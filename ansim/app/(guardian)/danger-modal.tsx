import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markAlertAsRead } from '@/features/alerts/alerts-api';
import { getSubjectProfile } from '@/features/relationships/guardian-registration';

export default function DangerModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    alertId?: string;
    subjectId?: string;
    targetName?: string;
    targetAge?: string;
    targetPhone?: string;
    dangerScore?: string;
    dangerReasons?: string;
  }>();

  const [profileName, setProfileName] = useState(params.targetName || '보호대상자');
  const [profilePhone, setProfilePhone] = useState(params.targetPhone ?? '');
  const targetName = profileName;
  const targetAge = params.targetAge;
  const targetPhone = profilePhone;
  const dangerScore = params.dangerScore || '-';
  const reason = params.dangerReasons?.trim() || '위험 요인 정보 없음';

  useEffect(() => {
    if (params.alertId) void markAlertAsRead(params.alertId).catch(() => {});
  }, [params.alertId]);

  useEffect(() => {
    const subjectId = Number(params.subjectId);
    if (!Number.isInteger(subjectId) || subjectId <= 0) return;

    void getSubjectProfile(subjectId)
      .then((profile) => {
        if (profile.name) setProfileName(profile.name);
        if (profile.phone) setProfilePhone(profile.phone);
      })
      .catch(() => {
        // 전달받은 이름·전화번호가 있으면 그대로 위험 안내를 보여 줍니다.
      });
  }, [params.subjectId]);

  const handleLocationCheck = () => {
    router.replace({
      pathname: '/protector-main',
      params: {
        subjectId: params.subjectId,
        targetName,
        targetAge,
        targetPhone,
        targetStatus: '위험',
        targetScore: dangerScore,
        tab: 'map',
      },
    });
  };

  const handleCall = async () => {
    const phone = targetPhone.replace(/[^0-9+]/g, '');
    if (!phone) {
      Alert.alert('전화번호 없음', '보호대상자의 전화번호 정보를 찾지 못했습니다.');
      return;
    }
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Alert.alert('전화 연결 실패', '이 기기에서 전화를 연결하지 못했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dangerHeader}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={38} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Ionicons name="warning" size={60} color="#FFFFFF" />
            <Text style={styles.headerTitle}>위험이 감지되었습니다!</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileCircle} />
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.targetName}>{targetName}</Text>
              {targetAge ? <Text style={styles.targetAge}> ({targetAge}세)</Text> : null}
            </View>
            <Text style={styles.scoreText}>위험도 {dangerScore}점</Text>
          </View>
        </View>

        <View style={styles.reasonContainer}>
          <Text style={styles.reasonTitle}>위험 감지 이유</Text>
          <View style={styles.reasonRow}>
            <Ionicons name="warning" size={21} color="#FF2525" style={styles.reasonIcon} />
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={[styles.actionButton, styles.locationButton]} onPress={handleLocationCheck}>
            <Text style={styles.actionButtonText}>위치 확인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.callButton]} onPress={() => void handleCall()}>
            <Text style={styles.actionButtonText}>전화하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.emergencyButton]} onPress={() => void Linking.openURL('tel:112')}>
            <Text style={styles.actionButtonText}>112 신고</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.borderEmergencyButton]} onPress={() => void Linking.openURL('tel:119')}>
            <Text style={[styles.actionButtonText, styles.borderEmergencyText]}>119 신고</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  dangerHeader: { backgroundColor: '#FF3030', paddingHorizontal: 20, paddingBottom: 30 },
  headerSafeArea: { position: 'relative' },
  closeButton: { alignSelf: 'flex-end', marginTop: 8 },
  headerContent: { alignItems: 'center', marginTop: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 15, marginBottom: 14 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24 },
  profileCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 26, padding: 30, marginBottom: 22 },
  profileCircle: { width: 102, height: 102, borderRadius: 51, backgroundColor: '#FFE1AD', borderWidth: 1, borderColor: '#F0C77F' },
  profileInfo: { marginLeft: 28, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  targetName: { fontSize: 23, fontWeight: 'bold', color: '#555555' },
  targetAge: { fontSize: 16, fontWeight: '500', color: '#555555' },
  scoreText: { fontSize: 26, fontWeight: '900', color: '#000000', marginTop: 16 },
  reasonContainer: { marginHorizontal: 12, marginBottom: 38 },
  reasonTitle: { fontSize: 21, fontWeight: 'bold', color: '#111111', marginBottom: 16 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start' },
  reasonIcon: { marginRight: 13, marginTop: 2 },
  reasonText: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#666666', lineHeight: 28 },
  buttonGroup: { gap: 18 },
  actionButton: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locationButton: { backgroundColor: '#59A03D' },
  callButton: { backgroundColor: '#2189CF' },
  emergencyButton: { backgroundColor: '#FF3030' },
  borderEmergencyButton: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FF3030' },
  actionButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  borderEmergencyText: { color: '#9B1C1C' },
});
