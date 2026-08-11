import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, View } from 'react-native';

export default function LoadingScreen() {
  const router = useRouter();
  const spinValue = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(false);

  // 💡 GPS 추적 시작 코드를 code.tsx(인증 성공 시점)로 이동했습니다.
  // 여기서는 아직 사용자가 보호자/보호대상자인지, subject_id가 무엇인지 알 수 없기 때문입니다.
  useEffect(() => {
    setIsMounted(true);
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