import Foundation
import CoreLocation
import UserNotifications
import AudioToolbox
import AVFoundation

/// iOS equivalent of BackgroundRideService.java: keeps ride tracking alive
/// while the app is backgrounded/screen is off - tracks location, polls for
/// nearby hazards and new walkie-talkie messages, and alerts/plays audio,
/// independent of the WebView (which iOS, like Android, pauses once the app
/// isn't in the foreground).
///
/// The mechanism is necessarily different from Android's foreground service:
/// iOS has no equivalent construct. Instead this relies on the "location"
/// UIBackgroundMode (declared in Info.plist) + CLLocationManager's
/// allowsBackgroundLocationUpdates, which is what keeps the process alive to
/// run the poll timer below - the same architecture Waze/Life360-style apps
/// use. Unlike Android, no persistent notification is needed to keep this
/// running - iOS shows its own system-level background-location indicator.
///
/// Same trade-off as the Android version, and for the same reason (no push
/// pipeline / Firebase Cloud Function wired up yet): deliberately
/// polling-based (every ~12s), not push-based, so alerts land a few seconds
/// late rather than instantly.
final class BackgroundRideManager: NSObject, CLLocationManagerDelegate {
    static let shared = BackgroundRideManager()

    private static let supabaseURL = "https://tmmyimiubfnpkujulqll.supabase.co"
    private static let anonKey = "sb_publishable_2yytuXb8y5nQGCZqd5bquQ_t-ZEY7j7"
    private static let pollIntervalSeconds: TimeInterval = 12

    private let locationManager = CLLocationManager()
    private var lastLocation: CLLocation?
    private var pollTimer: Timer?

    private var uid: String?
    private var accessToken: String?
    private var refreshToken: String?
    private var radiusM: Double = 100
    private var alertedHazardIds = Set<String>()
    private var lastMessageCheckISO: String = BackgroundRideManager.isoNow()

    private var audioPlayer: AVAudioPlayer?

    private override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    func start(uid: String, accessToken: String, refreshToken: String?, radiusM: Int) {
        self.uid = uid
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.radiusM = Double(radiusM)
        self.alertedHazardIds.removeAll()
        self.lastMessageCheckISO = BackgroundRideManager.isoNow()

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }

        let status = locationManager.authorizationStatus
        if status == .notDetermined {
            locationManager.requestWhenInUseAuthorization()
        } else if status == .authorizedWhenInUse {
            // Shows the system's "Change to Always Allow?" upgrade prompt.
            // iOS doesn't always surface this immediately after a fresh
            // when-in-use grant - if it doesn't, the rider needs to flip it
            // manually in Settings > Mifga > Location > Always, same
            // real-world caveat as Android's battery-optimization exemption.
            locationManager.requestAlwaysAuthorization()
        }

        locationManager.startUpdatingLocation()
        startPolling()
    }

    func stop() {
        locationManager.stopUpdatingLocation()
        pollTimer?.invalidate()
        pollTimer = nil
        uid = nil
        accessToken = nil
        refreshToken = nil
        alertedHazardIds.removeAll()
        audioPlayer?.stop()
        audioPlayer = nil
    }

    // ------------------------------------------------------------------
    // CLLocationManagerDelegate
    // ------------------------------------------------------------------

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        lastLocation = locations.last
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Transient GPS errors are normal (e.g. momentarily no fix) - nothing
        // to do, the next successful update just picks back up.
    }

    // ------------------------------------------------------------------
    // Polling loop
    // ------------------------------------------------------------------

    private func startPolling() {
        pollTimer?.invalidate()
        let timer = Timer(timeInterval: Self.pollIntervalSeconds, repeats: true) { [weak self] _ in
            self?.pollHazards()
            self?.pollMessages()
        }
        RunLoop.main.add(timer, forMode: .common)
        pollTimer = timer
    }

    private func pollHazards() {
        guard let loc = lastLocation, let url = URL(string: "\(Self.supabaseURL)/rest/v1/hazards?removed=eq.false&select=id,type,lat,lng") else { return }
        authorizedRequest(url: url) { [weak self] data in
            guard let self = self, let data = data else { return }
            guard let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }
            for row in rows {
                guard let id = row["id"] as? String, let type = row["type"] as? String,
                      let lat = row["lat"] as? Double, let lng = row["lng"] as? Double else { continue }
                if self.alertedHazardIds.contains(id) { continue }
                let distance = loc.distance(from: CLLocation(latitude: lat, longitude: lng))
                if distance <= self.radiusM {
                    self.alertedHazardIds.insert(id)
                    self.alertHazard(type: type)
                }
            }
        }
    }

    private func alertHazard(type: String) {
        playSystemSound(forHazardType: type)
        let content = UNMutableNotificationContent()
        content.title = "Mifga"
        content.body = "מפגע בקרבתך: \(hebrewLabel(for: type))"
        content.sound = .default
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    private func hebrewLabel(for type: String) -> String {
        switch type {
        case "police": return "שוטר"
        case "inspector": return "פקח"
        default: return "מפגע"
        }
    }

    /// Two distinct, always-available system tones so a rider can tell
    /// police/inspector apart by ear without looking at the phone - same
    /// intent as Android's ToneGenerator pair, no bundled audio needed.
    private func playSystemSound(forHazardType type: String) {
        let soundID: SystemSoundID = (type == "police") ? 1005 : (type == "inspector") ? 1013 : 1007
        AudioServicesPlaySystemSound(soundID)
    }

    private func pollMessages() {
        guard let uid = uid else { return }
        let sinceISO = lastMessageCheckISO
        let nextCheckISO = Self.isoNow()

        fetchGroupIds(uid: uid) { [weak self] groupIds in
            guard let self = self else { return }
            let group = DispatchGroup()

            if !groupIds.isEmpty {
                group.enter()
                self.fetchNewMessages(
                    path: "walkie_group_messages",
                    filter: "group_id=in.(\(groupIds.joined(separator: ",")))&sent_at=gt.\(sinceISO)&sender_id=neq.\(uid)",
                    markDeliveredRpc: "mark_message_delivered",
                    idParam: "p_message_id",
                    notifBody: "התקבלה הודעה קולית מקבוצה"
                ) { group.leave() }
            }

            group.enter()
            self.fetchNewMessages(
                path: "friend_messages",
                filter: "recipient_id=eq.\(uid)&sent_at=gt.\(sinceISO)",
                markDeliveredRpc: "mark_friend_message_delivered",
                idParam: "p_message_id",
                notifBody: "התקבלה הודעה קולית מחבר"
            ) { group.leave() }

            group.notify(queue: .main) {
                self.lastMessageCheckISO = nextCheckISO
            }
        }
    }

    private func fetchGroupIds(uid: String, completion: @escaping ([String]) -> Void) {
        guard let url = URL(string: "\(Self.supabaseURL)/rest/v1/walkie_group_members?member_id=eq.\(uid)&status=eq.accepted&select=group_id") else {
            completion([])
            return
        }
        authorizedRequest(url: url) { data in
            guard let data = data, let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                completion([])
                return
            }
            completion(rows.compactMap { $0["group_id"] as? String })
        }
    }

    private func fetchNewMessages(path: String, filter: String, markDeliveredRpc: String, idParam: String, notifBody: String, completion: @escaping () -> Void) {
        guard let url = URL(string: "\(Self.supabaseURL)/rest/v1/\(path)?\(filter)&select=id,audio_url") else {
            completion()
            return
        }
        authorizedRequest(url: url) { [weak self] data in
            guard let self = self, let data = data, let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                completion()
                return
            }
            for row in rows {
                guard let id = row["id"] as? String, let audioUrl = row["audio_url"] as? String else { continue }
                self.playRemoteAudio(urlString: audioUrl)
                self.rpcCall(name: markDeliveredRpc, body: [idParam: id])
                let content = UNMutableNotificationContent()
                content.title = "Mifga"
                content.body = notifBody
                content.sound = .default
                UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
            }
            completion()
        }
    }

    private func playRemoteAudio(urlString: String) {
        guard let url = URL(string: urlString) else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self = self, let data = data else { return }
            DispatchQueue.main.async {
                do {
                    try AVAudioSession.sharedInstance().setCategory(.playback, mode: .voiceChat)
                    try AVAudioSession.sharedInstance().setActive(true)
                    self.audioPlayer = try AVAudioPlayer(data: data)
                    self.audioPlayer?.play()
                } catch {
                    // Playback failure isn't fatal - the local notification
                    // above already told the rider a message arrived.
                }
            }
        }.resume()
    }

    // ------------------------------------------------------------------
    // Networking - plain URLSession, no extra dependency. Refreshes the
    // access token once on a 401 and retries, since a ride can outlast a
    // ~1h token lifetime (same approach as the Android service).
    // ------------------------------------------------------------------

    private func authorizedRequest(url: URL, allowRetry: Bool = true, completion: @escaping (Data?) -> Void) {
        guard let accessToken = accessToken else {
            completion(nil)
            return
        }
        var request = URLRequest(url: url)
        request.setValue(Self.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            if let http = response as? HTTPURLResponse, http.statusCode == 401, allowRetry {
                self.refreshAccessToken { success in
                    if success {
                        self.authorizedRequest(url: url, allowRetry: false, completion: completion)
                    } else {
                        completion(nil)
                    }
                }
                return
            }
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                completion(nil)
                return
            }
            completion(data)
        }.resume()
    }

    private func rpcCall(name: String, body: [String: Any]) {
        guard let accessToken = accessToken, let url = URL(string: "\(Self.supabaseURL)/rest/v1/rpc/\(name)") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(Self.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: request) { _, _, _ in
            // Fire and forget, same as the Android service.
        }.resume()
    }

    private func refreshAccessToken(completion: @escaping (Bool) -> Void) {
        guard let refreshToken = refreshToken, let url = URL(string: "\(Self.supabaseURL)/auth/v1/token?grant_type=refresh_token") else {
            completion(false)
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(Self.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])

        URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
            guard let self = self,
                  let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let newAccessToken = json["access_token"] as? String else {
                completion(false)
                return
            }
            self.accessToken = newAccessToken
            if let newRefreshToken = json["refresh_token"] as? String {
                self.refreshToken = newRefreshToken
            }
            completion(true)
        }.resume()
    }

    private static func isoNow() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }
}
