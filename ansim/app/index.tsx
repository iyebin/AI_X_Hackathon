import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, View } from 'react-native';

export default function LoadingScreen() {
  const router = useRouter();
  const spinValue = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    if (!isMounted) {
      return () => animation.stop();
    }

    const timer = setTimeout(() => {
      router.replace('/select-type');
    }, 2500);

    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [isMounted, router, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/images/loading_bg.png')}
        style={styles.backgroundImage}
        resizeMode="contain">
        <View style={styles.spinnerContainer}>
          <Animated.Image
            source={require('@/assets/images/loading_sp.png')}
            style={[styles.spinnerImage, { transform: [{ rotate: spin }] }]}
            resizeMode="contain"
          />
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerContainer: { marginTop: 350 },
  spinnerImage: { width: 70, height: 70 },
});
