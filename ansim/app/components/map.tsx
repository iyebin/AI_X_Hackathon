import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function MapDetailScreen() {
  const router = useRouter();

  // 💡 선택된 보호대상자의 데이터를 파라미터로 받아옵니다.
  const params = useLocalSearchParams<{
    targetName?: string;
    targetStatus?: string;
    targetScore?: string;
    targetGps?: string;
    updatedTime?: string;
  }>();

  const targetName = params.targetName || '슝슝슝';
  const targetStatus = params.targetStatus || '주의';
  const targetScore = params.targetScore || '56';
  const lastUpdated = params.updatedTime || '1분';

  const [refreshKey, setRefreshKey] = useState(0);

  // 새로고침 버튼 동작
  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // 💡 실시간 GPS 위치 좌표
  const currentPos = [37.5665, 126.9780];

  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #FDE4B8; }
          .custom-blue-dot {
            width: 18px;
            height: 18px;
            background-color: #0066FF;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 6px rgba(0,102,255,0.6);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${currentPos[0]}, ${currentPos[1]}], 16);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(map);

          var blueIcon = L.divIcon({
            className: 'custom-blue-dot',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });
          L.marker([${currentPos[0]}, ${currentPos[1]}], { icon: blueIcon }).addTo(map);
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. 상단 Header (뒤로가기, "실시간 위치" 뱃지, 새로고침) */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={28} color="#000000" />
        </TouchableOpacity>

        <View style={styles.badgeContainer}>
          <View style={styles.orangeBadge}>
            <Text style={styles.orangeBadgeText}>실시간 위치</Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleRefresh} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="reload" size={26} color="#000000" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. 지도 박스 (선 없는 마커 지도) */}
        <View style={styles.mapWrapper}>
          <WebView
            key={refreshKey}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            scrollEnabled={false}
          />
        </View>

        {/* 3. 지도 범례 (현재 위치만 표시) */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={styles.blueDot} />
            <Text style={styles.legendText}>현재 위치</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 4. 현재 상태 정보 영역 */}
        <Text style={styles.statusSectionTitle}>현재 상태</Text>

        <View style={styles.statusList}>
          {/* 위험도 점수 */}
          <View style={styles.statusRow}>
            <Ionicons name="warning" size={26} color="#E53E3E" style={styles.statusIcon} />
            <Text style={styles.statusText}>
              위험도 {targetScore}점 ({targetStatus})
            </Text>
          </View>

          {/* GPS 수신 상태 */}
          <View style={styles.statusRow}>
            <Ionicons name="location-outline" size={26} color="#55A238" style={styles.statusIcon} />
            <Text style={styles.statusText}>GPS 수신 정상</Text>
          </View>

          {/* 최근 업데이트 시간 */}
          <View style={styles.statusRow}>
            <Ionicons name="time-outline" size={26} color="#55A238" style={styles.statusIcon} />
            <Text style={styles.statusText}>최근 업데이트 {lastUpdated} 전</Text>
          </View>

          {/* 날씨 */}
          <View style={styles.statusRow}>
            <Ionicons name="cloudy-outline" size={26} color="#55A238" style={styles.statusIcon} />
            <Text style={styles.statusText}>날씨: 구름 많음 26°C</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  badgeContainer: {
    alignItems: 'center',
  },
  orangeBadge: {
    backgroundColor: '#F7931D',
    paddingHorizontal: 22,
    paddingVertical: 36,
    borderRadius: 18,
  },
  orangeBadgeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mapWrapper: {
    width: '100%',
    height: 320,
    backgroundColor: '#FDE4B8',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blueDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0066FF',
    marginRight: 6,
  },
  legendText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginBottom: 24,
  },
  statusSectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  statusList: {
    paddingHorizontal: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIcon: {
    width: 32,
    marginRight: 12,
  },
  statusText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#444444',
  },
});