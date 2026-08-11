import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface PlaceItem {
  id: string;
  name: string;
  category: '집' | '친구 집' | '학원' | '병원' | '기타';
  address: string;
  memo?: string;
}

export default function FrequentPlacesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    newPlaceName?: string;
    newCategory?: '집' | '친구 집' | '학원' | '병원' | '기타';
    newAddress?: string;
    newMemo?: string;
  }>();

  const [places, setPlaces] = useState<PlaceItem[]>([]);

  useEffect(() => {
    if (params.newPlaceName && params.newAddress) {
      if (params.id) {
        // 💡 기존 항목 수정
        setPlaces((prev) =>
          prev.map((item) =>
            item.id === params.id
              ? {
                  ...item,
                  name: params.newPlaceName!,
                  category: params.newCategory || '집',
                  address: params.newAddress!,
                  memo: params.newMemo || '',
                }
              : item
          )
        );
      } else {
        // 💡 새 항목 추가
        const newPlace: PlaceItem = {
          id: Date.now().toString(),
          name: params.newPlaceName,
          category: params.newCategory || '집',
          address: params.newAddress,
          memo: params.newMemo,
        };

        setPlaces((prev) => [...prev, newPlace]);
      }
    }
  }, [params.id, params.newPlaceName, params.newAddress, params.newCategory, params.newMemo]);

  // ➕ 장소 추가하기 (입력창 비운 상태)
  const handleAddPlace = () => {
    router.push({
      pathname: '/add-frequent-place',
      params: { mode: 'add' },
    });
  };

  // ✏️ 등록된 카드 클릭 (기존 데이터 채워진 수정 모드)
  const handleSelectPlace = (place: PlaceItem) => {
    router.push({
      pathname: '/add-frequent-place',
      params: {
        mode: 'edit',
        id: place.id,
        editName: place.name,
        editCategory: place.category,
        editAddress: place.address,
        editMemo: place.memo || '',
      },
    });
  };

  // 💡 [완료 / 뒤로가기] 클릭 시 보호대상자 메인(explore) 설정 탭으로 이동
  const handleComplete = () => {
    router.replace({
      pathname: '/explore',
      params: { tab: 'setting' },
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '집':
        return <Ionicons name="home" size={28} color="#55A238" />;
      case '친구 집':
        return <Ionicons name="home-outline" size={28} color="#55A238" />;
      case '학원':
        return <Ionicons name="book" size={28} color="#55A238" />;
      case '병원':
        return <FontAwesome5 name="hospital" size={26} color="#55A238" />;
      default:
        return <Ionicons name="ellipsis-horizontal" size={28} color="#55A238" />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleComplete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={28} color="#000000" />
        </TouchableOpacity>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>자주 가는 장소</Text>
        </View>

        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.mainTitle}>등록된 장소</Text>
          <Text style={styles.countText}>
            <Text style={styles.countBold}>{places.length}/10</Text> 최대 10개까지 등록할 수 있습니다.
          </Text>
        </View>

        {/* 장소 카드 목록 (클릭 시 수정 모드) */}
        {places.map((place) => (
          <TouchableOpacity
            key={place.id}
            style={styles.placeCard}
            onPress={() => handleSelectPlace(place)}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              {getCategoryIcon(place.category)}
            </View>

            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{place.name}</Text>
              <Text style={styles.placeAddress} numberOfLines={1}>
                {place.address}
              </Text>
            </View>

            <Text style={styles.arrowText}>&gt;</Text>
          </TouchableOpacity>
        ))}

        {places.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>등록된 자주 가는 장소가 없습니다.</Text>
            <Text style={styles.emptySubText}>아래 버튼을 눌러 자주 가는 장소를 추가해보세요.</Text>
          </View>
        )}

        {/* 장소 추가하기 버튼 (클릭 시 신규 등록 모드) */}
        <TouchableOpacity style={styles.addCard} onPress={handleAddPlace} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="#000000" />
          <Text style={styles.addCardText}>장소 추가하기</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 하단 완료 버튼 */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.completeBtn}
          onPress={handleComplete}
          activeOpacity={0.8}
        >
          <Text style={styles.completeBtnText}>완료</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  badge: {
    backgroundColor: '#55A238',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 8,
  },
  countText: {
    fontSize: 14,
    color: '#666666',
  },
  countBold: {
    fontWeight: 'bold',
    color: '#333333',
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EBF7E3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  arrowText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666666',
    marginLeft: 8,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#888888',
    marginBottom: 6,
  },
  emptySubText: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  addCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingVertical: 20,
    marginTop: 4,
  },
  addCardText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 8,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
  },
  completeBtn: {
    height: 56,
    backgroundColor: '#55A238',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
});