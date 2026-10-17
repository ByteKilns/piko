package com.nirjal.piko.esewa

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Captures eSewa (and optionally bank) notifications.
 *
 * Runs even when the Flutter UI is closed. Every event is queued in
 * PendingStore first, then handed on: to the app's Dart if a Piko screen's
 * engine is listening, otherwise to the background engine
 * (EsewaBackgroundRunner). Either one drains the queue.
 *
 * Parsing is intentionally NOT done here — Dart owns parsing so you can update
 * the patterns without touching native code.
 */
class EsewaNotificationListener : NotificationListenerService() {

    companion object {
        // Verify on a real device: adb shell pm list packages | grep -i esewa
        val WATCHED_PACKAGES = setOf(
            "com.f1soft.esewa",
        )

        /** Whether Android has this listener connected right now (in this process). */
        @Volatile
        var connected = false
            private set

        /**
         * Android sometimes keeps notification access switched on but stops
         * delivering to the listener (often after an app update). Asks it to
         * reconnect; harmless when access is off.
         */
        fun rebindIfDisconnected(ctx: Context) {
            if (connected) return
            try {
                requestRebind(ComponentName(ctx, EsewaNotificationListener::class.java))
            } catch (_: RuntimeException) {
                // Never let a refused rebind stop the app from opening.
            }
        }
    }

    // Catches up on eSewa notifications still in the shade, posted while the
    // listener was disconnected. Ones already sent are dropped by the server,
    // so re-reading them is harmless.
    override fun onListenerConnected() {
        connected = true
        val active = try { activeNotifications } catch (_: SecurityException) { null } ?: return
        active.forEach(::onNotificationPosted)
    }

    override fun onListenerDisconnected() {
        connected = false
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in WATCHED_PACKAGES) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        // BigText often contains the full message; fall back to normal text.
        val text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: ""
        if (title.isBlank() && text.isBlank()) return

        // Ignore group-summary notifications (they duplicate the individual ones).
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val event = JSONObject().apply {
            put("source", "notification")
            put("package", sbn.packageName)
            put("key", sbn.key)                 // stable per-notification id
            put("title", title)
            put("text", text)
            put("postedAt", sbn.postTime)       // epoch millis
        }

        // Queued first, so it survives until Dart has stored it; then hand it
        // to whichever Dart can drain it now.
        PendingStore.append(applicationContext, event)
        EsewaBridge.deliver(applicationContext, event)
    }
}
