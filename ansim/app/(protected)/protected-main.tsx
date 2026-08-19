import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProtectedMapView from '@/components/map/protected-map';
import NotificationView from '@/components/notifications/alarm';
import SettingView from '@/components/settings/setting-view';
import { getAlerts } from '@/features/alerts/alerts-api';
import { getProtectorPhone } from '@/features/contacts/protector-contact-store';
import { startGpsTracking, stopGpsTracking } from '@/features/gps/tracking';
import { registerPushNotifications } from '@/features/notifications/push-registration';
import { getWeatherSummary } from '@/features/environment/weather-api';

export default function ProtectedMainScreen() {
  const router = useRouter();

  const { userName, protectorPhone, subjectId, tab } = useLocalSearchParams<{
    userName?: string;
    protectorPhone?: string;
    subjectId?: string;
    tab?: 'home' | 'map' | 'notification' | 'setting';
  }>();

  const displayName = userName || '슝슝슝';
  const [targetPhone, setTargetPhone] = useState(getProtectorPhone() || protectorPhone || '');
  const numericSubjectId = Number(subjectId);

  const [activeTab, setActiveTab] = useState<string>(tab ?? 'home');
  const [weatherNotice, setWeatherNotice] = useState('날씨 정보를 불러오는 중입니다.');
  const [weatherAdvisory, setWeatherAdvisory] = useState('기상 특보 정보를 불러오는 중입니다.');
  const lastVisibleDangerAlertId = useRef<string | null>(null);
  const isAlertBaselineReady = useRef(false);
  const isAppForeground = useRef(AppState.currentState === 'active');

  useEffect(() => {
    if (tab) setActiveTab(tab);
  }, [tab]);

  useEffect(() => {
    if (!Number.isInteger(numericSubjectId) || numericSubjectId <= 0) return;
    void registerPushNotifications({ userId: numericSubjectId, userType: 'subject' }).catch((error) => {
      console.warn('푸시 알림 등록에 실패했습니다.', error);
    });
  }, [subjectId, numericSubjectId]);

  useEffect(() => {
    if (protectorPhone) setTargetPhone(protectorPhone);
  }, [protectorPhone]);

  useEffect(() => {
    if (!Number.isInteger(numericSubjectId) || numericSubjectId <= 0) {
      setWeatherNotice('날씨 정보를 확인할 수 없습니다.');
      setWeatherAdvisory('기상 특보 정보를 확인할 수 없습니다.');
      return;
    }

    void getWeatherSummary(numericSubjectId)
      .then((weather) => {
        setWeatherNotice(weather.headline);
        setWeatherAdvisory(weather.advisory ?? '현재 발효 중인 기상 특보가 없습니다.');
      })
      .catch(() => {
        setWeatherNotice('날씨 정보를 불러오지 못했습니다.');
        setWeatherAdvisory('기상 특보 정보를 불러오지 못했습니다.');
      });
  }, [numericSubjectId]);

  useEffect(() => {
    if (!Number.isInteger(numericSubjectId) || numericSubjectId <= 0) return;

    let isDisposed = false;
    const establishBaseline = async () => {
      try {
        const latestDanger = (await getAlerts({ subjectId: numericSubjectId, recipientType: 'subject', recipientId: numericSubjectId })).find((alert) => alert.kind === 'danger' && !alert.isRead);
        if (!isDisposed) {
          lastVisibleDangerAlertId.current = latestDanger?.id ?? null;
          isAlertBaselineReady.current = true;
        }
      } catch {
        if (!isDisposed) isAlertBaselineReady.current = true;
      }
    };

    const checkNewForegroundDangerAlert = async () => {
      if (isDisposed || !isAppForeground.current || !isAlertBaselineReady.current) return;
      try {
        const latestDanger = (await getAlerts({ subjectId: numericSubjectId, recipientType: 'subject', recipientId: numericSubjectId })).find((alert) => alert.kind === 'danger' && !alert.isRead);
        if (!latestDanger || latestDanger.id === lastVisibleDangerAlertId.current) return;

        lastVisibleDangerAlertId.current = latestDanger.id;
        router.push({
          pathname: '/danger-modal',
          params: {
            alertId: latestDanger.id,
            subjectId: String(numericSubjectId),
            targetName: displayName,
            targetPhone,
            dangerScore: String(latestDanger.riskScore ?? ''),
            dangerReasons: latestDanger.reason ?? latestDanger.message ?? '위험 요인 정보 없음',
            alertCreatedAt: latestDanger.createdAt ?? '',
            riskSnapshot: latestDanger.riskSnapshot ? JSON.stringify(latestDanger.riskSnapshot) : '',
            viewerRole: 'protected',
          },
        });
      } catch {
        // 다음 주기에서 다시 확인합니다.
      }
    };

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const becomingActive = nextState === 'active' && !isAppForeground.current;
      isAppForeground.current = nextState === 'active';
      if (becomingActive) {
        isAlertBaselineReady.current = false;
        void establishBaseline();
      }
    });

    isAlertBaselineReady.current = false;
    void establishBaseline();
    const intervalId = setInterval(() => void checkNewForegroundDangerAlert(), 10_000);

    return () => {
      isDisposed = true;
      appStateSubscription.remove();
      clearInterval(intervalId);
    };
  }, [displayName, numericSubjectId, router, targetPhone]);

  const handleCallProtector = () => {
    if (!targetPhone) {
      Alert.alert('알림', '등록된 보호자 전화번호가 없습니다.');
      return;
    }
    Linking.openURL(`tel:${targetPhone}`).catch(() =>
      Alert.alert('오류', '전화 앱을 열 수 없습니다.')
    );
  };

  const handleFindFacility = () => {
    router.push({
      pathname: '/protected-facility',
      params: {
        targetName: displayName,
        isProtected: 'true',
        subjectId,
      },
    });
  };

  const handleEmergencyCall = () => {
    Alert.alert('긴급신고', '112 또는 119로 긴급 연결하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '신고하기', onPress: () => Linking.openURL('tel:112') },
    ]);
  };

  const handleLocationTrackingChange = async (enabled: boolean) => {
    const numericSubjectId = Number(subjectId);
    if (!Number.isInteger(numericSubjectId) || numericSubjectId <= 0) {
      Alert.alert('위치 추적 실패', '보호대상자 정보를 찾을 수 없습니다.');
      return false;
    }

    try {
      if (enabled) {
        await startGpsTracking(numericSubjectId);
        Alert.alert('위치 추적 시작', '5분 간격으로 현재 위치를 전송합니다.');
      } else {
        stopGpsTracking();
        Alert.alert('위치 추적 중지', 'GPS 수집과 위치 전송을 중지했습니다.');
      }
      return true;
    } catch (error) {
      Alert.alert('위치 추적 실패', error instanceof Error ? error.message : '위치 추적 설정을 변경하지 못했습니다.');
      return false;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.greetingText}>안녕하세요.</Text>
                <Text style={styles.nameText}>{displayName}님!</Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveTab('notification')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="notifications-outline" size={32} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.subGreeting}>오늘도 안전한 하루 되세요😊</Text>

            <TouchableOpacity
              style={[styles.cardButton, styles.callCard]}
              onPress={handleCallProtector}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={36} color="#59A03D" />
              <Text style={styles.cardText}>보호자에게 전화하기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardButton, styles.facilityCard]}
              onPress={handleFindFacility}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="office-building" size={36} color="#3182CE" />
              <Text style={styles.cardText}>가까운 복지시설 찾기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardButton, styles.emergencyCard]}
              onPress={handleEmergencyCall}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="lightbulb-on" size={36} color="#E53E3E" />
              <Text style={styles.cardText}>긴급신고</Text>
            </TouchableOpacity>

            <View style={styles.noticeRow}>
              <View style={[styles.noticeBox, styles.weatherNoticeBox]}>
                <Ionicons name="thermometer-outline" size={25} color="#E05A2A" />
                <Text style={styles.noticeTitle}>현재 날씨</Text>
                <Text style={styles.noticeContent}>{weatherNotice}</Text>
              </View>
              <View style={[styles.noticeBox, styles.advisoryNoticeBox]}>
                <Ionicons name="warning-outline" size={25} color="#D97706" />
                <Text style={styles.noticeTitle}>기상 특보</Text>
                <Text style={styles.noticeContent}>{weatherAdvisory}</Text>
              </View>
            </View>
          </ScrollView>
        );

      case 'map':
        return (
          <ProtectedMapView
            subjectId={numericSubjectId}
            targetName={displayName}
            lastUpdated="1분 전"
          />
        );

      case 'notification':
        return (
          <NotificationView
            filterTargetName={displayName}
            subjectId={numericSubjectId}
            targetPhone={targetPhone}
            themeColor="#59A03D"
            viewerRole="protected"
            recipientType="subject"
            recipientId={numericSubjectId}
          />
        );

      case 'setting':
        return <SettingView isProtected={true} notificationUser={Number.isInteger(numericSubjectId) && numericSubjectId > 0 ? { userId: numericSubjectId, userType: 'subject' } : undefined} onLocationTrackingChange={handleLocationTrackingChange} onEmergencyContactSaved={() => setTargetPhone(getProtectorPhone() ?? '')} />;

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>{renderContent()}</View>

      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Ionicons
            name="home"
            size={28}
            color={activeTab === 'home' ? '#59A03D' : '#8E8E93'}
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'home' ? '#55A238' : '#8E8E93' }]}>
            홈
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('map')}>
          <Ionicons
            name="map-outline"
            size={28}
            color={activeTab === 'map' ? '#59A03D' : '#8E8E93'}
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'map' ? '#55A238' : '#8E8E93' }]}>
            지도
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('notification')}>
          <Ionicons
            name="notifications-outline"
            size={28}
            color={activeTab === 'notification' ? '#59A03D' : '#8E8E93'}
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'notification' ? '#55A238' : '#8E8E93' }]}>
            알림
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('setting')}>
          <Ionicons
            name="settings-outline"
            size={28}
            color={activeTab === 'setting' ? '#59A03D' : '#8E8E93'}
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'setting' ? '#55A238' : '#8E8E93' }]}>
            설정
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  contentContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 },
  greetingText: { fontSize: 26, fontWeight: 'bold', color: '#000000' },
  nameText: { fontSize: 28, fontWeight: '900', color: '#000000', marginTop: 4 },
  subGreeting: { fontSize: 18, fontWeight: '600', color: '#555555', marginTop: 16, marginBottom: 32 },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  callCard: { borderColor: '#C6E8B3' },
  facilityCard: { borderColor: '#BEE3F8' },
  emergencyCard: { borderColor: '#FEB2B2' },
  cardText: { fontSize: 20, fontWeight: 'bold', color: '#333333', marginLeft: 16 },
  noticeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  noticeBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    minHeight: 142,
  },
  weatherNoticeBox: { backgroundColor: '#EFF8FF', borderColor: '#BEE3F8' },
  advisoryNoticeBox: { backgroundColor: '#FFF7E8', borderColor: '#FEE0A5' },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginTop: 8, marginBottom: 8 },
  noticeContent: { fontSize: 15, fontWeight: '600', color: '#4A5568', lineHeight: 21 },
  bottomTabBar: {
    flexDirection: 'row',
    height: 65,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingBottom: 5,
  },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
});
