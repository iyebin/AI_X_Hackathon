import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/common/scaled-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FrequentPlace, getFrequentPlaces } from '@/features/places/frequent-place-store';
import { useTextSize } from '@/features/accessibility/text-size';
import TutorialTarget from '@/components/tutorial/tutorial-target';
import { useProtectedHelp } from '@/features/tutorial/protected-help-flow';

export default function FrequentPlacesScreen() {
  const router = useRouter();
  const { step: tutorialStep } = useProtectedHelp();
  const { tutorial } = useLocalSearchParams<{ tutorial?: string }>();
  const { mode: textSizeMode } = useTextSize();
  const [places, setPlaces] = useState<FrequentPlace[]>(getFrequentPlaces());
  const tutorialPlace: FrequentPlace = {
    id: 'tutorial-example-place',
    name: '집',
    category: '집' as FrequentPlace['category'],
    address: '광주광역시',
    memo: '',
  };
  const displayedPlaces = tutorial === 'registered' ? [...places, tutorialPlace] : places;

  // 장소 추가/수정 화면에서 돌아올 때 최신 목록을 다시 읽습니다.
  useFocusEffect(useCallback(() => {
    setPlaces(getFrequentPlaces());
  }, []));

  const handleAddPlace = () => {
    if (places.length >= 10) {
      Alert.alert('장소 등록 제한', '자주 가는 장소는 최대 10개까지 등록할 수 있습니다.');
      return;
    }
    router.push({ pathname: '/add-frequent-place', params: { mode: 'add' } });
  };

  const handleEditPlace = (place: FrequentPlace) => {
    router.push({
      pathname: '/add-frequent-place',
      params: {
        mode: 'edit',
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        memo: place.memo,
      },
    });
  };

  const getPlaceIcon = (category: FrequentPlace['category']) => {
    if (category === '집') return 'home';
    if (category === '친구 집') return 'home-outline';
    if (category === '학원') return 'book';
    if (category === '병원') return 'medical';
    return 'ellipsis-horizontal';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="뒤로 가기" disabled={Boolean(tutorialStep)} onPress={() => router.replace({ pathname: '/protected-main', params: { tab: 'setting' } })} hitSlop={12}>
          <Ionicons name="arrow-back" size={28} color="#111111" />
        </TouchableOpacity>
        <View style={styles.badge}><Text style={styles.badgeText}>자주 가는 장소</Text></View>
        <View style={styles.headerSpace} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.titleRow, textSizeMode === 'large' && styles.titleRowLarge]}>
          <Text style={styles.title}>등록된 장소</Text>
          <Text style={styles.count}><Text style={styles.countBold}>{displayedPlaces.length}/10</Text> 최대 10개까지 등록할 수 있습니다.</Text>
        </View>

        {displayedPlaces.map((place) => {
          const isTutorialRegisteredPlace = place.id === tutorialPlace.id;
          return (
            <TutorialTarget key={place.id} target={isTutorialRegisteredPlace ? 'registered-place' : `place-${place.id}`}>
              <TouchableOpacity
                disabled={Boolean(tutorialStep) && !isTutorialRegisteredPlace}
                style={[styles.placeCard, tutorialStep && !isTutorialRegisteredPlace && styles.tutorialDimmed]}
                onPress={() => handleEditPlace(place)}
                activeOpacity={0.7}>
                <View style={styles.iconCircle}><Ionicons name={getPlaceIcon(place.category)} size={27} color="#59A03D" /></View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
                  {!!place.memo && <Text style={styles.memo} numberOfLines={1}>{place.memo}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={22} color="#777777" />
              </TouchableOpacity>
            </TutorialTarget>
          );
        })}

        {displayedPlaces.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>등록한 장소가 없습니다.</Text>
            <Text style={[styles.emptyText, textSizeMode === 'large' && styles.emptyTextLarge]}>
              {textSizeMode === 'large' ? <>아래의 장소 추가하기를{'\n'}눌러 등록해 주세요.</> : '아래의 장소 추가하기를 눌러 등록해 주세요.'}
            </Text>
          </View>
        )}

        <TutorialTarget target="add">
          <TouchableOpacity style={styles.addCard} onPress={handleAddPlace} activeOpacity={0.8}>
            <Ionicons name="add" size={27} color="#59A03D" />
            <Text style={styles.addText}>장소 추가하기</Text>
          </TouchableOpacity>
        </TutorialTarget>
      </ScrollView>

      <View style={styles.bottomArea}>
        <TutorialTarget target="done">
          <TouchableOpacity style={styles.doneButton} onPress={() => router.replace({ pathname: '/protected-main', params: { tab: 'setting' } })} activeOpacity={0.8}>
            <Text style={styles.doneText}>완료</Text>
          </TouchableOpacity>
        </TutorialTarget>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  headerSpace: { width: 28 },
  badge: { height: 40, paddingHorizontal: 20, borderRadius: 16, backgroundColor: '#59A03D', justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  content: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 118 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 },
  titleRowLarge: { flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  title: { fontSize: 21, fontWeight: 'bold', color: '#111111' },
  count: { fontSize: 14, fontWeight: '600', color: '#666666' },
  countBold: { fontWeight: '800', color: '#444444' },
  placeCard: { minHeight: 96, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#DFDFDF', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  iconCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#E5FFDB', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 20, fontWeight: 'bold', color: '#111111' },
  placeAddress: { marginTop: 4, fontSize: 14, color: '#666666' },
  memo: { marginTop: 3, fontSize: 13, color: '#888888' },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 17, fontWeight: 'bold', color: '#777777' },
  emptyText: { marginTop: 7, fontSize: 14, color: '#999999' },
  emptyTextLarge: { textAlign: 'center' },
  addCard: { height: 96, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#DFDFDF', borderRadius: 18, marginTop: 2 },
  addText: { marginLeft: 10, fontSize: 21, fontWeight: 'bold', color: '#111111' },
  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 32, paddingTop: 12, paddingBottom: 24, backgroundColor: '#FFFFFF' },
  doneButton: { height: 76, justifyContent: 'center', alignItems: 'center', borderRadius: 17, backgroundColor: '#59A03D' },
  doneText: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' },
  tutorialDimmed: { opacity: 0.28 },
});
