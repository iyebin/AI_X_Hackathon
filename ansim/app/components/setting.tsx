import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface SettingViewProps {
  isProtected?: boolean;
}

export default function SettingView({ isProtected = false }: SettingViewProps) {
  const router = useRouter();

  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const locationSettings = await Location.getForegroundPermissionsAsync();
      setIsLocationEnabled(locationSettings.granted);
    } catch (e) {
      console.log('위치 권한 확인 중 오류:', e);
    }
  };

  const handleToggleNotification = (value: boolean) => {
    setIsNotificationEnabled(value);
    if (value) {
      Alert.alert('알림', '알림 수신 설정이 활성화되었습니다.');
    } else {
      Alert.alert('알림', '알림 수신이 비활성화되었습니다.');
    }
  };

  const handleToggleLocation = async (value: boolean) => {
    if (value) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setIsLocationEnabled(true);
          Alert.alert('알림', '위치 정보 사용이 허용되었습니다.');
        } else {
          setIsLocationEnabled(false);
          showSettingsAlert('위치');
        }
      } catch (e) {
        setIsLocationEnabled(value);
      }
    } else {
      setIsLocationEnabled(false);
      Alert.alert('알림', '위치 정보 사용이 비활성화되었습니다.');
    }
  };

  const showSettingsAlert = (type: string) => {
    Alert.alert(
      '권한 필요',
      `${type} 권한이 거부되어 있습니다. 기기 설정 화면에서 권한을 허용해 주세요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '설정으로 이동',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          router.replace('/select-type');
        },
      },
    ]);
  };

  const handleManageTarget = () => {
    router.push('/protector-select');
  };

  // 💡 자주 가는 장소 관리 클릭 핸들러
  const handleFrequentPlaces = () => {
    router.push('/frequent-places');
  };

  const handleSimpleMenu = (menuName: string) => {
    Alert.alert('알림', `${menuName} 기능 준비 중입니다.`);
  };

  const activeColor = isProtected ? '#5CB85C' : '#F7941D';

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBadgeContainer}>
        <View style={[styles.headerBadge, { backgroundColor: activeColor }]}>
          <Text style={styles.headerBadgeText}>설정</Text>
        </View>
      </View>

      <View style={styles.topDivider} />

      <Text style={styles.sectionTitle}>알림 설정</Text>
      <View style={styles.menuCard}>
        <View style={styles.menuItemRow}>
          <View style={styles.menuLeft}>
            <Ionicons name="notifications-outline" size={24} color="#333333" style={styles.menuIcon} />
            <Text style={styles.menuText}>알림 수신 설정</Text>
          </View>
          <Switch
            value={isNotificationEnabled}
            onValueChange={handleToggleNotification}
            trackColor={{ false: '#E0E0E0', true: activeColor }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.itemDivider} />

        <View style={styles.menuItemRow}>
          <View style={styles.menuLeft}>
            <Ionicons name="navigate-outline" size={24} color="#333333" style={styles.menuIcon} />
            <Text style={styles.menuText}>위치 정보 설정</Text>
          </View>
          <Switch
            value={isLocationEnabled}
            onValueChange={handleToggleLocation}
            trackColor={{ false: '#E0E0E0', true: activeColor }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>계정 설정</Text>
      <View style={styles.menuCard}>
        {!isProtected && (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleManageTarget}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={24} color="#333333" style={styles.menuIcon} />
              <Text style={styles.menuText}>보호대상 관리</Text>
            </TouchableOpacity>

            <View style={styles.itemDivider} />
          </>
        )}

        {isProtected && (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleSimpleMenu('긴급 연락처 관리')}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={24} color="#333333" style={styles.menuIcon} />
              <Text style={styles.menuText}>긴급 연락처 관리</Text>
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* 💡 새로 추가된 자주 가는 장소 관리 */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleFrequentPlaces}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={24} color="#333333" style={styles.menuIcon} />
              <Text style={styles.menuText}>자주 가는 장소 관리</Text>
            </TouchableOpacity>

            <View style={styles.itemDivider} />
          </>
        )}

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleSimpleMenu('계정 정보')}
          activeOpacity={0.7}
        >
          <Ionicons name="information-circle-outline" size={24} color="#333333" style={styles.menuIcon} />
          <Text style={styles.menuText}>계정 정보</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutBtnText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40 },
  headerBadgeContainer: { alignItems: 'center', marginVertical: 10 },
  headerBadge: { paddingHorizontal: 28, paddingVertical: 8, borderRadius: 16 },
  headerBadgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  topDivider: { height: 1, backgroundColor: '#EAEAEA', marginTop: 14, marginBottom: 28 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#000000', marginBottom: 12 },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginBottom: 32,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  menuItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { marginRight: 14 },
  menuText: { fontSize: 18, fontWeight: 'bold', color: '#333333' },
  itemDivider: { height: 1, backgroundColor: '#EAEAEA' },
  logoutBtn: {
    height: 58,
    borderWidth: 1.5,
    borderColor: '#E53E3E',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 10,
  },
  logoutBtnText: { color: '#E53E3E', fontSize: 22, fontWeight: 'bold' },
});