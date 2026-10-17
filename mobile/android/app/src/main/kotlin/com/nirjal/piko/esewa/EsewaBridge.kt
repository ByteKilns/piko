package com.nirjal.piko.esewa

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject

/**
 * Flutter <-> native bridge, set up on each engine that runs Piko's Dart code:
 * the app's (with its activity) and the background one (EsewaBackgroundRunner).
 *  MethodChannel "finance/esewa": isAccessGranted, openAccessSettings, pending,
 *    ack, notify, finished (background only), notificationsAllowed,
 *    askNotificationsOnce, requestNotificationPermission, takeOpenTarget,
 *    clearDraftAlerts
 *  EventChannel "finance/esewa/events": a wake-up for each new notification
 *    (the event itself is already queued in PendingStore)
 */
class EsewaBridge private constructor(
    engine: FlutterEngine,
    private val ctx: Context,
    private val activity: Activity?,
    private val onFinished: () -> Unit,
) {
    private var sink: EventChannel.EventSink? = null

    init {
        val messenger = engine.dartExecutor.binaryMessenger

        MethodChannel(messenger, METHOD).setMethodCallHandler { call, result ->
            when (call.method) {
                "isAccessGranted" -> result.success(isAccessGranted(ctx))
                "openAccessSettings" -> {
                    ctx.startActivity(
                        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    )
                    result.success(null)
                }
                "pending" -> result.success(PendingStore.pending(ctx))
                "ack" -> {
                    val ids = (call.arguments as? List<*>)?.filterIsInstance<String>() ?: emptyList()
                    PendingStore.ack(ctx, ids)
                    result.success(null)
                }
                "notify" -> {
                    val args = JSONObject(call.arguments as Map<*, *>)
                    val lines = args.optJSONArray("drafts") ?: JSONArray()
                    DraftNotifier.show(
                        ctx,
                        drafts = (0 until lines.length()).map { lines.getString(it) },
                        unreadable = args.optInt("unreadable"),
                    )
                    result.success(null)
                }
                "finished" -> {
                    result.success(null)
                    onFinished()
                }
                "notificationsAllowed" -> result.success(notificationsAllowed())
                "askNotificationsOnce" -> result.success(askNotificationsOnce())
                "requestNotificationPermission" -> {
                    requestNotificationPermission()
                    result.success(null)
                }
                "takeOpenTarget" -> {
                    val intent = activity?.intent
                    val target = intent?.getStringExtra(DraftNotifier.EXTRA_OPEN)
                    intent?.removeExtra(DraftNotifier.EXTRA_OPEN)
                    result.success(target)
                }
                "clearDraftAlerts" -> {
                    DraftNotifier.clearDrafts(ctx)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }

        EventChannel(messenger, EVENTS).setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(args: Any?, events: EventChannel.EventSink) { sink = events }
            override fun onCancel(args: Any?) { sink = null }
        })
    }

    /** Wakes this engine's Dart; false when it isn't listening. */
    fun wake(event: JSONObject): Boolean {
        val s = sink ?: return false
        main.post { s.success(event.toString()) }
        return true
    }

    private fun notificationsAllowed(): Boolean =
        ctx.getSystemService(NotificationManager::class.java).areNotificationsEnabled()

    private fun prefs() = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Android 13+: shows the permission prompt the first time only. True when it did. */
    private fun askNotificationsOnce(): Boolean {
        val a = activity ?: return false
        if (Build.VERSION.SDK_INT < 33 || notificationsAllowed() || prefs().getBoolean(ASKED, false)) return false
        prefs().edit().putBoolean(ASKED, true).apply()
        a.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), PERMISSION_REQUEST)
        return true
    }

    /**
     * Settings' "Draft alerts" row: the prompt while Android will still show
     * it, otherwise Piko's notification settings (denied twice, or turned off
     * there, or Android 12 and older).
     */
    private fun requestNotificationPermission() {
        val a = activity ?: return
        val canPrompt = Build.VERSION.SDK_INT >= 33 && !notificationsAllowed() &&
            (!prefs().getBoolean(ASKED, false) ||
                a.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))
        if (canPrompt) {
            prefs().edit().putBoolean(ASKED, true).apply()
            a.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), PERMISSION_REQUEST)
            return
        }
        val settings = if (Build.VERSION.SDK_INT >= 26) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null))
        }
        a.startActivity(settings)
    }

    companion object {
        private const val METHOD = "finance/esewa"
        private const val EVENTS = "finance/esewa/events"
        private const val PREFS = "esewa_alerts"
        private const val ASKED = "asked_permission"
        private const val PERMISSION_REQUEST = 7103
        private val main = Handler(Looper.getMainLooper())

        /** The app's engine, while a Piko screen has one. */
        private var ui: EsewaBridge? = null

        /** Bumped for every new notification, so the runner can tell one arrived during a run. */
        @Volatile
        var wakes = 0L
            private set

        fun attachUi(engine: FlutterEngine, ctx: Context, activity: Activity) {
            ui = EsewaBridge(engine, ctx, activity) {}
        }

        fun detachUi() {
            ui = null
        }

        fun background(engine: FlutterEngine, ctx: Context, onFinished: () -> Unit) =
            EsewaBridge(engine, ctx, null, onFinished)

        /**
         * A notification is queued: the app's Dart drains it if it's listening,
         * otherwise the background engine does.
         */
        fun deliver(ctx: Context, event: JSONObject) {
            wakes++
            if (ui?.wake(event) != true) EsewaBackgroundRunner.wake(ctx, event)
        }

        fun isAccessGranted(ctx: Context): Boolean {
            val enabled = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
            val me = ComponentName(ctx, EsewaNotificationListener::class.java).flattenToString()
            return enabled.split(":").any { it == me }
        }
    }
}
