import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import apiClient from '../../api/client';

export default function LectureDetail() {
  const { lectureId } = useLocalSearchParams();
  const [lecture, setLecture] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lectureId) loadData();
  }, [lectureId]);

  async function loadData() {
    try {
      const [lecRes, attRes] = await Promise.all([
        apiClient.get(`/api/lectures/${lectureId}`),
        apiClient.get(`/api/attendance/${lectureId}`),
      ]);
      setLecture(lecRes.data);
      setAttendance(attRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAttendance() {
    try {
      await apiClient.patch(`/api/lectures/${lectureId}`, {
        attendanceOpen: !lecture.attendanceOpen,
      });
      setLecture(prev => ({ ...prev, attendanceOpen: !prev.attendanceOpen }));
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0B0D14" />
      </View>
    );
  }

  const present = attendance.filter(a => a.status === 'present').length;
  const total = attendance.length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerSection}>
        <Text style={s.eyebrow}>LECTURE DETAIL</Text>
        <Text style={s.title}>{lecture?.subjectName || 'Lecture'}</Text>
        <Text style={s.meta}>{lecture?.scheduledDate} · {lecture?.startTime}–{lecture?.endTime}</Text>
      </View>

      {/* Stats */}
      <View style={s.heroCard}>
        <View style={s.heroStats}>
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{present}</Text>
            <Text style={s.heroLabel}>Present</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{total - present}</Text>
            <Text style={s.heroLabel}>Absent</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{total > 0 ? `${Math.round((present / total) * 100)}%` : '—'}</Text>
            <Text style={s.heroLabel}>Rate</Text>
          </View>
        </View>
      </View>

      {/* Toggle button */}
      <TouchableOpacity
        style={[s.toggleBtn, { backgroundColor: lecture?.attendanceOpen ? '#FAF0DC' : '#D4EBD8' }]}
        onPress={toggleAttendance}
      >
        <Text style={[s.toggleText, { color: lecture?.attendanceOpen ? '#3D2500' : '#174520' }]}>
          {lecture?.attendanceOpen ? '🔴  Close Attendance Window' : '🟢  Open Attendance Window'}
        </Text>
      </TouchableOpacity>

      {/* Attendance list */}
      <Text style={s.sectionLabel}>ATTENDANCE ({total})</Text>
      {attendance.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No attendance records yet</Text>
        </View>
      ) : (
        attendance.map((record, i) => (
          <View key={i} style={s.recordRow}>
            <View style={s.initials}>
              <Text style={s.initialsText}>
                {record.studentName?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.studentName}>{record.studentName || record.studentId}</Text>
              <Text style={s.recordMeta}>{record.markedAt ? new Date(record.markedAt).toLocaleTimeString() : ''}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: record.status === 'present' ? '#D4EBD8' : '#FAF0DC' }]}>
              <Text style={[s.statusText, { color: record.status === 'present' ? '#174520' : '#3D2500' }]}>
                {record.status}
              </Text>
            </View>
          </View>
        ))
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
  meta: { fontSize: 12, color: '#9B9790', marginTop: 4 },
  heroCard: { marginHorizontal: 24, backgroundColor: '#0B0D14', borderRadius: 22, padding: 24, marginBottom: 20 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  heroStat: { alignItems: 'center' },
  heroVal: { fontSize: 28, fontWeight: '700', color: '#F5F3EF' },
  heroLabel: { fontSize: 11, color: '#9B9790', marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: '#2A2E40' },
  toggleBtn: { marginHorizontal: 24, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 24 },
  toggleText: { fontWeight: '700', fontSize: 14 },
  sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 10 },
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },
  recordRow: { marginHorizontal: 24, marginBottom: 8, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  initials: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center' },
  initialsText: { color: '#F5F3EF', fontWeight: '700', fontSize: 13 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  recordMeta: { fontSize: 11, color: '#9B9790', marginTop: 1 },
  statusBadge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});