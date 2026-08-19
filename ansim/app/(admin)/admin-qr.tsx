import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminQrScreen() {
  const router = useRouter();

  // QR 코드 고유 시드값
  const [qrSeed, setQrSeed] = useState<number>(Date.now());

  // 현재 QR 코드 이미지 URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://example.com/admin?seed=${qrSeed}`;

  // 새 QR 생성 버튼 클릭
  const handleGenerateNewQr = () => {
    setQrSeed(Date.now());
    Alert.alert('알림', '새로운 QR 코드가 생성되었습니다.');
  };

  // 💡 QR 이미지 갤러리 실제 다운로드 로직
  const handleDownloadQr = async () => {
    try {
      // 1. 미디어 라이브러리 접근 권한 요청
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진첩 저장 권한을 허용해 주세요.');
        return;
      }

      // 2. 임시 저장 폴더 경로 지정
      const fileUri = `${FileSystem.documentDirectory}QR_${qrSeed}.png`;

      // 3. 웹의 QR 이미지를 앱 로컬 파일로 다운로드
      const downloadResult = await FileSystem.downloadAsync(qrUrl, fileUri);

      if (downloadResult.status === 200) {
        // 4. 로컬에 저장된 이미지를 기기 갤러리(사진첩)로 저장
        await MediaLibrary.createAssetAsync(downloadResult.uri);
        Alert.alert('저장 완료', 'QR 코드 이미지가 사진첩에 저장되었습니다!');
      } else {
        Alert.alert('오류', '이미지 다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('오류', 'QR 코드 저장 중 문제가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 뒤로가기 버튼 */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          // 💡 router.back() 대신 select-type으로 직접 이동하도록 지정
          router.replace('/select-type');
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={28} color="#000000" />
      </TouchableOpacity>

      {/* 중앙 메인 컨텐츠 */}
      <View style={styles.content}>
        <Text style={styles.mainTitle}>기관 관리자</Text>
        <Text style={styles.subTitle}>
          QR코드를 스캔하여{'\n'}웹으로 연결할 수 있습니다.
        </Text>

        {/* 파란 테두리의 QR 코드 박스 */}
        <View style={styles.qrBorderBox}>
          <Image
            source={{ uri: qrUrl }}
            style={styles.qrImage}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* 하단 버튼 2개 */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.btn, styles.downloadBtn]}
          onPress={handleDownloadQr}
          activeOpacity={0.8}
        >
          <Text style={styles.downloadBtnText}>QR 다운로드</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.generateBtn]}
          onPress={handleGenerateNewQr}
          activeOpacity={0.8}
        >
          <Text style={styles.generateBtnText}>새 QR 생성</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  backButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -40,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 20,
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  qrBorderBox: {
    width: 200,
    height: 200,
    borderWidth: 6,
    borderColor: '#1C82E6',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 36,
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1C82E6',
  },
  downloadBtnText: {
    color: '#1C82E6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  generateBtn: {
    backgroundColor: '#1C82E6',
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
