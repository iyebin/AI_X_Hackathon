import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppAlert, getAlerts, markAlertAsRead } from '@/features/alerts/alerts-api';

interface NotificationViewProps {
  filterTargetName?: string;
  subjectId?: number;
  targetPhone?: string;
  targets?: NotificationTarget[];
  themeColor?: string;
  viewerRole?: 'guardian' | 'protected';
}

export type NotificationTarget = {
  id: string;
  name: string;
  phone?: string;
};

type Filter = '전체' | '위험' | '주의' | '안전';

function displayTime(createdAt?: string): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function dateGroup(createdAt?: string): string {
  if (!createdAt) return '이전';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '이전';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfAlert = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((startOfToday - startOfAlert) / 86_400_000);
  if (difference === 0) return '오늘';
  if (difference === 1) return '어제';
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function typeInfo(kind: AppAlert['kind']) {
  if (kind === 'danger') return { label: '위험', color: '#FF2525', icon: 'warning' as const, heading: '위험' };
  if (kind === 'warning') return { label: '주의', color: '#FFBB01', icon: 'alert-circle' as const, heading: '주의' };
  return { label: '안전', color: '#2EAD61', icon: 'checkmark-circle' as const, heading: '안전' };
}

function isAuthCodeAlert(alert: AppAlert): boolean {
  const type = alert.type.toLowerCase();
  const content = `${alert.title} ${alert.message ?? ''}`;
  return ['auth', 'auth-code', 'auth_code', 'verification', 'verification-code'].includes(type)
    || /\uC778\uC99D\s*\uCF54\uB4DC|\uC778\uC99D\s*\uBC88\uD638|auth\s*code/ui.test(content);
}

export default function NotificationView({
  filterTargetName,
  subjectId,
  targetPhone,
  targets,
  themeColor = '#F7931E',
  viewerRole = 'guardian',
}: NotificationViewProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<Filter>('전체');
  const [alarms, setAlarms] = useState<AppAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAlarms(await getAlerts(Number.isInteger(subjectId) && (subjectId ?? 0) > 0 ? subjectId : undefined));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '알림을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useFocusEffect(useCallback(() => {
    void loadAlerts();
  }, [loadAlerts]));

  const targetById = useMemo(
    () => new Map(targets?.map((target) => [target.id, target]) ?? []),
    [targets],
  );

  const groupedAlarms = useMemo(() => {
    const visibleToGuardian = targets
      ? alarms.filter((alert) => alert.subjectId !== undefined && targetById.has(String(alert.subjectId)) && !isAuthCodeAlert(alert))
      : alarms.filter((alert) => !isAuthCodeAlert(alert));
    const filtered = visibleToGuardian.filter((alert) => selectedCategory === '전체' || typeInfo(alert.kind).label === selectedCategory);
    return filtered.reduce<Record<string, AppAlert[]>>((groups, alert) => {
      const group = dateGroup(alert.createdAt);
      (groups[group] ??= []).push(alert);
      return groups;
    }, {});
  }, [alarms, selectedCategory, targetById, targets]);

  const handleAlarmPress = async (alert: AppAlert) => {
    const target = alert.subjectId ? targetById.get(String(alert.subjectId)) : undefined;
    // 알림을 누르는 즉시 목록에도 읽음 상태를 반영합니다.
    // danger-modal에서도 한 번 더 서버 읽음 처리를 수행하므로 안전합니다.
    if (!alert.isRead) {
      setAlarms((current) => current.map((item) => item.id === alert.id ? { ...item, isRead: true } : item));
      try {
        await markAlertAsRead(alert.id);
      } catch {
        setAlarms((current) => current.map((item) => item.id === alert.id ? { ...item, isRead: false } : item));
      }
    }

    if (alert.kind === 'danger') {
      router.push({
        pathname: '/danger-modal',
        params: {
          alertId: alert.id,
          subjectId: String(alert.subjectId ?? subjectId ?? ''),
          targetName: filterTargetName ?? target?.name,
          targetPhone: targetPhone ?? target?.phone,
          dangerScore: String(alert.riskScore ?? ''),
          dangerReasons: alert.reason ?? alert.message ?? '위험 요인 정보 없음',
          alertCreatedAt: alert.createdAt ?? '',
          riskSnapshot: alert.riskSnapshot ? JSON.stringify(alert.riskSnapshot) : '',
          viewerRole,
        },
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBadgeContainer}>
        <View style={[styles.headerBadge, { backgroundColor: themeColor }]}><Text style={styles.headerBadgeText}>알림</Text></View>
      </View>
      <View style={styles.topDivider} />
      <View style={styles.filterRow}>
        {(['전체', '위험', '주의', '안전'] as const).map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.chip, isSelected && { backgroundColor: themeColor, borderColor: themeColor }]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.sectionDivider} />

      {loading ? <View style={styles.state}><ActivityIndicator color={themeColor} /><Text style={styles.stateText}>알림을 불러오는 중입니다.</Text></View> : null}
      {error ? <View style={styles.state}><Text style={styles.stateText}>{error}</Text><TouchableOpacity onPress={() => void loadAlerts()}><Text style={[styles.retryText, { color: themeColor }]}>다시 시도</Text></TouchableOpacity></View> : null}
      {!loading && !error && Object.keys(groupedAlarms).length === 0 ? <Text style={styles.emptyText}>해당하는 알림이 없습니다.</Text> : null}

      {!loading && !error && Object.entries(groupedAlarms).map(([group, items]) => (
        <View key={group} style={styles.group}>
          <Text style={styles.groupTitle}>{group}</Text>
          {items.map((item) => {
            const info = typeInfo(item.kind);
            const target = item.subjectId ? targetById.get(String(item.subjectId)) : undefined;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.alarmRow, !item.isRead && { backgroundColor: `${info.color}12` }]}
                onPress={() => void handleAlarmPress(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconCircle, { backgroundColor: info.color }]}>
                  <Ionicons name={info.icon} size={22} color="#FFFFFF" />
                </View>
                <View style={styles.alarmContent}>
                  <Text style={styles.alarmTitle}>{info.heading}</Text>
                  <Text style={styles.targetNameText}>{filterTargetName ?? target?.name ?? '보호대상자'}</Text>
                  <Text style={styles.scoreText}>위험도 {item.riskScore ?? '-'}점</Text>
                </View>
                <Text style={styles.timeText}>{displayTime(item.createdAt)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, backgroundColor: '#FFFFFF' },
  headerBadgeContainer: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 6 },
  headerBadge: { height: 40, backgroundColor: '#F7931E', borderRadius: 16, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  headerBadgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  topDivider: { height: 1, backgroundColor: '#EAEAEA', marginTop: 14, marginBottom: 20 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  chip: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: '#F7931E', borderColor: '#F7931E' },
  chipText: { fontSize: 16, fontWeight: 'bold', color: '#555555' },
  chipTextActive: { color: '#FFFFFF' },
  sectionDivider: { height: 1, backgroundColor: '#EAEAEA', marginBottom: 8 },
  group: { borderBottomWidth: 1, borderBottomColor: '#EAEAEA', paddingBottom: 10, marginBottom: 8 },
  groupTitle: { fontSize: 22, fontWeight: 'bold', color: '#111111', marginTop: 12, marginBottom: 6, paddingHorizontal: 10 },
  alarmRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 14, marginTop: 2 },
  alarmContent: { flex: 1 },
  alarmTitle: { fontSize: 19, fontWeight: 'bold', color: '#111111', marginBottom: 3 },
  targetNameText: { fontSize: 15, fontWeight: '600', color: '#666666', marginBottom: 2 },
  scoreText: { fontSize: 15, fontWeight: '600', color: '#666666' },
  timeText: { fontSize: 16, fontWeight: 'bold', color: '#666666', marginLeft: 8, marginTop: 2 },
  state: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  stateText: { color: '#666666', fontSize: 15, textAlign: 'center' },
  retryText: { color: '#F7931E', fontWeight: 'bold', fontSize: 15 },
  emptyText: { color: '#777777', fontSize: 16, textAlign: 'center', paddingVertical: 40 },
});
