package com.anonymous.ansim

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.concurrent.thread

class GpsService : Service() {
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var subjectId: Int = -1

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    sendLocationToBackend(location.latitude, location.longitude, location.time)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        subjectId = intent?.getIntExtra(EXTRA_SUBJECT_ID, -1) ?: -1
        if (subjectId <= 0) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("안심하랑께 위치 추적 중")
            .setContentText("5분 간격으로 현재 위치를 전송합니다.")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        startForeground(NOTIFICATION_ID, notification)

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_INTERVAL_MILLIS,
        ).setMinUpdateIntervalMillis(LOCATION_INTERVAL_MILLIS).build()

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
        } catch (exception: SecurityException) {
            stopSelf(startId)
        }
        return START_STICKY
    }

    private fun sendLocationToBackend(latitude: Double, longitude: Double, measuredAtMillis: Long) {
        val currentSubjectId = subjectId
        thread {
            var connection: HttpURLConnection? = null
            try {
                connection = URL(GPS_ENDPOINT).openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.connectTimeout = NETWORK_TIMEOUT_MILLIS
                connection.readTimeout = NETWORK_TIMEOUT_MILLIS
                connection.doOutput = true
                // 서버와 AI가 모두 한국 시간 기준의 숫자를 사용하도록, 시간대 접미사 없이 KST 시각을 전송합니다.
                val measuredAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("Asia/Seoul")
                }.format(Date(measuredAtMillis))
                val body = "{\"subject_id\":$currentSubjectId,\"latitude\":$latitude,\"longitude\":$longitude,\"measured_at\":\"$measuredAt\"}"
                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer -> writer.write(body) }
                val responseCode = connection.responseCode

                if (responseCode in 200..299) {
                    android.util.Log.i(
                        TAG,
                        "GPS 저장 성공: HTTP $responseCode",
                        connection.disconnect()
                        connection = null
                    )

                    requestRiskInference(currentSubjectId)
                } else {
                    android.util.Log.w(
                        TAG,
                        "GPS 저장 실패: HTTP $responseCode",
                    )
                }
            } catch (exception: Exception) {
                android.util.Log.e(TAG, "GPS 서버 전송 실패", exception)
            } finally {
                connection?.disconnect()
            }
        }
    }
    private fun requestRiskInference(
        currentSubjectId: Int,
    ) {
        var connection: HttpURLConnection? = null

        try {
            val endpoint =
                "$API_BASE_URL/subjects/" +
                    "$currentSubjectId/gps-inference"

            connection =
                URL(endpoint).openConnection()
                    as HttpURLConnection

            connection.requestMethod = "POST"
            connection.connectTimeout =
                NETWORK_TIMEOUT_MILLIS
            connection.readTimeout =
                INFERENCE_TIMEOUT_MILLIS

            val responseCode = connection.responseCode

            val responseStream =
                if (responseCode in 200..299) {
                    connection.inputStream
                } else {
                    connection.errorStream
                }

            val responseBody =
                responseStream
                    ?.bufferedReader()
                    ?.use { reader ->
                        reader.readText()
                    }
                    ?: ""

            if (responseCode in 200..299) {
                android.util.Log.i(
                    TAG,
                    "위험도 추론 성공: " +
                        "HTTP $responseCode / " +
                        responseBody,
                )
            } else {
                android.util.Log.w(
                    TAG,
                    "위험도 추론 생략 또는 실패: " +
                        "HTTP $responseCode / " +
                        responseBody,
                )
            }
        } catch (exception: Exception) {
            android.util.Log.e(
                TAG,
                "위험도 추론 요청 실패",
                exception,
            )
        } finally {
            connection?.disconnect()
        }
    }
    override fun onDestroy() {
            fusedLocationClient.removeLocationUpdates(locationCallback)
            super.onDestroy()
        }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "GPS 위치 추적", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    companion object {
        const val EXTRA_SUBJECT_ID = "subject_id"

        private const val API_BASE_URL =
            "https://ai-x-hackathon-backend.onrender.com"

        private const val GPS_ENDPOINT =
            "$API_BASE_URL/gps"

        private const val LOCATION_INTERVAL_MILLIS =
            5 * 60 * 1000L

        private const val NETWORK_TIMEOUT_MILLIS =
            15_000

        private const val INFERENCE_TIMEOUT_MILLIS =
            120_000

        private const val CHANNEL_ID =
            "gps_tracking"

        private const val NOTIFICATION_ID = 1001
        private const val TAG = "GpsService"
    }
}
