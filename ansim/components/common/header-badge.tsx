import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface HeaderBadgeProps {
  title: string;
  type?: 'protected' | 'protector';
  align?: 'center' | 'left';
}

export default function HeaderBadge({
  title,
  type = 'protected',
  align = 'center',
}: HeaderBadgeProps) {
  const backgroundColor = type === 'protected' ? '#59A03D' : '#F7931E';

  return (
    <View style={[styles.outerWrapper, align === 'center' && styles.centerAlign]}>
      <View style={[styles.badgeContainer, { backgroundColor }]}>
        <Text style={styles.badgeText}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  centerAlign: {
    alignItems: 'center',
  },
  badgeContainer: {
    height: 40,
    borderRadius: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
});
