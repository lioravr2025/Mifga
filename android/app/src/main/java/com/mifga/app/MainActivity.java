package com.mifga.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.ArrayList;
import java.util.List;

/**
 * Requests every runtime permission the app actually uses (mic for
 * walkie-talkie, camera for hazard photos, location for the map/ride
 * alerts/presence) right at launch, ahead of time.
 *
 * The WebView bridges getUserMedia()/geolocation to the matching Android
 * permission automatically, but only once that permission is already
 * granted at the OS level - it doesn't reliably trigger the first-time
 * request dialog itself. Asking upfront here removes that uncertainty
 * instead of depending on the WebView doing it lazily on first use.
 *
 * NOTE on background location: this requests ACCESS_BACKGROUND_LOCATION
 * (Android requires it as a *separate* second step, after foreground
 * location is already granted - bundling it into the first prompt is
 * disallowed on Android 11+). Getting the permission granted is only half
 * of "works like Waze with the screen off/app closed", though - the JS
 * running in the WebView still pauses when the app isn't in the
 * foreground, permission or not. Actually alerting in the background
 * needs a real Android foreground service (a persistent notification +
 * native location callbacks + native audio playback, independent of the
 * WebView) - that's a separate, substantially larger piece of native
 * work this permission request alone does not provide.
 */
public class MainActivity extends BridgeActivity {
    private static final int FOREGROUND_PERMISSIONS_REQUEST_CODE = 1001;
    private static final int BACKGROUND_LOCATION_REQUEST_CODE = 1002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before super.onCreate() - that's what builds the
        // Bridge from the plugin list.
        registerPlugin(MicRecorderPlugin.class);
        registerPlugin(BackgroundRidePlugin.class);
        super.onCreate(savedInstanceState);

        // Capacitor's default WebChromeClient grants getUserMedia() (mic/camera)
        // via an async ActivityResultLauncher, and Android invokes
        // onPermissionRequest() off the UI thread - in practice that grant
        // sometimes never resolves, so JS sees a NotAllowedError even though the
        // OS-level permission (requested below) is already held. Replacing it
        // with a synchronous, UI-thread grant based on the OS permission we
        // already have removes that failure mode for the walkie-talkie recorder.
        getBridge().getWebView().setWebChromeClient(new MicSafeWebChromeClient(getBridge()));

        List<String> needed = new ArrayList<>(
            java.util.Arrays.asList(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CAMERA,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        );
        // Without this, BackgroundRideService's persistent notification silently
        // doesn't show on Android 13+ (the service can still run, just invisibly).
        if (Build.VERSION.SDK_INT >= 33) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        List<String> toRequest = new ArrayList<>();
        for (String permission : needed) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                toRequest.add(permission);
            }
        }

        if (!toRequest.isEmpty()) {
            ActivityCompat.requestPermissions(this, toRequest.toArray(new String[0]), FOREGROUND_PERMISSIONS_REQUEST_CODE);
        } else {
            maybeRequestBackgroundLocation();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == FOREGROUND_PERMISSIONS_REQUEST_CODE) {
            maybeRequestBackgroundLocation();
        }
    }

    private void maybeRequestBackgroundLocation() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return; // permission didn't exist before Android 10

        boolean hasForeground = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean hasBackground = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (hasForeground && !hasBackground) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.ACCESS_BACKGROUND_LOCATION },
                BACKGROUND_LOCATION_REQUEST_CODE
            );
        }
    }

    /**
     * Same as Capacitor's BridgeWebChromeClient (file chooser, alerts, geolocation
     * prompts all still work via the parent class) except for mic/camera capture:
     * grants immediately on the UI thread if the OS permission is already held,
     * instead of relying on Capacitor's async permission-launcher path.
     */
    private static class MicSafeWebChromeClient extends BridgeWebChromeClient {
        private final MainActivity activity;

        MicSafeWebChromeClient(com.getcapacitor.Bridge bridge) {
            super(bridge);
            this.activity = (MainActivity) bridge.getActivity();
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            activity.runOnUiThread(() -> {
                List<String> toGrant = new ArrayList<>();
                for (String resource : request.getResources()) {
                    if (
                        resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                        ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                    ) {
                        toGrant.add(resource);
                    } else if (
                        resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
                        ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                    ) {
                        toGrant.add(resource);
                    }
                }
                if (!toGrant.isEmpty()) {
                    request.grant(toGrant.toArray(new String[0]));
                } else {
                    request.deny();
                }
            });
        }
    }
}
