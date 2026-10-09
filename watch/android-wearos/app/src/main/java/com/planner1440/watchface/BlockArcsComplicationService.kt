package com.planner1440.watchface

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.drawable.Icon
import android.util.Log
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.SmallImage
import androidx.wear.watchface.complications.data.SmallImageComplicationData
import androidx.wear.watchface.complications.data.SmallImageType
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

/**
 * The static art of the face, drawn here on the watch into one bitmap that the WFF face
 * shows through a full-face image complication slot (slot 4 in tools/make-watchface.ps1)
 * underneath the 24 h sweep, the hand, the centre dial and the figure. Three layers, in
 * paint order:
 *
 *   1. the outer ring circle and the 96 ticks, in the COUNT-MODE colour (amber counting
 *      up, cyan counting down) — they were WFF `<PartDraw>`s until pass 12, stuck amber
 *      because nothing outside a slot can be styled from phone data;
 *   2. one thin arc per category time range on that outer ring (`ranges` in the
 *      snapshot, pass 12) — the owner's two-ring form: thin outer ring = categories;
 *   3. one thicker arc per block at the block radius (`events`, pass 12a).
 *
 * Watch Face Format has no loop, so it cannot instantiate one arc per block itself; and
 * the Canvas face that could is blocked on Wear OS 6. A complication data source is the
 * one piece of our code the runtime does run for the face, so the loops live here, over
 * the snapshot [DataLayerClient] persisted. The colours are hex strings the phone already
 * resolved per category, so a user-made category needs nothing on this side.
 *
 * Geometry matches the generator (450x450 canvas, r = 180): block arcs at r - r * 0.2,
 * stroke 4.5, 0.7 alpha (as EventArcs.tsx); the ring at r + r * 0.125 with the category
 * arcs on it at stroke 2.5; the ticks exactly as make-watchface.ps1 used to emit them.
 * `Canvas.drawArc`'s 0 degrees is 3 o'clock, hence the -90.
 *
 * What may NOT move in here: the sweep, the hand and the figure. This bitmap is redrawn
 * only on a snapshot push (`requestUpdateAll()` from [DataLayerClient]) or a face reload,
 * and they must tick on their own, so they stay WFF.
 *
 * Gate: no snapshot at all (fresh install, nothing ever pushed) -> the ring and ticks
 * still have to show, so a bitmap in amber is returned; with a snapshot present there is
 * ALWAYS a bitmap, arcs or not. [NoDataComplicationData] is reserved for a request type we
 * do not serve (never null — null means "no change" and the slot would keep its last
 * frame). A snapshot whose `date` is not the watch's local today gets ring and ticks only:
 * yesterday's blocks must not sit on the face past midnight until the phone next pushes.
 */
class BlockArcsComplicationService : SuspendingComplicationDataSourceService() {

    companion object {
        private const val TAG = "1440:BlockArcs"

        /** Face design size; the runtime scales the bitmap into the slot's bounds. */
        const val SIZE = 450
        private const val R        = 180f
        private const val ARC_R    = R - R * 0.2f     // 144, as in make-preview.ps1
        private const val RING_R   = R + R * 0.125f   // 202.5, the outer ring of the generator
        private const val STROKE   = 4.5f
        private const val ALPHA    = 179              // 0.7 * 255, as EventArcs.tsx

        /** Category-range arcs on the outer ring: thinner and fainter than the blocks. */
        private const val RANGE_STROKE = 2.5f
        private const val RANGE_ALPHA  = 140

        // The static art, exactly as make-watchface.ps1 emitted it before pass 12.
        private const val RING_STROKE   = 1.5f
        private const val RING_ALPHA    = 0x8C          // #8CF59E0B
        private const val TICK_COUNT    = 96
        private const val MAJOR_STROKE  = 1.8f
        private const val MAJOR_ALPHA   = 0xE6          // #E6F59E0B
        private const val MINOR_STROKE  = 0.6f
        private const val MINOR_ALPHA   = 0xB4          // #B43D4F66
        private const val MINOR_COLOR   = 0xFF3D4F66.toInt()

        /** Count-mode accents: `countMode` "up" -> amber (the default), "down" -> cyan. */
        private const val AMBER = 0xFFF59E0B.toInt()
        private const val CYAN  = 0xFF38BDF8.toInt()
        private const val FALLBACK_COLOR = 0xFF94A3B8.toInt()

        /**
         * Probe switch (pass 12a). While true every request draws a fixed pattern instead of
         * the snapshot so the slot type / tint / scale question can be answered from a
         * screenshot: three solid arcs at the block radius in red / green / blue.
         * Resolved 2026-10-08 on the Galaxy Watch 7: SMALL_IMAGE (type PHOTO) renders them
         * untinted (pure #FF0000 / #00FF00 / #0000FF sampled off the screen) and at exact
         * full-face scale. PHOTO_IMAGE is rejected outright by WearServices
         * ("ComplicationPackageChecker: Unexpected complication data type PHOTO_IMAGE") and
         * the slot stays NOT_CONFIGURED, so only SMALL_IMAGE is served.
         */
        const val SPIKE = false

        /** The one request type this source serves (see the PHOTO_IMAGE note above). */
        private val IMAGE_TYPES = setOf(ComplicationType.SMALL_IMAGE)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        if (type !in IMAGE_TYPES) return null
        val bmp = newBitmap()
        val c = Canvas(bmp)
        drawStaticArt(c, AMBER)
        drawRange(c, 360, 720,   Color.parseColor("#38BDF8"))
        drawRange(c, 780, 1080,  Color.parseColor("#A78BFA"))
        drawArc(c, 540, 60,  Color.parseColor("#38BDF8"))
        drawArc(c, 660, 45,  Color.parseColor("#34D399"))
        drawArc(c, 780, 90,  Color.parseColor("#FBBF24"))
        drawArc(c, 1020, 60, Color.parseColor("#A78BFA"))
        return wrap(type, bmp)
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val type = request.complicationType
        if (type !in IMAGE_TYPES) return null

        if (SPIKE) {
            Log.d(TAG, "spike pattern for $type")
            return wrap(type, spikeBitmap(type))
        }

        val bmp = newBitmap()
        val c = Canvas(bmp)

        val snapshot = snapshot()
        if (snapshot == null) {
            // Nothing ever pushed (fresh install): the face still needs its ring and ticks.
            drawStaticArt(c, AMBER)
            Log.d(TAG, "no snapshot -> static art only (amber) for $type")
            return wrap(type, bmp)
        }

        val accent = if (snapshot.optString("countMode", "up") == "down") CYAN else AMBER
        drawStaticArt(c, accent)

        val today = localToday()
        val date  = snapshot.optString("date", "")
        if (date != today) {
            // Past midnight with no push since: yesterday's arcs must not stay up.
            Log.d(TAG, "snapshot dated $date, today is $today -> static art only for $type")
            return wrap(type, bmp)
        }

        var ranges = 0
        snapshot.optJSONArray("ranges")?.let { arr ->
            for (i in 0 until arr.length()) {
                val r = arr.optJSONObject(i) ?: continue
                val start = r.optInt("startMinute", -1)
                val end   = r.optInt("endMinute", -1)
                if (start < 0 || end <= start) continue
                drawRange(c, start, end, parseColor(r.optString("color", "")))
                ranges++
            }
        }

        val events = snapshot.optJSONArray("events") ?: JSONArray()
        var drawn = 0
        for (i in 0 until events.length()) {
            val ev = events.optJSONObject(i) ?: continue
            val start = ev.optInt("startMinute", -1)
            val dur   = ev.optInt("durationMinutes", 0)
            if (start < 0 || dur <= 0) continue
            drawArc(c, start, dur, parseColor(ev.optString("color", "")))
            drawn++
        }
        Log.d(TAG, "drew $drawn/${events.length()} arcs, $ranges ranges, ${if (accent == CYAN) "cyan" else "amber"} ring for $type")
        return wrap(type, bmp)
    }

    // ---- drawing -------------------------------------------------------------------------

    private fun newBitmap(): Bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)

    private val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = STROKE
        strokeCap = Paint.Cap.BUTT
    }

    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.BUTT
    }

    /** One block: [startMinute] from midnight, [durationMinutes] long, at the block radius. */
    private fun drawArc(c: Canvas, startMinute: Int, durationMinutes: Int, color: Int,
                        radius: Float = ARC_R, alpha: Int = ALPHA, stroke: Float = STROKE) {
        val cx = SIZE / 2f
        val startAngle = startMinute / 1440f * 360f - 90f   // Canvas 0 deg = 3 o'clock
        val sweep      = durationMinutes.coerceAtMost(1440) / 1440f * 360f
        arcPaint.color = color
        arcPaint.alpha = alpha
        arcPaint.strokeWidth = stroke
        c.drawArc(RectF(cx - radius, cx - radius, cx + radius, cx + radius), startAngle, sweep, false, arcPaint)
    }

    /** One category time range, [startMinute]..[endMinute], as a thin arc on the outer ring. */
    private fun drawRange(c: Canvas, startMinute: Int, endMinute: Int, color: Int) =
        drawArc(c, startMinute, endMinute - startMinute, color, RING_R, RANGE_ALPHA, RANGE_STROKE)

    /**
     * The outer ring circle and the 96 ticks in [accent] — a port of the two `<PartDraw>`
     * blocks make-watchface.ps1 emitted until pass 12, same radii, widths and alphas.
     * Major ticks (every 4th of 96 = one per hour) are in the accent; minor ticks keep the
     * slate `#3D4F66` they always had.
     */
    private fun drawStaticArt(c: Canvas, accent: Int) {
        val cx = SIZE / 2f
        linePaint.color = accent
        linePaint.alpha = RING_ALPHA
        linePaint.strokeWidth = RING_STROKE
        c.drawCircle(cx, cx, RING_R, linePaint)

        for (i in 0 until TICK_COUNT) {
            val rad   = Math.toRadians(i / TICK_COUNT.toDouble() * 360.0 - 90.0)
            val major = i % 4 == 0
            val inner = if (major) R - R * 0.06f else R + R * 0.01f
            val outer = R + R * 0.06f
            linePaint.color = if (major) accent else MINOR_COLOR
            linePaint.alpha = if (major) MAJOR_ALPHA else MINOR_ALPHA
            linePaint.strokeWidth = if (major) MAJOR_STROKE else MINOR_STROKE
            c.drawLine(
                (cx + inner * cos(rad)).toFloat(), (cx + inner * sin(rad)).toFloat(),
                (cx + outer * cos(rad)).toFloat(), (cx + outer * sin(rad)).toFloat(),
                linePaint
            )
        }
    }

    private fun parseColor(hex: String): Int =
        try { Color.parseColor(hex) } catch (e: IllegalArgumentException) { FALLBACK_COLOR }

    /** Probe: 6-8h red, 12-14h green, 18-20h blue, solid, at the real block radius. */
    @Suppress("UNUSED_PARAMETER")
    private fun spikeBitmap(type: ComplicationType): Bitmap {
        val bmp = newBitmap()
        val c = Canvas(bmp)
        drawArc(c, 360,  120, Color.RED,   alpha = 255)
        drawArc(c, 720,  120, Color.GREEN, alpha = 255)
        drawArc(c, 1080, 120, Color.BLUE,  alpha = 255)
        return bmp
    }

    // ---- packaging -----------------------------------------------------------------------

    /**
     * SMALL_IMAGE of type PHOTO: the Wear spec says photo-type small images are shown as-is,
     * not tinted, and this runtime honours that (verified by the probe above). The
     * 450x450 ARGB bitmap goes through ashmem, so the binder limit is not a concern.
     */
    @Suppress("UNUSED_PARAMETER")
    private fun wrap(type: ComplicationType, bmp: Bitmap): ComplicationData {
        val icon = Icon.createWithBitmap(bmp)
        val description = PlainComplicationText.Builder("Today's blocks").build()
        return SmallImageComplicationData.Builder(
            SmallImage.Builder(icon, SmallImageType.PHOTO).build(),
            description
        ).build()
    }

    private fun snapshot(): JSONObject? {
        val json = getSharedPreferences(DataLayerClient.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(DataLayerClient.PREFS_KEY, null) ?: return null
        return try { JSONObject(json) } catch (e: Exception) { null }
    }

    /** The watch's local date in the snapshot's `yyyy-MM-dd` form (core's `today()`). */
    private fun localToday(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
}
