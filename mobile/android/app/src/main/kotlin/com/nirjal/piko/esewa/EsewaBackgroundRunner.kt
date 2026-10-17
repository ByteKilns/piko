package com.nirjal.piko.esewa

import android.content.Context
import android.os.Handler
import android.os.Looper
import io.flutter.FlutterInjector
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.dart.DartExecutor
import org.json.JSONObject

/**
 * Runs Piko's Dart code with no UI (`esewaBackgroundMain` in lib/main.dart)
 * when an eSewa notification arrives and no Piko screen is running, so the
 * draft is made, and announced, without opening the app. At most one engine;
 * it ends when Dart says it's finished, or after a minute. Anything not yet
 * stored stays queued in PendingStore.
 */
object EsewaBackgroundRunner {
    private const val LIMIT_MS = 60_000L

    private val main = Handler(Looper.getMainLooper())
    private var engine: FlutterEngine? = null
    private var bridge: EsewaBridge? = null
    private var wakesAtStart = 0L
    private val timeout = Runnable { stop() }

    fun wake(ctx: Context, event: JSONObject) {
        val app = ctx.applicationContext
        main.post {
            // Running: its Dart drains again. Still starting: its first drain reads the queue.
            if (bridge?.wake(event) == true || engine != null) return@post
            start(app)
        }
    }

    private fun start(ctx: Context) {
        val e = FlutterEngine(ctx)
        engine = e
        wakesAtStart = EsewaBridge.wakes
        bridge = EsewaBridge.background(e, ctx) { main.post { finished(ctx) } }
        val bundle = FlutterInjector.instance().flutterLoader().findAppBundlePath()
        e.dartExecutor.executeDartEntrypoint(DartExecutor.DartEntrypoint(bundle, "esewaBackgroundMain"))
        main.postDelayed(timeout, LIMIT_MS)
    }

    private fun finished(ctx: Context) {
        stop()
        // A notification arrived while it ran, maybe after its last look at
        // the queue: run once more. (Not a loop: the next run starts from now.)
        if (EsewaBridge.wakes != wakesAtStart) start(ctx)
    }

    private fun stop() {
        main.removeCallbacks(timeout)
        engine?.destroy()
        engine = null
        bridge = null
    }
}
