import Foundation
import WatchConnectivity

/// WatchSnapshot mirrors the TypeScript interface in watchSync.ts.
struct WatchSnapshot: Codable {
    struct EventEntry: Codable {
        let startMinute:     Int
        let durationMinutes: Int
        let categoryId:      String
        let color:           String
    }
    struct BlockRef: Codable {
        let title:    String
        let endsAt:   Int?
        let startsAt: Int?
        let timeStr:  String?
    }

    let version:       Int
    let date:          String
    let currentMinute: Int
    let countMode:     String
    let wakeMinute:    Int
    let sleepMinute:   Int
    let events:        [EventEntry]
    let currentBlock:  BlockRef?
    let nextBlock:     BlockRef?
}

/// Singleton ObservableObject that manages the WCSession lifecycle.
/// WatchFaceView observes `snapshot` and re-renders on change.
final class WatchConnectivityManager: NSObject, ObservableObject {
    static let shared = WatchConnectivityManager()

    @Published var snapshot: WatchSnapshot?

    private override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    /// Called by phone-side React Native module to push an update.
    func sendSnapshot(_ snapshot: WatchSnapshot) {
        guard WCSession.default.isReachable else { return }
        if let data = try? JSONEncoder().encode(snapshot),
           let json = String(data: data, encoding: .utf8) {
            WCSession.default.sendMessage(["snapshot": json], replyHandler: nil, errorHandler: nil)
        }
    }
}

extension WatchConnectivityManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let json = message["snapshot"] as? String,
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(WatchSnapshot.self, from: data) else { return }
        DispatchQueue.main.async { self.snapshot = decoded }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        guard let json = applicationContext["snapshot"] as? String,
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(WatchSnapshot.self, from: data) else { return }
        DispatchQueue.main.async { self.snapshot = decoded }
    }

    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
    #endif
}
