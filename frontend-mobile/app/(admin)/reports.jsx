import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { router } from 'expo-router';
import apiClient from '../../api/client';

export default function ReportsScreen() {
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState({});
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get('/api/subjects'),
      apiClient.get('/api/admin/users', { params: { role: 'student' } }),
    ]).then(([subRes, stuRes]) => {
      setSubjects(subRes.data);
      const map = {};
      stuRes.data.forEach(u => { map[u.uid] = u; });
      setStudents(map);
      setLoading(false);
    });
  }, []);

  async function loadReport(subject) {
    setSelected(subject);
    setReport(null);
    setReportLoading(true);
    try {
      const res = await apiClient.get(`/api/reports/subject/${subject.subjectId}`);
      setReport(res.data);
    } catch (e) { console.error(e); }
    finally { setReportLoading(false); }
  }

  if (loading) {
    return <View style={s.centered}><ActivityIndicator color="#0B0D14" /></View>;
  }

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { if (selected) { setSelected(null); setReport(null); } else router.back(); }}>
          <Text style={s.backText}>← {selected ? 'All Subjects' : 'Back'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerSection}>
        <Text style={s.eyebrow}>REPORTS</Text>
        <Text style={s.title}>{selected ? selected.name : 'Attendance Reports'}</Text>
      </View>

      {!selected ? (
        /* Subject picker */
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <Text style={s.hint}>Select a subject to view its attendance report.</Text>
          {subjects.map(sub => (
            <TouchableOpacity key={sub.subjectId} style={s.subjectCard} onPress={() => loadReport(sub)}>
              <View style={{ flex: 1 }}>
                <Text style={s.subjectName}>{sub.name}</Text>
                <Text style={s.subjectMeta}>{sub.courseCode} · {sub.semesterLabel}</Text>
              </View>
              <Text style={{ color: '#9B9790', fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : reportLoading ? (
        <View style={s.centered}><ActivityIndicator color="#0B0D14" /></View>
      ) : report ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {/* Summary */}
          <View style={s.heroCard}>
            <View style={s.heroStats}>
              {[
                { val: report.totalLectures, label: 'Lectures' },
                { val: report.students.length, label: 'Students' },
                { val: `${report.threshold}%`, label: 'Threshold' },
                { val: report.students.filter(r => r.belowThreshold).length, label: 'Below' },
              ].map((item, i, arr) => (
                <View key={item.label} style={[s.heroStat, i < arr.length - 1 && s.heroStatBorder]}>
                  <Text style={s.heroVal}>{item.val}</Text>
                  <Text style={s.heroLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Student rows */}
          <Text style={s.sectionLabel}>STUDENT BREAKDOWN</Text>
          {report.students.length === 0 && (
            <View style={s.emptyCard}><Text style={s.emptyText}>No students enrolled</Text></View>
          )}
          {report.students.map(row => {
            const student = students[row.studentId];
            const below = row.belowThreshold;
            return (
              <View key={row.studentId} style={s.studentRow}>
                <View style={s.studentAvatar}>
                  <Text style={s.studentAvatarText}>
                    {student?.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.studentName}>{student?.fullName || row.studentId}</Text>
                  <Text style={s.studentMeta}>{student?.roleData?.registrationId || '—'}</Text>
                  <Text style={s.studentMeta}>{row.approved} / {row.totalLectures} lectures</Text>
                </View>
                <View style={[s.pctBadge, { backgroundColor: below ? '#FAF0DC' : '#D4EBD8' }]}>
                  <Text style={[s.pctText, { color: below ? '#3D2500' : '#174520' }]}>
                    {row.percentage}%
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 16 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  hint: { fontSize: 13, color: '#9B9790', marginBottom: 16 },
  subjectCard: { backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  subjectName: { fontSize: 15, fontWeight: '600', color: '#0B0D14' },
  subjectMeta: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  heroCard: { backgroundColor: '#0B0D14', borderRadius: 20, padding: 20, marginBottom: 20 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around' },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatBorder: { borderRightWidth: 1, borderColor: '#2A2E40' },
  heroVal: { fontSize: 22, fontWeight: '700', color: '#F5F3EF' },
  heroLabel: { fontSize: 10, color: '#9B9790', marginTop: 2 },
  sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 10 },
  emptyCard: { backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },
  studentRow: { backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  studentAvatar: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center' },
  studentAvatarText: { color: '#F5F3EF', fontWeight: '700', fontSize: 13 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  studentMeta: { fontSize: 11, color: '#9B9790', marginTop: 1 },
  pctBadge: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  pctText: { fontSize: 14, fontWeight: '700' },
});