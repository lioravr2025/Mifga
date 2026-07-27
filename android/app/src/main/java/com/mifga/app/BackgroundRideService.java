package com.mifga.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Keeps ride tracking alive while the app is backgrounded/screen is off,
 * the way Waze does: a foreground service (required by Android to run
 * reliably outside the app's own process lifecycle) that independently
 * tracks location, polls for nearby hazards and new walkie-talkie messages,
 * and alerts/plays audio natively - none of this depends on the WebView's
 * JS, which Android pauses once the app isn't in the foreground.
 *
 * Deliberately polling-based (every ~12s), not push-based: a real push
 * pipeline needs Firebase Cloud Messaging (a separate project, server-side
 * triggers on every insert, its own native plugin) which is a substantially
 * bigger undertaking on top of this. Polling means alerts land a few
 * seconds later than instantly, and OEM battery managers on some phones
 * (Samsung/Xiaomi/Huawei especially) may still kill this service despite
 * being a correctly-declared foreground service - that's an OS/manufacturer
 * restriction outside what any app can fully control; the fix on the
 * user's end is normally "remove from battery optimization" for Mifga.
 */
public class BackgroundRideService extends Service {
    private static final String TAG = "MifgaRideService";
    private static final String CHANNEL_ID = "mifga_ride_tracking";
    private static final int NOTIF_ID = 4201;
    private static final String SUPABASE_URL = "https://tmmyimiubfnpkujulqll.supabase.co";
    private static final String ANON_KEY = "sb_publishable_2yytuXb8y5nQGCZqd5bquQ_t-ZEY7j7";
    private static final long POLL_INTERVAL_S = 12;

    private String uid;
    private String accessToken;
    private String refreshToken;
    private int radiusM = 100;

    private LocationManager locationManager;
    private volatile Location lastLocation;
    private LocationListener locationListener;
    private ScheduledExecutorService executor;
    private ScheduledFuture<?> pollTask;
    private final Set<String> alertedHazardIds = Collections.synchronizedSet(new java.util.HashSet<>());
    private volatile String lastMessageCheckIso;
    private PowerManager.WakeLock wakeLock;
    private MediaPlayer voicePlayer;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            uid = intent.getStringExtra("uid");
            accessToken = intent.getStringExtra("accessToken");
            refreshToken = intent.getStringExtra("refreshToken");
            radiusM = intent.getIntExtra("radiusM", 100);
        }
        // Must hold location permission *before* calling startForeground() with
        // foregroundServiceType="location" - Android 14+ can throw
        // SecurityException/ForegroundServiceStartNotAllowedException at that
        // call itself otherwise, not just fail silently later.
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "no location permission, refusing to start");
            stopSelf();
            return START_NOT_STICKY;
        }
        lastMessageCheckIso = isoNow();
        startForeground(NOTIF_ID, buildNotification("עוקבים אחרי הנסיעה שלך ברקע"));
        acquireWakeLock();
        startLocationUpdates();
        startPolling();
        // Not START_STICKY - if the OS kills this service, a restart would
        // arrive with no ride credentials anyway (a plain Intent restart
        // carries no extras), so there's nothing useful to resume automatically.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (pollTask != null) pollTask.cancel(true);
        if (executor != null) executor.shutdownNow();
        if (locationManager != null && locationListener != null) {
            try {
                locationManager.removeUpdates(locationListener);
            } catch (SecurityException ignored) {}
        }
        if (voicePlayer != null) {
            try {
                voicePlayer.release();
            } catch (Exception ignored) {}
            voicePlayer = null;
        }
        releaseWakeLock();
    }

    // ------------------------------------------------------------------
    // Notification
    // ------------------------------------------------------------------

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "מעקב נסיעה ברקע",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("מציג שהמעקב אחרי הנסיעה והתרעות המפגעים ממשיכים לפעול ברקע");
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.createNotificationChannel(channel);
    }

    private Notification buildNotification(String text) {
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openApp, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Mifga פעילה")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(text));
    }

    // ------------------------------------------------------------------
    // Location
    // ------------------------------------------------------------------

    private void startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "no location permission, stopping");
            stopSelf();
            return;
        }
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                lastLocation = location;
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}

            @Override
            public void onProviderEnabled(String provider) {}

            @Override
            public void onProviderDisabled(String provider) {}
        };
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000, 10, locationListener, Looper.getMainLooper());
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000, 10, locationListener, Looper.getMainLooper());
            }
            Location last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last == null) last = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            if (last != null) lastLocation = last;
        } catch (SecurityException e) {
            Log.w(TAG, "location updates failed", e);
        }
    }

    // ------------------------------------------------------------------
    // Polling loop
    // ------------------------------------------------------------------

    private void startPolling() {
        executor = Executors.newSingleThreadScheduledExecutor();
        pollTask = executor.scheduleWithFixedDelay(this::pollOnceSafely, 2, POLL_INTERVAL_S, TimeUnit.SECONDS);
    }

    private void pollOnceSafely() {
        try {
            pollHazards();
            pollMessages();
        } catch (Exception e) {
            Log.w(TAG, "poll cycle failed", e);
        }
    }

    private void pollHazards() {
        Location loc = lastLocation;
        if (loc == null) return;
        try {
            String url = SUPABASE_URL + "/rest/v1/hazards?removed=eq.false&select=id,type,lat,lng";
            String body = httpGet(url);
            if (body == null) return;
            JSONArray arr = new JSONArray(body);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject h = arr.getJSONObject(i);
                String id = h.getString("id");
                String type = h.getString("type");
                if (alertedHazardIds.contains(id)) continue;
                double lat = h.getDouble("lat");
                double lng = h.getDouble("lng");
                double distance = haversineMeters(loc.getLatitude(), loc.getLongitude(), lat, lng);
                if (distance <= radiusM) {
                    alertedHazardIds.add(id);
                    playAlertTone(type);
                    mainHandler.post(() -> updateNotification("מפגע בקרבתך: " + hebrewLabel(type)));
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "pollHazards failed", e);
        }
    }

    private String hebrewLabel(String type) {
        if ("police".equals(type)) return "שוטר";
        if ("inspector".equals(type)) return "פקח";
        return "מפגע";
    }

    private void pollMessages() {
        if (uid == null) return;
        try {
            // 1. which groups am I an accepted member of
            List<String> groupIds = new ArrayList<>();
            String membersBody = httpGet(SUPABASE_URL + "/rest/v1/walkie_group_members?member_id=eq." + uid + "&status=eq.accepted&select=group_id");
            if (membersBody != null) {
                JSONArray arr = new JSONArray(membersBody);
                for (int i = 0; i < arr.length(); i++) groupIds.add(arr.getJSONObject(i).getString("group_id"));
            }

            String sinceParam = "sent_at=gt." + lastMessageCheckIso;
            String nextCheck = isoNow();

            // 2. new group messages from others
            if (!groupIds.isEmpty()) {
                StringBuilder idsIn = new StringBuilder("(");
                for (int i = 0; i < groupIds.size(); i++) {
                    if (i > 0) idsIn.append(",");
                    idsIn.append(groupIds.get(i));
                }
                idsIn.append(")");
                String url = SUPABASE_URL + "/rest/v1/walkie_group_messages?group_id=in." + idsIn + "&" + sinceParam + "&sender_id=neq." + uid + "&select=id,audio_url";
                String body = httpGet(url);
                if (body != null) {
                    JSONArray arr = new JSONArray(body);
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject m = arr.getJSONObject(i);
                        playRemoteAudio(m.getString("audio_url"));
                        rpcCall("mark_message_delivered", new JSONObject().put("p_message_id", m.getString("id")));
                        mainHandler.post(() -> updateNotification("התקבלה הודעה קולית מקבוצה"));
                    }
                }
            }

            // 3. new direct messages to me
            String friendUrl = SUPABASE_URL + "/rest/v1/friend_messages?recipient_id=eq." + uid + "&" + sinceParam + "&select=id,audio_url";
            String friendBody = httpGet(friendUrl);
            if (friendBody != null) {
                JSONArray arr = new JSONArray(friendBody);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject m = arr.getJSONObject(i);
                    playRemoteAudio(m.getString("audio_url"));
                    rpcCall("mark_friend_message_delivered", new JSONObject().put("p_message_id", m.getString("id")));
                    mainHandler.post(() -> updateNotification("התקבלה הודעה קולית מחבר"));
                }
            }

            lastMessageCheckIso = nextCheck;
        } catch (Exception e) {
            Log.w(TAG, "pollMessages failed", e);
        }
    }

    // ------------------------------------------------------------------
    // Audio: native tones for hazard proximity, native playback for
    // downloaded voice messages - both independent of the WebView.
    // ------------------------------------------------------------------

    private void playAlertTone(String type) {
        try {
            int stream = "police".equals(type) || "inspector".equals(type) ? AudioManager.STREAM_ALARM : AudioManager.STREAM_NOTIFICATION;
            ToneGenerator tg = new ToneGenerator(stream, 90);
            int tone = "police".equals(type)
                ? ToneGenerator.TONE_CDMA_HIGH_SS
                : "inspector".equals(type)
                ? ToneGenerator.TONE_CDMA_MED_SS
                : ToneGenerator.TONE_PROP_BEEP;
            tg.startTone(tone, 1200);
            mainHandler.postDelayed(tg::release, 1500);
        } catch (Exception e) {
            Log.w(TAG, "playAlertTone failed", e);
        }
    }

    private void playRemoteAudio(String urlStr) {
        try {
            byte[] bytes = httpGetBytes(urlStr);
            if (bytes == null) return;
            File temp = File.createTempFile("mifga_bg_voice_", ".m4a", getCacheDir());
            try (FileOutputStream fos = new FileOutputStream(temp)) {
                fos.write(bytes);
            }
            mainHandler.post(() -> {
                try {
                    if (voicePlayer != null) {
                        voicePlayer.release();
                    }
                    MediaPlayer mp = new MediaPlayer();
                    mp.setAudioAttributes(
                        new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
                    );
                    mp.setDataSource(temp.getAbsolutePath());
                    mp.setOnCompletionListener(mediaPlayer -> {
                        mediaPlayer.release();
                        temp.delete();
                        if (voicePlayer == mediaPlayer) voicePlayer = null;
                    });
                    mp.setOnErrorListener((mediaPlayer, what, extra) -> {
                        mediaPlayer.release();
                        temp.delete();
                        if (voicePlayer == mediaPlayer) voicePlayer = null;
                        return true;
                    });
                    mp.prepare();
                    mp.start();
                    voicePlayer = mp;
                } catch (Exception e) {
                    Log.w(TAG, "voice playback failed", e);
                    temp.delete();
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "playRemoteAudio failed", e);
        }
    }

    // ------------------------------------------------------------------
    // Networking - plain HttpURLConnection, no extra dependency. Refreshes
    // the access token once on a 401 and retries, since a ride can outlast
    // a ~1h token lifetime.
    // ------------------------------------------------------------------

    private String httpGet(String urlStr) {
        byte[] bytes = httpGetBytes(urlStr, true);
        return bytes == null ? null : new String(bytes, StandardCharsets.UTF_8);
    }

    private byte[] httpGetBytes(String urlStr) {
        return httpGetBytes(urlStr, false);
    }

    private byte[] httpGetBytes(String urlStr, boolean allowRetry) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("apikey", ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            int code = conn.getResponseCode();
            if (code == 401 && allowRetry && refreshAccessToken()) {
                conn.disconnect();
                return httpGetBytes(urlStr, false);
            }
            if (code < 200 || code >= 300) return null;
            return readAll(conn.getInputStream());
        } catch (Exception e) {
            Log.w(TAG, "httpGet failed: " + urlStr, e);
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void rpcCall(String fn, JSONObject body) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(SUPABASE_URL + "/rest/v1/rpc/" + fn);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("apikey", ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "application/json");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            conn.getResponseCode(); // fire and forget, drain response
        } catch (Exception e) {
            Log.w(TAG, "rpcCall failed: " + fn, e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private boolean refreshAccessToken() {
        if (refreshToken == null) return false;
        HttpURLConnection conn = null;
        try {
            URL url = new URL(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("apikey", ANON_KEY);
            conn.setRequestProperty("Content-Type", "application/json");
            JSONObject body = new JSONObject().put("refresh_token", refreshToken);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) return false;
            JSONObject json = new JSONObject(new String(readAll(conn.getInputStream()), StandardCharsets.UTF_8));
            accessToken = json.getString("access_token");
            if (json.has("refresh_token")) refreshToken = json.getString("refresh_token");
            return true;
        } catch (Exception e) {
            Log.w(TAG, "refreshAccessToken failed", e);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[4096];
        int n;
        while ((n = in.read(chunk)) != -1) buffer.write(chunk, 0, n);
        return buffer.toByteArray();
    }

    // ------------------------------------------------------------------
    // Misc
    // ------------------------------------------------------------------

    private static double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private static String isoNow() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Mifga::RideTrackingWakeLock");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(6 * 60 * 60 * 1000L); // safety cap: 6h, in case stop() is somehow never called
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }
}
