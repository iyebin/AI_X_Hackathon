import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SelectTypeScreen() {
  const router = useRouter();

  const handleSelectType = (roleType: 'guardian' | 'protected' | 'admin') => {
    console.log('선택한 역할:', roleType);

    // 💡 보호자 / 보호대상자는 메인 화면으로 바로 가지 않고 무조건 /code 로 이동!
    if (roleType === 'guardian' || roleType === 'protected') {
      router.push({
        pathname: '/code',
        params: { role: roleType },
      });
    } else if (roleType === 'admin') {
      // 기관 관리자 선택 시 QR 화면으로 이동
      router.push('/admin-qr');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.mainTitle}>안녕하세요!</Text>
          <Text style={styles.subTitle}>사용자 유형을 선택해주세요.</Text>
        </View>

        <View style={styles.cardList}>
          {/* 1. 보호자 */}
          <TouchableOpacity
            style={[styles.card, styles.guardianCard]}
            activeOpacity={0.8}
            onPress={() => handleSelectType('guardian')}
          >
            <Text style={[styles.cardTitle, styles.guardianTitle]}>보호자</Text>
            <Text style={styles.cardDescription}>가족, 보호용 사용자</Text>
          </TouchableOpacity>

          {/* 2. 보호대상자 */}
          <TouchableOpacity
            style={[styles.card, styles.protectedCard]}
            activeOpacity={0.8}
            onPress={() => handleSelectType('protected')}
          >
            <Text style={[styles.cardTitle, styles.protectedTitle]}>보호대상자</Text>
            <Text style={styles.cardDescription}>보호가 필요한 사용자</Text>
          </TouchableOpacity>

          {/* 3. 기관 관리자 */}
          <TouchableOpacity
            style={[styles.card, styles.adminCard]}
            activeOpacity={0.8}
            onPress={() => handleSelectType('admin')}
          >
            <Text style={[styles.cardTitle, styles.adminTitle]}>기관 관리자</Text>
            <Text style={styles.cardDescription}>기관 및 담당자</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555555',
  },
  cardList: {
    gap: 20,
  },
  card: {
    width: '100%',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 16,
    color: '#555555',
    fontWeight: '500',
  },
  guardianCard: {
    backgroundColor: '#FFF9F2',
    borderColor: '#FF9E42',
  },
  guardianTitle: {
    color: '#FF7A00',
  },
  protectedCard: {
    backgroundColor: '#F5FAF2',
    borderColor: '#73C05A',
  },
  protectedTitle: {
    color: '#53A832',
  },
  adminCard: {
    backgroundColor: '#F2F8FC',
    borderColor: '#3994E6',
  },
  adminTitle: {
    color: '#1C82E6',
  },
});