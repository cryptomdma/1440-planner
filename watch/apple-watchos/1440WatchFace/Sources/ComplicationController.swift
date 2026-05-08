import ClockKit
import SwiftUI

/// ClockKit complication data source for watchOS 7–9.
/// For watchOS 10+, use WidgetKit timeline instead.
class ComplicationController: NSObject, CLKComplicationDataSource {

    private var snap: WatchSnapshot? { WatchConnectivityManager.shared.snapshot }

    // MARK: - Complication Configuration

    func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
        let descriptors = [
            CLKComplicationDescriptor(
                identifier: "minuteCounter",
                displayName: "1440 Counter",
                supportedFamilies: [.modularSmall, .circularSmall, .utilitarianSmall]
            ),
            CLKComplicationDescriptor(
                identifier: "nextBlock",
                displayName: "1440 Next Block",
                supportedFamilies: [.modularLarge, .utilitarianLarge, .graphicRectangular]
            ),
        ]
        handler(descriptors)
    }

    // MARK: - Timeline Population

    func getCurrentTimelineEntry(
        for complication: CLKComplication,
        withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void
    ) {
        handler(makeEntry(for: complication, date: Date()))
    }

    func getTimelineEntries(
        for complication: CLKComplication,
        after date: Date,
        limit: Int,
        withHandler handler: @escaping ([CLKComplicationTimelineEntry]?) -> Void
    ) {
        handler(nil)
    }

    // MARK: - Private

    private func makeEntry(for complication: CLKComplication, date: Date) -> CLKComplicationTimelineEntry? {
        let template: CLKComplicationTemplate
        let cal = Calendar.current
        let h   = cal.component(.hour, from: date)
        let m   = cal.component(.minute, from: date)
        let cur = h * 60 + m

        let mode   = snap?.countMode ?? "up"
        let disp   = mode == "down" ? 1440 - cur : cur
        let dispStr = "\(disp)"

        switch complication.family {
        case .modularSmall:
            let t = CLKComplicationTemplateModularSmallSimpleText()
            t.textProvider = CLKSimpleTextProvider(text: dispStr)
            template = t
        case .circularSmall:
            let t = CLKComplicationTemplateCircularSmallSimpleText()
            t.textProvider = CLKSimpleTextProvider(text: dispStr)
            template = t
        case .utilitarianSmall:
            let t = CLKComplicationTemplateUtilitarianSmallFlat()
            t.textProvider = CLKSimpleTextProvider(text: dispStr)
            template = t
        case .modularLarge:
            let t = CLKComplicationTemplateModularLargeStandardBody()
            t.headerTextProvider = CLKSimpleTextProvider(text: "1440")
            t.body1TextProvider  = CLKSimpleTextProvider(
                text: snap?.nextBlock?.title ?? "No blocks"
            )
            t.body2TextProvider  = CLKSimpleTextProvider(
                text: snap?.nextBlock?.timeStr ?? "--"
            )
            template = t
        case .utilitarianLarge:
            let t = CLKComplicationTemplateUtilitarianLargeFlat()
            t.textProvider = CLKSimpleTextProvider(
                text: snap?.nextBlock.map { "\($0.title) \($0.timeStr ?? "")" } ?? "1440"
            )
            template = t
        default:
            return nil
        }

        return CLKComplicationTimelineEntry(date: date, complicationTemplate: template)
    }

    // MARK: - Placeholder

    func getLocalizableSampleTemplate(
        for complication: CLKComplication,
        withHandler handler: @escaping (CLKComplicationTemplate?) -> Void
    ) {
        handler(nil)
    }
}
