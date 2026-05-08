package com.planner1440.watchface

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.*
import android.util.Log
import android.view.SurfaceHolder
import androidx.wear.watchface.*
import androidx.wear.watchface.style.CurrentUserStyleRepository
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

/**
 * Canvas-based watch face renderer.
 * Replicates the SVG watch face from the mobile app using Android Canvas API.
 * Serves as a fallback for Wear OS 2 devices and as the rendering engine
 * for devices where Watch Face Format (WFF) XML is not supported.
 *
 * Layout mirrors the web prototype (WatchFace SVG component, App.jsx lines 226–268):
 *   - Outer circle + 96 tick marks
 *   - Per-event colored arc segments
 *   - Progress sweep arc (count-up or count-down)
 *   - Minute hand at 1440-position
 *   - Center dial: minute counter + mode label + clock time
 */
class WatchFaceService : WatchFaceService() {

    companion object {
        private const val TAG = "1440:WatchFace"
    }

    override suspend fun createWatchFace(
        surfaceHolder: SurfaceHolder,
        watchState:    WatchState,
        complicationSlotsManager: ComplicationSlotsManager,
        currentUserStyleRepository: CurrentUserStyleRepository
    ): WatchFace {
        val renderer = CanvasRenderer(surfaceHolder, currentUserStyleRepository, watchState, applicationContext)
        return WatchFace(WatchFaceType.ANALOG, renderer)
    }

    inner class CanvasRenderer(
        surfaceHolder: SurfaceHolder,
        currentUserStyleRepository: CurrentUserStyleRepository,
        watchState: WatchState,
        private val ctx: Context
    ) : Renderer.CanvasRenderer2<Renderer.SharedAssets>(
        surfaceHolder, currentUserStyleRepository, watchState,
        CanvasType.HARDWARE, 30_000L, clearWithBackgroundTintBeforeRenderingHighlightLayer = false
    ) {

        private var snapshot: JSONObject? = null
        private val snapshotReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val json = intent.getStringExtra(DataLayerClient.EXTRA_SNAPSHOT) ?: return
                try {
                    snapshot = JSONObject(json)
                    // Persist for complication providers
                    ctx.getSharedPreferences("1440_watch", Context.MODE_PRIVATE)
                        .edit().putString("snapshot", json).apply()
                    invalidate()
                } catch (e: Exception) {
                    Log.e(TAG, "Bad snapshot JSON", e)
                }
            }
        }

        init {
            ctx.registerReceiver(
                snapshotReceiver,
                IntentFilter(DataLayerClient.ACTION_SNAPSHOT_UPDATED)
            )
        }

        override suspend fun createSharedAssets(): Renderer.SharedAssets =
            object : Renderer.SharedAssets { override fun onDestroy() {} }

        override fun onDestroy() {
            super.onDestroy()
            ctx.unregisterReceiver(snapshotReceiver)
        }

        override fun renderHighlightLayer(canvas: Canvas, bounds: Rect, zonedDateTime: java.time.ZonedDateTime, sharedAssets: Renderer.SharedAssets) {
            // no highlight layer needed
        }

        override fun render(canvas: Canvas, bounds: Rect, zonedDateTime: java.time.ZonedDateTime, sharedAssets: Renderer.SharedAssets) {
            val snap        = snapshot
            val cx          = bounds.exactCenterX()
            val cy          = bounds.exactCenterY()
            val r           = minOf(cx, cy) * 0.8f
            val now         = zonedDateTime
            val curMin      = now.hour * 60 + now.minute
            val countMode   = snap?.optString("countMode", "up") ?: "up"
            val accentColor = if (countMode == "down") Color.parseColor("#38BDF8") else Color.parseColor("#F59E0B")
            val displayVal  = if (countMode == "down") 1440 - curMin else curMin

            // Background
            canvas.drawColor(Color.parseColor("#07090f"))

            // Outer circle
            val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style       = Paint.Style.STROKE
                color       = accentColor
                strokeWidth = 1.5f
                alpha       = 140
            }
            canvas.drawCircle(cx, cy, r + r * 0.125f, ringPaint)

            // 96 tick marks
            for (i in 0 until 96) {
                val angle = (i / 96f) * 360f - 90f
                val rad   = Math.toRadians(angle.toDouble()).toFloat()
                val major = i % 4 == 0
                val inner = if (major) r - r * 0.06f else r + r * 0.01f
                val outer = r + r * 0.06f
                val tick  = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color       = if (major) accentColor else Color.parseColor("#3d4f66")
                    strokeWidth = if (major) 1.8f else 0.6f
                    alpha       = if (major) 230 else 180
                }
                canvas.drawLine(
                    cx + inner * cos(rad), cy + inner * sin(rad),
                    cx + outer * cos(rad), cy + outer * sin(rad),
                    tick
                )
            }

            // Event arcs
            val eventsArray = snap?.optJSONArray("events") ?: JSONArray()
            for (i in 0 until eventsArray.length()) {
                val ev      = eventsArray.optJSONObject(i) ?: continue
                val start   = ev.optInt("startMinute", 0)
                val dur     = ev.optInt("durationMinutes", 60)
                val color   = ev.optString("color", "#888888")
                val sAngle  = (start / 1440f) * 360f - 90f
                val sweep   = (dur / 1440f) * 360f
                val arcR    = r - r * 0.2f
                val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    this.color  = Color.parseColor(color)
                    strokeWidth = 4.5f
                    style       = Paint.Style.STROKE
                    alpha       = 178
                }
                canvas.drawArc(
                    cx - arcR, cy - arcR, cx + arcR, cy + arcR,
                    sAngle, sweep, false, arcPaint
                )
            }

            // Progress sweep
            val sweepPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color       = accentColor
                strokeWidth = 2.8f
                style       = Paint.Style.STROKE
                strokeCap   = Paint.Cap.ROUND
                alpha       = 230
            }
            val arcR2  = r - r * 0.1f
            val sweep  = if (countMode == "down") {
                -(curMin / 1440f) * 360f  // shrinks as time passes
            } else {
                (curMin / 1440f) * 360f   // grows as time passes
            }
            canvas.drawArc(
                cx - arcR2, cy - arcR2, cx + arcR2, cy + arcR2,
                -90f, sweep, false, sweepPaint
            )

            // Center dial background
            val dialR = r * 0.41f
            canvas.drawCircle(cx, cy, dialR, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#07090f") })
            canvas.drawCircle(cx, cy, dialR, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.parseColor("#1f2d42"); style = Paint.Style.STROKE; strokeWidth = 1f
            })

            // Minute counter
            canvas.drawText(
                displayVal.toString(), cx, cy - r * 0.09f,
                Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color     = accentColor; textSize  = r * 0.19f
                    textAlign = Paint.Align.CENTER; typeface  = Typeface.MONOSPACE; isFakeBoldText = true
                }
            )

            // Mode label
            canvas.drawText(
                if (countMode == "down") "MIN LEFT" else "MIN ELAPSED", cx, cy + r * 0.06f,
                Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color     = Color.parseColor("#64748b"); textSize  = r * 0.075f
                    textAlign = Paint.Align.CENTER; typeface  = Typeface.MONOSPACE
                }
            )

            // Clock time
            val hh = if (now.hour == 0 || now.hour == 12) 12 else now.hour % 12
            val mm = String.format("%02d", now.minute)
            val ap = if (now.hour < 12) "AM" else "PM"
            canvas.drawText(
                "$hh:$mm $ap", cx, cy + r * 0.19f,
                Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color     = Color.parseColor("#94a3b8"); textSize  = r * 0.108f
                    textAlign = Paint.Align.CENTER; typeface  = Typeface.MONOSPACE
                }
            )

            // Minute hand
            val handAngle = (curMin / 1440f) * 360f - 90f
            val handRad   = Math.toRadians(handAngle.toDouble()).toFloat()
            val handLen   = r * 0.62f
            canvas.drawLine(
                cx, cy,
                cx + handLen * cos(handRad), cy + handLen * sin(handRad),
                Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = accentColor; strokeWidth = 2.2f; strokeCap = Paint.Cap.ROUND
                }
            )
            canvas.drawCircle(cx, cy, 3.5f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accentColor })
        }
    }
}
