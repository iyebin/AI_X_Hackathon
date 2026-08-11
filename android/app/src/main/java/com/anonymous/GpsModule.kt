package com.anonymous

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class GpsModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "GpsModule"

    @ReactMethod
    fun startTracking(subjectId: Double) {
        // 💡 subject_id(보호대상자 id)를 Intent extra로 실어서 GpsService에 전달
        val intent = Intent(reactContext, GpsService::class.java)
        intent.putExtra("subject_id", subjectId.toInt())
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopTracking() {
        val intent = Intent(reactContext, GpsService::class.java)
        reactContext.stopService(intent)
    }
}