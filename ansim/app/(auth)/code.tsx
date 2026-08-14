import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthRole, verifyAuthCode } from '@/features/auth/verify-code';
import { setCurrentGuardian } from '@/features/auth/current-session';
import { setProtectorPhone } from '@/features/contacts/protector-contact-store';
import { startGpsTracking } from '@/features/gps/tracking';
import { getGuardiansForSubject } from '@/features/relationships/guardian-registration';

export default function CodeScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const isProtected = role === 'protected';
  const roleTitle = isProtected ? '보호대상자' : '보호자';
  const primaryColor = isProtected ? '#59A03D' : '#F7931E';

  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const inputsRef = useRef<(TextInput | null)[]>([]);

  const handleChangeText = (value: string, index: number) => {
    const nextCode = [...code];
    nextCode[index] = value.slice(-1);
    setCode(nextCode);

    if (nextCode[index] && index < nextCode.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleConnect = async () => {
    const enteredCode = code.join('');
    if (enteredCode.length !== code.length) {
      Alert.alert('인증 코드 확인', '6자리 인증 코드를 모두 입력해 주세요.');
      return;
    }

    try {
      const role: AuthRole = isProtected ? 'protected' : 'guardian';
      const authenticatedUser = await verifyAuthCode(enteredCode, role);

      if (isProtected) {
        const subjectId = authenticatedUser.subjectId;
        if (!subjectId) {
          throw new Error('서버 응답에 보호대상자 ID(subject_id)가 없습니다.');
        }
        try {
          await startGpsTracking(subjectId);
        } catch (error) {
          Alert.alert(
            '위치 추적을 시작할 수 없습니다',
            error instanceof Error ? error.message : '위치 권한을 확인해 주세요.'
          );
          return;
        }

        const guardians = await getGuardiansForSubject(subjectId);
        const emergencyGuardian = guardians.find((guardian) => guardian.phone);
        if (!emergencyGuardian?.phone) {
          throw new Error('연결된 보호자의 전화번호를 찾을 수 없습니다.');
        }
        setProtectorPhone(emergencyGuardian.phone);
      }

      Alert.alert('인증 완료', `${authenticatedUser.name ?? roleTitle}님, 인증이 완료되었습니다.`, [
        {
          text: '확인',
          onPress: () => {
            if (isProtected) {
              router.replace({
                pathname: '/protected-main',
                params: { userName: authenticatedUser.name, subjectId: String(authenticatedUser.subjectId) },
              });
            } else {
              if (!authenticatedUser.guardianId) {
                throw new Error('서버 응답에 보호자 ID(guardian_id)가 없습니다.');
              }
              setCurrentGuardian(authenticatedUser.guardianId, authenticatedUser.name);
              router.replace({
                pathname: '/protector-select',
                params: { guardianId: String(authenticatedUser.guardianId) },
              });
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert('인증 실패', error instanceof Error ? error.message : '인증 중 오류가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.inner} onPress={Keyboard.dismiss}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/select-type')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>

        <View style={styles.titleArea}>
          <Text style={styles.mainTitle}>{roleTitle}</Text>
          <Text style={styles.subTitle}>기관에서 발급한 인증 코드를 입력해 주세요.</Text>
        </View>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputsRef.current[index] = ref;
              }}
              style={[styles.codeInput, digit ? { borderColor: primaryColor } : null]}
              value={digit}
              onChangeText={(value) => handleChangeText(value, index)}
              onKeyPress={(event) => handleKeyPress(event.nativeEvent.key, index)}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={handleConnect}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>연결하기</Text>
        </TouchableOpacity>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  backButton: { alignSelf: 'flex-start', marginTop: 8 },
  titleArea: { alignItems: 'center', marginTop: 40 },
  mainTitle: { fontSize: 28, fontWeight: 'bold', color: '#000000', marginBottom: 24 },
  subTitle: { fontSize: 18, fontWeight: '600', color: '#666666', textAlign: 'center', lineHeight: 26 },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 40,
    paddingHorizontal: 8,
  },
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
  button: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  buttonText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
});
