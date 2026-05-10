import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

export default function HistoryScreen() {
  const { userProfile } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.uid) loadData();
  }, [userProfile]);

  async function loadData() {
    try {
      const [subRes, statsRes] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get(`/api/reports/student/${userProfile.uid}/all-subjects`),
      ]);
      const enrolled = subRes.data.filter(s => (s.enrolledStudentIds || []).includes(userProfile.uid));
      setSubjects(enrolled);
      const map = Object.fromEntries(
        (statsRes.data || []).map(r => [r.subjectId, r])
      );
      setStatsMap(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0B0D14" />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
      <View style={s.headerSection}>
        <Text style={s.eyebrow}>STUDENT PORTAL</Text>
        <Text style={s.title}>Attendance History</Text>
        <Text style={s.subtitle}>{subjects.length} subject{subjects.length !== 1 ? 's' : ''} enrolled</Text>
      </View>

      {subjects.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyEmoji}>📋</Text>
          <Text style={s.emptyText}>No subjects enrolled yet</Text>
        </View>
      ) : (
        subjects.map(sub => {
          const stats = statsMap[sub.subjectId];
          const pct = stats?.percentage ?? null;
          const below = stats?.belowThreshold;
          const absent = (stats?.total != null && stats?.approved != null) ? stats.total - stats.approved : null;

          return (
            <View key={sub.subjectId} style={s.subjectCard}>
              {/* Card header */}
              <View style={s.subjectTop}>
                <View style={s.subjectInitials}>
                  <Text style={s.subjectInitialsText}>{sub.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subjectName}>{sub.name}</Text>
                  <Text style={s.subjectCode}>{sub.courseCode}</Text>
                </View>
                <View style={[s.pctBadge, { backgroundColor: below ? '#FAF0DC' : '#D4EBD8' }]}>
                  <Text style={[s.pctText, { color: below ? '#3D2500' : '#174520' }]}>
                    {pct !== null ? `${pct}%` : '—'}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              {pct !== null && (
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, {
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: below ? '#C47018' : '#2A6E35',
                  }]} />
                </View>
              )}

              {/* Stat chips */}
              {stats && (
                <View style={s.statsRow}>
                  {[
                    { val: stats.approved ?? '—', label: 'Present', color: '#D4EBD8', textColor: '#174520' },
                    { val: absent ?? '—', label: 'Absent', color: '#F5D8D8', textColor: '#8A1E1E' },
                    { val: stats.total ?? '—', label: 'Total', color: '#EDE9E3', textColor: '#0B0D14' },
                  ].map(chip => (
                    <View key={chip.label} style={[s.statChip, { backgroundColor: chip.color }]}>
                      <Text style={[s.statChipVal, { color: chip.textColor }]}>{chip.val}</Text>
                      <Text style={[s.statChipLabel, { color: chip.textColor }]}>{chip.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {below && (
                <View style={s.alertRow}>
                  <Text style={s.alertText}>⚠️  Attendance below required threshold</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },
  topBar: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 24 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  subtitle: { fontSize: 12, color: '#9B9790', marginTop: 4 },
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 32, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9B9790' },
  subjectCard: { marginHorizontal: 24, marginBottom: 14, backgroundColor: '#FAF8F4', borderRadius: 20, borderWidth: 1, borderColor: '#E5E1DA', padding: 16 },
  subjectTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  subjectInitials: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  subjectInitialsText: { fontSize: 13, fontWeight: '700', color: '#F5F3EF' },
  subjectName: { fontSize: 15, fontWeight: '700', color: '#0B0D14' },
  subjectCode: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  pctBadge: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  pctText: { fontSize: 14, fontWeight: '700' },
  progressTrack: { height: 5, backgroundColor: '#E5E1DA', borderRadius: 100, marginBottom: 14, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 100 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statChip: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  statChipVal: { fontSize: 18, fontWeight: '700' },
  statChipLabel: { fontSize: 10, marginTop: 2, fontWeight: '500' },
  alertRow: { marginTop: 12, backgroundColor: '#FAF0DC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#C47018' },
  alertText: { fontSize: 12, color: '#3D2500', fontWeight: '500' },
});