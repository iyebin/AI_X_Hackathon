import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { PlaceCategory, addFrequentPlace, updateFrequentPlace } from '@/features/places/frequent-place-store';

const CATEGORIES: { label: PlaceCategory; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { label: '집', icon: 'home' },
  { label: '친구 집', icon: 'people' },
  { label: '학원', icon: 'book' },
  { label: '병원', icon: 'medical' },
  { label: '기타', icon: 'ellipsis-horizontal' },
];

const DEFAULT_COORDS = { latitude: 37.6228, longitude: 127.0784 };

export default function AddFrequentPlaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: 'add' | 'edit'; id?: string; name?: string; category?: PlaceCategory; address?: string; memo?: string }>();
  const isEditMode = params.mode === 'edit' && !!params.id;
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('집');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setName(isEditMode ? params.name ?? '' : '');
    setCategory(isEditMode ? params.category ?? '집' : '집');
    setAddress(isEditMode ? params.address ?? '' : '');
    setMemo(isEditMode ? params.memo ?? '' : '');
  }, [isEditMode, params.name, params.category, params.address, params.memo]);

  const searchAddress = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;

    try {
      setIsSearching(true);
      // Android 기기의 지오코더를 우선 사용합니다. 한국 도로명 주소 인식률이 더 좋습니다.
      const deviceResults = await Location.geocodeAsync(trimmedQuery);
      if (deviceResults[0]) {
        setCoords({ latitude: deviceResults[0].latitude, longitude: deviceResults[0].longitude });
        return;
      }

      // 기기 지오코더에서 결과가 없을 때만 공개 지오코더를 보조로 사용합니다.
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ko&q=${encodeURIComponent(trimmedQuery)}`);
      const results: { lat: string; lon: string }[] = await response.json();
      if (results[0]) {
        setCoords({ latitude: Number(results[0].lat), longitude: Number(results[0].lon) });
      } else {
        Alert.alert('주소를 찾지 못했어요', '도로명 주소를 더 자세히 입력한 뒤 다시 시도해 주세요.');
      }
    } catch {
      Alert.alert('주소 검색 실패', '네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 주소 입력이 멈추면 자동으로 마커를 갱신합니다.
  useEffect(() => {
    const query = address.trim();
    if (query.length < 2) return;
    const timer = setTimeout(() => searchAddress(query), 900);
    return () => clearTimeout(timer);
  }, [address, searchAddress]);

  const mapHtml = useMemo(() => `
    <!doctype html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>html,body,#map{width:100%;height:100%;margin:0}.pin{width:18px;height:18px;background:#59A03D;border:3px solid white;border-radius:50%;box-shadow:0 1px 4px #555}</style>
    </head><body><div id="map"></div><script>
      const point=[${coords.latitude},${coords.longitude}];
      const map=L.map('map',{zoomControl:false,attributionControl:false}).setView(point,16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
      const icon=L.divIcon({className:'pin',iconSize:[24,24],iconAnchor:[12,12]});
      L.marker(point,{icon}).addTo(map);
    </script></body></html>`, [coords]);

  const handleSave = () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('입력 확인', '장소 이름과 주소를 입력해 주세요.');
      return;
    }

    const data = { name: name.trim(), category, address: address.trim(), memo: memo.trim(), latitude: coords.latitude, longitude: coords.longitude };
    if (isEditMode) updateFrequentPlace(params.id!, data);
    else addFrequentPlace(data);
    router.replace('/frequent-places');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="뒤로 가기" onPress={() => router.replace('/frequent-places')} hitSlop={12}>
            <Ionicons name="arrow-back" size={30} color="#111111" />
          </TouchableOpacity>
          <View style={styles.badge}><Text style={styles.badgeText}>자주 가는 장소</Text></View>
          <View style={styles.headerSpace} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>장소 이름</Text>
          <View style={styles.inputBox}>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예) 집, 학원, 병원, 경로당 등" placeholderTextColor="#B4B4B4" maxLength={20} />
            <Text style={styles.count}>{name.length}/20자</Text>
          </View>

          <Text style={styles.label}>장소 종류</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((item) => {
              const selected = category === item.label;
              return (
                <TouchableOpacity key={item.label} style={[styles.categoryBox, selected && styles.categorySelected]} onPress={() => setCategory(item.label)}>
                  <Ionicons name={item.icon} size={25} color={selected ? '#59A03D' : '#666666'} />
                  <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>장소 위치</Text>
          <View style={styles.mapBox}>
            <WebView originWhitelist={['*']} source={{ html: mapHtml }} scrollEnabled={false} />
          </View>
          <View style={styles.addressBox}>
            <Ionicons name="location-outline" size={21} color="#666666" />
            <TextInput style={styles.addressInput} value={address} onChangeText={setAddress} onSubmitEditing={() => searchAddress(address)} placeholder="주소를 입력해 주세요" placeholderTextColor="#999999" returnKeyType="search" />
            <TouchableOpacity onPress={() => searchAddress(address)} disabled={isSearching} hitSlop={8}>
              <Text style={styles.searchText}>{isSearching ? '검색 중' : '위치 변경'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>메모 <Text style={styles.optional}>(선택)</Text></Text>
          <View style={[styles.inputBox, styles.memoBox]}>
            <TextInput style={styles.memoInput} value={memo} onChangeText={setMemo} placeholder="메모를 입력하세요." placeholderTextColor="#B4B4B4" multiline maxLength={50} textAlignVertical="top" />
            <Text style={styles.count}>{memo.length}/50자</Text>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
            <Text style={styles.saveText}>{isEditMode ? '수정하기' : '등록하기'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboard: { flex: 1 },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  headerSpace: { width: 30 },
  badge: { height: 40, paddingHorizontal: 15, borderRadius: 15, backgroundColor: '#59A03D', justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { marginTop: 21, marginBottom: 9, color: '#111111', fontSize: 20, fontWeight: 'bold' },
  optional: { color: '#777777', fontSize: 14, fontWeight: 'normal' },
  inputBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#DFDFDF', borderRadius: 11, paddingHorizontal: 14 },
  input: { flex: 1, color: '#111111', fontSize: 17, fontWeight: '600' },
  count: { color: '#B8B8B8', fontSize: 14, fontWeight: 'bold' },
  categoryRow: { flexDirection: 'row', gap: 7 },
  categoryBox: { flex: 1, height: 74, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#DFDFDF', borderRadius: 10 },
  categorySelected: { borderColor: '#59A03D' },
  categoryText: { marginTop: 4, color: '#666666', fontSize: 14, fontWeight: 'bold' },
  categoryTextSelected: { color: '#59A03D' },
  mapBox: { height: 142, overflow: 'hidden', borderWidth: 1.5, borderColor: '#CDE7C1', borderRadius: 10, backgroundColor: '#E8FFDD' },
  addressBox: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#DFDFDF', borderRadius: 10, marginTop: 2, paddingHorizontal: 12 },
  addressInput: { flex: 1, color: '#333333', fontSize: 16, fontWeight: '600' },
  searchText: { color: '#666666', fontSize: 14, fontWeight: 'bold' },
  memoBox: { height: 92, flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  memoInput: { width: '100%', flex: 1, margin: 0, padding: 0, color: '#111111', fontSize: 16, fontWeight: '600', lineHeight: 20, includeFontPadding: false },
  saveButton: { height: 76, marginTop: 32, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: '#59A03D' },
  saveText: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' },
});
