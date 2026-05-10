import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

function getTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function TeacherLectures() {
  const { userProfile } = useAuth();
  const [lectures, setLectures] = useState([]);
  const [subjectMap, setSubjectMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.uid) loadData();
  }, [userProfile]);

  async function loadData() {
    setLoading(true);
    try {
      const [subRes, lecRes] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get('/api/lectures', { params: { date: getTodayISO() } }),
      ]);
      const mine = subRes.data.filter(s => s.teacherId === userProfile.uid);
      const myIds = mine.map(s => s.subjectId);
      const map = Object.fromEntries(mine.map(s => [s.subjectId, s]));
      setSubjectMap(map);
      const myLectures = lecRes.data
        .filter(l => myIds.includes(l.subjectId))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      setLectures(myLectures);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAttendance(lec) {
    try {
      const endpoint = lec.attendanceOpen
        ? `/api/lectures/${lec.lectureId}/close`
        : `/api/lectures/${lec.lectureId}/open`;
      await apiClient.patch(endpoint);
      setLectures(prev =>
        prev.map(l => l.lectureId === lec.lectureId ? { ...l, attendanceOpen: !l.attendanceOpen } : l)
      );
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerSection}>
        <Text style={s.eyebrow}>TODAY'S LECTURES</Text>
        <Text style={s.title}>
          {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#0B0D14" />
        </View>
      ) : lectures.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No lectures scheduled for today</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {lectures.map(lec => {
            const sub = subjectMap[lec.subjectId];
            return (
              <TouchableOpacity
                key={lec.lectureId}
                style={s.lecCard}
                onPress={() => router.push({ pathname: '/(teacher)/lecture-detail', params: { lectureId: lec.lectureId } })}
              >
                <View style={s.lecLeft}>
                  <View style={s.lecCardTop}>
                    <Text style={s.lecCode}>{sub?.courseCode || '—'}</Text>
                    <View style={[s.statusDot, { backgroundColor: lec.attendanceOpen ? '#2A6E35' : '#C4BFB8' }]} />
                  </View>
                  <Text style={s.lecName}>{sub?.name || lec.subjectId}</Text>
                  <Text style={s.lecMeta}>{lec.startTime} – {lec.endTime}</Text>
                </View>
                <TouchableOpacity
                  style={[s.toggleBtn, { backgroundColor: lec.attendanceOpen ? '#D4EBD8' : '#EDE9E3' }]}
                  onPress={() => toggleAttendance(lec)}
                >
                  <Text style={[s.toggleText, { color: lec.attendanceOpen ? '#174520' : '#6B6760' }]}>
                    {lec.attendanceOpen ? 'Close' : 'Open'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#0B0D14' },
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },
  lecCard: { backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  lecLeft: { flex: 1 },
  lecCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  lecCode: { fontSize: 11, fontWeight: '600', color: '#9B9790' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  lecName: { fontSize: 15, fontWeight: '700', color: '#0B0D14', marginBottom: 2 },
  lecMeta: { fontSize: 12, color: '#9B9790' },
  toggleBtn: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 16 },
  toggleText: { fontWeight: '700', fontSize: 13 },
});