package com.nirjal.piko.esewa

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.nirjal.piko.MainActivity
import com.nirjal.piko.R

/**
 * Piko's own notifications about eSewa capture, on their own channel ("eSewa
 * drafts") so they can be switched off without stopping capture:
 *  - drafts: one notification, updated rather than stacked; the count resets
 *    when the review screen opens. Tap → review screen.
 *  - couldn't read: an eSewa notification that held no payment Piko could
 *    read. Tap → Captured notifications.
 * Nothing is shown while a Piko screen is in front; Home's banner covers it.
 */
object DraftNotifier {
    const val EXTRA_OPEN = "piko_open"

    private const val CHANNEL = "esewa_drafts"
    private const val DRAFTS_ID = 7101
    private const val UNREADABLE_ID = 7102
    private const val PREFS = "esewa_alerts"
    private const val UNSEEN = "unseen_drafts"

    /** True while MainActivity is resumed. */
    @Volatile
    var appVisible = false

    fun show(ctx: Context, drafts: List<String>, unreadable: Int) {
        if (appVisible) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        ensureChannel(nm)
        if (drafts.isNotEmpty()) {
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val unseen = prefs.getInt(UNSEEN, 0) + drafts.size
            prefs.edit().putInt(UNSEEN, unseen).apply()
            val title = if (unseen == 1) "Draft: ${drafts.last()}" else "$unseen eSewa drafts to review"
            val text = if (unseen == 1) "Tap to review" else "Latest: ${drafts.last()}"
            nm.notify(DRAFTS_ID, build(ctx, title, text, "review", DRAFTS_ID))
        }
        if (unreadable > 0) {
            nm.notify(
                UNREADABLE_ID,
                build(ctx, "Piko couldn't read an eSewa notification", "Tap to see it", "captured", UNREADABLE_ID),
            )
        }
    }

    fun clearDrafts(ctx: Context) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(UNSEEN, 0).apply()
        ctx.getSystemService(NotificationManager::class.java).cancel(DRAFTS_ID)
    }

    private fun ensureChannel(nm: NotificationManager) {
        if (Build.VERSION.SDK_INT < 26 || nm.getNotificationChannel(CHANNEL) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "eSewa drafts", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "When an eSewa payment becomes a draft to review"
            }
        )
    }

    private fun build(ctx: Context, title: String, text: String, open: String, requestCode: Int): Notification {
        val intent = Intent(ctx, MainActivity::class.java)
            .putExtra(EXTRA_OPEN, open)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val tap = PendingIntent.getActivity(
            ctx, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) {
            Notification.Builder(ctx, CHANNEL)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(ctx)
        }
        return builder
            .setSmallIcon(R.drawable.ic_stat_piko)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build()
    }
}
