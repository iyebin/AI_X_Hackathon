package com.anonymous

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class GpsService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var subjectId: Int = -1 // 💡 보호대상자 id, JS에서 startTracking(subjectId)로 전달받음

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // 백그라운드 GPS 수집 콜백
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    // DB 저장용 백엔드 API 호출
                    sendLocationToBackend(location.latitude, location.longitude)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // 💡 GpsModule에서 넘겨준 subject_id를 읽어옴 (없으면 -1)
        val incomingSubjectId = intent?.getIntExtra("subject_id", -1) ?: -1
        if (incomingSubjectId != -1) {
            subjectId = incomingSubjectId
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("안심보호 서비스 가동 중")
            .setContentText("실시간 위치 추적이 활성화되어 있습니다.")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        // 💡 버그 수정: Android 14(API 34)부터는 포그라운드 서비스 타입을 명시하지 않으면
        // MissingForegroundServiceTypeException으로 크래시납니다.
        // ⚠️ AndroidManifest.xml의 <service> 태그에도
        // android:foregroundServiceType="location" 속성이 함께 있어야 합니다.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // 💡 5분(300,000ms) 간격으로 위치 업데이트 요청 (배터리 절약을 위해 간격 확대)
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5 * 60 * 1000L)
            .setMinUpdateIntervalMillis(60 * 1000L) // 다른 앱이 더 자주 요청해도 최소 1분 간격은 유지
            .build()

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
        } catch (e: SecurityException) {
            e.printStackTrace()
        }

        return START_STICKY
    }

    // 백엔드 DB 서버로 좌표 전송 (GPS 저장 API)
    private fun sendLocationToBackend(lat: Double, lng: Double) {
        if (subjectId == -1) {
            println("GPS 전송 실패: subject_id가 설정되지 않음")
            return
        }

        thread {
            try {
                val url = URL("$API_BASE_URL/gps")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.doOutput = true

                val jsonInputString =
                    "{\"subject_id\": $subjectId, \"latitude\": $lat, \"longitude\": $lng}"

                OutputStreamWriter(conn.outputStream).use { os ->
                    os.write(jsonInputString)
                    os.flush()
                }

                val responseCode = conn.responseCode
                println("GPS 백엔드 전송 응답 코드: $responseCode")
                conn.disconnect()

                // 💡 GPS 저장이 성공하면(2xx) 주변 기관 조회 API를 이어서 호출
                if (responseCode in 200..299) {
                    fetchNearestInstitutions(subjectId)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // 저장 성공 후 주변 기관 조회 (GET /subjects/{subject_id}/institutions/nearest)
    private fun fetchNearestInstitutions(subjectId: Int) {
        thread {
            try {
                val url = URL("$API_BASE_URL/subjects/$subjectId/institutions/nearest")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"

                val responseCode = conn.responseCode
                val responseBody = conn.inputStream.bufferedReader().use { it.readText() }
                println("주변 기관 조회 응답 코드: $responseCode / $responseBody")
                conn.disconnect()

                // TODO: 응답받은 기관 목록을 JS로 전달하려면
                // RCTDeviceEventEmitter로 이벤트를 emit해서 facility.tsx에서 구독하게 해야 합니다.
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "GPS Service Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    companion object {
        private const val API_BASE_URL = "https://medal-bacterial-nvidia-customize.trycloudflare.com"
        private const val CHANNEL_ID = "GpsServiceChannel"
        private const val NOTIFICATION_ID = 1001
    }
}
