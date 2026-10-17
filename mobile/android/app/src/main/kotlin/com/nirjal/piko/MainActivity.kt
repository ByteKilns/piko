package com.nirjal.piko

import android.content.Intent
import com.nirjal.piko.esewa.DraftNotifier
import com.nirjal.piko.esewa.EsewaBridge
import com.nirjal.piko.esewa.EsewaNotificationListener
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // eSewa auto-capture: the channels Dart uses to read the notification queue.
        EsewaBridge.attachUi(flutterEngine, applicationContext, this)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        // New notifications go to the background engine from now on.
        EsewaBridge.detachUi()
        super.cleanUpFlutterEngine(flutterEngine)
    }

    override fun onResume() {
        super.onResume()
        DraftNotifier.appVisible = true
        EsewaNotificationListener.rebindIfDisconnected(applicationContext)
    }

    override fun onPause() {
        DraftNotifier.appVisible = false
        super.onPause()
    }

    // A tapped alert while Piko is running: Dart reads its target on resume.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
