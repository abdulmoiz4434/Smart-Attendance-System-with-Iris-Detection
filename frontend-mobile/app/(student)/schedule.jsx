import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ScheduleScreen() {
  const { userProfile } = useAuth();
  const [subjects, setSubjects] = useState([]);
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
        <Text style={s.title}>My Schedule</Text>
      </View>

      {subjects.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No subjects enrolled</Text>
        </View>
      ) : (
        subjects.map(sub => (
          <View key={sub.subjectId} style={s.subjectCard}>
            <View style={s.subjectHeader}>
              <Text style={s.subjectName}>{sub.name}</Text>
              <Text style={s.subjectCode}>{sub.courseCode}</Text>
            </View>
            {(sub.schedule || []).map((slot, i) => (
              <View key={i} style={s.slotRow}>
                <View style={s.dayBadge}>
                  <Text style={s.dayText}>{slot.day?.slice(0, 3).toUpperCase()}</Text>
                </View>
                <Text style={s.slotTime}>{slot.startTime} – {slot.endTime}</Text>
                {slot.room && <Text style={s.slotRoom}>{slot.room}</Text>}
              </View>
            ))}
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
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },
  subjectCard: { marginHorizontal: 24, marginBottom: 14, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 16 },
  subjectHeader: { marginBottom: 12 },
  subjectName: { fontSize: 16, fontWeight: '700', color: '#0B0D14' },
  subjectCode: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  dayBadge: { backgroundColor: '#0B0D14', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  dayText: { color: '#F5F3EF', fontSize: 11, fontWeight: '700' },
  slotTime: { fontSize: 13, color: '#0B0D14', fontWeight: '500' },
  slotRoom: { fontSize: 12, color: '#9B9790', marginLeft: 'auto' },
});