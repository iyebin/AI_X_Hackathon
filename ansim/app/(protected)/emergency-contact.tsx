import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProtectorPhone, setProtectorPhone } from '@/features/contacts/protector-contact-store';

export default function EmergencyContactScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState(getProtectorPhone());

  const handleSave = () => {
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 9 || phoneNumber.length > 11) {
      Alert.alert('번호 확인', '올바른 전화번호를 입력해 주세요.');
      return;
    }
    setProtectorPhone(phoneNumber);
    Alert.alert('저장 완료', '보호자 전화번호가 변경되었습니다.', [
      { text: '확인', onPress: () => router.replace({ pathname: '/protected-main', params: { tab: 'setting' } }) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace({ pathname: '/protected-main', params: { tab: 'setting' } })} hitSlop={12}>
          <Ionicons name="arrow-back" size={28} color="#111111" />
        </TouchableOpacity>
        <View style={styles.badge}><Text style={styles.badgeText}>긴급 연락처 관리</Text></View>
        <View style={styles.headerSpace} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>보호자 전화번호</Text>
        <Text style={styles.description}>긴급 상황 시 홈의 전화하기 버튼으로 연결할 번호입니다.</Text>
        <TextInput
          style={styles.phoneInput}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="보호자 전화번호"
          maxLength={13}
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
          <Text style={styles.saveText}>저장하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 72, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSpace: { width: 28 },
  badge: { height: 40, paddingHorizontal: 20, borderRadius: 16, backgroundColor: '#59A03D', justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  content: { paddingHorizontal: 24, paddingTop: 26 },
  title: { fontSize: 21, fontWeight: 'bold', color: '#111111' },
  description: { marginTop: 9, color: '#777777', fontSize: 15, lineHeight: 22 },
  phoneInput: { height: 58, marginTop: 24, borderWidth: 1.5, borderColor: '#DDE3E8', borderRadius: 14, paddingHorizontal: 16, color: '#111111', fontSize: 18, fontWeight: '600' },
  saveButton: { height: 58, marginTop: 26, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#59A03D' },
  saveText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
});
