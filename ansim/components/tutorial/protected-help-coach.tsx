import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/common/scaled-text';
import { type ProtectedHelpStep, useProtectedHelp } from '@/features/tutorial/protected-help-flow';

type CoachCopy = { title: string; description: string; showNext?: boolean };

const COPY: Record<ProtectedHelpStep, CoachCopy> = {
  'home-intro': { title: '안심하랑께 사용 방법', description: '여기는 보호대상자의 메인 홈입니다.' },
  'home-call': { title: '보호자에게 연락하기', description: '누르면 등록된 보호자 연락처로 연결됩니다.' },
  'home-emergency': { title: '긴급신고', description: '위급한 상황에서 누르면 긴급신고로 연결됩니다.' },
  'home-weather': { title: '현재 날씨와 기상특보', description: '현재 날씨와 기상특보 정보를 확인할 수 있습니다.' },
  'home-facility': { title: '가까운 복지시설 찾기', description: '현재 위치에서 가까운 복지시설을 확인할 수 있습니다.' },
  'facility-list': { title: '가까운 복지시설', description: '시설 목록과 위치를 확인할 수 있습니다.' },
  'facility-card': { title: '복지시설 카드', description: '시설을 선택하면 지도에서 해당 시설의 위치를 확인할 수 있습니다.' },
  'facility-route': { title: '길찾기', description: '길찾기를 선택하면 현재 위치에서 가는 길을 확인할 수 있습니다.' },
  'facility-route-preview': { title: '길찾기 경로', description: '파란 선으로 표시된 도보 경로를 확인할 수 있습니다.', showNext: true },
  map: { title: '지도', description: '하단의 지도 아이콘을 선택해보세요.' },
  'map-info': { title: '지도', description: '현재 위치와 날씨 정보를 확인할 수 있습니다.' },
  notification: { title: '알림', description: '하단의 알림 아이콘을 선택해보세요.' },
  'notification-list': { title: '알림 내역', description: '받은 알림 내역을 확인할 수 있습니다.' },
  'notification-alert': { title: '예시 알림', description: '알림을 선택하면 알림 당시의 위험도와 위험요인을 확인할 수 있습니다.' },
  'alert-modal': { title: '위험 알림', description: '내용을 확인한 뒤 오른쪽 위 X를 눌러 닫아주세요.' },
  setting: { title: '설정', description: '하단의 설정 아이콘을 선택해보세요.' },
  'settings-font': { title: '글씨 크기', description: '글씨 크기를 조절할 수 있습니다.' },
  'settings-notification': { title: '알림·위치 수신 설정', description: '알림과 위치 권한을 설정할 수 있습니다.' },
  'settings-contact': { title: '긴급연락처 관리', description: '긴급연락처 관리를 선택해보세요.' },
  'settings-contact-modal': { title: '긴급연락처 수정', description: '이곳에서 긴급연락처를 수정할 수 있습니다.' },
  'frequent-places': { title: '자주 가는 장소 관리', description: '자주 가는 장소 관리를 선택해보세요.' },
  'add-place': { title: '장소 추가하기', description: '장소 이름·종류·위치를 입력해 새로운 장소를 등록할 수 있습니다.' },
  'register-place': { title: '등록하기', description: '입력한 장소 정보를 확인한 뒤 등록하기를 선택하세요.' },
  'registered-place': { title: '등록된 장소', description: '방금 등록한 장소를 확인해보세요.' },
  'complete-place': { title: '완료', description: '등록된 장소를 확인한 뒤 완료를 선택하세요.' },
  'help-finish': { title: '도움말', description: '사용 방법이 다시 궁금하면 이 도움말을 선택해주세요.' },
};

/**
 * 안내 문구만 루트에 표시합니다. 강조와 클릭 처리는 각 화면의 실제 버튼을
 * TutorialTarget이 직접 사용하므로, 별도 좌표·마스크 레이어가 없습니다.
 */
export default function ProtectedHelpCoach() {
  const { step, advanceTutorial, finishTutorial } = useProtectedHelp();
  if (!step) return null;

  const copy = COPY[step];
  return (
    <View style={styles.root} pointerEvents="box-none">
      {step === 'home-intro' || step === 'home-weather' || step === 'facility-list' || step === 'map-info' || step === 'notification-list' || step === 'settings-font' || step === 'settings-notification' || step === 'help-finish' ? <Pressable style={styles.firstStepTouchArea} onPress={advanceTutorial} /> : null}
      <TouchableOpacity style={styles.skip} onPress={finishTutorial} activeOpacity={0.8}>
        <Text style={styles.skipText}>건너뛰기</Text>
      </TouchableOpacity>

      <View style={[styles.bubble, step === 'home-weather' ? styles.bubbleTop : step === 'help-finish' ? styles.bubbleHelp : styles.bubbleBottom]} pointerEvents="none">
        <View style={styles.bubbleHead}>
          <Ionicons name="hand-left-outline" size={20} color="#FFFFFF" />
          <Text style={styles.title}>{copy.title}</Text>
        </View>
        <Text style={styles.description}>{copy.description}</Text>
      </View>

      {copy.showNext ? (
        <TouchableOpacity style={styles.nextButton} onPress={advanceTutorial} activeOpacity={0.85}>
          <Text style={styles.nextText}>다음</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
  firstStepTouchArea: { ...StyleSheet.absoluteFillObject },
  skip: { position: 'absolute', top: 22, left: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.48)' },
  skipText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  bubble: { position: 'absolute', left: 20, right: 20, padding: 19, borderRadius: 20, backgroundColor: '#59A03D' },
  bubbleBottom: { bottom: 106 },
  bubbleTop: { top: 365 },
  bubbleHelp: { top: 405 },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  description: { marginTop: 8, color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 25 },
  nextButton: { position: 'absolute', left: 40, right: 40, bottom: 38, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#398723' },
  nextText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
});
