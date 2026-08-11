import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface NotificationViewProps {
  filterTargetName?: string;
}

interface AlarmItem {
  id: string;
  targetName: string;
  type: 'danger' | 'warning' | 'safe';
  title: string;
  scoreText: string;
  time: string;
  dateGroup: '오늘' | '어제';
}

export default function NotificationView({ filterTargetName }: NotificationViewProps) {
  const currentTargetName = filterTargetName || '슝슝슝';
  const [selectedCategory, setSelectedCategory] = useState<'전체' | '위험' | '주의' | '안전'>('전체');

  const [alarms] = useState<AlarmItem[]>([
    { id: '1', targetName: '슝슝슝', type: 'danger', title: '위험 발생', scoreText: '위험도 85점', time: '15:32', dateGroup: '오늘' },
    { id: '2', targetName: '슝슝슝', type: 'warning', title: '주의 발생', scoreText: '위험도 60점', time: '11:15', dateGroup: '오늘' },
    { id: '3', targetName: '슝슝슝', type: 'safe', title: '안전 확인', scoreText: '위험도 15점', time: '09:00', dateGroup: '오늘' },
    { id: '4', targetName: '슝슝슝', type: 'danger', title: '위험 발생', scoreText: '위험도 90점', time: '18:20', dateGroup: '어제' },
  ]);

  const filteredAlarms = alarms.filter((item) => {
    if (selectedCategory === '전체') return true;
    if (selectedCategory === '위험') return item.type === 'danger';
    if (selectedCategory === '주의') return item.type === 'warning';
    if (selectedCategory === '안전') return item.type === 'safe';
    return true;
  });

  const todayAlarms = filteredAlarms.filter((item) => item.dateGroup === '오늘');
  const yesterdayAlarms = filteredAlarms.filter((item) => item.dateGroup === '어제');

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'danger':
        return { icon: 'warning', color: '#E53E3E' };
      case 'warning':
        return { icon: 'alert-circle', color: '#F7931E' };
      case 'safe':
        return { icon: 'checkmark-circle', color: '#59A03D' };
      default:
        return { icon: 'information-circle', color: '#3182CE' };
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBadgeContainer}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>알림</Text>
        </View>
      </View>

      <View style={styles.topDivider} />

      <View style={styles.filterRow}>
        {(['전체', '위험', '주의', '안전'] as const).map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sectionDivider} />

      <Text style={styles.dateGroupTitle}>오늘</Text>
      {todayAlarms.length > 0 ? (
        todayAlarms.map((item) => {
          const typeInfo = getTypeInfo(item.type);
          return (
            <View key={item.id} style={styles.alarmRow}>
              <View style={[styles.iconCircle, { backgroundColor: typeInfo.color }]}>
                <Ionicons name={typeInfo.icon as any} size={22} color="#FFFFFF" />
              </View>

              <View style={styles.alarmContent}>
                <Text style={styles.alarmTitle}>{item.title}</Text>
                <Text style={styles.targetNameText}>{currentTargetName}</Text>
                <Text style={styles.scoreText}>{item.scoreText}</Text>
              </View>

              <Text style={styles.timeText}>{item.time}</Text>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyText}>해당하는 알림 내역이 없습니다.</Text>
      )}

      <View style={styles.sectionDivider} />

      <Text style={styles.dateGroupTitle}>어제</Text>
      {yesterdayAlarms.length > 0 ? (
        yesterdayAlarms.map((item) => {
          const typeInfo = getTypeInfo(item.type);
          return (
            <View key={item.id} style={styles.alarmRow}>
              <View style={[styles.iconCircle, { backgroundColor: typeInfo.color }]}>
                <Ionicons name={typeInfo.icon as any} size={22} color="#FFFFFF" />
              </View>

              <View style={styles.alarmContent}>
                <Text style={styles.alarmTitle}>{item.title}</Text>
                <Text style={styles.targetNameText}>{currentTargetName}</Text>
                <Text style={styles.scoreText}>{item.scoreText}</Text>
              </View>

              <Text style={styles.timeText}>{item.time}</Text>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyText}>해당하는 알림 내역이 없습니다.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, backgroundColor: '#FFFFFF' },
  headerBadgeContainer: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 6 },
  headerBadge: { height: 40, backgroundColor: '#F7931E', borderRadius: 16, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  headerBadgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  topDivider: { height: 1, backgroundColor: '#EAEAEA', marginTop: 14, marginBottom: 20 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#F7931E', borderColor: '#F7931E' },
  chipText: { fontSize: 16, fontWeight: 'bold', color: '#555555' },
  chipTextActive: { color: '#FFFFFF' },
  sectionDivider: { height: 1, backgroundColor: '#EAEAEA', marginVertical: 20 },
  dateGroupTitle: { fontSize: 20, fontWeight: 'bold', color: '#000000', marginBottom: 16 },
  alarmRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 14, marginTop: 2 },
  alarmContent: { flex: 1 },
  alarmTitle: { fontSize: 20, fontWeight: 'bold', color: '#000000', marginBottom: 4 },
  targetNameText: { fontSize: 15, fontWeight: '600', color: '#666666', marginBottom: 2 },
  scoreText: { fontSize: 15, fontWeight: '600', color: '#666666' },
  timeText: { fontSize: 16, fontWeight: 'bold', color: '#444444' },
  emptyText: { fontSize: 14, color: '#999999', marginVertical: 8 },
});
