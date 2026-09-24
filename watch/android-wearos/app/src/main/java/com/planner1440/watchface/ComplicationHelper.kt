package com.planner1440.watchface

import android.content.SharedPreferences
import androidx.wear.watchface.complications.data.*
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import org.json.JSONObject

/**
 * Provides two complication slots:
 *   Slot 1 — SHORT_TEXT: current minute counter (elapsed or remaining)
 *   Slot 2 — SHORT_TEXT: next block title + start time
 *
 * Reads the latest WatchSnapshot from SharedPreferences (written by DataLayerClient when
 * the phone's DataItem arrives). On Wear OS 5+ launch devices these two are what the
 * Watch Face Format face in ../wff shows, since the androidx Canvas face is blocked there.
 */
class MinuteCounterComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        return ShortTextComplicationData.Builder(
            text    = PlainComplicationText.Builder("720").build(),
            contentDescription = PlainComplicationText.Builder("Minutes remaining").build()
        ).build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        val snapshot = loadSnapshot() ?: return buildDefault()

        // The phone only sends on calendar edits, so its currentMinute goes stale within
        // a minute; take the minute from the watch clock and only the count mode from the
        // snapshot. UPDATE_PERIOD_SECONDS=60 in the manifest keeps this ticking.
        val now            = java.time.LocalTime.now()
        val currentMinute  = now.hour * 60 + now.minute
        val countMode      = snapshot.optString("countMode", "up")
        val displayMinute  = if (countMode == "down") 1440 - currentMinute else currentMinute

        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(displayMinute.toString()).build(),
            contentDescription = PlainComplicationText.Builder(
                if (countMode == "down") "Minutes remaining" else "Minutes elapsed"
            ).build()
        )
            .setTitle(PlainComplicationText.Builder(if (countMode == "down") "MIN LEFT" else "MIN ELAPSED").build())
            .build()
    }

    private fun buildDefault() = ShortTextComplicationData.Builder(
        text = PlainComplicationText.Builder("--").build(),
        contentDescription = PlainComplicationText.Builder("1440 Planner").build()
    ).build()

    private fun loadSnapshot(): JSONObject? {
        val prefs = getSharedPreferences(DataLayerClient.PREFS_NAME, MODE_PRIVATE)
        val json  = prefs.getString(DataLayerClient.PREFS_KEY, null) ?: return null
        return try { JSONObject(json) } catch (e: Exception) { null }
    }
}

class NextBlockComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        return ShortTextComplicationData.Builder(
            text    = PlainComplicationText.Builder("Meeting 2:30P").build(),
            contentDescription = PlainComplicationText.Builder("Next block").build()
        ).build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        val snapshot  = loadSnapshot() ?: return buildDefault()
        val nextBlock = snapshot.optJSONObject("nextBlock") ?: return buildDefault()

        val title    = nextBlock.optString("title", "").take(10)
        val timeStr  = nextBlock.optString("timeStr", "--")

        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder("$title $timeStr").build(),
            contentDescription = PlainComplicationText.Builder("Next block: $title").build()
        ).build()
    }

    private fun buildDefault() = ShortTextComplicationData.Builder(
        text = PlainComplicationText.Builder("No blocks").build(),
        contentDescription = PlainComplicationText.Builder("No upcoming blocks").build()
    ).build()

    private fun loadSnapshot(): JSONObject? {
        val prefs = getSharedPreferences(DataLayerClient.PREFS_NAME, MODE_PRIVATE)
        val json  = prefs.getString(DataLayerClient.PREFS_KEY, null) ?: return null
        return try { JSONObject(json) } catch (e: Exception) { null }
    }
}
