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

const STATUS_COLORS = {
  scheduled: { bg: '#E5E1DA', text: '#4A4845' },
  ongoing:   { bg: '#D4DCF0', text: '#0A2460' },
  completed: { bg: '#D4EBD8', text: '#174520' },
  cancelled: { bg: '#F5D8D8', text: '#8A1E1E' },
};

export default function TeacherDashboardMobile() {
  const { userProfile, logout } = useAuth();
  const [lectures, setLectures] = useState([]);
  const [subjectMap, setSubjectMap] = useState({});
  const [pendingCounts, setPendingCounts] = useState({});
  const [toggling, setToggling] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/subjects').then(r => {
      const map = {};
      r.data.forEach(s => { map[s.subjectId] = s; });
      setSubjectMap(map);
    });
  }, []);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const today = getTodayISO();
    const q = query(
      collection(db, 'lectures'),
      where('teacherId', '==', userProfile.uid),
      where('scheduledDate', '==', today),
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => d.data());
      data.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setLectures(data);
      setLoading(false);
    });
    return unsub;
  }, [userProfile]);

  useEffect(() => {
    if (lectures.length === 0) return;
    const ids = lectures.map(l => l.lectureId).slice(0, 10);
    const q = query(
      collection(db, 'attendance'),
      where('lectureId', 'in', ids),
      where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(q, snap => {
      const counts = {};
      snap.docs.forEach(d => {
        const { lectureId } = d.data();
        counts[lectureId] = (counts[lectureId] || 0) + 1;
      });
      setPendingCounts(counts);
    });
    return unsub;
  }, [lectures]);

  const handleToggle = async (lec) => {
    setToggling(t => ({ ...t, [lec.lectureId]: true }));
    try {
      const endpoint = lec.attendanceOpen
        ? `/api/lectures/${lec.lectureId}/close`
        : `/api/lectures/${lec.lectureId}/open`;
      await apiClient.patch(endpoint);
    } finally {
      setToggling(t => ({ ...t, [lec.lectureId]: false }));
    }
  };

  const firstName = userProfile?.fullName?.split(' ')[0];
  const totalPending = Object.values(pendingCounts).reduce((a, b) => a + b, 0);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>TEACHER PORTAL</Text>
          <Text style={s.greeting}>Hi, {firstName}</Text>
          <Text style={s.date}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.avatarTile}>
          <Text style={s.avatarText}>
            {userProfile?.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={s.heroCard}>
        <View style={s.heroStats}>
          {[
            { label: "Lectures Today", value: lectures.length },
            { label: "Pending",        value: totalPending },
            { label: "Open",           value: lectures.filter(l => l.attendanceOpen).length },
          ].map(stat => (
            <View key={stat.label} style={s.heroStat}>
              <Text style={s.heroVal}>{stat.value}</Text>
              <Text style={s.heroLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Lectures */}
      <Text style={s.sectionLabel}>TODAY'S LECTURES</Text>
      {loading ? (
        <ActivityIndicator color="#0B0D14" style={{ marginTop: 20 }} />
      ) : lectures.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No lectures today.</Text>
        </View>
      ) : (
        lectures.map(lec => {
          const sub = subjectMap[lec.subjectId];
          const pending = pendingCounts[lec.lectureId] || 0;
          const isToggling = toggling[lec.lectureId];
          const pill = STATUS_COLORS[lec.status] || STATUS_COLORS.scheduled;

          return (
            <View key={lec.lectureId} style={s.lectureCard}>
              <View style={s.lectureTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lectureName}>{sub?.name || lec.subjectId}</Text>
                  <Text style={s.lectureMeta}>{sub?.courseCode} · {lec.startTime} – {lec.endTime}</Text>
                </View>
                <View style={[s.pill, { backgroundColor: pill.bg }]}>
                  <Text style={[s.pillText, { color: pill.text }]}>{lec.status}</Text>
                </View>
              </View>

              {pending > 0 && (
                <View style={s.pendingStrip}>
                  <Text style={s.pendingText}>{pending} pending approval</Text>
                </View>
              )}

              <View style={s.lectureActions}>
                {lec.status !== 'cancelled' && lec.status !== 'completed' && (
                  <TouchableOpacity
                    style={lec.attendanceOpen ? s.closeBtn : s.openBtn}
                    onPress={() => handleToggle(lec)}
                    disabled={isToggling}
                  >
                    <Text style={lec.attendanceOpen ? s.closeBtnText : s.openBtnText}>
                      {isToggling ? '…' : lec.attendanceOpen ? 'Close Window' : 'Open Window'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={s.manageBtn}
                  onPress={() => router.push({ pathname: '/(teacher)/lecture-detail', params: { lectureId: lec.lectureId } })}
                >
                  <Text style={s.manageBtnText}>Manage</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#F5F3EF' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, paddingTop: 52 },
  eyebrow:       { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 6 },
  greeting:      { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  date:          { fontSize: 12, color: '#9B9790', marginTop: 2 },
  avatarTile:    { width: 44, height: 44, borderRadius: 13, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center' },
  avatarText:    { color: '#F5F3EF', fontWeight: '700', fontSize: 16 },
  heroCard:      { marginHorizontal: 24, backgroundColor: '#0B0D14', borderRadius: 22, padding: 24, marginBottom: 28 },
  heroStats:     { flexDirection: 'row', justifyContent: 'space-around' },
  heroStat:      { alignItems: 'center' },
  heroVal:       { fontSize: 28, fontWeight: '700', color: '#F5F3EF' },
  heroLabel:     { fontSize: 11, color: '#9B9790', marginTop: 2 },
  sectionLabel:  { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 12 },
  emptyCard:     { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 28, alignItems: 'center' },
  emptyText:     { color: '#9B9790', fontSize: 13 },
  lectureCard:   { marginHorizontal: 24, marginBottom: 12, backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 16 },
  lectureTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  lectureName:   { fontSize: 15, fontWeight: '700', color: '#0B0D14', marginBottom: 2 },
  lectureMeta:   { fontSize: 12, color: '#9B9790' },
  pill:          { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  pillText:      { fontSize: 11, fontWeight: '500' },
  pendingStrip:  { backgroundColor: '#FAF0DC', borderRadius: 8, padding: '8px 10px', marginBottom: 10, paddingVertical: 6, paddingHorizontal: 10 },
  pendingText:   { fontSize: 12, color: '#3D2500', fontWeight: '500' },
  lectureActions:{ flexDirection: 'row', gap: 8 },
  openBtn:       { flex: 1, backgroundColor: '#0B0D14', borderRadius: 10, padding: 10, alignItems: 'center' },
  openBtnText:   { color: '#F5F3EF', fontSize: 12, fontWeight: '700' },
  closeBtn:      { flex: 1, backgroundColor: '#F5D8D8', borderRadius: 10, padding: 10, alignItems: 'center' },
  closeBtnText:  { color: '#8A1E1E', fontSize: 12, fontWeight: '700' },
  manageBtn:     { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 10, padding: 10, paddingHorizontal: 16 },
  manageBtnText: { color: '#6B6760', fontSize: 12 },
});