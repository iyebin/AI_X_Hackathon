import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/common/scaled-text';

export type ProtectedTutorialTab = 'home' | 'map' | 'notification' | 'setting';

type TutorialStep = {
  tab: ProtectedTutorialTab;
  target: 'tab' | 'call' | 'facility' | 'emergency' | 'weather' | 'advisory';
  tabIndex?: number;
  title: string;
  description: string;
};

const STEPS: TutorialStep[] = [
  {
    tab: 'map',
    target: 'tab',
    tabIndex: 1,
    title: '지도',
    description: '여기를 눌러 현재 위치와 자주 가는 장소를 확인해 보세요.',
  },
  {
    tab: 'notification',
    target: 'tab',
    tabIndex: 2,
    title: '알림',
    description: '여기를 눌러 위험도 변화와 기관 알림을 확인해 보세요.',
  },
  {
    tab: 'setting',
    target: 'tab',
    tabIndex: 3,
    title: '설정',
    description: '여기를 눌러 위치·알림 권한, 글씨 크기를 설정해 보세요.',
  },
  {
    tab: 'home',
    target: 'tab',
    tabIndex: 0,
    title: '홈',
    description: '여기를 눌러 보호자에게 전화하거나 가까운 복지시설을 찾아보세요.',
  },
  {
    tab: 'home',
    target: 'call',
    title: '보호자에게 전화하기',
    description: '보호자와 바로 통화해야 할 때 사용하는 버튼이에요.',
  },
  {
    tab: 'home',
    target: 'facility',
    title: '가까운 복지시설 찾기',
    description: '내 주변의 복지관, 노인센터, 병원 등의 위치를 찾아볼 수 있어요.',
  },
  {
    tab: 'home',
    target: 'emergency',
    title: '긴급신고',
    description: '긴급한 상황에서는 이 버튼으로 112 신고를 할 수 있어요.',
  },
  {
    tab: 'home',
    target: 'weather',
    title: '현재 날씨',
    description: '현재 위치의 기온·습도·강수량 등 날씨 정보를 확인할 수 있어요.',
  },
  {
    tab: 'home',
    target: 'advisory',
    title: '기상특보',
    description: '폭염, 호우, 태풍 같은 기상특보가 있으면 이곳에서 알려드려요.',
  },
];

interface ProtectedAppTutorialProps {
  visible: boolean;
  onComplete: () => void;
  onSelectTab: (tab: ProtectedTutorialTab) => void;
}

export default function ProtectedAppTutorial({ visible, onComplete, onSelectTab }: ProtectedAppTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = useMemo(() => STEPS[stepIndex], [stepIndex]);
  const isLast = stepIndex === STEPS.length - 1;

  const finish = () => {
    setStepIndex(0);
    onComplete();
  };

  const handleTargetPress = () => {
    if (step.target === 'tab') onSelectTab(step.tab);
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((current) => current + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish} statusBarTranslucent>
      <View style={styles.overlay}>
        {/* 화면의 다른 영역을 모두 막아, 현재 안내 중인 탭만 누를 수 있습니다. */}
        <Pressable style={styles.dimmedArea} />

        <View style={styles.bubble} pointerEvents="none">
          <View style={styles.bubbleTitleRow}>
            <Ionicons name="hand-left-outline" size={21} color="#FFFFFF" />
            <Text style={styles.bubbleTitle}>{step.title}</Text>
          </View>
          <Text style={styles.bubbleDescription}>{step.description}</Text>
          <Text style={styles.bubbleHint}>아래 강조된 버튼을 눌러 계속하세요.</Text>
          <View style={styles.bubbleArrow} />
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={finish} activeOpacity={0.8}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={getTargetStyle(step)}
          onPress={handleTargetPress}
          activeOpacity={0.9}
          accessibilityLabel={`${step.title} 안내 버튼`}
        >
          <View style={styles.targetTabInner}>
            <Text style={styles.targetLabel}>{step.target === 'tab' ? `${step.title} 눌러보기` : '여기를 눌러 계속하기'}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function getTargetStyle(step: TutorialStep): StyleProp<ViewStyle> {
  if (step.target === 'tab') {
    return [styles.targetTab, { left: `${(step.tabIndex ?? 0) * 25}%` as `${number}%` }];
  }

  const targetStyles = {
    call: styles.targetCall,
    facility: styles.targetFacility,
    emergency: styles.targetEmergency,
    weather: styles.targetWeather,
    advisory: styles.targetAdvisory,
  };
  return [styles.targetHomeButton, targetStyles[step.target]];
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'transparent' },
  dimmedArea: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20, 24, 28, 0.68)' },
  skipButton: { position: 'absolute', top: 58, right: 24, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  skipText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  bubble: { position: 'absolute', right: 22, bottom: 112, left: 22, padding: 20, borderRadius: 20, backgroundColor: '#59A03D' },
  bubbleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubbleTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  bubbleDescription: { marginTop: 10, color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 25 },
  bubbleHint: { marginTop: 10, color: '#E9F8E4', fontSize: 13, fontWeight: '700' },
  bubbleArrow: { position: 'absolute', bottom: -12, width: 0, height: 0, alignSelf: 'center', borderTopWidth: 12, borderRightWidth: 13, borderLeftWidth: 13, borderTopColor: '#59A03D', borderRightColor: 'transparent', borderLeftColor: 'transparent' },
  targetTab: { position: 'absolute', bottom: 0, width: '25%', height: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderTopWidth: 3, borderTopColor: '#59A03D' },
  targetTabInner: { minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 6, borderRadius: 10, backgroundColor: '#E8F7E2' },
  targetLabel: { color: '#317E1C', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  targetHomeButton: { position: 'absolute', right: 24, left: 24, height: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#59A03D', borderRadius: 16, backgroundColor: '#FFFFFF' },
  targetCall: { top: '23%' },
  targetFacility: { top: '34%' },
  targetEmergency: { top: '45%' },
  targetWeather: { top: '57%', right: '51%', left: 24, height: 142 },
  targetAdvisory: { top: '57%', right: 24, left: '51%', height: 142 },
});
