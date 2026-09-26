package com.planner1440.watchface

import android.content.Context
import androidx.wear.watchface.complications.data.*
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import org.json.JSONObject

/**
 * Complication data sources backed by the last WatchSnapshot the phone sent
 * (SharedPreferences, written by [DataLayerClient]).
 *
 * ## Why there are two "count" sources rather than one
 *
 * The Watch Face Format face in ../wff wants to render the headline figure *itself*, from
 * the watch's own clock, so it ticks every minute instead of waiting for an update. It only
 * needs to know which direction to count. Getting that one bit across turned out to be the
 * hard part, because on this runtime (Galaxy Watch 7, Wear OS 6) **complication data reaches
 * a WFF face only as display strings**:
 *
 *   - `[COMPLICATION.RANGED_VALUE]`, `[COMPLICATION.RANGED_MIN]` and `[COMPLICATION.RANGED_MAX]`
 *     all evaluate to 0, whatever the source sends. Tried at format version 1 and 2.
 *   - `[COMPLICATION.TEXT]` substitutes correctly with `%s` but is not coerced to a number,
 *     so `[COMPLICATION.TEXT] * 2` is also 0.
 *
 * So no arithmetic and no conditional can be driven from phone data. What *is* observable
 * is whether a slot has data at all: a `<Complication>` block does not render when its slot
 * is EMPTY. Hence [CountUpComplicationService] and [CountDownComplicationService], which
 * return data only in their own mode and null in the other. The face stacks both in the
 * same box, so exactly one is ever visible, each with its own colour and live expression.
 *
 * [MinuteCounterComplicationService] is the plain SHORT_TEXT number, kept because it is the
 * useful thing to put in someone else's watch face; our face no longer uses it.
 */

private const val MODE_DOWN = "down"

private fun Context.snapshot(): JSONObject? {
    val json = getSharedPreferences(DataLayerClient.PREFS_NAME, Context.MODE_PRIVATE)
        .getString(DataLayerClient.PREFS_KEY, null) ?: return null
    return try { JSONObject(json) } catch (e: Exception) { null }
}

/** True when the phone is counting down. Defaults to counting up with no snapshot yet. */
private fun Context.countsDown(): Boolean =
    snapshot()?.optString("countMode", "up") == MODE_DOWN

private fun watchMinuteOfDay(): Int = java.time.LocalTime.now().let { it.hour * 60 + it.minute }

private fun shortText(text: String, title: String?, description: String) =
    ShortTextComplicationData.Builder(
        text = PlainComplicationText.Builder(text).build(),
        contentDescription = PlainComplicationText.Builder(description).build()
    ).apply {
        if (title != null) setTitle(PlainComplicationText.Builder(title).build())
    }.build()

/**
 * Renders only while the phone is in the requested count mode; null (EMPTY) otherwise,
 * which is what makes the matching half of the face disappear.
 */
abstract class CountModeComplicationService(
    private val wantDown: Boolean
) : SuspendingComplicationDataSourceService() {

    private val title get() = if (wantDown) "MIN LEFT" else "MIN ELAPSED"
    private val description get() = if (wantDown) "Minutes remaining today" else "Minutes elapsed today"

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        if (type != ComplicationType.SHORT_TEXT) null
        else shortText(if (wantDown) "720" else "720", title, description)

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        // The other half is showing. This must be an explicit NoData, not null: null means
        // "no change" to the system, so the slot kept whatever it showed last and, after the
        // first mode flip, both figures were on screen at once.
        if (countsDown() != wantDown) return NoDataComplicationData()
        val minute = watchMinuteOfDay()
        // Our own face ignores this number and computes it from the watch clock; it is here
        // so the source still reads correctly in an ordinary slot on another face.
        return shortText(
            text  = (if (wantDown) 1440 - minute else minute).toString(),
            title = title,
            description = description
        )
    }
}

class CountUpComplicationService   : CountModeComplicationService(wantDown = false)
class CountDownComplicationService : CountModeComplicationService(wantDown = true)

/** Plain "minutes elapsed/remaining" SHORT_TEXT, for faces other than ours. */
class MinuteCounterComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        if (type != ComplicationType.SHORT_TEXT) null
        else shortText("720", "MIN LEFT", "Minutes remaining today")

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        if (snapshot() == null) return shortText("--", null, "1440 Planner")
        val down   = countsDown()
        val minute = watchMinuteOfDay()
        return shortText(
            text  = (if (down) 1440 - minute else minute).toString(),
            title = if (down) "MIN LEFT" else "MIN ELAPSED",
            description = if (down) "Minutes remaining today" else "Minutes elapsed today"
        )
    }
}

/**
 * Slot 2: what you are in, or what is coming.
 *
 * The block you are *currently* in takes precedence over the next one — before, this read
 * only `nextBlock` and so said "No blocks" while you were sitting in your last block of
 * the day, which is exactly when the phone screen shows one. `text` is the title, `title`
 * is the time qualifier, and the face renders them on two lines.
 */
class NextBlockComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        if (type != ComplicationType.SHORT_TEXT) null
        else shortText("Meeting", "2:30 PM", "Next block")

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        val snapshot = snapshot() ?: return noBlocks()

        snapshot.optJSONObject("currentBlock")?.let { current ->
            val title = current.optString("title", "").take(14)
            val ends  = current.optInt("endsAt", -1)
            return shortText(
                text  = "NOW $title",
                title = if (ends >= 0) "till ${minuteToTimeStr(ends)}" else "in progress",
                description = "Current block: $title"
            )
        }
        snapshot.optJSONObject("nextBlock")?.let { next ->
            val title = next.optString("title", "").take(14)
            return shortText(
                text  = title,
                title = next.optString("timeStr", "--"),
                description = "Next block: $title"
            )
        }
        return noBlocks()
    }

    private fun noBlocks() = shortText("No blocks", null, "No upcoming blocks")

    // Minutes from midnight → "9:45 PM". Mirrors minuteToTimeStr in packages/core.
    private fun minuteToTimeStr(minute: Int): String {
        val m   = ((minute % 1440) + 1440) % 1440
        val h   = m / 60
        val h12 = if (h % 12 == 0) 12 else h % 12
        return "%d:%02d %s".format(h12, m % 60, if (h < 12) "AM" else "PM")
    }
}
