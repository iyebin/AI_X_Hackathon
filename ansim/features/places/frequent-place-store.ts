export type PlaceCategory = '집' | '친구 집' | '학원' | '병원' | '기타';

export type FrequentPlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string;
  memo: string;
  latitude?: number;
  longitude?: number;
};

// 앱이 실행 중인 동안 장소 목록을 유지합니다.
// 추후 백엔드 또는 AsyncStorage 연동 시 이 모듈의 함수만 교체하면 됩니다.
let places: FrequentPlace[] = [];

export function getFrequentPlaces() {
  return places;
}

export function addFrequentPlace(place: Omit<FrequentPlace, 'id'>) {
  const newPlace: FrequentPlace = { id: Date.now().toString(), ...place };
  places = [...places, newPlace];
  return newPlace;
}

export function updateFrequentPlace(id: string, changes: Omit<FrequentPlace, 'id'>) {
  places = places.map((place) => (place.id === id ? { ...place, ...changes } : place));
}
