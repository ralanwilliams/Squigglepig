package expo.modules.screenpin

import android.app.ActivityManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android's app pinning, for the endless hunt's padlock (src/lib/screenPin.ts).
// startLockTask on an app no device policy has allow-listed pins it the way
// the person can: Android asks them first ("Pin this app?"), and they can
// unpin it with the phone's own gesture. No permission is needed.
class ScreenPinModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenPin")

    Function("pin") {
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread { runCatching { activity.startLockTask() } }
    }

    Function("unpin") {
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread { runCatching { activity.stopLockTask() } }
    }

    AsyncFunction("isPinned") {
      val manager = appContext.reactContext?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      manager != null && manager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
    }
  }
}
