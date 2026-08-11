package com.anonymous.ansim

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class GpsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "GpsModule"

    @ReactMethod
    fun startTracking(subjectId: Int) {
        val intent = Intent(reactContext, GpsService::class.java).apply {
            putExtra(GpsService.EXTRA_SUBJECT_ID, subjectId)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopTracking() {
        reactContext.stopService(Intent(reactContext, GpsService::class.java))
    }
}
