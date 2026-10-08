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
import androidx.wear.watchface.complications.data.PhotoImageComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.SmallImage
import androidx.wear.watchface.complications.data.SmallImageComplicationData
import androidx.wear.watchface.complications.data.SmallImageType
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import org.json.JSONObject

/**
 * Today's blocks as coloured arcs, drawn here on the watch into a bitmap and shown by the
 * WFF face through a full-face image complication slot (slot 4 in
 * tools/make-watchface.ps1) that sits underneath the ring, ticks and hand.
 *
 * Watch Face Format has no loop, so it cannot instantiate one arc per block itself; and
 * the Canvas face that could is blocked on Wear OS 6. A complication data source is the
 * one piece of our code the runtime does run for the face, so the loop lives here:
 * `Canvas.drawArc` over the `events` array of the snapshot [DataLayerClient] persisted.
 * The colours are hex strings the phone already resolved per category, so a user-made
 * category needs nothing on this side.
 *
 * Geometry matches the generator (450x450 canvas, r = 180): arcs at r - r * 0.2, stroke
 * 4.5, butt caps, 0.7 alpha — the same look as the in-app preview (EventArcs.tsx).
 * `Canvas.drawArc`'s 0 degrees is 3 o'clock, hence the -90.
 *
 * Refresh: UPDATE_PERIOD_SECONDS is 0; [DataLayerClient] calls requestUpdateAll() on this
 * source after every snapshot, exactly as it does for the count gates. With nothing to
 * draw it returns [NoDataComplicationData] (never null — null means "no change" and the
 * slot would keep yesterday's arcs).
 */
class BlockArcsComplicationService : SuspendingComplicationDataSourceService() {

    companion object {
        private const val TAG = "1440:BlockArcs"

        /** Face design size; the runtime scales the bitmap into the slot's bounds. */
        const val SIZE = 450
        private const val R        = 180f
        private const val ARC_R    = R - R * 0.2f   // 144, as in make-preview.ps1
        private const val STROKE   = 4.5f
        private const val ALPHA    = 179            // 0.7 * 255, as EventArcs.tsx

        /**
         * Spike switch (pass 12a). While true every request draws a fixed probe instead of
         * the snapshot so the slot type / tint / scale question can be answered from a
         * screenshot: SMALL_IMAGE requests get three arcs at the block radius, PHOTO_IMAGE
         * requests get three at a smaller radius, each in three unmistakable colours.
         */
        const val SPIKE = true

        /** Supported request types — whichever the face's slot asks for. */
        private val IMAGE_TYPES = setOf(ComplicationType.SMALL_IMAGE, ComplicationType.PHOTO_IMAGE)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        if (type !in IMAGE_TYPES) return null
        val bmp = newBitmap()
        val c = Canvas(bmp)
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

        val snapshot = snapshot() ?: return NoDataComplicationData()
        val events = snapshot.optJSONArray("events")
        if (events == null || events.length() == 0) {
            Log.d(TAG, "no events in snapshot -> NoData")
            return NoDataComplicationData()
        }

        val bmp = newBitmap()
        val c = Canvas(bmp)
        var drawn = 0
        for (i in 0 until events.length()) {
            val ev = events.optJSONObject(i) ?: continue
            val start = ev.optInt("startMinute", -1)
            val dur   = ev.optInt("durationMinutes", 0)
            if (start < 0 || dur <= 0) continue
            val color = try { Color.parseColor(ev.optString("color", "#94A3B8")) }
                        catch (e: IllegalArgumentException) { Color.parseColor("#94A3B8") }
            drawArc(c, start, dur, color)
            drawn++
        }
        Log.d(TAG, "drew $drawn/${events.length()} arcs for $type")
        return if (drawn == 0) NoDataComplicationData() else wrap(type, bmp)
    }

    // ---- drawing -------------------------------------------------------------------------

    private fun newBitmap(): Bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)

    private val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = STROKE
        strokeCap = Paint.Cap.BUTT
    }

    /** One block: [startMinute] from midnight, [durationMinutes] long, at the block radius. */
    private fun drawArc(c: Canvas, startMinute: Int, durationMinutes: Int, color: Int, radius: Float = ARC_R, alpha: Int = ALPHA) {
        val cx = SIZE / 2f
        val startAngle = startMinute / 1440f * 360f - 90f   // Canvas 0 deg = 3 o'clock
        val sweep      = durationMinutes.coerceAtMost(1440) / 1440f * 360f
        arcPaint.color = color
        arcPaint.alpha = alpha
        c.drawArc(RectF(cx - radius, cx - radius, cx + radius, cx + radius), startAngle, sweep, false, arcPaint)
    }

    /** Spike probe: three solid arcs whose colours say which slot type rendered them. */
    private fun spikeBitmap(type: ComplicationType): Bitmap {
        val bmp = newBitmap()
        val c = Canvas(bmp)
        if (type == ComplicationType.SMALL_IMAGE) {
            // 6-8h red, 12-14h green, 18-20h blue, at the real block radius
            drawArc(c, 360,  120, Color.RED,   alpha = 255)
            drawArc(c, 720,  120, Color.GREEN, alpha = 255)
            drawArc(c, 1080, 120, Color.BLUE,  alpha = 255)
        } else {
            // same hours, inner radius, magenta / yellow / cyan
            drawArc(c, 360,  120, Color.MAGENTA, radius = ARC_R - 30f, alpha = 255)
            drawArc(c, 720,  120, Color.YELLOW,  radius = ARC_R - 30f, alpha = 255)
            drawArc(c, 1080, 120, Color.CYAN,    radius = ARC_R - 30f, alpha = 255)
        }
        return bmp
    }

    // ---- packaging -----------------------------------------------------------------------

    private fun wrap(type: ComplicationType, bmp: Bitmap): ComplicationData {
        val icon = Icon.createWithBitmap(bmp)
        val description = PlainComplicationText.Builder("Today's blocks").build()
        return if (type == ComplicationType.PHOTO_IMAGE) {
            PhotoImageComplicationData.Builder(icon, description).build()
        } else {
            // PHOTO: the Wear spec says photo-type small images are shown as-is, not tinted.
            SmallImageComplicationData.Builder(
                SmallImage.Builder(icon, SmallImageType.PHOTO).build(),
                description
            ).build()
        }
    }

    private fun snapshot(): JSONObject? {
        val json = getSharedPreferences(DataLayerClient.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(DataLayerClient.PREFS_KEY, null) ?: return null
        return try { JSONObject(json) } catch (e: Exception) { null }
    }
}
