import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator
} from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

function getTodayISO() { return new Date().toISOString().split('T')[0]; }

export default function StudentDashboardMobile() {
  const { userProfile, logout } = useAuth();
  const [mySubjects, setMySubjects] = useState([]);
  const [subjectStats, setSubjectStats] = useState({});
  const [openLectures, setOpenLectures] = useState([]);
  const [todayLectures, setTodayLectures] = useState([]);
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
      const [subRes, cfgRes] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get('/api/system-config'),
      ]);
      setConfig(cfgRes.data);

      const enrolled = subRes.data.filter(s =>
        (s.enrolledStudentIds || []).includes(userProfile.uid)
      );
      setMySubjects(enrolled);
      const map = Object.fromEntries(enrolled.map(s => [s.subjectId, s]));
      setSubjectMap(map);

      // Per-subject stats
      const statsMap = {};
      await Promise.all(enrolled.map(async s => {
        try {
          const r = await apiClient.get(`/api/reports/student/${userProfile.uid}/subject/${s.subjectId}`);
          statsMap[s.subjectId] = r.data;
        } catch { }
      }));
      setSubjectStats(statsMap);

      // Today's lectures
      const today = getTodayISO();
      const lecRes = await apiClient.get('/api/lectures', { params: { date: today } });
      const myLectures = lecRes.data.filter(l =>
        enrolled.some(s => s.subjectId === l.subjectId)
      );
      myLectures.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setTodayLectures(myLectures);
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
      const open = snap.docs
        .map(d => d.data())
        .filter(l => subjectIds.includes(l.subjectId));
      setOpenLectures(open);
    });
    return unsub;
  }, [mySubjects]);

  const statsArr = Object.values(subjectStats);
  const overallPct = statsArr.length > 0
    ? Math.round(statsArr.reduce((s, r) => s + r.percentage, 0) / statsArr.length)
    : null;
  const shortageCount = statsArr.filter(s => s.belowThreshold).length;
  const threshold = config?.attendanceThreshold || 75;
  const firstName = userProfile?.fullName?.split(' ')[0];

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0B0D14" />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>STUDENT PORTAL</Text>
          <Text style={s.greeting}>Hi, {firstName}</Text>
          <Text style={s.date}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.avatarTile}>
          <Text style={s.avatarText}>
            {userProfile?.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Shortage warning */}
      {shortageCount > 0 && (
        <View style={s.warningBanner}>
          <Text style={s.warningText}>
            ⚠️  Below {threshold}% in {shortageCount} subject{shortageCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Hero */}
      <View style={s.heroCard}>
        <View style={s.heroStats}>
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{overallPct !== null ? `${overallPct}%` : '—'}</Text>
            <Text style={s.heroLabel}>Overall</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{mySubjects.length}</Text>
            <Text style={s.heroLabel}>Subjects</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={[s.heroVal, shortageCount > 0 && { color: '#C47018' }]}>{shortageCount}</Text>
            <Text style={s.heroLabel}>Alerts</Text>
          </View>
        </View>
      </View>

      {/* Open lectures — mark attendance CTA */}
      {openLectures.length > 0 && (
        <>
          <Text style={s.sectionLabel}>OPEN WINDOWS</Text>
          {openLectures.map(lec => {
            const sub = subjectMap[lec.subjectId];
            return (
              <TouchableOpacity
                key={lec.lectureId}
                style={s.openLecCard}
                onPress={() => router.push({
                  pathname: '/(student)/mark-attendance',
                  params: { lectureId: lec.lectureId, subjectName: sub?.name || '' }
                })}
              >
                <View>
                  <Text style={s.openLecName}>{sub?.name || 'Lecture'}</Text>
                  <Text style={s.openLecMeta}>{sub?.courseCode} · {lec.startTime}–{lec.endTime}</Text>
                </View>
                <View style={s.markBtn}>
                  <Text style={s.markBtnText}>Mark →</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Today's schedule */}
      {todayLectures.length > 0 && (
        <>
          <Text style={s.sectionLabel}>TODAY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.todayStrip}>
            {todayLectures.map(lec => {
              const sub = subjectMap[lec.subjectId];
              return (
                <View key={lec.lectureId} style={s.scheduleSlot}>
                  <Text style={s.slotTime}>{lec.startTime}</Text>
                  <Text style={s.slotCode}>{sub?.courseCode || '—'}</Text>
                  <View style={[s.slotDot, { backgroundColor: lec.attendanceOpen ? '#2A6E35' : '#C4BFB8' }]} />
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Module grid */}
      <Text style={s.sectionLabel}>QUICK ACCESS</Text>
      <View style={s.moduleGrid}>
        {[
          { label: 'Schedule', icon: '🗓️', path: '/(student)/schedule' },
          { label: 'History', icon: '📋', path: '/(student)/history' },
        ].map(m => (
          <TouchableOpacity
            key={m.label}
            style={s.moduleCard}
            onPress={() => router.push(m.path)}
          >
            <View style={s.iconTile}><Text style={{ fontSize: 18 }}>{m.icon}</Text></View>
            <Text style={s.moduleTitle}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subject attendance */}
      <Text style={s.sectionLabel}>MY SUBJECTS</Text>
      {mySubjects.map(s_ => {
        const stats = subjectStats[s_.subjectId];
        const pct = stats?.percentage ?? null;
        const below = stats?.belowThreshold;
        return (
          <View key={s_.subjectId} style={s.subjectRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.subjectName}>{s_.name}</Text>
              <Text style={s.subjectMeta}>{s_.courseCode}</Text>
            </View>
            <View style={[s.pctBadge, { backgroundColor: below ? '#FAF0DC' : '#D4EBD8' }]}>
              <Text style={[s.pctText, { color: below ? '#3D2500' : '#174520' }]}>
                {pct !== null ? `${pct}%` : '—'}
              </Text>
            </View>
          </View>
        );
      })}
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
  warningBanner: { marginHorizontal: 24, marginBottom: 12, backgroundColor: '#FAF0DC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#C47018' },
  warningText: { fontSize: 13, color: '#3D2500', fontWeight: '500' },
  heroCard: { marginHorizontal: 24, backgroundColor: '#0B0D14', borderRadius: 22, padding: 24, marginBottom: 24 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  heroStat: { alignItems: 'center' },
  heroVal: { fontSize: 28, fontWeight: '700', color: '#F5F3EF' },
  heroLabel: { fontSize: 11, color: '#9B9790', marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: '#2A2E40' },
  sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 10, marginTop: 4 },
  openLecCard: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#D4EBD8', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openLecName: { fontSize: 15, fontWeight: '700', color: '#0B0D14' },
  openLecMeta: { fontSize: 12, color: '#6B6760', marginTop: 2 },
  markBtn: { backgroundColor: '#0B0D14', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  markBtnText: { color: '#F5F3EF', fontWeight: '700', fontSize: 13 },
  todayStrip: { paddingHorizontal: 24, marginBottom: 20 },
  scheduleSlot: { backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, marginRight: 10, alignItems: 'center', minWidth: 80 },
  slotTime: { fontSize: 13, fontWeight: '600', color: '#0B0D14' },
  slotCode: { fontSize: 11, color: '#9B9790', marginTop: 2 },
  slotDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  moduleGrid: { flexDirection: 'row', marginHorizontal: 24, gap: 12, marginBottom: 20 },
  moduleCard: { flex: 1, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 18, alignItems: 'flex-start' },
  iconTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  moduleTitle: { fontSize: 13, fontWeight: '700', color: '#0B0D14' },
  subjectRow: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, flexDirection: 'row', alignItems: 'center' },
  subjectName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  subjectMeta: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  pctBadge: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  pctText: { fontSize: 13, fontWeight: '700' },
});