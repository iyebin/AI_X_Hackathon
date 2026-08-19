import React, { isValidElement } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useProtectedHelp } from '@/features/tutorial/protected-help-flow';

interface TutorialTargetProps {
  target: string;
  style?: StyleProp<ViewStyle>;
  onTutorialPress?: () => void;
  disableDimming?: boolean;
  preserveChildInteraction?: boolean;
  children: React.ReactElement;
}

/** 실제 버튼을 그대로 사용해 튜토리얼 대상의 크기와 모서리가 원본과 항상 일치합니다. */
export default function TutorialTarget({ target, style, onTutorialPress, disableDimming = false, preserveChildInteraction = false, children }: TutorialTargetProps) {
  const { step, activeTarget, advanceTutorial } = useProtectedHelp();
  if (!isValidElement(children)) return <View style={style}>{children}</View>;

  const child = children as React.ReactElement<{ style?: StyleProp<ViewStyle>; onPress?: () => void; disabled?: boolean }>;
  const isTutorialActive = Boolean(step);
  const isCurrentTarget = isTutorialActive && activeTarget === target;
  const childStyle = [child.props.style, style, isTutorialActive && !isCurrentTarget && !disableDimming ? { opacity: 0.28 } : null];

  return React.cloneElement(child, {
    style: childStyle,
    disabled: isTutorialActive && !isCurrentTarget && !preserveChildInteraction ? true : child.props.disabled,
    onPress: isCurrentTarget ? () => {
      onTutorialPress?.();
      advanceTutorial();
    } : isTutorialActive && preserveChildInteraction ? undefined : child.props.onPress,
  });
}
