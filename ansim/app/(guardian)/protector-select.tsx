import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderBadge from '@/components/common/header-badge';
import NotificationView from '@/components/notifications/alarm';
import SettingView from '@/components/settings/setting-view';
import { getAge, getSubjectsForGuardian } from '@/features/relationships/guardian-registration';
import { getCurrentGuardianId } from '@/features/auth/current-session';

export interface TargetUser {
  id: string;
  name: string;
  age: string;
  status: '안전' | '주의' | '위험';
  updatedAt: string;
  profileImage?: string;
  score?: number;
  gpsOutCount?: string;
  phone?: string;
}

export default function ProtectorSelectScreen() {
  const router = useRouter();
  const { guardianId } = useLocalSearchParams<{ guardianId?: string }>();
  const activeGuardianId = Number(guardianId) || getCurrentGuardianId();
  const [activeTab, setActiveTab] = useState<'home' | 'notification' | 'setting'>('home');
  const [targets, setTargets] = useState<TargetUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSubjects = async () => {
      const requestedGuardianId = Number(guardianId);
      const id = Number.isInteger(requestedGuardianId) && requestedGuardianId > 0
        ? requestedGuardianId
        : getCurrentGuardianId();
      if (!id || !Number.isInteger(id) || id <= 0) {
        setIsLoading(false);
        return;
      }

      try {
        const subjects = await getSubjectsForGuardian(id);
        setTargets(subjects.map((subject) => ({
          id: String(subject.id),
          name: subject.name,
          age: getAge(subject.birth_date),
          status: '안전',
          updatedAt: '정보 없음',
          phone: subject.phone ?? undefined,
        })));
      } catch (error) {
        Alert.alert('보호대상자 조회 실패', error instanceof Error ? error.message : '연결 정보를 가져오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSubjects();
  }, [guardianId]);

  const handleSelectTarget = (target: TargetUser) => {
    router.push({
      pathname: '/protector-main',
      params: {
        targetName: target.name,
        subjectId: target.id,
        targetStatus: target.status,
        targetScore: String(target.score ?? 80),
        targetGps: target.gpsOutCount ?? '0%',
        targetPhone: target.phone ?? '',
        updatedTime: target.updatedAt,
      },
    });
  };

  const getStatusColor = (status: TargetUser['status']) => ({
    위험: '#FF2525',
    주의: '#FFBB01',
    안전: '#2EAD61',
  }[status]);

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={28} color="#000000" />
        </TouchableOpacity>
        <HeaderBadge title="보호대상자" type="protector" align="center" />
        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.sectionTitle}>현재 보호 중</Text>
      {isLoading ? <Text style={styles.emptyText}>보호대상자 정보를 불러오는 중입니다.</Text> : null}
      {!isLoading && targets.length === 0 ? <Text style={styles.emptyText}>연결된 보호대상자가 없습니다.</Text> : null}

      {targets.map((item) => (
        <TouchableOpacity key={item.id} style={styles.targetCard} onPress={() => handleSelectTarget(item)} activeOpacity={0.8}>
          <View style={styles.profileCircle}>
            {item.profileImage ? <Image source={{ uri: item.profileImage }} style={styles.profileImage} /> : null}
          </View>
          <View style={styles.cardCenterInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.targetName}>{item.name}</Text>
              <Text style={styles.targetAge}>({item.age})</Text>
            </View>
            <Text style={styles.updateTimeText}>최근 업데이트 {item.updatedAt}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusBadgeText}>{item.status}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const content = activeTab === 'home'
    ? renderHome()
    : activeTab === 'notification'
      ? <NotificationView targets={targets} />
      : <SettingView isProtected={false} notificationUser={activeGuardianId ? { userId: activeGuardianId, userType: 'guardian' } : undefined} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>{content}</View>
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Ionicons name="home" size={26} color={activeTab === 'home' ? '#F7931E' : '#8E8E93'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'home' ? '#F7931E' : '#8E8E93' }]}>홈</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => Alert.alert('안내', '보호대상자를 먼저 선택해 주세요.')}>
          <Ionicons name="map-outline" size={26} color="#8E8E93" />
          <Text style={[styles.tabLabel, { color: '#8E8E93' }]}>지도</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  contentContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, height: 36 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333333', marginBottom: 16 },
  emptyText: { textAlign: 'center', color: '#666666', fontSize: 15, marginVertical: 20 },
  targetCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 16, marginBottom: 14 },
  profileCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FDE4B8', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 16 },
  profileImage: { width: '100%', height: '100%' },
  cardCenterInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  targetName: { fontSize: 22, fontWeight: 'bold', color: '#000000', marginRight: 6 },
  targetAge: { fontSize: 15, color: '#666666', fontWeight: '500' },
  updateTimeText: { fontSize: 13, color: '#777777' },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  statusBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  bottomTabBar: { flexDirection: 'row', height: 65, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingBottom: 5 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
});
