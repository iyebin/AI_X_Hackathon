import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

interface NotificationItem {
  id: string;
  title: string;
  time: string;
  dateGroup: string;
  type: 'weather' | 'hazard' | 'warning';
}

export default function ProtectedNotificationScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const mockData: NotificationItem[] = [
      { id: '1', title: '폭염주의보 발생', time: '15:32', dateGroup: '오늘', type: 'weather' },
      { id: '2', title: '폭염주의보 발생', time: '15:32', dateGroup: '오늘', type: 'weather' },
      { id: '3', title: '폭염주의보 발생', time: '15:59', dateGroup: '어제', type: 'weather' },
    ];
    setNotifications(mockData);
  }, []);

  const groupedNotifications = notifications.reduce((acc, item) => {
    if (!acc[item.dateGroup]) {
      acc[item.dateGroup] = [];
    }
    acc[item.dateGroup].push(item);
    return acc;
  }, {} as Record<string, NotificationItem[]>);

  const sections = Object.keys(groupedNotifications).map((date) => ({
    date,
    data: groupedNotifications[date],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>알림</Text>
        </View>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>{item.date}</Text>

            {item.data.map((notice, index) => (
              <View key={notice.id} style={styles.itemWrapper}>
                <View style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <View style={styles.iconContainer}>
                      <Text style={styles.weatherIcon}>☀️</Text>
                    </View>
                    <Text style={styles.itemTitle}>{notice.title}</Text>
                  </View>
                  <Text style={styles.itemTime}>{notice.time}</Text>
                </View>
                {index < item.data.length - 1 && <View style={styles.innerDivider} />}
              </View>
            ))}
            <View style={styles.sectionDivider} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 72, alignItems: 'center', justifyContent: 'center' },
  badge: { height: 40, backgroundColor: '#59A03D', borderRadius: 16, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  listContainer: { paddingHorizontal: 24, paddingTop: 10 },
  sectionGroup: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#000000', marginBottom: 12 },
  itemWrapper: { marginVertical: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { marginRight: 12 },
  weatherIcon: { fontSize: 22 },
  itemTitle: { fontSize: 17, fontWeight: 'bold', color: '#000000' },
  itemTime: { fontSize: 15, color: '#666666', fontWeight: '500' },
  innerDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  sectionDivider: { height: 1, backgroundColor: '#E5E5E5', marginTop: 16 },
});
