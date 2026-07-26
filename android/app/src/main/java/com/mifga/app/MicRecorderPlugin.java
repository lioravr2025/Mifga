package com.mifga.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;

/**
 * Walkie-talkie audio capture/playback done entirely through native Android
 * APIs (MediaRecorder/MediaPlayer), bypassing the WebView's getUserMedia() +
 * onPermissionRequest() bridge. That bridge is what MainActivity's
 * MicSafeWebChromeClient previously tried to patch, but it kept failing with
 * NotAllowedError even with RECORD_AUDIO already granted at the OS level -
 * a known class of unreliable behavior across Android WebView versions/OEMs.
 * This plugin sidesteps that layer completely instead of continuing to
 * patch it.
 */
@CapacitorPlugin(name = "MicRecorder")
public class MicRecorderPlugin extends Plugin {
    private MediaRecorder recorder;
    private File outputFile;
    private MediaPlayer player;

    @PluginMethod
    public void start(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("MIC_PERMISSION_DENIED");
            return;
        }
        if (recorder != null) {
            call.reject("ALREADY_RECORDING");
            return;
        }
        try {
            outputFile = File.createTempFile("mifga_walkie_", ".m4a", getContext().getCacheDir());
            MediaRecorder r = new MediaRecorder();
            r.setAudioSource(MediaRecorder.AudioSource.MIC);
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            r.setAudioEncodingBitRate(64000);
            r.setAudioSamplingRate(44100);
            r.setOutputFile(outputFile.getAbsolutePath());
            r.prepare();
            r.start();
            recorder = r;
            call.resolve();
        } catch (Exception e) {
            recorder = null;
            call.reject("START_FAILED: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (recorder == null) {
            call.reject("NOT_RECORDING");
            return;
        }
        try {
            recorder.stop();
            recorder.release();
            recorder = null;

            byte[] bytes = new byte[(int) outputFile.length()];
            try (FileInputStream fis = new FileInputStream(outputFile)) {
                int total = 0;
                while (total < bytes.length) {
                    int n = fis.read(bytes, total, bytes.length - total);
                    if (n < 0) break;
                    total += n;
                }
            }
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            outputFile.delete();
            outputFile = null;

            JSObject ret = new JSObject();
            ret.put("base64", base64);
            ret.put("mimeType", "audio/mp4");
            call.resolve(ret);
        } catch (Exception e) {
            recorder = null;
            call.reject("STOP_FAILED: " + e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("NO_URL");
            return;
        }
        try {
            if (player != null) {
                player.release();
                player = null;
            }
            MediaPlayer mp = new MediaPlayer();
            mp.setDataSource(getContext(), Uri.parse(url));
            mp.setOnPreparedListener(MediaPlayer::start);
            mp.setOnCompletionListener(mediaPlayer -> {
                mediaPlayer.release();
                if (player == mediaPlayer) player = null;
            });
            mp.setOnErrorListener((mediaPlayer, what, extra) -> {
                mediaPlayer.release();
                if (player == mediaPlayer) player = null;
                return true;
            });
            mp.prepareAsync();
            player = mp;
            call.resolve();
        } catch (Exception e) {
            call.reject("PLAY_FAILED: " + e.getMessage());
        }
    }
}
