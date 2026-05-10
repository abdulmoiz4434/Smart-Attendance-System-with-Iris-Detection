import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal
} from 'react-native';
import { router } from 'expo-router';
import apiClient from '../../api/client';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function defaultForm() {
  return {
    name: '', courseCode: '', semesterLabel: '', semesterStart: '',
    semesterEnd: '', teacherId: '', department: '', creditHours: 3,
    enrolledStudentIds: [], schedule: [],
  };
}

export default function SubjectsScreen() {
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEnroll, setShowEnroll] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [scheduleSlot, setScheduleSlot] = useState({ day: 'Monday', startTime: '09:00', endTime: '10:30' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [subRes, teachRes, stuRes] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get('/api/admin/users', { params: { role: 'teacher' } }),
        apiClient.get('/api/admin/users', { params: { role: 'student' } }),
      ]);
      setSubjects(subRes.data);
      setTeachers(teachRes.data);
      setStudents(stuRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  function addSlot() {
    setForm(prev => ({ ...prev, schedule: [...prev.schedule, { ...scheduleSlot }] }));
  }
  function removeSlot(i) {
    setForm(prev => ({ ...prev, schedule: prev.schedule.filter((_, idx) => idx !== i) }));
  }

  async function handleCreate() {
    setFormError('');
    if (!form.name || !form.courseCode || !form.teacherId || !form.semesterStart || !form.semesterEnd) {
      setFormError('Fill all required fields.'); return;
    }
    if (form.schedule.length === 0) { setFormError('Add at least one schedule slot.'); return; }
    setSaving(true);
    try {
      const res = await apiClient.post('/api/subjects', form);
      const subjectId = res.data.subjectId;
      await apiClient.post(`/api/subjects/${subjectId}/generate-lectures`);
      setShowCreate(false);
      setForm(defaultForm());
      loadAll();
    } catch (e) {
      setFormError(e.response?.data?.detail || 'Failed to create subject');
    } finally { setSaving(false); }
  }

  async function handleEnroll() {
    await apiClient.patch(`/api/subjects/${showEnroll.subjectId}/enroll`, { studentIds: selectedIds });
    setShowEnroll(null);
    loadAll();
  }

  const filteredStudents = students.filter(s =>
    s.fullName?.toLowerCase().includes(enrollSearch.toLowerCase()) ||
    (s.roleData?.registrationId || '').toLowerCase().includes(enrollSearch.toLowerCase())
  );

  const toggleStudent = (uid) => {
    setSelectedIds(ids => ids.includes(uid) ? ids.filter(i => i !== uid) : [...ids, uid]);
  };

  const f = form;

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => { setForm(defaultForm()); setFormError(''); setShowCreate(true); }}>
          <Text style={s.addBtnText}>+ Add Subject</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerSection}>
        <Text style={s.eyebrow}>SUBJECT MANAGEMENT</Text>
        <Text style={s.title}>Subjects</Text>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color="#0B0D14" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {subjects.length === 0 && (
            <View style={s.emptyCard}><Text style={s.emptyText}>No subjects yet</Text></View>
          )}
          {subjects.map(sub => (
            <View key={sub.subjectId} style={s.subjectCard}>
              <View style={s.subjectCardTop}>
                <View style={s.courseCodeBadge}><Text style={s.courseCodeText}>{sub.courseCode}</Text></View>
                <Text style={s.semLabel}>{sub.semesterLabel}</Text>
              </View>
              <Text style={s.subjectName}>{sub.name}</Text>
              <Text style={s.subjectMeta}>{sub.department} · {sub.creditHours} credits</Text>
              <Text style={s.subjectMeta}>{(sub.enrolledStudentIds || []).length} students enrolled</Text>
              <TouchableOpacity style={s.enrollBtn} onPress={() => {
                setShowEnroll(sub);
                setSelectedIds([...(sub.enrolledStudentIds || [])]);
                setEnrollSearch('');
              }}>
                <Text style={s.enrollBtnText}>Manage Enrollment</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create Subject Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <ScrollView style={s.modal} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Create Subject</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>
          {formError ? <View style={s.errBanner}><Text style={s.errText}>{formError}</Text></View> : null}

          <Field label="Subject Name *"><TextInput style={s.input} value={f.name} onChangeText={v => set('name', v)} placeholder="Data Structures" placeholderTextColor="#C4BFB8" /></Field>
          <Field label="Course Code *"><TextInput style={s.input} value={f.courseCode} onChangeText={v => set('courseCode', v)} placeholder="CS-301" placeholderTextColor="#C4BFB8" /></Field>
          <Field label="Semester Label *"><TextInput style={s.input} value={f.semesterLabel} onChangeText={v => set('semesterLabel', v)} placeholder="Fall 2024" placeholderTextColor="#C4BFB8" /></Field>
          <Field label="Department *"><TextInput style={s.input} value={f.department} onChangeText={v => set('department', v)} placeholder="Computer Science" placeholderTextColor="#C4BFB8" /></Field>
          <Field label="Semester Start * (YYYY-MM-DD)"><TextInput style={s.input} value={f.semesterStart} onChangeText={v => set('semesterStart', v)} placeholder="2024-09-01" placeholderTextColor="#C4BFB8" /></Field>
          <Field label="Semester End * (YYYY-MM-DD)"><TextInput style={s.input} value={f.semesterEnd} onChangeText={v => set('semesterEnd', v)} placeholder="2025-01-31" placeholderTextColor="#C4BFB8" /></Field>
          <Field label="Credit Hours"><TextInput style={s.input} value={String(f.creditHours)} onChangeText={v => set('creditHours', parseInt(v) || 3)} placeholder="3" placeholderTextColor="#C4BFB8" keyboardType="number-pad" /></Field>

          <Field label="Teacher *">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {teachers.map(t => (
                <TouchableOpacity key={t.uid} style={[s.roleChip, f.teacherId === t.uid && s.roleChipActive]} onPress={() => set('teacherId', t.uid)}>
                  <Text style={[s.roleChipText, f.teacherId === t.uid && s.roleChipTextActive]}>{t.fullName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>

          {/* Schedule builder */}
          <Text style={s.sectionLabel}>Weekly Schedule</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {DAYS.map(d => (
              <TouchableOpacity key={d} style={[s.roleChip, scheduleSlot.day === d && s.roleChipActive]} onPress={() => setScheduleSlot(prev => ({ ...prev, day: d }))}>
                <Text style={[s.roleChipText, scheduleSlot.day === d && s.roleChipTextActive]}>{d.slice(0, 3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Field label="Start"><TextInput style={s.input} value={scheduleSlot.startTime} onChangeText={v => setScheduleSlot(p => ({ ...p, startTime: v }))} placeholder="09:00" placeholderTextColor="#C4BFB8" /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="End"><TextInput style={s.input} value={scheduleSlot.endTime} onChangeText={v => setScheduleSlot(p => ({ ...p, endTime: v }))} placeholder="10:30" placeholderTextColor="#C4BFB8" /></Field>
            </View>
          </View>
          <TouchableOpacity style={s.ghostBtn} onPress={addSlot}>
            <Text style={s.ghostBtnText}>+ Add Slot</Text>
          </TouchableOpacity>

          {f.schedule.map((slot, i) => (
            <View key={i} style={s.slotRow}>
              <Text style={s.slotText}>{slot.day} · {slot.startTime} – {slot.endTime}</Text>
              <TouchableOpacity onPress={() => removeSlot(i)}><Text style={{ color: '#9B9790', fontSize: 16 }}>✕</Text></TouchableOpacity>
            </View>
          ))}

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#F5F3EF" /> : <Text style={s.submitBtnText}>Create Subject</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* Enroll Students Modal */}
      <Modal visible={!!showEnroll} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEnroll(null)}>
        <View style={[s.modal, { flex: 1 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Enroll Students</Text>
            <TouchableOpacity onPress={() => setShowEnroll(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <Text style={{ fontSize: 13, color: '#9B9790', marginBottom: 12 }}>{showEnroll?.name}</Text>
          <TextInput
            style={[s.input, { marginBottom: 12 }]}
            value={enrollSearch}
            onChangeText={setEnrollSearch}
            placeholder="Search by name or reg ID…"
            placeholderTextColor="#C4BFB8"
          />
          <ScrollView style={{ flex: 1 }}>
            {filteredStudents.map(stu => (
              <TouchableOpacity key={stu.uid} style={s.enrollRow} onPress={() => toggleStudent(stu.uid)}>
                <View style={[s.checkbox, selectedIds.includes(stu.uid) && s.checkboxChecked]}>
                  {selectedIds.includes(stu.uid) && <Text style={{ color: '#F5F3EF', fontSize: 12 }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{stu.fullName}</Text>
                  <Text style={s.userMeta}>{stu.roleData?.registrationId || stu.email}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ fontSize: 12, color: '#9B9790', marginVertical: 10 }}>{selectedIds.length} selected</Text>
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowEnroll(null)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={handleEnroll}>
              <Text style={s.submitBtnText}>Save Enrollment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '500', color: '#6B6760', marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  addBtn: { backgroundColor: '#0B0D14', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
  addBtnText: { color: '#F5F3EF', fontWeight: '700', fontSize: 13 },
  headerSection: { paddingHorizontal: 24, paddingBottom: 16 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  emptyCard: { backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 13, color: '#9B9790' },
  subjectCard: { backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 18, marginBottom: 12 },
  subjectCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  courseCodeBadge: { backgroundColor: '#EDE9E3', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  courseCodeText: { fontSize: 11, color: '#9B9790', fontWeight: '500' },
  semLabel: { fontSize: 11, color: '#9B9790' },
  subjectName: { fontSize: 16, fontWeight: '700', color: '#0B0D14', marginBottom: 4 },
  subjectMeta: { fontSize: 12, color: '#6B6760', marginBottom: 2 },
  enrollBtn: { marginTop: 12, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, padding: 10, alignItems: 'center' },
  enrollBtnText: { fontSize: 13, color: '#6B6760', fontWeight: '500' },
  modal: { flex: 1, backgroundColor: '#F5F3EF', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0B0D14' },
  modalClose: { fontSize: 18, color: '#9B9790' },
  errBanner: { backgroundColor: '#F5D8D8', borderRadius: 10, padding: 12, marginBottom: 14 },
  errText: { fontSize: 13, color: '#8A1E1E' },
  input: { backgroundColor: '#EDE9E3', borderRadius: 12, padding: 12, fontSize: 14, color: '#0B0D14' },
  sectionLabel: { fontSize: 12, fontWeight: '500', color: '#6B6760', marginBottom: 8, marginTop: 4 },
  roleChip: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  roleChipActive: { backgroundColor: '#0B0D14', borderColor: '#0B0D14' },
  roleChipText: { fontSize: 13, color: '#6B6760' },
  roleChipTextActive: { color: '#F5F3EF' },
  ghostBtn: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
  ghostBtnText: { fontSize: 13, color: '#6B6760' },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EDE9E3', borderRadius: 10, padding: 10, marginBottom: 6 },
  slotText: { fontSize: 13, color: '#0B0D14' },
  enrollRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E1DA' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#E5E1DA', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#0B0D14', borderColor: '#0B0D14' },
  userName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  userMeta: { fontSize: 12, color: '#9B9790' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#6B6760' },
  submitBtn: { flex: 2, backgroundColor: '#0B0D14', borderRadius: 12, padding: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#F5F3EF' },
});