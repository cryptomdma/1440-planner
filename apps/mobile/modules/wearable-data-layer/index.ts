import { requireOptionalNativeModule } from 'expo';

export interface WearableDataLayerModule {
  /**
   * Writes the WatchSnapshot JSON to the Wearable Data Layer at `/1440/snapshot`.
   * Resolves once Google Play services has accepted the DataItem (not when the watch
   * has read it); rejects if Play services is missing or the write fails.
   */
  sendSnapshot(json: string): Promise<void>;
}

// `null` when the running binary predates the module — e.g. JS reloaded over Metro
// against an APK built before apps/mobile/modules existed. Callers must handle that
// instead of crashing the calendar subscription.
const WearableDataLayer = requireOptionalNativeModule<WearableDataLayerModule>('WearableDataLayer');

export default WearableDataLayer;
