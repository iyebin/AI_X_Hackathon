import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DangerModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    targetName?: string;
    targetAge?: string;
    dangerScore?: string;
    dangerReasons?: string; // 줄바꿈(\n) 또는 쉼표(,) 구분 문자열
    targetPhone?: string;
  }>();

  // 전달받는 변동 값들 (기본값 세팅)
  const targetName = params.targetName || '홍길동';
  const targetAge = params.targetAge || '15';
  const dangerScore = params.dangerScore || '85';
  const targetPhone = params.targetPhone || '01055556666';

  // 위험 감지 이유 (문자열 파싱 또는 기본배열)
  const reasonsList = params.dangerReasons
    ? params.dangerReasons.split(',')
    : ['GPS 이탈', '15분 이상 정지', '폭우주의보 발령'];

  // 버튼 동작들
  const handleLocationCheck = () => {
    // 지도 화면이나 메인 화면으로 연결
    router.replace({
      pathname: '/protector-main',
      params: { targetName, targetStatus: '위험' },
    });
  };

  const handleCall = () => {
    Linking.openURL(`tel:${targetPhone}`).catch(() =>
      Alert.alert('오류', '전화 앱을 열 수 없습니다.')
    );
  };

  const handle112Call = () => {
    Linking.openURL('tel:112');
  };

  const handle119Call = () => {
    Linking.openURL('tel:119');
  };

  return (
    <View style={styles.container}>
      {/* 1. 상단 빨간색 긴급 헤더 */}
      <View style={styles.dangerHeader}>
        <SafeAreaView edges={['top']} style={styles.safeHeaderInner}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={36} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Ionicons name="warning-outline" size={60} color="#FFFFFF" />
            <Text style={styles.headerTitle}>위험이 감지되었습니다!</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* 2. 하단 상세 및 버튼 영역 */}
      <ScrollView contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {/* 대상자 정보 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileCircle} />
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.targetName}>{targetName}</Text>
              <Text style={styles.targetAge}> ({targetAge}세)</Text>
            </View>
            <Text style={styles.scoreText}>위험도 {dangerScore}점</Text>
          </View>
        </View>

        {/* 위험 감지 이유 목록 */}
        <View style={styles.reasonContainer}>
          <Text style={styles.reasonTitle}>위험 감지 이유</Text>

          {reasonsList.map((reason, index) => (
            <View key={index} style={styles.reasonRow}>
              <Ionicons name="warning" size={20} color="#FF0000" style={styles.reasonIcon} />
              <Text style={styles.reasonText}>{reason.trim()}</Text>
            </View>
          ))}
        </View>

        {/* 하단 4개 주요 조치 버튼 */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#55A238' }]}
            onPress={handleLocationCheck}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>위치 확인</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#1A87D0' }]}
            onPress={handleCall}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>전화하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#F03E3E' }]}
            onPress={handle112Call}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>112 신고</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.borderBtn]}
            onPress={handle119Call}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, { color: '#E53E3E' }]}>119 신고</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  dangerHeader: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  safeHeaderInner: {
    position: 'relative',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 12,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
  },
  profileCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFE5B4',
  },
  profileInfo: {
    marginLeft: 18,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  targetName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  targetAge: {
    fontSize: 16,
    color: '#666666',
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    marginTop: 6,
  },
  reasonContainer: {
    marginBottom: 36,
  },
  reasonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reasonIcon: {
    marginRight: 10,
  },
  reasonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444444',
  },
  buttonGroup: {
    gap: 12,
  },
  actionBtn: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  borderBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E53E3E',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});