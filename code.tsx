import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CodeScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [code, setCode] = useState('');

  // 역할에 따른 문구 및 테마 색상 설정
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
      <View style={styles.content}>
        <Text style={styles.title}>{roleName} 인증</Text>
        <Text style={styles.subTitle}>기관으로부터 부여받은 인증코드를 입력해 주세요.</Text>

        <TextInput
          style={[
            styles.input,
            { borderColor: themeColor, backgroundColor: bgInputColor }
          ]}
          placeholder="인증코드 입력 (예: ABC-1234)"
          placeholderTextColor="#999999"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: themeColor },
            !code.trim() && styles.disabledButton
          ]}
          onPress={handleVerifyCode}
          disabled={!code.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>인증하기 및 로그인</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 32,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#000000',
    marginBottom: 20,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});