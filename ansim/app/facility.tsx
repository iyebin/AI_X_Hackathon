import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface FacilityItem {
  id: string;
  name: string;
  category: '복지관' | '노인센터' | '병원' | '기타';
  distance: string;
  address: string;
  phone: string;
  isRedPin?: boolean;
}

const MOCK_FACILITIES: FacilityItem[] = [
  {
    id: '1',
    name: '서구종합사회복지관',
    category: '복지관',
    distance: '340m',
    address: '광주광역시 서구 어쩌고저쩌고',
    phone: '000-123-4567',
    isRedPin: true,
  },
  {
    id: '2',
    name: '서구종합사회복지관',
    category: '복지관',
    distance: '340m',
    address: '광주광역시 서구 어쩌고저쩌고',
    phone: '000-123-4567',
    isRedPin: false,
  },
  {
    id: '3',
    name: '서구종합사회복지관',
    category: '노인센터',
    distance: '520m',
    address: '광주광역시 서구 어쩌고저쩌고',
    phone: '000-987-6543',
    isRedPin: false,
  },
  {
    id: '4',
    name: '서구만남의 병원',
    category: '병원',
    distance: '800m',
    address: '광주광역시 서구',
    phone: '000-111-2222',
    isRedPin: false,
  },
];

export default function FacilityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    targetName?: string;
    targetLocation?: string;
    isProtected?: string; // 'true' 또는 'false'
  }>();

  const [selectedCategory, setSelectedCategory] = useState<string>('전체');

  const filteredFacilities =
    selectedCategory === '전체'
      ? MOCK_FACILITIES
      : MOCK_FACILITIES.filter((item) => item.category === selectedCategory);

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() =>
      Alert.alert('오류', '전화 앱을 연결할 수 없습니다.')
    );
  };

  const handleRoute = (facility: FacilityItem) => {
    Alert.alert('길찾기', `${facility.name}으로의 길찾기 안내를 시작합니다.`);
  };

  // 💡 보호자 / 보호대상자 메인 화면 판별 및 정확한 이동
  const handleGoBack = () => {
    // string 'true' 또는 boolean true 여부 모두 체크
    const isProtectedUser = String(params.isProtected) === 'true';

    if (isProtectedUser) {
      // 🟢 보호대상자 메인으로 리다이렉트
      router.replace({
        pathname: '/explore',
        params: { userName: params.targetName || '슝슝슝' },
      });
    } else {
      // 🟠 보호자 메인으로 리다이렉트
      router.replace({
        pathname: '/protector-main',
        params: { targetName: params.targetName || '슝슝슝' },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* 뒤로가기 버튼 */}
        <TouchableOpacity
          onPress={handleGoBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={28} color="#000000" />
        </TouchableOpacity>

        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>복지시설 안내</Text>
        </View>

        <View style={{ width: 28 }} />
      </View>

      <View style={styles.emptyMapBox} />

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['전체', '복지관', '노인센터', '병원', '기타'] as const).map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredFacilities.map((item) => (
          <View key={item.id} style={styles.facilityCard}>
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <Ionicons
                  name="location"
                  size={26}
                  color={item.isRedPin ? '#E53E3E' : '#F7941D'}
                />
                <Text style={styles.facilityName}>{item.name}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#666666" />
              <Text style={styles.distanceText}>{item.distance}</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {item.address}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <TouchableOpacity
                style={styles.phoneRow}
                onPress={() => handleCall(item.phone)}
                activeOpacity={0.7}
              >
                <Ionicons name="call-outline" size={18} color="#000000" />
                <Text style={styles.phoneText}>{item.phone}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.routeBtn}
                onPress={() => handleRoute(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.routeBtnText}>길찾기</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {filteredFacilities.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>해당 카테고리의 주변 시설이 없습니다.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBadge: {
    backgroundColor: '#F7941D',
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 16,
  },
  headerBadgeText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  emptyMapBox: {
    height: 180,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterContainer: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: { borderColor: '#F7941D', backgroundColor: '#F7941D' },
  chipText: { fontSize: 15, fontWeight: 'bold', color: '#333333' },
  chipTextActive: { color: '#FFFFFF' },
  listContainer: { paddingBottom: 20 },
  facilityCard: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  facilityName: { fontSize: 20, fontWeight: 'bold', color: '#000000' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 10, paddingLeft: 4 },
  distanceText: { fontSize: 14, fontWeight: 'bold', color: '#555555', marginLeft: 4, marginRight: 10 },
  addressText: { fontSize: 14, color: '#666666', flex: 1 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  routeBtn: {
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  routeBtnText: { color: '#4CAF50', fontSize: 15, fontWeight: 'bold' },
  emptyContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#888888' },
});