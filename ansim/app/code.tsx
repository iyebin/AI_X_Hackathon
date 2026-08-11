import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEMP_VALID_CODE = '123456';

export default function CodeScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();

  const isProtected = role === 'protected';
  const roleName = isProtected ? '보호대상자' : '보호자';
  const themeColor = isProtected ? '#53A832' : '#FF7A00'; // 초록 vs 주황
  const bgInputColor = isProtected ? '#F5FAF2' : '#FFF9F2';

  const handleVerifyCode = () => {
    if (!code.trim()) {
      Alert.alert('알림', '기관으로부터 전달받은 인증코드를 입력해주세요.');
      return;
    }

    console.log(`[${roleName}] 입력된 인증코드:`, code);

    Alert.alert('인증 완료', `${roleName} 권한으로 로그인되었습니다.`, [
      {
        text: '확인',
        onPress: () => {
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.inner} onPress={Keyboard.dismiss}>
        {/* 💡 router.back() 대신 router.replace('/select-type')으로 변경 */}
{/* 상단 뒤로가기 버튼 */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // 💡 router.back() 대신 replace로 select-type 화면을 직접 지정
            router.replace('/select-type');
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>

        <View style={styles.titleArea}>
          <Text style={styles.mainTitle}>{roleTitle}</Text>
          <Text style={styles.subTitle}>
            기관에서 발급한{'\n'}인증코드를 입력해주세요.
          </Text>
        </View>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputsRef.current[index] = ref;
              }}
              style={[
                styles.codeInput,
                digit ? { borderColor: primaryColor } : null,
              ]}
              value={digit}
              onChangeText={(text) => handleChangeText(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={handleConnect}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>연결하기</Text>
        </TouchableOpacity>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, justifyContent: 'space-between' },
  backButton: { alignSelf: 'flex-start', marginTop: 8 },
  titleArea: { alignItems: 'center', marginTop: 40 },
  mainTitle: { fontSize: 28, fontWeight: 'bold', color: '#000000', marginBottom: 24 },
  subTitle: { fontSize: 18, fontWeight: '600', color: '#666666', textAlign: 'center', lineHeight: 26 },
  codeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 40, paddingHorizontal: 8 },
  codeInput: {
    width: 44,
    height: 54,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  button: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 'auto' },
  buttonText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
});
