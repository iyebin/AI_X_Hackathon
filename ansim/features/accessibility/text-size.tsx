import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type TextSizeMode = 'default' | 'large';

const TEXT_SIZE_STORAGE_KEY = '@ansim/text-size-mode';
const TEXT_SIZE_MULTIPLIER: Record<TextSizeMode, number> = {
  default: 1,
  large: 1.5,
};

type TextSizeContextValue = {
  mode: TextSizeMode;
  multiplier: number;
  isReady: boolean;
  setMode: (mode: TextSizeMode) => Promise<void>;
};

const TextSizeContext = createContext<TextSizeContextValue | undefined>(undefined);

export function TextSizeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TextSizeMode>('default');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(TEXT_SIZE_STORAGE_KEY)
      .then((savedMode) => {
        if (savedMode === 'large' || savedMode === 'default') setModeState(savedMode);
      })
      .finally(() => setIsReady(true));
  }, []);

  const value = useMemo<TextSizeContextValue>(() => ({
    mode,
    multiplier: TEXT_SIZE_MULTIPLIER[mode],
    isReady,
    setMode: async (nextMode) => {
      setModeState(nextMode);
      await AsyncStorage.setItem(TEXT_SIZE_STORAGE_KEY, nextMode);
    },
  }), [isReady, mode]);

  return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>;
}

export function useTextSize() {
  const context = useContext(TextSizeContext);
  if (!context) throw new Error('useTextSize must be used inside TextSizeProvider.');
  return context;
}
