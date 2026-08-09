import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function AddFrequentPlaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: 'add' | 'edit';
    id?: string;
    editName?: string;
    editCategory?: '집' | '친구 집' | '학원' | '병원' | '기타';
    editAddress?: string;
    editMemo?: string;
  }>();

  const isEditMode = params.mode === 'edit';

  const [placeName, setPlaceName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'집' | '친구 집' | '학원' | '병원' | '기타'>('집');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');

  // 지도 좌표
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 37.5665,
    lng: 126.9780,
  });

  // 💡 mode 값 변화 및 전달된 params 변경 감지하여 상태 초기화/설정
  useEffect(() => {
    if (params.mode === 'edit') {
      // ✏️ 수정 모드: 기존 작성되어 전달된 데이터 세팅
      setPlaceName(params.editName || '');
      setSelectedCategory(params.editCategory || '집');
      setAddress(params.editAddress || '');
      setMemo(params.editMemo || '');

      if (params.editAddress) {
        handleSearchAddressWithQuery(params.editAddress);
      }
    } else {
      // ➕ 추가 모드: 무조건 모든 폼 비우기
      setPlaceName('');
      setSelectedCategory('집');
      setAddress('');
      setMemo('');
      setCoords({ lat: 37.5665, lng: 126.9780 });
    }
  }, [params.mode, params.id, params.editName, params.editCategory, params.editAddress, params.editMemo]);

  const categories: { label: '집' | '친구 집' | '학원' | '병원' | '기타'; icon: any }[] = [
    { label: '집', icon: <Ionicons name="home" size={24} color="#55A238" /> },
    { label: '친구 집', icon: <Ionicons name="home-outline" size={24} color="#55A238" /> },
    { label: '학원', icon: <Ionicons name="book" size={24} color="#55A238" /> },
    { label: '병원', icon: <FontAwesome5 name="hospital" size={22} color="#55A238" /> },
    { label: '기타', icon: <Ionicons name="ellipsis-horizontal" size={24} color="#55A238" /> },
  ];

  const handleSearchAddressWithQuery = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        setCoords({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        });
      }
    } catch (e) {
      console.log('주소 변환 실패:', e);
    }
  };

  const handleSearchAddress = () => {
    handleSearchAddressWithQuery(address);
  };

  const handleGoBack = () => {
    router.replace('/frequent-places');
  };

  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${coords.lat}, ${coords.lng}], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
          L.marker([${coords.lat}, ${coords.lng}]).addTo(map);
        </script>
      </body>
    </html>
  `;

  const handleRegister = () => {
    if (!placeName.trim()) {
      Alert.alert('알림', '장소 이름을 입력해주세요.');
      return;
    }

    if (!address.trim()) {
      Alert.alert('알림', '장소 주소를 입력해주세요.');
      return;
    }

    const alertMessage = isEditMode ? '장소 정보가 수정되었습니다!' : '장소가 등록되었습니다!';

    Alert.alert('성공', alertMessage, [
      {
        text: '확인',
        onPress: () => {
          router.replace({
            pathname: '/frequent-places',
            params: {
              id: isEditMode ? params.id : undefined, // 💡 수정일 때만 기존 id 전달
              newPlaceName: placeName,
              newCategory: selectedCategory,
              newAddress: address,
              newMemo: memo,
            },
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleGoBack}
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
          {/* 1. 장소 이름 */}
          <Text style={styles.label}>장소 이름</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="예 ) 집, 학원, 병원, 경로당 등"
              placeholderTextColor="#BBBBBB"
              value={placeName}
              onChangeText={setPlaceName}
              maxLength={20}
            />
            <Text style={styles.charCount}>{placeName.length}/20자</Text>
          </View>

          {/* 2. 장소 종류 */}
          <Text style={styles.label}>장소 종류</Text>
          <View style={styles.categoryRow}>
            {categories.map((item) => {
              const isSelected = selectedCategory === item.label;
              return (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.categoryBox, isSelected && styles.categorySelected]}
                  onPress={() => setSelectedCategory(item.label)}
                  activeOpacity={0.8}
                >
                  {item.icon}
                  <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. 장소 위치 */}
          <Text style={styles.label}>장소 위치</Text>
          <View style={styles.mapPreviewBox}>
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={{ flex: 1 }}
              scrollEnabled={false}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="location-outline" size={20} color="#333333" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="주소를 입력하세요 (예: 테헤란로 123)"
              placeholderTextColor="#BBBBBB"
              value={address}
              onChangeText={setAddress}
              onBlur={handleSearchAddress}
              onSubmitEditing={handleSearchAddress}
            />
          </View>

          {/* 4. 메모 (선택) */}
          <Text style={styles.label}>
            메모 <Text style={styles.optionalText}>(선택)</Text>
          </Text>
          <View style={[styles.inputWrapper, styles.memoWrapper]}>
            <TextInput
              style={styles.memoInput}
              placeholder="메모를 입력하세요."
              placeholderTextColor="#BBBBBB"
              value={memo}
              onChangeText={setMemo}
              maxLength={50}
              multiline
            />
            <Text style={styles.charCount}>{memo.length}/50자</Text>
          </View>

          {/* 등록/수정 버튼 */}
          <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} activeOpacity={0.8}>
            <Text style={styles.registerBtnText}>{isEditMode ? '수정하기' : '등록하기'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Pressable>
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
    paddingBottom: 40,
  },
  label: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    marginTop: 12,
  },
  optionalText: {
    fontSize: 16,
    color: '#888888',
    fontWeight: 'normal',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  charCount: {
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: 'bold',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryBox: {
    flex: 1,
    height: 72,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  categorySelected: {
    borderColor: '#55A238',
    borderWidth: 2,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555555',
    marginTop: 4,
  },
  categoryTextSelected: {
    color: '#55A238',
  },
  mapPreviewBox: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  memoWrapper: {
    height: 100,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  memoInput: {
    flex: 1,
    width: '100%',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    textAlignVertical: 'top',
  },
  registerBtn: {
    height: 56,
    backgroundColor: '#55A238',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
});