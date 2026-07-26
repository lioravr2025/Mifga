package com.mifga.app;

import android.Manifest;
import android.content.pm.PackageManager;
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
 */
public class MainActivity extends BridgeActivity {
    private static final int PERMISSIONS_REQUEST_CODE = 1001;

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
            ActivityCompat.requestPermissions(this, toRequest.toArray(new String[0]), PERMISSIONS_REQUEST_CODE);
        }
    }
}
