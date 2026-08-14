import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProtectedMapView from '@/components/map/protected-map';
import ProtectedNotificationScreen from '@/components/notifications/protected-notification-screen';
import SettingView from '@/components/settings/setting-view';
import { getProtectorPhone } from '@/features/contacts/protector-contact-store';

export default function ProtectedMainScreen() {
  const router = useRouter();

  const { userName, protectorPhone, subjectId, tab } = useLocalSearchParams<{
    userName?: string;
    protectorPhone?: string;
    subjectId?: string;
    tab?: 'home' | 'map' | 'notification' | 'setting';
  }>();

  const displayName = userName || '슝슝슝';
  const [targetPhone, setTargetPhone] = useState(getProtectorPhone() || protectorPhone || '01012345678');

  const [activeTab, setActiveTab] = useState<string>(tab ?? 'home');

  useEffect(() => {
    if (tab) setActiveTab(tab);
  }, [tab]);

  useEffect(() => {
    if (protectorPhone) setTargetPhone(protectorPhone);
  }, [protectorPhone]);

  const [notice] = useState({
    title: '공지사항',
    content: '폭우주의보 발령 중입니다.\n외출 시 안전에 유의하세요.',
  });

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

            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>{notice.title}</Text>
              <Text style={styles.noticeContent}>{notice.content}</Text>
            </View>
          </ScrollView>
        );

      case 'map':
        return (
          <ProtectedMapView
            targetName={displayName}
            lastUpdated="1분 전"
            weatherText="구름 많음 26°C"
          />
        );

      case 'notification':
        return <ProtectedNotificationScreen />;

      case 'setting':
        return <SettingView isProtected={true} onEmergencyContactSaved={() => setTargetPhone(getProtectorPhone())} />;

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
  noticeBox: {
    backgroundColor: '#FFF5E6',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FEEBC8',
    padding: 20,
    marginTop: 8,
  },
  noticeTitle: { fontSize: 20, fontWeight: 'bold', color: '#000000', marginBottom: 10 },
  noticeContent: { fontSize: 16, fontWeight: '500', color: '#4A5568', lineHeight: 24 },
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
