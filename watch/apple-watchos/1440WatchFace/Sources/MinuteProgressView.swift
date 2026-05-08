import SwiftUI

/// Reusable arc progress indicator. Draws a partial circle stroke from -90° (top).
struct MinuteProgressView: View {
    var progress: Double   // 0.0 – 1.0
    var color: Color
    var lineWidth: CGFloat = 2.8
    var clockwise: Bool    = true

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            ZStack {
                // Track (faint full circle)
                Circle()
                    .stroke(color.opacity(0.12), lineWidth: lineWidth)
                // Progress arc
                Circle()
                    .trim(from: 0, to: clockwise ? CGFloat(progress) : CGFloat(1 - progress))
                    .stroke(
                        color,
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: size, height: size)
        }
    }
}

#Preview {
    MinuteProgressView(progress: 0.6, color: .yellow)
        .frame(width: 120, height: 120)
        .background(Color.black)
}
