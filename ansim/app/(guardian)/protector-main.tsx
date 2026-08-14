import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  DimensionValue,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import HeaderBadge from '@/components/common/header-badge';
import LocationMapView from '@/components/map/location-map-view';
import NotificationView from '@/components/notifications/alarm';
import SettingView from '@/components/settings/setting-view';
import { getCurrentGuardianName } from '@/features/auth/current-session';
import { formatTimeSince, getLatestGps, GpsLocation } from '@/features/gps/gps-api';

export default function ProtectorMainScreen() {
  const router = useRouter();
  const guardianName = getCurrentGuardianName() || '보호자';

  const params = useLocalSearchParams<{
    subjectId?: string;
    targetName?: string;
    targetStatus?: '안전' | '주의' | '위험';
    targetScore?: string;
    targetGps?: string;
    targetPhone?: string;
    updatedTime?: string;
    tab?: 'home' | 'map' | 'notification' | 'setting';
  }>();

  const targetName = params.targetName || '슝슝슝';
  const targetStatus = params.targetStatus || '주의';
  const targetScore = params.targetScore || '56';
  const targetGps = params.targetGps || '55%';
  const targetPhone = params.targetPhone || '01055556666';
  const lastUpdated = params.updatedTime || '1분';

  const [activeTab, setActiveTab] = useState<string>(params.tab ?? 'home');
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    if (params.tab) setActiveTab(params.tab);
  }, [params.tab]);

  useEffect(() => {
    const subjectId = Number(params.subjectId);
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      setGpsError('보호대상자 ID가 없습니다.');
      return;
    }

    getLatestGps(subjectId)
      .then((location) => {
        setGpsLocation(location);
        setGpsError(null);
      })
      .catch((error) => {
        setGpsLocation(null);
        setGpsError(error instanceof Error ? error.message : 'GPS 위치를 가져오지 못했습니다.');
      });
  }, [params.subjectId, mapRefreshKey]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '안전':
        return '#2EAD61';
      case '주의':
        return '#FFBB01';
      case '위험':
        return '#E53E3E';
      default:
        return '#FFBB01';
    }
  };

  const currentStatusColor = getStatusColor(targetStatus);

  const handleCall = () => {
    Linking.openURL(`tel:${targetPhone}`).catch(() =>
      Alert.alert('오류', '전화 앱을 열 수 없습니다.')
    );
  };

  const handleFindFacility = () => {
    router.push({
      pathname: '/facility',
      params: { 
        targetName,
        subjectId: params.subjectId,
        isProtected: 'false'
      },
    });
  };

  const handleEmergencyCall = () => {
    Alert.alert('긴급신고', '112로 긴급 전화를 연결하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '신고하기', onPress: () => Linking.openURL('tel:112') },
    ]);
  };

  const currentPos = [gpsLocation?.latitude ?? 37.5665, gpsLocation?.longitude ?? 126.978];
  const gpsUpdatedAgo = gpsLocation ? `${formatTimeSince(gpsLocation.measuredAt)} 전` : '정보 없음';

  const simpleMapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${currentPos[0]}, ${currentPos[1]}], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

          var marker = L.marker([${currentPos[0]}, ${currentPos[1]}]).addTo(map);
          marker.bindPopup("<b>${targetName}님 위치</b>").openPopup();
        </script>
      </body>
    </html>
  `;

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.greetingText}>안녕하세요.</Text>
                <View style={styles.subGreetingRow}>
                  <Text style={styles.greetingSubText}>오늘도 </Text>
                  {/* 💡 router.back() 대신 router.push('/protector-select')로 명확하게 변경 */}
              <TouchableOpacity onPress={() => router.push('/protector-select')} activeOpacity={0.7}>
                    <View style={styles.nameBadge}>
                      <Text style={styles.nameBadgeText}>{targetName}님</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.greetingSubText}>의 안전을 함께 지켜요.</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsSidebarOpen(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="menu" size={34} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>한눈에 보는 요약</Text>
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/summary-detail',
                    params: { targetName, targetStatus, targetScore, targetGps },
                  })}
                  hitSlop={8}>
                  <Text style={styles.summaryMore}>더보기 &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.summaryBody}>
                <View>
                  <Text style={[styles.statusBigText, { color: currentStatusColor }]}>
                    {targetStatus}
                  </Text>
                  <Text style={styles.scoreText}>
                    <Text style={styles.scoreBold}>{targetScore}점</Text> / 100점
                  </Text>
                </View>

                <View style={styles.gpsProgressBox}>
                  <Text style={styles.gpsText}>GPS 이탈</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: targetGps as DimensionValue,
                          backgroundColor: currentStatusColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.gpsPercent}>{targetGps}</Text>
                </View>
              </View>
            </View>

            <View style={styles.locationHeader}>
              <Text style={styles.locationTitle}>실시간 위치</Text>
              <View style={styles.refreshRow}>
                <Text style={styles.refreshText}>마지막 업데이트 {gpsUpdatedAgo}</Text>
                <Ionicons name="refresh" size={18} color="#555" />
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={() => setActiveTab('map')}>
              <LocationMapView targetName={targetName} latitude={currentPos[0]} longitude={currentPos[1]} height={180} />
            </TouchableOpacity>

            <View style={styles.circleButtonsRow}>
              <TouchableOpacity style={styles.circleBtnContainer} onPress={handleCall} activeOpacity={0.8}>
                <View style={[styles.circleBtn, { backgroundColor: '#59A03D' }]}>
                  <Ionicons name="call" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.circleBtnLabel}>전화하기</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.circleBtnContainer} onPress={handleFindFacility} activeOpacity={0.8}>
                <View style={[styles.circleBtn, { backgroundColor: '#5C59E5' }]}>
                  <MaterialCommunityIcons name="office-building" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.circleBtnLabel}>복지시설</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.circleBtnContainer} onPress={handleEmergencyCall} activeOpacity={0.8}>
                <View style={[styles.circleBtn, { backgroundColor: '#E53E3E' }]}>
                  <Ionicons name="warning" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.circleBtnLabel}>긴급신고</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );

      case 'map':
        return (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.mapTabHeader}>
              <HeaderBadge title="실시간 위치" type="protector" align="center" />
              
              <TouchableOpacity
                style={{ position: 'absolute', right: 0 }}
                onPress={() => setMapRefreshKey((prev) => prev + 1)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="reload" size={26} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.mapDetailWrapper}>
              <WebView
                key={mapRefreshKey}
                originWhitelist={['*']}
                source={{ html: simpleMapHtml }}
                style={{ flex: 1 }}
                scrollEnabled={false}
              />
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <Ionicons name="location" size={20} color="#0066FF" style={{ marginRight: 4 }} />
                <Text style={styles.legendText}>현재 위치</Text>
              </View>
            </View>

            {gpsError ? <Text style={styles.gpsErrorText}>{gpsError}</Text> : null}

            <View style={styles.divider} />

            <Text style={styles.statusSectionTitle}>현재 상태</Text>

            <View style={styles.statusList}>
              <View style={styles.statusRow}>
                <Ionicons name="warning" size={26} color="#E53E3E" style={styles.statusIcon} />
                <Text style={styles.statusText}>
                  위험도 {targetScore}점 ({targetStatus})
                </Text>
              </View>

              <View style={styles.statusRow}>
                <Ionicons name="location-outline" size={26} color="#59A03D" style={styles.statusIcon} />
                <Text style={styles.statusText}>GPS 수신 정상</Text>
              </View>

              <View style={styles.statusRow}>
                <Ionicons name="time-outline" size={26} color="#59A03D" style={styles.statusIcon} />
                <Text style={styles.statusText}>최근 업데이트 {gpsUpdatedAgo}</Text>
              </View>

              <View style={styles.statusRow}>
                <Ionicons name="cloudy-outline" size={26} color="#59A03D" style={styles.statusIcon} />
                <Text style={styles.statusText}>날씨: 구름 많음 26°C</Text>
              </View>
            </View>
          </ScrollView>
        );

      case 'notification':
        return <NotificationView filterTargetName={targetName} />;

      case 'setting':
        return <SettingView isProtected={false} />;

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>{renderContent()}</View>

      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Ionicons name="home" size={26} color={activeTab === 'home' ? '#F7931E' : '#8E8E93'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'home' ? '#F7931E' : '#8E8E93' }]}>홈</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('map')}>
          <Ionicons name="map-outline" size={26} color={activeTab === 'map' ? '#F7931E' : '#8E8E93'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'map' ? '#F7931E' : '#8E8E93' }]}>지도</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('notification')}>
          <Ionicons name="notifications-outline" size={26} color={activeTab === 'notification' ? '#F7931E' : '#8E8E93'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'notification' ? '#F7931E' : '#8E8E93' }]}>알림</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('setting')}>
          <Ionicons name="settings-outline" size={26} color={activeTab === 'setting' ? '#F7931E' : '#8E8E93'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'setting' ? '#F7931E' : '#8E8E93' }]}>설정</Text>
        </TouchableOpacity>
      </View>

      {isSidebarOpen && (
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity style={styles.sidebarDim} activeOpacity={1} onPress={() => setIsSidebarOpen(false)} />
          <View style={styles.sidebarPanel}>
            <TouchableOpacity style={styles.sidebarBack} onPress={() => setIsSidebarOpen(false)} hitSlop={12}>
              <Ionicons name="arrow-back" size={30} color="#111111" />
            </TouchableOpacity>

            <View style={styles.sidebarProfile}>
              <View style={styles.sidebarAvatar}><Ionicons name="person" size={43} color="#FFFFFF" /></View>
              <View>
                <Text style={styles.sidebarName}>{guardianName}</Text>
                <Text style={styles.sidebarRole}>보호자</Text>
              </View>
            </View>

            <View style={styles.sidebarDivider} />
            <TouchableOpacity style={styles.sidebarItem} onPress={() => { setActiveTab('home'); setIsSidebarOpen(false); }}>
              <Ionicons name="home-outline" size={27} color="#666666" /><Text style={styles.sidebarItemText}>홈</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarItem} onPress={() => router.push('/protector-select')}>
              <Ionicons name="people-outline" size={27} color="#666666" /><Text style={styles.sidebarItemText}>보호대상 관리</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarItem} onPress={() => { setActiveTab('setting'); setIsSidebarOpen(false); }}>
              <Ionicons name="settings-outline" size={27} color="#666666" /><Text style={styles.sidebarItemText}>설정</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarItem} onPress={() => Alert.alert('도움말', '도움말 기능을 준비 중입니다.')}>
              <Ionicons name="help-circle-outline" size={27} color="#666666" /><Text style={styles.sidebarItemText}>도움말</Text>
            </TouchableOpacity>

            <View style={styles.sidebarBottom}>
              <View style={styles.sidebarDivider} />
              <TouchableOpacity style={styles.sidebarLogout} onPress={() => router.replace('/select-type')}>
                <Ionicons name="log-out-outline" size={27} color="#FF2525" /><Text style={styles.sidebarLogoutText}>로그아웃</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
  },
  subGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  greetingSubText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  nameBadge: {
    backgroundColor: '#F7931E',
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  nameBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  summaryCard: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  summaryMore: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#666666',
  },
  summaryBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBigText: {
    fontSize: 38,
    fontWeight: 'bold',
  },
  scoreText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  scoreBold: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
  },
  gpsProgressBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#444444',
    marginRight: 8,
  },
  progressBarBg: {
    width: 70,
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  gpsPercent: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshText: {
    fontSize: 13,
    color: '#666666',
  },
  circleButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginBottom: 10,
    marginTop: 16,
  },
  circleBtnContainer: {
    alignItems: 'center',
  },
  circleBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  circleBtnLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333333',
  },
  mapTabHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
    height: 36,
  },
  mapDetailWrapper: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  gpsErrorText: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 13,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginVertical: 16,
  },
  statusSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  statusList: {
    paddingHorizontal: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    width: 32,
    marginRight: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444444',
  },
  bottomTabBar: {
    flexDirection: 'row',
    height: 65,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingBottom: 5,
  },
  sidebarOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 10 },
  sidebarDim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  sidebarPanel: { width: '78%', paddingHorizontal: 26, backgroundColor: '#FFFFFF' },
  sidebarBack: { alignSelf: 'flex-start', marginTop: 26 },
  sidebarProfile: { flexDirection: 'row', alignItems: 'center', marginTop: 52, marginLeft: 12 },
  sidebarAvatar: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFE0AA', borderWidth: 1, borderColor: '#E9CB97', marginRight: 30 },
  sidebarName: { fontSize: 23, fontWeight: 'bold', color: '#111111' },
  sidebarRole: { marginTop: 10, fontSize: 15, fontWeight: '600', color: '#666666' },
  sidebarDivider: { height: 1, marginTop: 31, backgroundColor: '#E0E0E0' },
  sidebarItem: { height: 48, flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  sidebarItemText: { marginLeft: 20, fontSize: 18, fontWeight: '600', color: '#666666' },
  sidebarBottom: { marginTop: 'auto', marginBottom: 80 },
  sidebarLogout: { height: 67, flexDirection: 'row', alignItems: 'center', paddingLeft: 17 },
  sidebarLogoutText: { marginLeft: 17, fontSize: 18, fontWeight: 'bold', color: '#FF2525' },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
});
