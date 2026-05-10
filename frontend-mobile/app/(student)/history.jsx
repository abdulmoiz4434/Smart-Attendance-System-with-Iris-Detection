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
      const res = await apiClient.get('/api/subjects');
      const enrolled = res.data.filter(s =>
        (s.enrolledStudentIds || []).includes(userProfile.uid)
      );
      setSubjects(enrolled);
      const map = {};
      await Promise.all(enrolled.map(async s => {
        try {
          const r = await apiClient.get(`/api/reports/student/${userProfile.uid}/subject/${s.subjectId}`);
          map[s.subjectId] = r.data;
        } catch { }
      }));
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
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
      <View style={s.headerSection}>
        <Text style={s.eyebrow}>STUDENT PORTAL</Text>
        <Text style={s.title}>Attendance History</Text>
      </View>

      {subjects.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No subjects enrolled</Text>
        </View>
      ) : (
        subjects.map(sub => {
          const stats = statsMap[sub.subjectId];
          const pct = stats?.percentage ?? null;
          const below = stats?.belowThreshold;
          return (
            <View key={sub.subjectId} style={s.subjectCard}>
              <View style={s.subjectTop}>
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
              {stats && (
                <View style={s.statsRow}>
                  <View style={s.statChip}>
                    <Text style={s.statChipVal}>{stats.attended ?? '—'}</Text>
                    <Text style={s.statChipLabel}>Present</Text>
                  </View>
                  <View style={s.statChip}>
                    <Text style={s.statChipVal}>{stats.total ?? '—'}</Text>
                    <Text style={s.statChipLabel}>Total</Text>
                  </View>
                  <View style={s.statChip}>
                    <Text style={s.statChipVal}>{stats.total != null && stats.attended != null ? stats.total - stats.attended : '—'}</Text>
                    <Text style={s.statChipLabel}>Absent</Text>
                  </View>
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
  topBar: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },
  subjectCard: { marginHorizontal: 24, marginBottom: 14, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 16 },
  subjectTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  subjectName: { fontSize: 15, fontWeight: '700', color: '#0B0D14' },
  subjectCode: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  pctBadge: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  pctText: { fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: { flex: 1, backgroundColor: '#EDE9E3', borderRadius: 12, padding: 10, alignItems: 'center' },
  statChipVal: { fontSize: 18, fontWeight: '700', color: '#0B0D14' },
  statChipLabel: { fontSize: 10, color: '#9B9790', marginTop: 2 },
});