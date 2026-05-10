import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TeacherDashboard() {
  const { userProfile, logout } = useAuth();
  const [mySubjects, setMySubjects] = useState([]);
  const [todayLectures, setTodayLectures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.uid) loadData();
  }, [userProfile]);

  async function loadData() {
    try {
      const [subRes, lecRes] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get('/api/lectures', { params: { date: getTodayISO() } }),
      ]);
      const mine = subRes.data.filter(s => s.teacherId === userProfile.uid);
      setMySubjects(mine);
      const myIds = mine.map(s => s.subjectId);
      const myLectures = lecRes.data.filter(l => myIds.includes(l.subjectId));
      myLectures.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setTodayLectures(myLectures);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAttendance(lecture) {
    try {
      await apiClient.patch(`/api/lectures/${lecture.lectureId}`, {
        attendanceOpen: !lecture.attendanceOpen,
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  const subjectMap = Object.fromEntries(mySubjects.map(s => [s.subjectId, s]));
  const firstName = userProfile?.name?.split(' ')[0] || userProfile?.email;

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0B0D14" />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>TEACHER PORTAL</Text>
          <Text style={s.greeting}>Hi, {firstName}</Text>
          <Text style={s.date}>
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.avatarTile}>
          <Text style={s.avatarText}>
            {userProfile?.name?.split(' ').map(w => w[0]).join('').slice(0, 2) || 'T'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={s.heroCard}>
        <View style={s.heroStats}>
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{mySubjects.length}</Text>
            <Text style={s.heroLabel}>Subjects</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{todayLectures.length}</Text>
            <Text style={s.heroLabel}>Today</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{todayLectures.filter(l => l.attendanceOpen).length}</Text>
            <Text style={s.heroLabel}>Open</Text>
          </View>
        </View>
      </View>

      {/* Today's lectures */}
      <Text style={s.sectionLabel}>TODAY'S LECTURES</Text>
      {todayLectures.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No lectures scheduled today</Text>
        </View>
      ) : (
        todayLectures.map(lec => {
          const sub = subjectMap[lec.subjectId];
          return (
            <TouchableOpacity
              key={lec.lectureId}
              style={s.lecCard}
              onPress={() => router.push({ pathname: '/(teacher)/lecture-detail', params: { lectureId: lec.lectureId } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.lecName}>{sub?.name || 'Lecture'}</Text>
                <Text style={s.lecMeta}>{sub?.courseCode} · {lec.startTime}–{lec.endTime}</Text>
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
        })
      )}

      {/* My subjects */}
      <Text style={s.sectionLabel}>MY SUBJECTS</Text>
      {mySubjects.map(sub => (
        <View key={sub.subjectId} style={s.subjectRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.subjectName}>{sub.name}</Text>
            <Text style={s.subjectMeta}>{sub.courseCode} · {sub.enrolledStudentIds?.length || 0} students</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, paddingTop: 52 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  greeting: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  date: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  avatarTile: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#F5F3EF', fontWeight: '700', fontSize: 16 },
  heroCard: { marginHorizontal: 24, backgroundColor: '#0B0D14', borderRadius: 22, padding: 24, marginBottom: 24 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  heroStat: { alignItems: 'center' },
  heroVal: { fontSize: 28, fontWeight: '700', color: '#F5F3EF' },
  heroLabel: { fontSize: 11, color: '#9B9790', marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: '#2A2E40' },
  sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 10, marginTop: 4 },
  lecCard: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 16, flexDirection: 'row', alignItems: 'center' },
  lecName: { fontSize: 15, fontWeight: '700', color: '#0B0D14' },
  lecMeta: { fontSize: 12, color: '#6B6760', marginTop: 2 },
  toggleBtn: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  toggleText: { fontWeight: '700', fontSize: 13 },
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },
  subjectRow: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 14 },
  subjectName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  subjectMeta: { fontSize: 12, color: '#9B9790', marginTop: 2 },
});