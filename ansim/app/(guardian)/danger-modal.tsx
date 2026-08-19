import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markAlertAsRead } from '@/features/alerts/alerts-api';
import { getSavedSession } from '@/features/auth/current-session';
import { getSubjectProfile } from '@/features/relationships/guardian-registration';
import { CurrentRiskStatus, getRiskHistory, parseRiskStatus, RiskFactor } from '@/features/risk/risk-api';

const RISK_FACTOR_COLORS = ['#C62828', '#EF5350', '#FF8585', '#FFD0D0'];

function factorReason(factor: RiskFactor): string {
  const description = factor.description?.trim();
  if (description && !['string', 'null', 'undefined'].includes(description.toLowerCase())) return description;
  return '알림 발생 당시의 항목별 상세 이유가 없습니다.';
}

function findSnapshotAtAlertTime(history: CurrentRiskStatus[], alertCreatedAt?: string): CurrentRiskStatus | null {
  if (!history.length) return null;
  const alertTime = Date.parse(alertCreatedAt ?? '');
  if (!Number.isFinite(alertTime)) return history[0];

  return history.reduce((nearest, item) => {
    const nearestTime = Date.parse(nearest.measuredAt ?? '');
    const itemTime = Date.parse(item.measuredAt ?? '');
    if (!Number.isFinite(itemTime)) return nearest;
    if (!Number.isFinite(nearestTime) || Math.abs(itemTime - alertTime) < Math.abs(nearestTime - alertTime)) return item;
    return nearest;
  });
}

function parseAlertSnapshot(value?: string): CurrentRiskStatus | null {
  if (!value) return null;
  try {
    const snapshot = parseRiskStatus(JSON.parse(value));
    return snapshot.score !== 0 || snapshot.factors.length > 0 ? snapshot : null;
  } catch {
    return null;
  }
}
function getAlertReason(value?: string): string {
  const reason = value?.trim();
  // Swagger의 예시값 또는 값이 없는 상태를 실제 분석 결과처럼 노출하지 않습니다.
  if (!reason || ['string', 'null', 'undefined'].includes(reason.toLowerCase())) {
    return '알림 발생 당시의 상세 분석 정보가 없습니다.';
  }
  return reason;
}

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
    alertCreatedAt?: string;
    riskSnapshot?: string;
    viewerRole?: 'guardian' | 'protected';
  }>();

  const [viewerRole, setViewerRole] = useState<'guardian' | 'protected'>(params.viewerRole ?? 'guardian');
  const [profileName, setProfileName] = useState(params.targetName || '보호대상자');
  const [profilePhone, setProfilePhone] = useState(params.targetPhone ?? '');
  const [riskSnapshot, setRiskSnapshot] = useState<CurrentRiskStatus | null>(null);
  const [isRiskSnapshotLoading, setIsRiskSnapshotLoading] = useState(true);
  const [expandedFactorKey, setExpandedFactorKey] = useState<string | null>(null);
  const targetName = profileName;
  const targetAge = params.targetAge;
  const targetPhone = profilePhone;
  const dangerScore = params.dangerScore || '-';
  const reason = getAlertReason(params.dangerReasons);

  useEffect(() => {
    if (params.alertId) void markAlertAsRead(params.alertId).catch(() => {});
  }, [params.alertId]);

  useEffect(() => {
    void getSavedSession().then((session) => {
      if (!session) return;
      setViewerRole(session.role);
      if (session.role === 'protected' && session.protectorPhone) {
        setProfilePhone(session.protectorPhone);
      }
    });
  }, []);

  useEffect(() => {
    const subjectId = Number(params.subjectId);
    if (!Number.isInteger(subjectId) || subjectId <= 0) return;

    void getSubjectProfile(subjectId)
      .then((profile) => {
        if (profile.name) setProfileName(profile.name);
        if (viewerRole !== 'protected' && profile.phone) setProfilePhone(profile.phone);
      })
      .catch(() => {
        // 전달받은 이름·전화번호가 있으면 그대로 위험 안내를 보여 줍니다.
      });
  }, [params.subjectId, viewerRole]);

  useEffect(() => {
    const subjectId = Number(params.subjectId);
    const alertSnapshot = parseAlertSnapshot(params.riskSnapshot);
    if (alertSnapshot) {
      setRiskSnapshot(alertSnapshot);
      setIsRiskSnapshotLoading(false);
      return;
    }

    setRiskSnapshot(null);
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      setIsRiskSnapshotLoading(false);
      return;
    }

    setIsRiskSnapshotLoading(true);
    // 새 알림은 risk_snapshot을 바로 사용합니다.
    // 스냅샷이 없는 과거 알림만 알림 생성 시각과 가장 가까운 이력으로 보완합니다.
    void getRiskHistory(subjectId)
      .then((history) => setRiskSnapshot(findSnapshotAtAlertTime(history, params.alertCreatedAt)))
      .catch(() => setRiskSnapshot(null))
      .finally(() => setIsRiskSnapshotLoading(false));
  }, [params.alertCreatedAt, params.riskSnapshot, params.subjectId]);

  const handleLocationCheck = () => {
    if (viewerRole === 'protected') {
      router.replace({
        pathname: '/protected-main',
        params: {
          subjectId: params.subjectId,
          userName: targetName,
          protectorPhone: targetPhone,
          tab: 'map',
        },
      });
      return;
    }

    router.replace({
      pathname: '/protector-main',
      params: {
        subjectId: params.subjectId,
        targetName,
        targetAge,
        targetPhone,
        targetStatus: '위험',
        targetScore: displayScore,
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

  // 이 화면은 '선택한 알림이 발생한 당시'의 정보를 표시합니다.
  // 현재 위험도 API를 다시 호출하면 과거 알림 점수가 현재 점수로 바뀌므로 사용하지 않습니다.
  const displayScore = dangerScore;
  const riskFactors = [...(riskSnapshot?.factors ?? [])]
    .sort((left, right) => right.percent - left.percent)
    .slice(0, 3);

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
            <Text style={styles.scoreText}>위험도 {displayScore}점</Text>
          </View>
        </View>

        <View style={styles.analysisContainer}>
          <Text style={styles.analysisTitle}>위험요인 상세 분석</Text>
          {isRiskSnapshotLoading ? (
            <View style={styles.snapshotLoading}>
              <ActivityIndicator color="#FF2525" />
              <Text style={styles.snapshotLoadingText}>알림 당시의 분석 정보를 불러오는 중입니다.</Text>
            </View>
          ) : riskFactors.length ? riskFactors.map((factor, index) => {
            const isExpanded = expandedFactorKey === factor.key;
            const color = RISK_FACTOR_COLORS[index];
            return (
              <TouchableOpacity
                key={factor.key}
                style={styles.factorCard}
                activeOpacity={0.8}
                onPress={() => setExpandedFactorKey((current) => current === factor.key ? null : factor.key)}
              >
                <View style={styles.factorHeader}>
                  <Text style={styles.factorTitle}>{factor.title}</Text>
                  <View style={styles.factorPercentArea}>
                    <View style={styles.factorTrack}>
                      <View style={[styles.factorFill, { width: `${factor.percent}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.factorPercent}>{factor.percent}%</Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={19} color="#777777" />
                  </View>
                </View>
                {isExpanded ? (
                  <View style={styles.factorReasonCard}>
                    <Ionicons name="warning" size={18} color={color} style={styles.factorReasonIcon} />
                    <Text style={styles.factorReasonText}>{factorReason(factor)}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }) : (
            <View style={styles.fallbackReasonCard}>
              <Ionicons name="warning" size={18} color="#FF2525" style={styles.factorReasonIcon} />
              <Text style={styles.factorReasonText}>{reason}</Text>
            </View>
          )}
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
  analysisContainer: { marginHorizontal: 12, marginBottom: 34 },
  analysisTitle: { fontSize: 21, fontWeight: 'bold', color: '#111111', marginBottom: 13 },
  snapshotLoading: { minHeight: 72, borderWidth: 1, borderColor: '#E1E1E1', borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  snapshotLoadingText: { fontSize: 14, fontWeight: '600', color: '#777777' },
  factorCard: { borderWidth: 1, borderColor: '#E1E1E1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10 },
  factorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  factorTitle: { flex: 1, fontSize: 17, fontWeight: 'bold', color: '#222222' },
  factorPercentArea: { flexDirection: 'row', alignItems: 'center' },
  factorTrack: { width: 72, height: 9, borderRadius: 5, overflow: 'hidden', backgroundColor: '#E5E5E5' },
  factorFill: { height: '100%', borderRadius: 5 },
  factorPercent: { width: 39, marginLeft: 8, fontSize: 15, fontWeight: 'bold', color: '#555555' },
  factorReasonCard: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
  fallbackReasonCard: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#E1E1E1', borderRadius: 12, padding: 14 },
  factorReasonIcon: { marginRight: 8, marginTop: 2 },
  factorReasonText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#666666', lineHeight: 22 },
  buttonGroup: { gap: 18 },
  actionButton: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locationButton: { backgroundColor: '#59A03D' },
  callButton: { backgroundColor: '#2189CF' },
  emergencyButton: { backgroundColor: '#FF3030' },
  borderEmergencyButton: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FF3030' },
  actionButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  borderEmergencyText: { color: '#9B1C1C' },
});
