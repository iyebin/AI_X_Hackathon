import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
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
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEMP_VALID_CODE = '123456';

export default function CodeScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();

  const isProtected = role === 'protected';
  const roleTitle = isProtected ? '보호대상자' : '보호자';
  const primaryColor = isProtected ? '#55A238' : '#F7941D';

  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const inputsRef = useRef<(TextInput | null)[]>([]);

  const handleChangeText = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const startGpsTracking = async () => {
    const foregroundPermission = await Location.requestForegroundPermissionsAsync();
    if (foregroundPermission.status !== 'granted') {
      throw new Error('위치 권한이 필요합니다.');
    }

    const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
    if (backgroundPermission.status !== 'granted') {
      throw new Error('백그라운드 위치 권한이 필요합니다.');
    }

    const gpsModule = NativeModules.GpsModule as
      | { startTracking: (subjectId: number) => void }
      | undefined;
    if (!gpsModule) {
      throw new Error('GPS 추적 모듈을 찾을 수 없습니다. 앱을 다시 빌드해 주세요.');
    }

    gpsModule.startTracking(3);
  };

  const handleConnect = async () => {
    const fullCode = code.join('');

    if (fullCode.length < 6) {
      Alert.alert('알림', '인증코드 6자리를 모두 입력해주세요.');
      return;
    }

    if (fullCode === TEMP_VALID_CODE) {
      if (isProtected) {
        try {
          await startGpsTracking();
        } catch (error) {
          Alert.alert(
            '위치 추적을 시작할 수 없습니다',
            error instanceof Error ? error.message : '위치 권한을 확인해 주세요.'
          );
          return;
        }
      }

      Alert.alert('성공', '인증이 완료되었습니다!', [
        {
          text: '확인',
          onPress: () => {
            if (isProtected) {
              router.replace({
                pathname: '/explore',
                params: {
                  userName: '슝슝슝',
                  protectorPhone: '01012345678',
                },
              });
            } else {
              router.replace('/protector-select');
            }
          },
        },
      ]);
    } else {
      Alert.alert('오류', '인증코드가 틀렸습니다.\n다시 확인해주세요.', [
        {
          text: '확인',
          onPress: () => {
            setCode(['', '', '', '', '', '']);
            inputsRef.current[0]?.focus();
          },
        },
      ]);
    }
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
