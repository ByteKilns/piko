package com.nirjal.piko.esewa

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Captures eSewa (and optionally bank) notifications.
 *
 * Runs even when the Flutter UI is closed. Every event is queued in
 * PendingStore first; if the Flutter side is listening it is also woken
 * through EsewaBridge, and it drains the queue.
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

        // Queued first, so it survives until Dart has stored it; then wake Dart
        // in case the app is running.
        PendingStore.append(applicationContext, event)
        EsewaBridge.emit(event)
    }
}
