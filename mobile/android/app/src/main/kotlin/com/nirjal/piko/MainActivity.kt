package com.nirjal.piko

import com.nirjal.piko.esewa.EsewaBridge
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // eSewa auto-capture: the channels Dart uses to read the notification queue.
        EsewaBridge.register(flutterEngine, applicationContext)
    }
}
