package com.planner1440.watchface

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

/**
 * Listens for WatchSnapshot payloads pushed from the phone companion app.
 * Phone sends a DataItem to path "/1440/snapshot" containing the JSON payload
 * (apps/mobile/modules/wearable-data-layer). This service:
 *   1. persists the JSON to SharedPreferences PREFS_NAME/PREFS_KEY — the single copy the
 *      two complication data sources read (and the WFF face is fed by those),
 *   2. asks the system to refresh both complications right away,
 *   3. rebroadcasts in-process for the androidx Canvas renderer, on devices that still
 *      allow one (Wear OS 5+ launch devices block it, so the WFF path is the real one).
 */
class DataLayerClient : WearableListenerService() {

    companion object {
        const val SNAPSHOT_PATH            = "/1440/snapshot"
        const val SNAPSHOT_KEY             = "snapshot_json"
        const val ACTION_SNAPSHOT_UPDATED  = "com.planner1440.watchface.SNAPSHOT_UPDATED"
        const val EXTRA_SNAPSHOT           = "snapshot"
        const val PREFS_NAME               = "1440_watch"
        const val PREFS_KEY                = "snapshot"
        private const val TAG              = "1440:DataLayer"

        // The two count gates matter most here: they carry no clock of their own, so a
        // change of count mode on the phone only reaches the face through this refresh.
        private val COMPLICATION_SERVICES = listOf(
            CountUpComplicationService::class.java,
            CountDownComplicationService::class.java,
            MinuteCounterComplicationService::class.java,
            NextBlockComplicationService::class.java,
        )
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type != DataEvent.TYPE_CHANGED) continue   // deletions carry no map
            val path = event.dataItem.uri.path ?: continue
            if (path != SNAPSHOT_PATH) continue

            val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
            val json    = dataMap.getString(SNAPSHOT_KEY) ?: continue

            Log.d(TAG, "Received snapshot, currentMinute=${parseMinute(json)}")
            broadcastSnapshot(json)
        }
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == SNAPSHOT_PATH) {
            val json = String(event.data)
            Log.d(TAG, "Received message snapshot")
            broadcastSnapshot(json)
        }
    }

    private fun broadcastSnapshot(json: String) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(PREFS_KEY, json).apply()

        // Otherwise the face waits for UPDATE_PERIOD_SECONDS to notice the new snapshot.
        for (service in COMPLICATION_SERVICES) {
            ComplicationDataSourceUpdateRequester
                .create(this, ComponentName(this, service))
                .requestUpdateAll()
        }

        val intent = Intent(ACTION_SNAPSHOT_UPDATED).apply {
            putExtra(EXTRA_SNAPSHOT, json)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    private fun parseMinute(json: String): Int = try {
        JSONObject(json).optInt("currentMinute", -1)
    } catch (e: Exception) { -1 }
}
