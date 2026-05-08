import SwiftUI

/// Full-face watch face view matching the SVG prototype (App.jsx WatchFace component).
/// Observes WatchConnectivityManager and re-renders when a new snapshot arrives.
struct WatchFaceView: View {
    @ObservedObject private var wc = WatchConnectivityManager.shared
    @State private var currentMinute: Int = todayMinute()

    let timer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    private var snap: WatchSnapshot? { wc.snapshot }
    private var countMode: String  { snap?.countMode ?? "up" }
    private var accentColor: Color { countMode == "down" ? Color(hex: "#38BDF8") : Color(hex: "#F59E0B") }
    private var displayVal: Int    { countMode == "down" ? 1440 - currentMinute : currentMinute }
    private var progress: Double   { Double(currentMinute) / 1440.0 }

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let cx   = size / 2
            let cy   = size / 2
            let r    = size * 0.40

            ZStack {
                // Background
                Color(hex: "#07090f").ignoresSafeArea()

                Canvas { ctx, canvasSize in
                    let center = CGPoint(x: cx, y: cy)

                    // Outer ring
                    let outerPath = Path(ellipseIn: CGRect(
                        x: cx - r - r * 0.125, y: cy - r - r * 0.125,
                        width: (r + r * 0.125) * 2, height: (r + r * 0.125) * 2
                    ))
                    ctx.stroke(outerPath, with: .color(accentColor.opacity(0.55)), lineWidth: 1.5)

                    // 96 tick marks
                    for i in 0..<96 {
                        let angle  = (Double(i) / 96.0) * 360.0 - 90.0
                        let rad    = angle * .pi / 180
                        let major  = i % 4 == 0
                        let inner  = r + (major ? -r * 0.06 : r * 0.01)
                        let outer2 = r + r * 0.06
                        var tick = Path()
                        tick.move(to: CGPoint(x: cx + inner * cos(rad), y: cy + inner * sin(rad)))
                        tick.addLine(to: CGPoint(x: cx + outer2 * cos(rad), y: cy + outer2 * sin(rad)))
                        ctx.stroke(tick, with: .color(major ? accentColor.opacity(0.9) : Color(hex: "#3d4f66").opacity(0.7)),
                                   lineWidth: major ? 1.8 : 0.6)
                    }

                    // Event arcs
                    if let events = snap?.events {
                        for ev in events {
                            let arcR   = r - r * 0.20
                            let sAngle = (Double(ev.startMinute) / 1440.0) * 360.0 - 90.0
                            let eAngle = (Double(ev.startMinute + ev.durationMinutes) / 1440.0) * 360.0 - 90.0
                            var arc = Path()
                            arc.addArc(center: center, radius: arcR,
                                       startAngle: .degrees(sAngle), endAngle: .degrees(eAngle),
                                       clockwise: false)
                            ctx.stroke(arc, with: .color(Color(hex: ev.color).opacity(0.7)), lineWidth: 4.5)
                        }
                    }

                    // Progress arc
                    let arcR2  = r - r * 0.10
                    let endAngle = countMode == "down"
                        ? -90.0 - progress * 360.0  // shrinks
                        : -90.0 + progress * 360.0  // grows
                    var progArc = Path()
                    progArc.addArc(center: center, radius: arcR2,
                                   startAngle: .degrees(-90), endAngle: .degrees(endAngle),
                                   clockwise: countMode == "down")
                    ctx.stroke(progArc, with: .color(accentColor.opacity(0.9)),
                               style: StrokeStyle(lineWidth: 2.8, lineCap: .round))

                    // Center dial background
                    let dialR = r * 0.41
                    let dialRect = CGRect(x: cx - dialR, y: cy - dialR, width: dialR * 2, height: dialR * 2)
                    ctx.fill(Path(ellipseIn: dialRect), with: .color(Color(hex: "#07090f")))
                    ctx.stroke(Path(ellipseIn: dialRect), with: .color(Color(hex: "#1f2d42")), lineWidth: 1)

                    // Minute hand
                    let handAngle = (Double(currentMinute) / 1440.0) * 360.0 - 90.0
                    let handRad   = handAngle * .pi / 180
                    let handLen   = r * 0.62
                    var hand = Path()
                    hand.move(to: center)
                    hand.addLine(to: CGPoint(x: cx + handLen * cos(handRad), y: cy + handLen * sin(handRad)))
                    ctx.stroke(hand, with: .color(accentColor), style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
                    ctx.fill(Path(ellipseIn: CGRect(x: cx - 3.5, y: cy - 3.5, width: 7, height: 7)),
                             with: .color(accentColor))
                }

                // Text overlays (Canvas text support is limited in watchOS < 9)
                VStack(spacing: 2) {
                    Text("\(displayVal)")
                        .font(.system(size: size * 0.095, weight: .bold, design: .monospaced))
                        .foregroundColor(accentColor)
                    Text(countMode == "down" ? "MIN LEFT" : "MIN ELAPSED")
                        .font(.system(size: size * 0.038, design: .monospaced))
                        .foregroundColor(Color(hex: "#64748b"))
                    Text(minuteToTimeStr(currentMinute))
                        .font(.system(size: size * 0.054, design: .monospaced))
                        .foregroundColor(Color(hex: "#94a3b8"))
                }
            }
            .frame(width: size, height: size)
        }
        .onReceive(timer) { _ in currentMinute = todayMinute() }
    }
}

// MARK: - Helpers

private func todayMinute() -> Int {
    let c = Calendar.current.dateComponents([.hour, .minute], from: Date())
    return (c.hour ?? 0) * 60 + (c.minute ?? 0)
}

private func minuteToTimeStr(_ m: Int) -> String {
    let h24 = (m / 60) % 24
    let mn  = m % 60
    let hh  = h24 == 0 ? 12 : (h24 > 12 ? h24 - 12 : h24)
    let ap  = h24 < 12 ? "AM" : "PM"
    return String(format: "%d:%02d %@", hh, mn, ap)
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8)  & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
