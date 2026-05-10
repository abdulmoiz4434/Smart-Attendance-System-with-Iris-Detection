import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal
} from 'react-native';
import { router } from 'expo-router';
import apiClient from '../../api/client';

function getTodayISO() { return new Date().toISOString().split('T')[0]; }

export default function LecturesScreen() {
  const [lectures, setLectures] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterDate, setFilterDate] = useState(getTodayISO());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ subjectId: '', scheduledDate: getTodayISO(), startTime: '09:00', endTime: '10:30' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  useEffect(() => {
    apiClient.get('/api/subjects').then(r => setSubjects(r.data));
  }, []);

  useEffect(() => { loadLectures(); }, [filterSubject, filterDate]);

  async function loadLectures() {
    setLoading(true);
    try {
      const params = {};
      if (filterSubject) params.subject_id = filterSubject;
      if (filterDate) params.date = filterDate;
      const res = await apiClient.get('/api/lectures', { params });
      const sorted = [...res.data].sort((a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime)
      );
      setLectures(sorted);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    setFormError('');
    if (!form.subjectId || !form.scheduledDate) { setFormError('Select subject and date.'); return; }
    setSaving(true);
    try {
      const subject = subjects.find(s => s.subjectId === form.subjectId);
      await apiClient.post('/api/lectures', { ...form, teacherId: subject?.teacherId || '' });
      setShowCreate(false);
      setForm({ subjectId: '', scheduledDate: getTodayISO(), startTime: '09:00', endTime: '10:30' });
      loadLectures();
    } catch (e) {
      setFormError(e.response?.data?.detail || 'Failed to create lecture');
    } finally { setSaving(false); }
  }

  async function handleCancel(id) {
    Alert.alert('Cancel Lecture', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        await apiClient.patch(`/api/lectures/${id}/cancel`);
        loadLectures();
      }}
    ]);
  }

  const subjectMap = Object.fromEntries(subjects.map(s => [s.subjectId, s]));
  const selectedSubjectName = form.subjectId ? subjectMap[form.subjectId]?.name : 'Select subject…';

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => { setFormError(''); setShowCreate(true); }}>
          <Text style={s.addBtnText}>+ Manual Lecture</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerSection}>
        <Text style={s.eyebrow}>LECTURE MANAGEMENT</Text>
        <Text style={s.title}>Lectures</Text>
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={filterDate}
          onChangeText={setFilterDate}
          placeholder="Filter date (YYYY-MM-DD)"
          placeholderTextColor="#C4BFB8"
        />
        {filterDate ? (
          <TouchableOpacity style={s.clearBtn} onPress={() => setFilterDate('')}>
            <Text style={s.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color="#0B0D14" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {lectures.length === 0 && (
            <View style={s.emptyCard}><Text style={s.emptyText}>No lectures found</Text></View>
          )}
          {lectures.map(lec => {
            const sub = subjectMap[lec.subjectId];
            return (
              <View key={lec.lectureId} style={s.lecCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lecName}>{sub?.name || lec.subjectId}</Text>
                  <Text style={s.lecMeta}>{sub?.courseCode} · {lec.scheduledDate}</Text>
                  <Text style={s.lecMeta}>{lec.startTime} – {lec.endTime}</Text>
                  <View style={s.badgeRow}>
                    <View style={[s.badge, { backgroundColor: statusColor(lec.status) }]}>
                      <Text style={s.badgeText}>{lec.status}</Text>
                    </View>
                    {lec.isManual && (
                      <View style={[s.badge, { backgroundColor: '#EDE9E3' }]}>
                        <Text style={s.badgeText}>Manual</Text>
                      </View>
                    )}
                  </View>
                </View>
                {lec.status === 'scheduled' && (
                  <TouchableOpacity style={s.dangerBtn} onPress={() => handleCancel(lec.lectureId)}>
                    <Text style={s.dangerBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Create Manual Lecture Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <ScrollView style={s.modal} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Manual Lecture</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>
          {formError ? <View style={s.errBanner}><Text style={s.errText}>{formError}</Text></View> : null}

          <Field label="Subject *">
            <TouchableOpacity style={s.input} onPress={() => setShowSubjectPicker(true)}>
              <Text style={{ color: form.subjectId ? '#0B0D14' : '#C4BFB8', fontSize: 14 }}>{selectedSubjectName}</Text>
            </TouchableOpacity>
          </Field>
          <Field label="Date * (YYYY-MM-DD)">
            <TextInput style={s.input} value={form.scheduledDate} onChangeText={v => setForm(p => ({ ...p, scheduledDate: v }))} placeholder="2024-11-15" placeholderTextColor="#C4BFB8" />
          </Field>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Start Time"><TextInput style={s.input} value={form.startTime} onChangeText={v => setForm(p => ({ ...p, startTime: v }))} placeholder="09:00" placeholderTextColor="#C4BFB8" /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="End Time"><TextInput style={s.input} value={form.endTime} onChangeText={v => setForm(p => ({ ...p, endTime: v }))} placeholder="10:30" placeholderTextColor="#C4BFB8" /></Field>
            </View>
          </View>

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#F5F3EF" /> : <Text style={s.submitBtnText}>Create Lecture</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Subject picker sub-modal */}
        <Modal visible={showSubjectPicker} animationType="slide" transparent onRequestClose={() => setShowSubjectPicker(false)}>
          <View style={s.pickerOverlay}>
            <View style={s.pickerSheet}>
              <Text style={[s.modalTitle, { marginBottom: 16 }]}>Select Subject</Text>
              <ScrollView>
                {subjects.map(sub => (
                  <TouchableOpacity key={sub.subjectId} style={s.pickerRow} onPress={() => {
                    setForm(p => ({ ...p, subjectId: sub.subjectId }));
                    setShowSubjectPicker(false);
                  }}>
                    <Text style={s.userName}>{sub.name}</Text>
                    <Text style={s.userMeta}>{sub.courseCode}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
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

function statusColor(status) {
  if (status === 'scheduled') return '#D8E8F5';
  if (status === 'cancelled') return '#F5D8D8';
  if (status === 'completed') return '#D4EBD8';
  return '#EDE9E3';
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
  filterRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 16, alignItems: 'center' },
  clearBtn: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  clearBtnText: { fontSize: 13, color: '#6B6760' },
  emptyCard: { backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 13, color: '#9B9790' },
  lecCard: { backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  lecName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  lecMeta: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#0B0D14' },
  dangerBtn: { backgroundColor: '#F5D8D8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dangerBtnText: { fontSize: 12, fontWeight: '600', color: '#8A1E1E' },
  modal: { backgroundColor: '#F5F3EF', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0B0D14' },
  modalClose: { fontSize: 18, color: '#9B9790' },
  errBanner: { backgroundColor: '#F5D8D8', borderRadius: 10, padding: 12, marginBottom: 14 },
  errText: { fontSize: 13, color: '#8A1E1E' },
  input: { backgroundColor: '#EDE9E3', borderRadius: 12, padding: 12, fontSize: 14, color: '#0B0D14' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#6B6760' },
  submitBtn: { flex: 2, backgroundColor: '#0B0D14', borderRadius: 12, padding: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#F5F3EF' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#F5F3EF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '60%' },
  pickerRow: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#E5E1DA' },
  userName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  userMeta: { fontSize: 12, color: '#9B9790' },
});