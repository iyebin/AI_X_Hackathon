import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { completeProtectedTutorial, shouldShowProtectedTutorial } from './protected-tutorial-state';

export type ProtectedHelpStep =
  | 'home-intro'
  | 'home-call'
  | 'home-emergency'
  | 'home-weather'
  | 'home-facility'
  | 'facility-list'
  | 'facility-card'
  | 'facility-route'
  | 'facility-route-preview'
  | 'map'
  | 'map-info'
  | 'notification'
  | 'notification-list'
  | 'notification-alert'
  | 'alert-modal'
  | 'setting'
  | 'settings-font'
  | 'settings-notification'
  | 'settings-contact'
  | 'settings-contact-modal'
  | 'frequent-places'
  | 'add-place'
  | 'register-place'
  | 'registered-place'
  | 'complete-place'
  | 'help-finish';

export const HELP_STEP_TARGET: Record<ProtectedHelpStep, string> = {
  'home-intro': 'home', 'home-call': 'call', 'home-emergency': 'emergency', 'home-weather': 'weather', 'home-facility': 'facility',
  'facility-list': 'next', 'facility-card': 'facility-card', 'facility-route': 'route', 'facility-route-preview': 'next', map: 'map', 'map-info': 'none', notification: 'notification', 'notification-list': 'none',
  'notification-alert': 'alert', 'alert-modal': 'close', setting: 'setting', 'settings-font': 'font-size', 'settings-notification': 'notification-settings', 'settings-contact': 'contact', 'settings-contact-modal': 'none', 'frequent-places': 'frequent', 'add-place': 'add',
  'register-place': 'register', 'registered-place': 'registered-place', 'complete-place': 'done', 'help-finish': 'help',
};

type ProtectedHelpContextValue = {
  step: ProtectedHelpStep | null;
  subjectId?: number;
  activeTarget?: string;
  checkFirstTutorial: (subjectId: number) => Promise<void>;
  startTutorial: (subjectId: number) => void;
  setStep: (step: ProtectedHelpStep) => void;
  advanceTutorial: () => void;
  finishTutorial: () => void;
};

const ProtectedHelpContext = createContext<ProtectedHelpContextValue | null>(null);

export function ProtectedHelpProvider({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const [step, setStep] = useState<ProtectedHelpStep | null>(null);
  const [subjectId, setSubjectId] = useState<number>();

  const checkFirstTutorial = useCallback(async (nextSubjectId: number) => {
    // 도움말 진행 중 다른 화면으로 이동했다가 메인으로 돌아와도
    // 첫 실행 단계가 다시 시작되어 현재 단계를 덮어쓰지 않게 합니다.
    if (step) return;
    if (await shouldShowProtectedTutorial(nextSubjectId)) {
      setSubjectId(nextSubjectId);
      setStep('home-intro');
    }
  }, [step]);

  const startTutorial = useCallback((nextSubjectId: number) => {
    setSubjectId(nextSubjectId);
    setStep('home-intro');
  }, []);

  const finishTutorial = useCallback(() => {
    const completedSubjectId = subjectId;
    setStep(null);
    if (completedSubjectId) void completeProtectedTutorial(completedSubjectId);
  }, [subjectId]);

  const advanceTutorial = useCallback(() => {
    switch (step) {
      case 'home-intro': return setStep('home-call');
      case 'home-call': return setStep('home-emergency');
      case 'home-emergency': return setStep('home-weather');
      case 'home-weather': return setStep('home-facility');
      case 'home-facility': router.push({ pathname: '/protected-facility', params: { subjectId: String(subjectId ?? 3), tutorial: 'true' } }); return setStep('facility-list');
      case 'facility-list': return setStep('facility-card');
      case 'facility-card': return setStep('facility-route');
      case 'facility-route': return setStep('facility-route-preview');
      case 'facility-route-preview': router.replace({ pathname: '/protected-main', params: { subjectId: String(subjectId ?? 3), tab: 'home' } }); return setStep('map');
      case 'map': router.replace({ pathname: '/protected-main', params: { subjectId: String(subjectId ?? 3), tab: 'map' } }); return setStep('map-info');
      case 'map-info': router.replace({ pathname: '/protected-main', params: { subjectId: String(subjectId ?? 3), tab: 'home' } }); return setStep('notification');
      case 'notification': router.replace({ pathname: '/protected-main', params: { subjectId: String(subjectId ?? 3), tab: 'notification' } }); return setStep('notification-list');
      case 'notification-list': return setStep('notification-alert');
      case 'notification-alert': router.push({
        pathname: '/danger-modal',
        params: {
          subjectId: String(subjectId ?? 3),
          dangerScore: '85',
          dangerReasons: 'GPS 이상 감지',
          riskLevel: 'danger',
          viewerRole: 'protected',
          riskSnapshot: JSON.stringify({
            risk_level: 'danger',
            risk_score: 85,
            factors: [
              { type: 'gps_deviation', name: 'GPS 이상', score: 50, percentage: 59, description: '평소 이동 패턴과 다른 움직임이 감지되었습니다.' },
              { type: 'weather', name: '기상', score: 22, percentage: 26, description: '현재 기상 상황이 위험도에 영향을 주고 있습니다.' },
              { type: 'air', name: '대기', score: 13, percentage: 15, description: '현재 대기질이 외부 활동에 영향을 줄 수 있습니다.' },
            ],
          }),
        },
      }); return setStep('alert-modal');
      case 'alert-modal': {
        // Android Fabric에서는 모달 화면을 교체하는 동일 프레임에 오버레이의
        // 대상 버튼까지 바꾸면 이미 부모가 있는 네이티브 뷰를 재부착하려 할 수 있습니다.
        // 단계를 먼저 바꾸고 다음 프레임에 홈으로 이동해 두 렌더를 분리합니다.
        setStep('setting');
        requestAnimationFrame(() => {
          router.replace({ pathname: '/protected-main', params: { subjectId: String(subjectId ?? 3), tab: 'home' } });
        });
        return;
      }
      case 'setting': router.replace({ pathname: '/protected-main', params: { subjectId: String(subjectId ?? 3), tab: 'setting' } }); return setStep('settings-font');
      case 'settings-font': return setStep('settings-notification');
      case 'settings-notification': return setStep('settings-contact');
      case 'settings-contact': return setStep('settings-contact-modal');
      case 'settings-contact-modal': return setStep('frequent-places');
      case 'frequent-places': router.push({ pathname: '/frequent-places', params: { tutorial: 'start' } }); return setStep('add-place');
      case 'add-place': router.push({ pathname: '/add-frequent-place', params: { mode: 'add', tutorial: 'true' } }); return setStep('register-place');
      case 'register-place': router.replace({ pathname: '/frequent-places', params: { tutorial: 'registered' } }); return setStep('registered-place');
      case 'registered-place': return setStep('complete-place');
      case 'complete-place': router.replace({ pathname: '/protected-main', params: { subjectId: String(subjectId ?? 3), tab: 'home' } }); return setStep('help-finish');
      case 'help-finish': return finishTutorial();
    }
  }, [finishTutorial, router, step, subjectId]);

  const value = useMemo(() => ({ step, subjectId, activeTarget: step ? HELP_STEP_TARGET[step] : undefined, checkFirstTutorial, startTutorial, setStep, advanceTutorial, finishTutorial }), [step, subjectId, checkFirstTutorial, startTutorial, advanceTutorial, finishTutorial]);
  return <ProtectedHelpContext.Provider value={value}>{children}</ProtectedHelpContext.Provider>;
}

export function useProtectedHelp() {
  const value = useContext(ProtectedHelpContext);
  if (!value) throw new Error('useProtectedHelp must be used inside ProtectedHelpProvider');
  return value;
}
