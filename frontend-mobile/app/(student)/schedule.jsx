import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

function getTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getTodayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

export default function ScheduleScreen() {
  const { userProfile } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [todayLectures, setTodayLectures] = useState([]);
  const [subjectMap, setSubjectMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.uid) loadData();
  }, [userProfile]);

  async function loadData() {
    try {
      const today = getTodayISO();
      const [subRes, lecRes] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get('/api/lectures', { params: { date: today } }),
      ]);

      const enrolled = subRes.data.filter(s =>
        (s.enrolledStudentIds || []).includes(userProfile.uid)
      );
      setSubjects(enrolled);

      const map = Object.fromEntries(enrolled.map(s => [s.subjectId, s]));
      setSubjectMap(map);

      // Only today's lectures for enrolled subjects, sorted by start time
      const myToday = lecRes.data
        .filter(l => enrolled.some(s => s.subjectId === l.subjectId) && l.status !== 'cancelled')
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      setTodayLectures(myToday);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const todayName = getTodayName();

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
        <Text style={s.title}>My Schedule</Text>
        <Text style={s.subtitle}>{subjects.length} subject{subjects.length !== 1 ? 's' : ''} enrolled</Text>
      </View>

      {/* Today's lectures */}
      <Text style={s.sectionLabel}>TODAY — {todayName.toUpperCase()}</Text>
      {todayLectures.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyEmoji}>☀️</Text>
          <Text style={s.emptyText}>No lectures scheduled for today</Text>
        </View>
      ) : (
        todayLectures.map(lec => {
          const sub = subjectMap[lec.subjectId];
          const isOpen = lec.attendanceOpen;
          return (
            <View key={lec.lectureId} style={[s.todayCard, isOpen && s.todayCardOpen]}>
              <View style={s.todayLeft}>
                <View style={[s.todayInitials, isOpen && s.todayInitialsOpen]}>
                  <Text style={s.todayInitialsText}>{sub?.name?.slice(0, 2).toUpperCase() || '??'}</Text>
                </View>
                <View>
                  <Text style={s.todaySubject}>{sub?.name || lec.subjectId}</Text>
                  <Text style={s.todayMeta}>{sub?.courseCode} · Lecture #{lec.lectureNumber}</Text>
                </View>
              </View>
              <View style={s.todayRight}>
                <Text style={s.todayTime}>{lec.startTime} – {lec.endTime}</Text>
                {isOpen && (
                  <View style={s.openPill}>
                    <Text style={s.openPillText}>OPEN</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}

      {/* Weekly timetable — derived from subject.schedule[], no extra API call */}
      <Text style={[s.sectionLabel, { marginTop: 24 }]}>WEEKLY TIMETABLE</Text>
      {subjects.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyEmoji}>🗓️</Text>
          <Text style={s.emptyText}>No subjects enrolled yet</Text>
        </View>
      ) : (
        subjects.map(sub => (
          <View key={sub.subjectId} style={s.subjectCard}>
            <View style={s.subjectHeader}>
              <View style={s.subjectInitials}>
                <Text style={s.subjectInitialsText}>{sub.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.subjectName}>{sub.name}</Text>
                <Text style={s.subjectCode}>{sub.courseCode}</Text>
              </View>
            </View>

            {(sub.schedule || []).length === 0 ? (
              <Text style={s.noSchedule}>No schedule set</Text>
            ) : (
              <View style={s.slots}>
                {(sub.schedule || []).map((slot, i) => (
                  <View key={i} style={s.slotRow}>
                    <View style={[s.dayBadge, slot.day === todayName && s.dayBadgeToday]}>
                      <Text style={s.dayText}>{slot.day?.slice(0, 3).toUpperCase()}</Text>
                    </View>
                    <View style={s.slotInfo}>
                      <Text style={s.slotTime}>{slot.startTime} – {slot.endTime}</Text>
                    </View>
                    {slot.room && (
                      <View style={s.roomBadge}>
                        <Text style={s.roomText}>{slot.room}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },
  topBar: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  subtitle: { fontSize: 12, color: '#9B9790', marginTop: 4 },

  sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 12 },

  // Today cards
  todayCard: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayCardOpen: { borderColor: '#2A6E35', backgroundColor: '#D4EBD8' },
  todayLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  todayInitials: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  todayInitialsOpen: { backgroundColor: '#2A6E35' },
  todayInitialsText: { fontSize: 13, fontWeight: '700', color: '#F5F3EF' },
  todaySubject: { fontSize: 14, fontWeight: '700', color: '#0B0D14' },
  todayMeta: { fontSize: 12, color: '#6B6760', marginTop: 2 },
  todayRight: { alignItems: 'flex-end', gap: 4 },
  todayTime: { fontSize: 12, fontWeight: '600', color: '#0B0D14' },
  openPill: { backgroundColor: '#2A6E35', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  openPillText: { fontSize: 9, fontWeight: '700', color: '#F5F3EF', letterSpacing: 1 },

  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 40, alignItems: 'center', marginBottom: 14 },
  emptyEmoji: { fontSize: 32, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9B9790' },

  // Timetable cards
  subjectCard: { marginHorizontal: 24, marginBottom: 14, backgroundColor: '#FAF8F4', borderRadius: 20, borderWidth: 1, borderColor: '#E5E1DA', padding: 16 },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  subjectInitials: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  subjectInitialsText: { fontSize: 13, fontWeight: '700', color: '#F5F3EF' },
  subjectName: { fontSize: 15, fontWeight: '700', color: '#0B0D14' },
  subjectCode: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  noSchedule: { fontSize: 13, color: '#C4BFB8', fontStyle: 'italic' },
  slots: { gap: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EDE9E3', borderRadius: 12, padding: 10 },
  dayBadge: { backgroundColor: '#0B0D14', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, minWidth: 42, alignItems: 'center' },
  dayBadgeToday: { backgroundColor: '#1A3A7A' },
  dayText: { color: '#F5F3EF', fontSize: 11, fontWeight: '700' },
  slotInfo: { flex: 1 },
  slotTime: { fontSize: 13, color: '#0B0D14', fontWeight: '600' },
  roomBadge: { backgroundColor: '#FAF8F4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#E5E1DA' },
  roomText: { fontSize: 11, color: '#6B6760', fontWeight: '500' },
});
