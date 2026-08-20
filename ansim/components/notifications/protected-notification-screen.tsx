import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/common/scaled-text';
import { AppAlert, getAlerts, markAlertAsRead } from '@/features/alerts/alerts-api';

interface ProtectedNotificationScreenProps {
  subjectId?: number;
}

interface AlertSection {
  title: string;
  data: AppAlert[];
}

function formatDateGroup(createdAt?: string): string {
  if (!createdAt) return '날짜 정보 없음';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';

  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const itemStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((dayStart - itemStart) / (1000 * 60 * 60 * 24));
  if (difference === 0) return '오늘';
  if (difference === 1) return '어제';
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatTime(createdAt?: string): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function makeSections(alerts: AppAlert[]): AlertSection[] {
  const groups = alerts.reduce<Record<string, AppAlert[]>>((result, alert) => {
    const key = formatDateGroup(alert.createdAt);
    (result[key] ??= []).push(alert);
    return result;
  }, {});

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

function alertIcon(kind: AppAlert['kind']): keyof typeof Ionicons.glyphMap {
  if (kind === 'danger') return 'warning';
  if (kind === 'warning') return 'alert-circle';
  return 'notifications';
}

function alertColor(kind: AppAlert['kind']): string {
  if (kind === 'danger') return '#FF2525';
  if (kind === 'warning') return '#FFBB01';
  return '#59A03D';
}

export default function ProtectedNotificationScreen({ subjectId }: ProtectedNotificationScreenProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const alerts = await getAlerts({
        subjectId: Number.isInteger(subjectId) && (subjectId ?? 0) > 0 ? subjectId : undefined,
        recipientType: 'subject',
        recipientId: subjectId,
      });
      setAlerts(
        alerts.filter((alert) => {
          const type = alert.type.toLowerCase();
          const message = `${alert.title} ${alert.message ?? ''}`;
          const isAuthCodeAlert = ['auth', 'auth-code', 'auth_code', 'verification', 'verification-code'].includes(type)
            || /\uC778\uC99D\s*\uCF54\uB4DC|\uC778\uC99D\s*\uBC88\uD638|auth\s*code/ui.test(message);
          return !isAuthCodeAlert;
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '알림을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const handlePressAlert = async (alert: AppAlert) => {
    if ((alert.kind === 'danger' || alert.kind === 'warning') && alert.subjectId) {
      router.push({
        pathname: '/danger-modal',
        params: {
          alertId: alert.id,
          subjectId: String(alert.subjectId),
          dangerScore: String(alert.riskScore ?? ''),
          dangerReasons: alert.reason ?? alert.message ?? '',
          riskLevel: alert.kind,
          viewerRole: 'protected',
        },
      });
      return;
    }

    if (alert.isRead) return;

    setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, isRead: true } : item)));
    try {
      await markAlertAsRead(alert.id);
    } catch {
      setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, isRead: false } : item)));
    }
  };

  const sections = makeSections(alerts);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>알림</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#59A03D" />
          <Text style={styles.stateText}>알림을 불러오는 중입니다.</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadAlerts()}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sections.length ? styles.listContainer : styles.emptyListContainer}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.itemRow, !item.isRead && styles.unreadRow]}
              onPress={() => void handlePressAlert(item)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${alertColor(item.kind)}1A` }]}>
                <Ionicons name={alertIcon(item.kind)} size={21} color={alertColor(item.kind)} />
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, !item.isRead && styles.unreadTitle]}>{item.title}</Text>
                {item.message ? <Text style={styles.itemMessage}>{item.message}</Text> : null}
              </View>
              <View style={styles.rightColumn}>
                <Text style={styles.itemTime}>{formatTime(item.createdAt)}</Text>
                {!item.isRead ? <View style={styles.unreadDot} /> : null}
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={<Text style={styles.emptyText}>받은 알림이 없습니다.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 72,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  badge: {
    height: 40,
    backgroundColor: '#59A03D',
    borderRadius: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  headerSpacer: { width: 23 },
  listContainer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 },
  emptyListContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111111', marginTop: 16, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 5, borderRadius: 12 },
  unreadRow: { backgroundColor: '#F5FBF2' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemContent: { flex: 1, paddingRight: 8 },
  itemTitle: { fontSize: 16, fontWeight: '500', color: '#333333' },
  unreadTitle: { fontWeight: 'bold', color: '#111111' },
  itemMessage: { fontSize: 13, color: '#707070', marginTop: 4, lineHeight: 18 },
  rightColumn: { alignItems: 'flex-end', alignSelf: 'stretch', justifyContent: 'space-between' },
  itemTime: { fontSize: 13, color: '#777777' },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#59A03D', marginRight: 2 },
  divider: { height: 1, backgroundColor: '#EEEEEE', marginLeft: 57 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  stateText: { marginTop: 12, color: '#666666', fontSize: 15 },
  errorText: { color: '#666666', fontSize: 15, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#59A03D' },
  retryText: { color: '#FFFFFF', fontWeight: 'bold' },
  emptyText: { color: '#777777', fontSize: 16 },
});
