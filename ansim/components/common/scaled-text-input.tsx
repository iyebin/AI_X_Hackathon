import React, { forwardRef } from 'react';
import { StyleSheet, TextInput as NativeTextInput, type TextInputProps, type TextStyle } from 'react-native';

import { useTextSize } from '@/features/accessibility/text-size';

/** 앱에서 선택한 글씨 크기를 입력창과 안내 문구에도 동일하게 적용합니다. */
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(({ style, ...props }, ref) => {
  const { multiplier } = useTextSize();
  const resolvedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontSize = resolvedStyle?.fontSize;
  const lineHeight = resolvedStyle?.lineHeight;
  const scaledStyle: TextStyle | undefined = multiplier === 1 ? undefined : {
    ...(typeof fontSize === 'number' ? { fontSize: Math.round(fontSize * multiplier) } : {}),
    ...(typeof lineHeight === 'number' ? { lineHeight: Math.round(lineHeight * multiplier) } : {}),
  };

  return <NativeTextInput ref={ref} {...props} style={[style, scaledStyle]} />;
});

TextInput.displayName = 'ScaledTextInput';
