import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderBadge from '@/components/common/header-badge';
import NotificationView from '@/components/notifications/alarm';
import SettingView from '@/components/settings/setting-view';

export interface TargetUser {
  id: string;
  name: string;
  age: string;
  status: '안전' | '주의' | '위험';
  statusBg: string;
  updatedAt: string;
  profileImage?: string;
  score?: number;
  gpsOutCount?: string;
  phone?: string;
}

export default function ProtectorSelectScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('home');

  const [targets] = useState<TargetUser[]>([
    {
      id: '1',
      name: '슝슝슝',
      age: '15세',
      status: '주의',
      statusBg: '#FF3B30',
      updatedAt: '1분 전',
      profileImage: undefined,
      score: 56,
      gpsOutCount: '55%',
      phone: '01055556666',
    },
  ]);

  const handleSelectTarget = (target: TargetUser) => {
    router.push({
      pathname: '/protector-main',
      params: {
        targetName: target.name,
        targetStatus: target.status,
        targetScore: (target.score || 80).toString(),
        targetGps: target.gpsOutCount || '0%',
        targetPhone: target.phone || '01000000000',
        updatedTime: target.updatedAt,
      },
    });
  };

  const handleAddTarget = () => {
    Alert.alert('보호대상 추가', '새로운 보호대상자 등록 화면으로 연결합니다.');
  };

  const handleMapTabPress = () => {
    Alert.alert('알림', '보호대상자를 먼저 선택해 주세요.');
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      위험: '#FF2525',
      주의: '#FFBB01',
      안전: '#2EAD61',
    };
    return statusColors[status] ?? '#8E8E93';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.topHeader}>
              <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="arrow-back" size={28} color="#000000" />
              </TouchableOpacity>

              <HeaderBadge title="보호대상" type="protector" align="center" />

              <View style={{ width: 28 }} />
            </View>

            <Text style={styles.sectionTitle}>현재 보호 중</Text>

            {targets.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.targetCard}
                onPress={() => handleSelectTarget(item)}
                activeOpacity={0.8}
              >
                <View style={styles.profileCircle}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.profileImage} />
                  ) : null}
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

            <TouchableOpacity style={styles.addCard} onPress={handleAddTarget} activeOpacity={0.8}>
              <Ionicons name="add" size={38} color="#000000" style={styles.addIcon} />
              <View>
                <Text style={styles.addCardTitle}>보호대상 추가</Text>
                <Text style={styles.addCardSub}>새로운 보호대상자를 등록하세요.</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        );

      case 'notification':
        return <NotificationView filterTargetName="슝슝슝" />;

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

        <TouchableOpacity style={styles.tabItem} onPress={handleMapTabPress}>
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
    paddingBottom: 30,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    height: 36,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  profileCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FDE4B8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 16,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  cardCenterInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  targetName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 6,
  },
  targetAge: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
  },
  updateTimeText: {
    fontSize: 13,
    color: '#777777',
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  addIcon: {
    marginRight: 16,
  },
  addCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  addCardSub: {
    fontSize: 14,
    color: '#666666',
  },
  bottomTabBar: {
    flexDirection: 'row',
    height: 65,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingBottom: 5,
  },
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
