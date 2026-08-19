import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/common/scaled-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { FACILITY_SEARCH_LOCATION, getNearestInstitutions } from '@/features/institutions/nearest-institutions';

type FacilityCategory = '전체' | '복지관' | '노인센터' | '병원' | '기타';

/** 서버 연동 시 그대로 사용할 시설 데이터 형태입니다. */
type Facility = {
  facilityId: string;
  name: string;
  category: Exclude<FacilityCategory, '전체'>;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  operatingHours: string;
  distance: string;
  description?: string;
  status?: 'open' | 'closed';
};

// TODO: 백엔드 시설 조회 API 연결 전까지 화면 확인용 데이터입니다.
const DUMMY_FACILITIES: Facility[] = [
  {
    facilityId: '1',
    name: '서구종합사회복지관',
    category: '복지관',
    address: '광주광역시 서구 어쩌고저쩌고',
    latitude: 35.1512,
    longitude: 126.8903,
    phone: '000-123-4567',
    operatingHours: '09:00 ~ 18:00',
    distance: '340m',
    status: 'open',
    description: '지역 주민을 위한 복지 상담, 문화 프로그램과 급식 지원을 제공합니다.',
  },
  {
    facilityId: '2',
    name: '서구노인복지센터',
    category: '노인센터',
    address: '광주광역시 서구 상무대로 1147',
    latitude: 35.1534,
    longitude: 126.8852,
    phone: '062-000-5678',
    operatingHours: '09:00 ~ 18:00',
    distance: '520m',
    status: 'open',
    description: '어르신의 건강한 일상과 사회 참여를 돕는 프로그램을 운영합니다.',
  },
  {
    facilityId: '3',
    name: '서구마음병원',
    category: '병원',
    address: '광주광역시 서구 금화로 86',
    latitude: 35.1481,
    longitude: 126.8941,
    phone: '062-000-9012',
    operatingHours: '24시간',
    distance: '800m',
    status: 'open',
    description: '진료와 상담이 필요한 경우 이용할 수 있는 의료기관입니다.',
  },
];

const CATEGORIES: FacilityCategory[] = ['전체', '복지관', '노인센터', '병원', '기타'];

type Props = {
  variant: 'protected' | 'guardian';
  returnRoute: Href;
  subjectId?: number;
};

export default function FacilityListScreen({ variant, returnRoute, subjectId }: Props) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<FacilityCategory>('전체');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [selectedMapFacility, setSelectedMapFacility] = useState<Facility | null>(null);
  const [routeFacility, setRouteFacility] = useState<Facility | null>(null);
  const [serverFacilities, setServerFacilities] = useState<Facility[]>([]);
  const [currentLocation, setCurrentLocation] = useState(FACILITY_SEARCH_LOCATION);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mapRef = useRef<WebView>(null);
  const themeColor = variant === 'protected' ? '#59A03D' : '#F7931E';

  useEffect(() => {
    getNearestInstitutions(subjectId ?? 0)
      .then((result) => {
        setServerFacilities(result.facilities as Facility[]);
        setCurrentLocation(result.currentLocation);
        setLoadError(null);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : '가까운 복지시설을 불러오지 못했습니다.'))
      .finally(() => setIsLoading(false));
  }, [subjectId]);

  const facilities = useMemo(
    () => selectedCategory === '전체'
      ? serverFacilities
      : serverFacilities.filter((facility) => facility.category === selectedCategory),
    [selectedCategory, serverFacilities],
  );

  const mapCenter = selectedMapFacility
    ? { latitude: selectedMapFacility.latitude, longitude: selectedMapFacility.longitude }
    : currentLocation;
  // 카테고리 필터에 맞는 시설만 지도에 표시하고, 현재 위치 마커는 항상 유지합니다.
  const mapMarkers = serverFacilities
    .filter((facility) => Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude) && facility.latitude !== 0 && facility.longitude !== 0)
    .map((facility) => ({ id: facility.facilityId, name: facility.name, latitude: facility.latitude, longitude: facility.longitude }));
  const mapHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>html,body,#map{width:100%;height:100%;margin:0}.current{width:16px;height:16px;border:3px solid #fff;border-radius:50%;background:#1677ff;box-shadow:0 0 5px #1677ff}.facility{width:18px;height:18px;border:3px solid #fff;border-radius:50%;background:#F7931E;box-shadow:0 0 5px #b65b00}.selected{background:#FF2525}</style></head><body><div id="map"></div><script>const facilities=${JSON.stringify(mapMarkers)};const selectedId=${JSON.stringify(selectedMapFacility?.facilityId ?? null)};const current=[${currentLocation.latitude},${currentLocation.longitude}];const map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${mapCenter.latitude},${mapCenter.longitude}],16);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);const currentIcon=L.divIcon({className:'current',iconSize:[22,22],iconAnchor:[11,11]});L.marker(current,{icon:currentIcon}).addTo(map).bindPopup('현재 위치');facilities.forEach((facility)=>{const icon=L.divIcon({className:selectedId===facility.id?'facility selected':'facility',iconSize:[24,24],iconAnchor:[12,12]});L.marker([facility.latitude,facility.longitude],{icon}).addTo(map).bindPopup(facility.name).on('click',()=>window.ReactNativeWebView.postMessage(facility.id));});const points=[current,...facilities.map((facility)=>[facility.latitude,facility.longitude])];if(points.length>1)map.fitBounds(points,{padding:[22,22],maxZoom:selectedId?14:15});</script></body></html>`;

  const mapHtmlWithGlobal = mapHtml.replace('const map=L.map', 'const map=window.leafletMap=L.map');
  const focusedMapHtml = (selectedMapFacility
    ? mapHtmlWithGlobal.replace(
      'if(points.length>1)map.fitBounds(points,{padding:[22,22],maxZoom:selectedId?14:15});',
      'const selected=facilities.find((facility)=>facility.id===selectedId);if(selected){map.setView([selected.latitude,selected.longitude],14);}else if(points.length>1){map.fitBounds(points,{padding:[22,22],maxZoom:15});}',
    )
    : mapHtmlWithGlobal)
    .replace(
      "className:selectedId===facility.id?'facility selected':'facility'",
      "className:(selectedId===facility.id?'facility selected':'facility')+' marker-'+facility.id",
    );

  // OSRM은 OpenStreetMap 데이터를 이용하는 오픈소스 경로 엔진입니다.
  // 공개 foot 프로필로 현재 위치와 선택 시설 사이의 도보 경로를 지도 위에 표시합니다.
  const routeMapHtml = routeFacility
    ? focusedMapHtml.replace(
      'const points=[current,...facilities.map',
      `const routeTarget=${JSON.stringify({ latitude: routeFacility.latitude, longitude: routeFacility.longitude })};map.fitBounds([current,[routeTarget.latitude,routeTarget.longitude]],{padding:[26,26],maxZoom:15});fetch('https://routing.openstreetmap.de/routed-foot/route/v1/driving/'+current[1]+','+current[0]+';'+routeTarget.longitude+','+routeTarget.latitude+'?overview=full&geometries=geojson').then((response)=>response.json()).then((data)=>{const route=data.routes&&data.routes[0];if(!route)return;const routePoints=route.geometry.coordinates.map((point)=>[point[1],point[0]]);const line=L.polyline(routePoints,{color:'#2563EB',weight:5,opacity:0.9}).addTo(map);map.fitBounds(line.getBounds(),{padding:[26,26],maxZoom:15});}).catch(()=>{});const points=[current,...facilities.map`,
    )
    : focusedMapHtml;
  void routeMapHtml;

  useEffect(() => {
    const visibleIds = JSON.stringify(facilities.map((facility) => facility.facilityId));
    mapRef.current?.injectJavaScript(`(function(){const visibleIds=new Set(${visibleIds});document.querySelectorAll('.facility').forEach((element)=>{const markerClass=[...element.classList].find((className)=>className.startsWith('marker-'));if(markerClass){element.style.display=visibleIds.has(markerClass.slice(7))?'block':'none';}});true;})()`);
  }, [facilities]);

  const selectMapFacility = (facility: Facility) => {
    setRouteFacility(null);
    setSelectedMapFacility(facility);
  };

  const showWalkingRoute = (facility: Facility) => {
    const destination = JSON.stringify({ latitude: facility.latitude, longitude: facility.longitude });
    mapRef.current?.injectJavaScript(`(function(){const map=window.leafletMap;if(!map)return;if(window.routeLine)map.removeLayer(window.routeLine);const current=[${currentLocation.latitude},${currentLocation.longitude}];const destination=${destination};fetch('https://routing.openstreetmap.de/routed-foot/route/v1/driving/'+current[1]+','+current[0]+';'+destination.longitude+','+destination.latitude+'?overview=full&geometries=geojson').then((response)=>response.json()).then((data)=>{const route=data.routes&&data.routes[0];if(!route)return;const points=route.geometry.coordinates.map((point)=>[point[1],point[0]]);window.routeLine=L.polyline(points,{color:'#2563EB',weight:5,opacity:0.9}).addTo(map);map.fitBounds(window.routeLine.getBounds(),{padding:[26,26],maxZoom:15});}).catch(()=>{});true;})()`);
  };

  const handleCall = async (phone: string) => {
    const phoneUrl = `tel:${phone.replace(/[^0-9+]/g, '')}`;
    const supported = await Linking.canOpenURL(phoneUrl);

    if (supported) {
      await Linking.openURL(phoneUrl);
    } else {
      Alert.alert('전화 연결 불가', '이 기기에서는 전화 앱을 열 수 없습니다.');
    }
  };

  const handleRoute = (facility: Facility) => {
    setSelectedMapFacility(facility);
    setRouteFacility(facility);
    showWalkingRoute(facility);
    return;
    // eslint-disable-next-line no-unreachable
    Alert.alert('길찾기', `${facility.name} 길찾기 기능을 준비 중입니다.`);
  };

  const handleCategorySelect = (category: FacilityCategory) => {
    setSelectedCategory(category);
    setRouteFacility(null);
    mapRef.current?.injectJavaScript(`(function(){const map=window.leafletMap;if(map&&window.routeLine){map.removeLayer(window.routeLine);window.routeLine=null;}true;})()`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="뒤로 가기" onPress={() => router.replace(returnRoute)} hitSlop={12}>
          <Ionicons name="arrow-back" size={31} color="#111111" />
        </TouchableOpacity>
        <View style={[styles.titleBadge, { backgroundColor: themeColor }]}>
          <Text style={styles.title}>복지시설 안내</Text>
        </View>
        <View style={styles.headerSpace} />
      </View>

      {/* 추후 지도 컴포넌트가 들어갈 영역 */}
      <View style={styles.mapPlaceholder}>
        <WebView
          key={selectedMapFacility?.facilityId ?? 'current'}
          ref={mapRef}
          originWhitelist={['*']}
          source={{ html: focusedMapHtml }}
          scrollEnabled={false}
          onLoadEnd={() => {
            if (routeFacility) showWalkingRoute(routeFacility);
          }}
          onMessage={(event) => {
            const facility = facilities.find((item) => item.facilityId === event.nativeEvent.data);
            if (facility) selectMapFacility(facility);
          }}
        />
      </View>

      <View style={styles.filterArea}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {CATEGORIES.map((category) => {
            const active = category === selectedCategory;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.filterChip, active && { backgroundColor: themeColor, borderColor: themeColor }]}
                onPress={() => handleCategorySelect(category)}>
                <Text style={[styles.filterText, active && styles.activeFilterText]}>{category}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        style={styles.facilityList}
        data={facilities}
        keyExtractor={(facility) => facility.facilityId}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: facility }) => (
          <TouchableOpacity
            style={styles.facilityRow}
            activeOpacity={0.7}
            onPress={() => selectMapFacility(facility)}>
            <View style={styles.facilityTitleRow}>
              <Ionicons name="location" size={30} color={themeColor} />
              <Text style={styles.facilityName}>{facility.name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color="#707070" />
              <Text style={styles.distance}>{facility.distance}</Text>
              <Text style={styles.address} numberOfLines={1}>{facility.address}</Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.phoneButton} onPress={() => handleCall(facility.phone)}>
                <Ionicons name="call-outline" size={24} color="#111111" />
                <Text style={styles.phone}>{facility.phone}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.routeButton, { borderColor: '#D7D7D7' }]}
                onPress={() => handleRoute(facility)}>
                <Text style={[styles.routeText, { color: themeColor }]}>길찾기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{isLoading ? '가까운 복지시설을 불러오는 중입니다.' : loadError ?? '해당 유형의 복지시설이 없습니다.'}</Text>
          </View>
        }
      />

      <Modal
        visible={selectedFacility !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedFacility(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedFacility && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleArea}>
                    <Text style={styles.modalTitle}>{selectedFacility.name}</Text>
                    <Text style={[styles.modalCategory, { color: themeColor }]}>{selectedFacility.category}</Text>
                  </View>
                  <TouchableOpacity accessibilityLabel="상세 정보 닫기" onPress={() => setSelectedFacility(null)}>
                    <Ionicons name="close" size={28} color="#333333" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalDetails}>
                  <Text style={styles.detailText}>주소  {selectedFacility.address}</Text>
                  <Text style={styles.detailText}>운영시간  {selectedFacility.operatingHours}</Text>
                  <Text style={styles.detailText}>거리  {selectedFacility.distance}</Text>
                  {!!selectedFacility.description && <Text style={styles.description}>{selectedFacility.description}</Text>}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, { borderColor: themeColor }]}
                    onPress={() => handleRoute(selectedFacility)}>
                    <Text style={[styles.modalActionText, { color: themeColor }]}>길찾기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionButton, { backgroundColor: themeColor, borderColor: themeColor }]}
                    onPress={() => handleCall(selectedFacility.phone)}>
                    <Ionicons name="call" size={19} color="#FFFFFF" />
                    <Text style={styles.modalCallText}>전화 걸기</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  headerSpace: { width: 31 },
  titleBadge: { height: 40, borderRadius: 16, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  mapPlaceholder: { height: 168, backgroundColor: '#FFFFFF', marginBottom: 20 },
  filterArea: { minHeight: 80, justifyContent: 'flex-start' },
  filterRow: { minHeight: 50, alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  filterChip: { width: 'auto', minHeight: 50, alignSelf: 'center', borderWidth: 1, borderColor: '#D8D8D8', borderRadius: 15, paddingHorizontal: 13, paddingVertical: 5, justifyContent: 'center', alignItems: 'center' },
  filterText: { color: '#5B5B5B', fontSize: 19, fontWeight: '700', lineHeight: 24, includeFontPadding: false },
  activeFilterText: { color: '#FFFFFF' },
  facilityList: { flex: 1, borderTopWidth: 1, borderTopColor: '#E7E7E7' },
  facilityRow: { minHeight: 166, borderBottomWidth: 1, borderBottomColor: '#E7E7E7', paddingHorizontal: 26, paddingTop: 25, paddingBottom: 12 },
  facilityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  facilityName: { flex: 1, color: '#111111', fontSize: 26, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  distance: { color: '#6B6B6B', fontSize: 17, fontWeight: '800' },
  address: { flex: 1, color: '#6B6B6B', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  phoneButton: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  phone: { color: '#111111', fontSize: 19, fontWeight: '800' },
  routeButton: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 8 },
  routeText: { fontSize: 19, fontWeight: '800' },
  emptyContainer: { alignItems: 'center', paddingTop: 45 },
  emptyText: { color: '#777777', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  modalContent: { minHeight: 320, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitleArea: { flex: 1, paddingRight: 12 },
  modalTitle: { color: '#111111', fontSize: 23, fontWeight: '800' },
  modalCategory: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  modalDetails: { marginTop: 22, gap: 10 },
  detailText: { color: '#444444', fontSize: 16, lineHeight: 23 },
  description: { marginTop: 8, borderRadius: 10, backgroundColor: '#F5F5F5', color: '#555555', fontSize: 15, lineHeight: 22, padding: 13 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 27 },
  modalActionButton: { flex: 1, minHeight: 50, borderWidth: 1.5, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  modalActionText: { fontSize: 17, fontWeight: '800' },
  modalCallText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
