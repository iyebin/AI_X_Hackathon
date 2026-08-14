import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import HeaderBadge from '@/components/common/header-badge';

interface ProtectedMapViewProps {
  targetName?: string;
  latitude?: number;
  longitude?: number;
  lastUpdated?: string;
  weatherText?: string;
}

export default function ProtectedMapView({
  targetName = '보호대상자',
  latitude = 37.5665,
  longitude = 126.9780,
  lastUpdated = '1분 전',
  weatherText = '구름 많음 26°C',
}: ProtectedMapViewProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // 선 없는 파란색 위치 점 마커 HTML
  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
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
          var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${latitude}, ${longitude}], 16);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(map);

          var blueIcon = L.divIcon({
            className: 'custom-blue-dot',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          L.marker([${latitude}, ${longitude}], { icon: blueIcon }).addTo(map);
        </script>
      </body>
    </html>
  `;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. 상단 HeaderBadge + 새로고침 */}
      <View style={styles.topHeader}>
        <HeaderBadge title="실시간 위치" type="protected" align="center" />
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="reload" size={26} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* 2. 지도 영역 */}
      <View style={styles.mapWrapper}>
        <WebView
          key={refreshKey}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={{ flex: 1 }}
          scrollEnabled={false}
        />
      </View>

      {/* 3. 하단 현재 상태 영역 */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusSectionTitle}>현재 상태</Text>

        <View style={styles.statusList}>
          <View style={styles.statusRow}>
            <Ionicons name="time-outline" size={26} color="#59A03D" style={styles.statusIcon} />
            <Text style={styles.statusText}>최근 업데이트 {lastUpdated}</Text>
          </View>

          <View style={styles.statusRow}>
            <Ionicons name="cloudy-outline" size={26} color="#59A03D" style={styles.statusIcon} />
            <Text style={styles.statusText}>날씨: {weatherText}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  topHeader: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    position: 'absolute',
    right: 0,
  },
  mapWrapper: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginBottom: 24,
  },
  statusContainer: {
    paddingHorizontal: 4,
  },
  statusSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  statusList: {
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 12,
  },
  statusText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#444444',
  },
});
