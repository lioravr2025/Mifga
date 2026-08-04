import Foundation
import Capacitor

/// JS-facing control for BackgroundRideManager - started when a ride begins,
/// stopped when it ends. Mirrors BackgroundRidePlugin.java's interface
/// exactly (same plugin name "BackgroundRide", same start/stop/isSupported
/// methods) so the existing TypeScript in src/lib/backgroundRide.ts needs no
/// changes to work on iOS too.
@objc(BackgroundRidePlugin)
public class BackgroundRidePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BackgroundRidePlugin"
    public let jsName = "BackgroundRide"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise)
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard let uid = call.getString("uid"), let accessToken = call.getString("accessToken") else {
            call.reject("MISSING_SESSION")
            return
        }
        let refreshToken = call.getString("refreshToken")
        let radiusM = call.getInt("radiusM") ?? 100

        BackgroundRideManager.shared.start(uid: uid, accessToken: accessToken, refreshToken: refreshToken, radiusM: radiusM)
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        BackgroundRideManager.shared.stop()
        call.resolve()
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": true])
    }
}
