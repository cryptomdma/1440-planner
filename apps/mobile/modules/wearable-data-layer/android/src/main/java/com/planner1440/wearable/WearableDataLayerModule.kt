package com.planner1440.wearable

import android.util.Log
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Phone side of the watch sync transport. `sendSnapshot(json)` writes the WatchSnapshot
 * JSON to the Wearable Data Layer at /1440/snapshot; the watch's DataLayerClient
 * (watch/android-wearos) receives it in onDataChanged.
 *
 * Path and key are the contract with DataLayerClient.kt — change both or neither.
 */
class WearableDataLayerModule : Module() {

  companion object {
    private const val TAG          = "1440:WatchSync"
    private const val SNAPSHOT_PATH = "/1440/snapshot"
    private const val SNAPSHOT_KEY  = "snapshot_json"
    private const val TS_KEY        = "ts"
  }

  override fun definition() = ModuleDefinition {
    Name("WearableDataLayer")

    AsyncFunction("sendSnapshot") { json: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "React context is not available", null)
        return@AsyncFunction
      }

      val request = PutDataMapRequest.create(SNAPSHOT_PATH).apply {
        dataMap.putString(SNAPSHOT_KEY, json)
        // The Data Layer only delivers when the bytes change; the timestamp keeps a
        // re-send of an identical snapshot flowing (e.g. after a watch reconnect).
        dataMap.putLong(TS_KEY, System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()

      Wearable.getDataClient(context).putDataItem(request)
        .addOnSuccessListener { item ->
          Log.d(TAG, "putDataItem ok ${item.uri} (${json.length} chars)")
          promise.resolve(null)
        }
        .addOnFailureListener { e ->
          Log.w(TAG, "putDataItem failed", e)
          promise.reject("E_DATA_LAYER", e.message ?: e.toString(), e)
        }
    }
  }
}
