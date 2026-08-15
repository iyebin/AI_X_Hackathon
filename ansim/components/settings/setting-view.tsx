import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getProtectorPhone, setProtectorPhone } from '@/features/contacts/protector-contact-store';
import { clearSavedSession } from '@/features/auth/current-session';
import { isGpsTrackingEnabled, stopGpsTracking } from '@/features/gps/tracking';
import { registerPushNotifications, PushUserType } from '@/features/notifications/push-registration';
import { isPushNotificationEnabled, setPushNotificationEnabled } from '@/features/notifications/push-preference';

interface SettingViewProps {
  isProtected?: boolean;
  notificationUser?: { userId: number; userType: PushUserType };
  onEmergencyContactSaved?: () => void;
  onLocationTrackingChange?: (enabled: boolean) => Promise<boolean>;
}

export default function SettingView({ isProtected = false, notificationUser, onEmergencyContactSaved, onLocationTrackingChange }: SettingViewProps) {
  const router = useRouter();

  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isContactModalVisible, setIsContactModalVisible] = useState(false);
  const [protectorPhone, setProtectorPhoneInput] = useState('');

  const checkLocationPermission = useCallback(async () => {
    try {
      const locationSettings = await Location.getForegroundPermissionsAsync();
      const backgroundSettings = isProtected ? await Location.getBackgroundPermissionsAsync() : null;
      const hasRequiredPermission = locationSettings.granted && (!isProtected || backgroundSettings?.granted);

      if (isProtected && !hasRequiredPermission) {
        if (isGpsTrackingEnabled()) stopGpsTracking();
        setIsLocationEnabled(false);
        return;
      }

      setIsLocationEnabled(isProtected ? isGpsTrackingEnabled() : locationSettings.granted);
    } catch (e) {
      console.log('위치 권한 확인 중 오류:', e);
    }
  }, [isProtected]);

  const checkNotificationPreference = useCallback(async () => {
    if (!notificationUser) return;

    const isEnabledInApp = await isPushNotificationEnabled(notificationUser);
    if (!isEnabledInApp) {
      setIsNotificationEnabled(false);
      return;
    }

    const permission = await Notifications.getPermissionsAsync();
    setIsNotificationEnabled(permission.status !== 'denied');
  }, [notificationUser]);

  useFocusEffect(
    useCallback(() => {
      void checkLocationPermission();
      void checkNotificationPreference();
    }, [checkLocationPermission, checkNotificationPreference]),
  );

  const handleToggleNotificationLegacy = (value: boolean) => {
    setIsNotificationEnabled(value);
    if (value) {
      Alert.alert('알림', '알림 수신 설정이 활성화되었습니다.');
    } else {
      Alert.alert('알림', '알림 수신이 비활성화되었습니다.');
    }
  };

  const handleToggleNotification = async (value: boolean) => {
    if (!notificationUser) {
      setIsNotificationEnabled(value);
      return;
    }

    await setPushNotificationEnabled(notificationUser, value);
    if (!value) {
      setIsNotificationEnabled(false);
      Alert.alert('알림', '이 기기에서 알림 수신이 비활성화되었습니다.');
      return;
    }

    const permission = await Notifications.getPermissionsAsync();
    if (permission.status === 'denied') {
      await setPushNotificationEnabled(notificationUser, false);
      setIsNotificationEnabled(false);
      Alert.alert(
        '알림 권한 필요',
        '알림 권한이 휴대폰 설정에서 꺼져 있습니다. 설정에서 알림을 허용해 주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '설정으로 이동', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }

    try {
      await registerPushNotifications(notificationUser);
      setIsNotificationEnabled(true);
      Alert.alert('알림', '알림 수신 설정이 활성화되었습니다.');
    } catch (error) {
      await setPushNotificationEnabled(notificationUser, false);
      setIsNotificationEnabled(false);
      Alert.alert('알림', error instanceof Error ? error.message : '알림 권한을 확인해 주세요.');
    }
  };

  const handleToggleLocation = async (value: boolean) => {
    if (onLocationTrackingChange) {
      const changed = await onLocationTrackingChange(value);
      if (changed) setIsLocationEnabled(value);
      return;
    }

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
        onPress: async () => {
          await clearSavedSession();
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

  const handleEmergencyContact = () => {
    setProtectorPhoneInput(getProtectorPhone());
    setIsContactModalVisible(true);
  };

  const handleSaveEmergencyContact = () => {
    const phoneNumber = protectorPhone.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 9 || phoneNumber.length > 11) {
      Alert.alert('번호 확인', '올바른 보호자 전화번호를 입력해 주세요.');
      return;
    }
    setProtectorPhone(phoneNumber);
    onEmergencyContactSaved?.();
    setIsContactModalVisible(false);
  };

  const handleSimpleMenu = (menuName: string) => {
    Alert.alert('알림', `${menuName} 기능 준비 중입니다.`);
  };

  const activeColor = isProtected ? '#59A03D' : '#F7931E';

  return (
    <>
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

        {isProtected && <View style={styles.itemDivider} />}

        {isProtected && <View style={styles.menuItemRow}>
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
        </View>}
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
              onPress={handleEmergencyContact}
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

    <Modal visible={isContactModalVisible} transparent animationType="fade" onRequestClose={() => setIsContactModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>긴급 연락처 관리</Text>
          <Text style={styles.modalDescription}>홈에서 전화하기를 누르면 이 번호로 연결됩니다.</Text>
          <TextInput
            style={styles.modalInput}
            value={protectorPhone}
            onChangeText={setProtectorPhoneInput}
            keyboardType="phone-pad"
            placeholder="보호자 전화번호"
            maxLength={13}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setIsContactModalVisible(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveContactButton, { backgroundColor: activeColor }]} onPress={handleSaveEmergencyContact}>
              <Text style={styles.saveContactText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40 },
  headerBadgeContainer: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 6 },
  headerBadge: { height: 40, borderRadius: 16, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  headerBadgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
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
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  modalContent: { borderRadius: 20, padding: 24, backgroundColor: '#FFFFFF' },
  modalTitle: { color: '#111111', fontSize: 21, fontWeight: 'bold' },
  modalDescription: { marginTop: 8, color: '#666666', fontSize: 15, lineHeight: 21 },
  modalInput: { height: 56, marginTop: 20, paddingHorizontal: 15, borderWidth: 1.5, borderColor: '#DDE3E8', borderRadius: 13, color: '#111111', fontSize: 18, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelButton: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#DDE3E8', borderRadius: 13 },
  cancelText: { color: '#555555', fontSize: 17, fontWeight: 'bold' },
  saveContactButton: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 13 },
  saveContactText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
});
