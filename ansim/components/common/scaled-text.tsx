import React from 'react';
import { StyleSheet, Text as NativeText, TextProps, TextStyle } from 'react-native';

import { useTextSize } from '@/features/accessibility/text-size';

/** 앱 설정의 글씨 크기를 모든 일반 텍스트에 적용하는 공통 Text 컴포넌트입니다. */
export function Text({ style, ...props }: TextProps) {
  const { multiplier } = useTextSize();
  const resolvedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontSize = resolvedStyle?.fontSize;
  const lineHeight = resolvedStyle?.lineHeight;
  const scaledStyle: TextStyle | undefined = multiplier === 1 ? undefined : {
    ...(typeof fontSize === 'number' ? { fontSize: Math.round(fontSize * multiplier) } : {}),
    ...(typeof lineHeight === 'number' ? { lineHeight: Math.round(lineHeight * multiplier) } : {}),
  };

  return <NativeText {...props} style={[styles.base, style, scaledStyle]} />;
}

const styles = StyleSheet.create({
  // 가로 배치의 긴 이름·설명은 화면 밖으로 밀려나지 않고 다음 줄로 이어집니다.
  base: { flexShrink: 1 },
});
