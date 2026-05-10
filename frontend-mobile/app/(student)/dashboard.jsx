import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert
} from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

function getTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function StudentDashboardMobile() {
  const { userProfile, logout } = useAuth();
  const [mySubjects, setMySubjects] = useState([]);
  const [subjectStats, setSubjectStats] = useState({});
  const [openLectures, setOpenLectures] = useState([]);
  const [subjectMap, setSubjectMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (!userProfile?.uid) return;
    loadData();
  }, [userProfile]);

  async function loadData() {
    setLoading(true);
    try {
      const today = getTodayISO();
      // Single batch: subjects + all-subjects report + today's lectures + config in parallel
      const [subRes, statsRes, lecRes, cfgRes] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get(`/api/reports/student/${userProfile.uid}/all-subjects`),
        apiClient.get('/api/lectures', { params: { date: today } }),
        apiClient.get('/api/system-config'),
      ]);

      setConfig(cfgRes.data);

      const enrolled = subRes.data.filter(s =>
        (s.enrolledStudentIds || []).includes(userProfile.uid)
      );
      setMySubjects(enrolled);
      const map = Object.fromEntries(enrolled.map(s => [s.subjectId, s]));
      setSubjectMap(map);

      // all-subjects returns array — convert to map
      const statsMap = Object.fromEntries(
        (statsRes.data || []).map(r => [r.subjectId, r])
      );
      setSubjectStats(statsMap);

      const myLectures = lecRes.data.filter(l => enrolled.some(s => s.subjectId === l.subjectId));
      setOpenLectures(myLectures.filter(l => l.attendanceOpen));
    } finally {
      setLoading(false);
    }
  }

  // Real-time open lectures listener
  useEffect(() => {
    if (mySubjects.length === 0) return;
    const subjectIds = mySubjects.map(s => s.subjectId).slice(0, 10);
    const today = getTodayISO();
    const q = query(
      collection(db, 'lectures'),
      where('scheduledDate', '==', today),
      where('attendanceOpen', '==', true),
    );
    const unsub = onSnapshot(q, snap => {
      const open = snap.docs.map(d => d.data()).filter(l => subjectIds.includes(l.subjectId));
      setOpenLectures(open);
    });
    return unsub;
  }, [mySubjects]);

  const statsArr = Object.values(subjectStats);
  const overallPct = statsArr.length > 0
    ? Math.round(statsArr.reduce((sum, r) => sum + r.percentage, 0) / statsArr.length)
    : null;
  const shortageCount = statsArr.filter(s => s.belowThreshold).length;
  const threshold = config?.attendanceThreshold || 75;
  const firstName = userProfile?.fullName?.split(' ')[0];

  // Render shell immediately — no full-screen spinner
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 48 }}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>STUDENT PORTAL</Text>
          <Text style={s.greeting}>Hi, {firstName} 👋</Text>
          <Text style={s.date}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity style={s.bellBtn} onPress={() => router.push('/(student)/notifications')}>
          <Text style={s.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Shortage warning */}
      {shortageCount > 0 && (
        <View style={s.warningBanner}>
          <Text style={s.warningIcon}>⚠️</Text>
          <Text style={s.warningText}>
            Below {threshold}% in {shortageCount} subject{shortageCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Hero card */}
      <View style={s.heroCard}>
        <Text style={s.heroEyebrow}>ATTENDANCE OVERVIEW</Text>
        <View style={s.heroStats}>
          {[
            { val: loading ? '…' : (overallPct !== null ? `${overallPct}%` : '—'), label: 'Overall', alert: false },
            { val: loading ? '…' : mySubjects.length, label: 'Subjects', alert: false },
            { val: loading ? '…' : shortageCount, label: 'Alerts', alert: !loading && shortageCount > 0 },
          ].map((item, i, arr) => (
            <View key={item.label} style={[s.heroStat, i < arr.length - 1 && s.heroStatBorder]}>
              <Text style={[s.heroVal, item.alert && { color: '#C47018' }, loading && { color: '#3A3E50' }]}>{item.val}</Text>
              <Text style={s.heroLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick access */}
      <Text style={s.sectionLabel}>QUICK ACCESS</Text>
      <View style={s.moduleGrid}>
        <TouchableOpacity
          style={s.moduleCard}
          onPress={() => router.push('/(student)/schedule')}
        >
          <View style={s.iconTile}><Text style={{ fontSize: 18 }}>🗓️</Text></View>
          <Text style={s.moduleTitle}>Schedule</Text>
          <Text style={s.moduleSub}>View timetable</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.moduleCard}
          onPress={() => router.push('/(student)/history')}
        >
          <View style={s.iconTile}><Text style={{ fontSize: 18 }}>📋</Text></View>
          <Text style={s.moduleTitle}>History</Text>
          <Text style={s.moduleSub}>Attendance records</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.moduleCard, openLectures.length > 0 && s.moduleCardActive]}
          onPress={() => {
            if (openLectures.length === 0) return;
            if (openLectures.length === 1) {
              const lec = openLectures[0];
              const sub = subjectMap[lec.subjectId];
              router.push({
                pathname: '/(student)/mark-attendance',
                params: { lectureId: lec.lectureId, subjectName: sub?.name || '' },
              });
              return;
            }
            // Multiple open lectures — let student pick
            Alert.alert(
              'Open Windows',
              'Select a lecture to mark attendance:',
              [
                ...openLectures.map(lec => {
                  const sub = subjectMap[lec.subjectId];
                  return {
                    text: `${sub?.name || 'Lecture'} (${lec.startTime})`,
                    onPress: () => router.push({
                      pathname: '/(student)/mark-attendance',
                      params: { lectureId: lec.lectureId, subjectName: sub?.name || '' },
                    }),
                  };
                }),
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <View style={[s.iconTile, openLectures.length > 0 && s.iconTileActive]}>
            <Text style={{ fontSize: 18 }}>👁️</Text>
          </View>
          <Text style={s.moduleTitle}>Open Windows</Text>
          <Text style={s.moduleSub}>
            {openLectures.length > 0 ? `${openLectures.length} open now` : 'None right now'}
          </Text>
          {openLectures.length > 0 && <View style={s.liveDot} />}
        </TouchableOpacity>
      </View>

      {/* My subjects */}
      <Text style={s.sectionLabel}>MY SUBJECTS</Text>
      {loading ? (
        <>
          {[1, 2, 3].map(i => (
            <View key={i} style={s.skeletonRow} />
          ))}
        </>
      ) : mySubjects.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No subjects enrolled</Text>
        </View>
      ) : (
        mySubjects.map(sub_ => {
          const stats = subjectStats[sub_.subjectId];
          const pct = stats?.percentage ?? null;
          const below = stats?.belowThreshold;
          return (
            <View key={sub_.subjectId} style={s.subjectRow}>
              <View style={s.subjectInitials}>
                <Text style={s.subjectInitialsText}>{sub_.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.subjectName}>{sub_.name}</Text>
                <Text style={s.subjectMeta}>{sub_.courseCode}</Text>
              </View>
              <View style={[s.pctBadge, { backgroundColor: below ? '#FAF0DC' : '#D4EBD8' }]}>
                <Text style={[s.pctText, { color: below ? '#3D2500' : '#174520' }]}>
                  {pct !== null ? `${pct}%` : '—'}
                </Text>
              </View>
            </View>
          );
        })
      )}

      {/* Sign out */}
      <TouchableOpacity
        style={s.signOutBtn}
        onPress={() =>
          Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
          ])
        }
      >
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  greeting: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  date: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  bellBtn: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FAF8F4', borderWidth: 1, borderColor: '#E5E1DA', justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 20 },

  warningBanner: { marginHorizontal: 24, marginBottom: 14, backgroundColor: '#FAF0DC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#C47018', flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningIcon: { fontSize: 16 },
  warningText: { fontSize: 13, color: '#3D2500', fontWeight: '500', flex: 1 },

  heroCard: { marginHorizontal: 24, backgroundColor: '#0B0D14', borderRadius: 24, padding: 24, marginBottom: 28 },
  heroEyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 16 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatBorder: { borderRightWidth: 1, borderColor: '#2A2E40' },
  heroVal: { fontSize: 28, fontWeight: '700', color: '#F5F3EF' },
  heroLabel: { fontSize: 11, color: '#9B9790', marginTop: 4 },

  sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 12, marginTop: 4 },

  openWindowsEmpty: { marginHorizontal: 24, marginBottom: 20, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center' },
  openWindowsEmptyIcon: { fontSize: 28, marginBottom: 8 },
  openWindowsEmptyText: { fontSize: 13, color: '#9B9790', textAlign: 'center' },
  openLecCard: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#D4EBD8', borderRadius: 18, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openLecLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  openLecIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  openLecName: { fontSize: 14, fontWeight: '700', color: '#0B0D14' },
  openLecMeta: { fontSize: 12, color: '#6B6760', marginTop: 2 },
  markBtn: { backgroundColor: '#0B0D14', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  markBtnText: { color: '#F5F3EF', fontWeight: '700', fontSize: 13 },

  moduleGrid: { flexDirection: 'row', marginHorizontal: 24, gap: 12, marginBottom: 20 },
  moduleCard: { flex: 1, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 18 },
  iconTile: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  moduleTitle: { fontSize: 13, fontWeight: '700', color: '#0B0D14', marginBottom: 2 },
  moduleSub: { fontSize: 11, color: '#9B9790' },

  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },

  skeletonRow: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#EDE9E3', borderRadius: 14, height: 58 },

  subjectRow: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  subjectInitials: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EDE9E3', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  subjectInitialsText: { fontSize: 12, fontWeight: '700', color: '#6B6760' },
  subjectName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  subjectMeta: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  pctBadge: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  pctText: { fontSize: 13, fontWeight: '700' },

  signOutBtn: { marginHorizontal: 24, marginTop: 8, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 14, padding: 14, alignItems: 'center' },
  signOutText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
});