package com.mifga.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS-facing control for BackgroundRideService - started when a ride begins,
 * stopped when it ends. See that class for what actually happens while it
 * runs (location tracking, hazard-proximity alerts, walkie-message polling,
 * all independent of the WebView so they keep working while the app is
 * backgrounded).
 */
@CapacitorPlugin(name = "BackgroundRide")
public class BackgroundRidePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String uid = call.getString("uid");
        String accessToken = call.getString("accessToken");
        String refreshToken = call.getString("refreshToken");
        Integer radiusMBoxed = call.getInt("radiusM", 100);
        // Force the primitive Intent.putExtra(String, int) overload - passing
        // the boxed Integer directly resolves to putExtra(String, Serializable)
        // instead (Java prefers a no-conversion match over unboxing), which
        // getIntExtra() on the receiving side then can't see at all.
        int radiusM = radiusMBoxed != null ? radiusMBoxed : 100;

        if (uid == null || accessToken == null) {
            call.reject("MISSING_SESSION");
            return;
        }

        Intent intent = new Intent(getContext(), BackgroundRideService.class);
        intent.putExtra("uid", uid);
        intent.putExtra("accessToken", accessToken);
        intent.putExtra("refreshToken", refreshToken);
        intent.putExtra("radiusM", radiusM);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        maybeRequestBatteryOptimizationExemption();
        call.resolve();
    }

    /**
     * The single biggest real-world reason a correctly-built foreground
     * service still gets killed: OEM battery managers (Samsung/Xiaomi/Huawei
     * especially) aggressively suspend background apps regardless of the
     * foreground service declaration, unless the user has granted this
     * exemption. Waze and other navigation apps prompt for the same thing.
     * Shows the system's own permission-style dialog - not a full settings
     * screen - so this is low-friction to ask at the moment it matters (ride
     * start), not proactively on every launch.
     */
    private void maybeRequestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            String packageName = getContext().getPackageName();
            if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + packageName));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
        } catch (Exception e) {
            // Some OEM builds restrict/ignore this intent entirely - not fatal,
            // the service still runs, just possibly less reliably in the background.
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), BackgroundRideService.class));
        call.resolve();
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        call.resolve(ret);
    }
}
