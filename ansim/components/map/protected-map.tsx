import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/common/scaled-text';
import { WebView } from 'react-native-webview';
import HeaderBadge from '@/components/common/header-badge';
import { getWeatherSummary } from '@/features/environment/weather-api';
import { formatTimeSince, getLatestGps } from '@/features/gps/gps-api';

interface ProtectedMapViewProps {
  subjectId?: number;
  targetName?: string;
  latitude?: number;
  longitude?: number;
  lastUpdated?: string;
  weatherText?: string;
}

export default function ProtectedMapView({
  subjectId,
  targetName = '보호대상자',
  latitude = 37.5665,
  longitude = 126.978,
  lastUpdated = '정보 없음',
  weatherText,
}: ProtectedMapViewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentLocation, setCurrentLocation] = useState({ latitude, longitude });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastMeasuredAt, setLastMeasuredAt] = useState<string | undefined>();
  const [serverWeatherText, setServerWeatherText] = useState<string | null>('날씨 정보를 불러오는 중입니다.');
  const displayWeatherText = serverWeatherText ?? weatherText;

  useEffect(() => {
    const numericSubjectId = Number(subjectId);
    if (!Number.isInteger(numericSubjectId) || numericSubjectId <= 0) {
      setLocationError('보호대상자 정보를 확인할 수 없습니다.');
      return;
    }

    let isActive = true;
    const loadLatestGps = async () => {
      try {
        const gps = await getLatestGps(numericSubjectId);
        if (!isActive) return;
        setCurrentLocation({ latitude: gps.latitude, longitude: gps.longitude });
        setLastMeasuredAt(gps.measuredAt);
        setLocationError(null);
      } catch (error) {
        if (!isActive) return;
        setLocationError(error instanceof Error ? error.message : '저장된 위치를 불러오지 못했습니다.');
      }
    };

    void loadLatestGps();
    const intervalId = setInterval(() => void loadLatestGps(), 15_000);
    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [subjectId, refreshKey]);

  useEffect(() => {
    const numericSubjectId = Number(subjectId);
    if (!Number.isInteger(numericSubjectId) || numericSubjectId <= 0) {
      setServerWeatherText('날씨 정보를 확인할 수 없습니다.');
      return;
    }

    void getWeatherSummary(numericSubjectId)
      .then((weather) => setServerWeatherText(weather.text))
      .catch(() => setServerWeatherText('날씨 정보를 불러오지 못했습니다.'));
  }, [subjectId, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((previous) => previous + 1);
  };

  const mapHtml = `
    <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body,html,#map{width:100%;height:100%;margin:0}.dot{width:18px;height:18px;background:#0066FF;border:3px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,102,255,.6)}</style>
    </head><body><div id="map"></div><script>
      var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${currentLocation.latitude},${currentLocation.longitude}],16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
      var icon=L.divIcon({className:'dot',iconSize:[24,24],iconAnchor:[12,12]});
      L.marker([${currentLocation.latitude},${currentLocation.longitude}],{icon:icon}).addTo(map).bindPopup('<b>${targetName}님 현재 위치</b>');
    </script></body></html>`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.topHeader}>
        <HeaderBadge title="실시간 위치" type="protected" align="center" />
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} hitSlop={10}>
          <Ionicons name="reload" size={26} color="#000000" />
        </TouchableOpacity>
      </View>
      <View style={styles.mapWrapper}>
        <WebView key={refreshKey} originWhitelist={['*']} source={{ html: mapHtml }} style={{ flex: 1 }} scrollEnabled={false} />
      </View>
      <View style={styles.statusContainer}>
        <Text style={styles.statusSectionTitle}>현재 상태</Text>
        <View style={styles.statusRow}>
          <Ionicons name="time-outline" size={26} color="#59A03D" style={styles.statusIcon} />
          <Text style={styles.statusText}>최근 업데이트 {lastMeasuredAt ? `${formatTimeSince(lastMeasuredAt)} 전` : lastUpdated}</Text>
        </View>
        {displayWeatherText ? <View style={styles.statusRow}>
          <Ionicons name="cloudy-outline" size={26} color="#59A03D" style={styles.statusIcon} />
          <Text style={styles.statusText}>{displayWeatherText}</Text>
        </View> : null}
        {locationError ? <Text style={styles.locationErrorText}>{locationError}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  topHeader: { position: 'relative', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  refreshButton: { position: 'absolute', right: 0 },
  mapWrapper: { width: '100%', height: 280, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E0E0E0', marginBottom: 24 },
  statusContainer: { paddingHorizontal: 4 },
  statusSectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#000000', marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusIcon: { marginRight: 12 },
  statusText: { flex: 1, flexShrink: 1, fontSize: 17, fontWeight: 'bold', color: '#444444', lineHeight: 24 },
  locationErrorText: { color: '#777777', fontSize: 14, marginTop: 2 },
});
