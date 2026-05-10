import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

export default function TeacherSubjects() {
  const { userProfile } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.uid) loadData();
  }, [userProfile]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/subjects');
      setSubjects(res.data.filter(s => s.teacherId === userProfile.uid));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
        <Text style={s.eyebrow}>MY SUBJECTS</Text>
        <Text style={s.title}>Subjects</Text>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#0B0D14" />
        </View>
      ) : subjects.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No subjects assigned to you</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {subjects.map(sub => (
            <View key={sub.subjectId} style={s.subjectCard}>
              <View style={s.subjectCardTop}>
                <View style={s.codeBadge}>
                  <Text style={s.codeText}>{sub.courseCode}</Text>
                </View>
                <Text style={s.semLabel}>{sub.semesterLabel}</Text>
              </View>
              <Text style={s.subjectName}>{sub.name}</Text>
              <Text style={s.subjectMeta}>{sub.department}</Text>
              <View style={s.subjectFooter}>
                <Text style={s.footerStat}>
                  <Text style={s.footerVal}>{sub.enrolledStudentIds?.length || 0}</Text>  students
                </Text>
                <Text style={s.footerStat}>
                  <Text style={s.footerVal}>{sub.creditHours}</Text>  credits
                </Text>
              </View>
            </View>
          ))}
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
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },
  subjectCard: { backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 18, marginBottom: 12 },
  subjectCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  codeBadge: { backgroundColor: '#EDE9E3', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  codeText: { fontSize: 11, color: '#6B6760', fontWeight: '500' },
  semLabel: { fontSize: 11, color: '#9B9790' },
  subjectName: { fontSize: 16, fontWeight: '700', color: '#0B0D14', marginBottom: 4 },
  subjectMeta: { fontSize: 12, color: '#6B6760', marginBottom: 14 },
  subjectFooter: { flexDirection: 'row', gap: 20, borderTopWidth: 1, borderColor: '#E5E1DA', paddingTop: 12 },
  footerStat: { fontSize: 12, color: '#9B9790' },
  footerVal: { fontWeight: '700', color: '#0B0D14' },
});