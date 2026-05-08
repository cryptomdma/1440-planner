package com.planner1440.watchface

import android.content.Intent
import android.util.Log
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

/**
 * Listens for WatchSnapshot payloads pushed from the phone companion app.
 * Phone sends a DataItem to path "/1440/snapshot" containing the JSON payload.
 * This service decodes it and broadcasts to WatchFaceService via local broadcast.
 */
class DataLayerClient : WearableListenerService() {

    companion object {
        const val SNAPSHOT_PATH            = "/1440/snapshot"
        const val SNAPSHOT_KEY             = "snapshot_json"
        const val ACTION_SNAPSHOT_UPDATED  = "com.planner1440.watchface.SNAPSHOT_UPDATED"
        const val EXTRA_SNAPSHOT           = "snapshot"
        private const val TAG              = "1440:DataLayer"
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
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
