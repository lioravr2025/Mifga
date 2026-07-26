package com.mifga.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
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
        super.onCreate(savedInstanceState);

        String[] needed = {
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        };

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
}
