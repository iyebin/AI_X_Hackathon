import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { CurrentRiskStatus, getCurrentRiskStatus } from '@/features/risk/risk-api';

type RiskStatus = '위험' | '주의' | '안전';

const RISK_ITEMS = [
  { title: 'GPS 이상', points: '29점 (52%)', percent: 52, description: '이동 경로의 이상 여부를 분석했습니다.' },
  { title: '대기', points: '15점 (27%)', percent: 27, description: '대기 환경 정보를 분석했습니다.' },
  { title: '기상', points: '12점 (21%)', percent: 21, description: '기상 환경 정보를 분석했습니다.' },
  // 네 번째 위험요인 추가 시 visible을 true로 바꾸거나 제거하면 됩니다.
  { title: '추가 위험요인', points: '', percent: 0, description: '', visible: false },
];

const VISIBLE_RISK_ITEM_COUNT = 3;

// 위험요인 색상은 상태별로, 퍼센트가 높은 순서대로 배정됩니다.
const RISK_COLORS: Record<RiskStatus, string[]> = {
  위험: ['#C62828', '#EF5350', '#FF8585', '#FFD0D0'],
  주의: ['#F68E32', '#FFA453', '#FEBF0B', '#FFDC76'],
  안전: ['#2E7D32', '#4CAF50', '#81C784', '#C8E6C9'],
};

const THEME: Record<RiskStatus, { main: string; soft: string; pale: string }> = {
  위험: { main: '#FF2525', soft: '#F87171', pale: '#FECACA' },
  주의: { main: '#FFBB01', soft: '#FFA64D', pale: '#FFD76A' },
  안전: { main: '#2EAD61', soft: '#7CC763', pale: '#C9EDB6' },
};

export default function SummaryDetailScreen() {
  const router = useRouter();
  const { targetStatus, targetScore, subjectId } = useLocalSearchParams<{
    targetStatus?: RiskStatus;
    targetScore?: string;
    subjectId?: string;
  }>();
  const [serverRisk, setServerRisk] = useState<CurrentRiskStatus | null>(null);

  useEffect(() => {
    const numericSubjectId = Number(subjectId);
    if (!Number.isInteger(numericSubjectId) || numericSubjectId <= 0) return;

    void getCurrentRiskStatus(numericSubjectId)
      .then(setServerRisk)
      .catch(() => setServerRisk(null));
  }, [subjectId]);

  const status: RiskStatus = serverRisk?.level === 'danger'
    ? '위험'
    : serverRisk?.level === 'safe'
      ? '안전'
      : targetStatus === '위험' || targetStatus === '안전'
        ? targetStatus
        : '주의';
  const score = serverRisk ? String(serverRisk.score) : (targetScore ?? '56');
  const theme = THEME[status];
  const riskItems = serverRisk?.factors.length
    ? serverRisk.factors.map((factor) => ({
        title: factor.title,
        points: factor.points === undefined ? `${factor.percent}%` : `${factor.points}점 (${factor.percent}%)`,
        percent: factor.percent,
        description: factor.description ?? '위험 요인을 분석하고 있습니다.',
      }))
    : RISK_ITEMS;
  // 현재 화면은 상위 세 항목만 보이며, 네 번째 색상은 RISK_COLORS에 유지합니다.
  const sortedRiskItems = [...riskItems]
    .filter((item) => !('visible' in item) || item.visible !== false)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, VISIBLE_RISK_ITEM_COUNT);
  const riskColors = RISK_COLORS[status];
  const chartHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"></head><body style="margin:0;background:transparent;overflow:hidden"><canvas id="chart" width="180" height="180"></canvas><script>
    const items=${JSON.stringify(sortedRiskItems.map((item, index) => ({ percent: item.percent, color: riskColors[index] })))};
    const ctx=document.getElementById('chart').getContext('2d');let start=-Math.PI/2;
    items.forEach((item)=>{const angle=item.percent/100*Math.PI*2;ctx.beginPath();ctx.moveTo(90,90);ctx.arc(90,90,88,start,start+angle);ctx.closePath();ctx.fillStyle=item.color;ctx.fill();start+=angle;});
  </script></body></html>`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={30} color="#111111" />
        </TouchableOpacity>
        <View style={styles.headerBadge}><Text style={styles.headerTitle}>위험도 구성</Text></View>
        <View style={styles.headerSpace} />
      </View>

      <View style={styles.divider} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>현재 위험도</Text>
        <View style={styles.chartArea}>
          <View style={styles.chart}>
            <WebView originWhitelist={['*']} source={{ html: chartHtml }} scrollEnabled={false} style={styles.chartWebView} />
          </View>
          <View style={styles.legend}>
            {sortedRiskItems.map((item, index) => (
              <View key={item.title} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: riskColors[index] }]} />
                <Text style={styles.legendText}>{item.title}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.scoreRow}>
          <Text style={[styles.score, { color: theme.main }]}>{score}점</Text>
          <Text style={styles.scoreTotal}> / 100점</Text>
          <View style={[styles.statusBadge, { backgroundColor: theme.main }]}><Text style={styles.statusText}>{status}</Text></View>
        </View>

        <Text style={styles.analysisTitle}>위험요인 상세 분석</Text>
        <View style={styles.analysisCard}>
          {sortedRiskItems.map((item, index) => (
            <View key={item.title} style={[styles.riskRow, index < sortedRiskItems.length - 1 && styles.riskDivider]}>
              <View style={styles.riskTextArea}>
                <View style={styles.riskTitleRow}>
                  <Text style={styles.riskTitle}>{item.title}</Text>
                  <View style={[styles.pointBadge, { backgroundColor: riskColors[index] }]}><Text style={styles.pointText}>{item.points}</Text></View>
                </View>
                <Text style={styles.description}>{item.description}</Text>
              </View>
              <View style={styles.percentArea}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${item.percent}%`, backgroundColor: riskColors[index] }]} />
                </View>
                <Text style={styles.percentText}>{item.percent}%</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  headerSpace: { width: 30 },
  headerBadge: { height: 40, borderRadius: 16, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7931E' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', includeFontPadding: false },
  divider: { height: 1, marginHorizontal: 20, backgroundColor: '#DFDFDF' },
  content: { paddingHorizontal: 26, paddingTop: 24, paddingBottom: 40 },
  sectionLabel: { color: '#666666', fontSize: 19, fontWeight: 'bold' },
  chartArea: { flexDirection: 'row', alignItems: 'center', marginTop: 28 },
  chart: { width: 180, height: 180, overflow: 'hidden', flexShrink: 0 },
  chartWebView: { width: 180, height: 180, backgroundColor: 'transparent' },
  legend: { marginLeft: 12, gap: 10 },
  legendText: { color: '#666666', fontSize: 17, fontWeight: 'bold' },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 18, height: 18, borderRadius: 9, marginRight: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 26 },
  score: { fontSize: 54, fontWeight: 'bold' },
  scoreTotal: { color: '#555555', fontSize: 20, fontWeight: 'bold' },
  statusBadge: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 5, marginLeft: 'auto' },
  statusText: { color: '#FFFFFF', fontSize: 19, fontWeight: 'bold' },
  analysisTitle: { marginTop: 42, marginBottom: 14, color: '#111111', fontSize: 22, fontWeight: 'bold' },
  analysisCard: { borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, paddingHorizontal: 10 },
  riskRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  riskDivider: { borderBottomWidth: 1, borderBottomColor: '#DDDDDD' },
  riskTextArea: { flex: 1, paddingRight: 8 },
  riskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  riskTitle: { color: '#111111', fontSize: 19, fontWeight: 'bold' },
  pointBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  pointText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  description: { marginTop: 7, color: '#666666', fontSize: 13, fontWeight: '600' },
  percentArea: { width: 125, flexDirection: 'row', alignItems: 'center' },
  progressTrack: { width: 70, height: 10, overflow: 'hidden', borderRadius: 5, backgroundColor: '#E1E1E1' },
  progressFill: { height: '100%', borderRadius: 5 },
  percentText: { width: 42, marginLeft: 8, color: '#666666', fontSize: 16, fontWeight: 'bold' },
});
