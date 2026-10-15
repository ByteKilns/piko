package com.nirjal.piko.esewa

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject

/**
 * Flutter <-> native bridge.
 *  MethodChannel "finance/esewa":  isAccessGranted, openAccessSettings, pending, ack
 *  EventChannel  "finance/esewa/events": live raw events (JSON strings)
 */
object EsewaBridge {
    private const val METHOD = "finance/esewa"
    private const val EVENTS = "finance/esewa/events"

    private var sink: EventChannel.EventSink? = null
    private val main = Handler(Looper.getMainLooper())

    fun register(engine: FlutterEngine, ctx: Context) {
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
                else -> result.notImplemented()
            }
        }

        EventChannel(messenger, EVENTS).setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(args: Any?, events: EventChannel.EventSink) { sink = events }
            override fun onCancel(args: Any?) { sink = null }
        })
    }

    /** Wakes Dart if it is listening. The event is already queued in PendingStore. */
    fun emit(event: JSONObject) {
        val s = sink ?: return
        main.post { s.success(event.toString()) }
    }

    private fun isAccessGranted(ctx: Context): Boolean {
        val enabled = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
        val me = ComponentName(ctx, EsewaNotificationListener::class.java).flattenToString()
        return enabled.split(":").any { it == me }
    }
}
