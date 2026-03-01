import SwiftUI

// Newspaper-inspired design system matching foundervoice_app
// hsl() values converted to SwiftUI Color(red:green:blue:)
enum FlaxTheme {

    // MARK: - Backgrounds
    // hsl(42, 24%, 95%) → warm cream
    static let cream    = Color(red: 0.962, green: 0.955, blue: 0.938)
    // hsl(40, 20%, 92%) → beige
    static let beige    = Color(red: 0.936, green: 0.925, blue: 0.904)
    static let white    = Color.white

    // MARK: - Text
    // hsl(0, 0%, 10%) → near-black
    static let textPrimary = Color(white: 0.10)
    // hsl(0, 0%, 40%)
    static let textMuted   = Color(white: 0.40)
    // hsl(0, 0%, 60%)
    static let textFaint   = Color(white: 0.60)

    // MARK: - Borders
    // hsl(0, 0%, 80%)
    static let border      = Color(white: 0.80)
    // hsl(0, 0%, 65%)
    static let borderStrong = Color(white: 0.65)

    // MARK: - Semantic
    // hsl(35, 60%, 45%) — amber/warning, used as recording indicator
    static let amber   = Color(red: 0.72, green: 0.495, blue: 0.18)
    // hsl(142, 35%, 35%) — muted green
    static let success = Color(red: 0.228, green: 0.473, blue: 0.317)
    // hsl(0, 40%, 40%) — muted red
    static let error   = Color(red: 0.56, green: 0.24, blue: 0.24)
    // Dark gray accent
    static let accent  = Color(white: 0.25)

    // MARK: - Border Radius
    static let radiusSm: CGFloat = 2
    static let radiusMd: CGFloat = 4
    static let radiusLg: CGFloat = 6

    // MARK: - Shadow
    static func newspaperShadow() -> some View {
        return Rectangle()
            .shadow(color: .black.opacity(0.20), radius: 0, x: 2, y: 2)
    }
}

// MARK: - View Modifiers

extension View {
    func newspaperBorder(_ width: CGFloat = 1) -> some View {
        self.overlay(
            Rectangle()
                .stroke(FlaxTheme.border, lineWidth: width)
        )
    }

    func newspaperCard() -> some View {
        self
            .background(FlaxTheme.white)
            .cornerRadius(FlaxTheme.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: FlaxTheme.radiusMd)
                    .stroke(FlaxTheme.border, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.12), radius: 0, x: 2, y: 2)
    }
}

// MARK: - Font Helpers

extension Font {
    // IBM Plex Mono shipped as a system fallback; we use monospaced system font as equivalent
    static let flaxMono   = Font.system(.body, design: .monospaced)
    static let flaxMonoSm = Font.system(.caption, design: .monospaced)
    static let flaxMonoXs = Font.system(.caption2, design: .monospaced)

    // Merriweather equivalent — serif system font
    static let flaxSerif  = Font.system(.title3, design: .serif).bold()
    static let flaxSerifSm = Font.system(.subheadline, design: .serif)
}
