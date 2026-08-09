import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, View } from 'react-native';
import { useGpsTracker } from '../hooks/useGps'; // 👈 1. hook 경로에 맞게 확인해주세요!

export default function LoadingScreen() {
  const router = useRouter();
  const spinValue = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(false);
  const { startTracking } = useGpsTracker(); // 👈 2. GPS 시작 함수 가져오기

  // 1. 화면 컴포넌트 마운트 및 GPS 백그라운드 추적 시작
  useEffect(() => {
    setIsMounted(true);
    startTracking(); // 👈 3. 앱 켜지자마자 권한 요청 & 백그라운드 GPS 시작!
  }, []);

  // 2. 스피너 애니메이션 및 2.5초 후 안전하게 이동
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 마운트가 완료되었을 때만 타이머 동작
    if (isMounted) {
      const timer = setTimeout(() => {
        router.replace('/select-type');
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isMounted]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/images/loading_bg.png')}
        style={styles.backgroundImage}
        resizeMode="contain"
      >
        <View style={styles.spinnerContainer}>
          <Animated.Image
            source={require('@/assets/images/loading_sp.png')}
            style={[
              styles.spinnerImage,
              { transform: [{ rotate: spin }] },
            ]}
            resizeMode="contain"
          />
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerContainer: {
    marginTop: 350,
  },
  spinnerImage: {
    width: 70,
    height: 70,
  },
});