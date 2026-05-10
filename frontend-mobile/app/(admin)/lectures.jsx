import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList
} from 'react-native';
import { router } from 'expo-router';
import apiClient from '../../api/client';

function getTodayISO() { return new Date().toISOString().split('T')[0]; }

function isPastScheduled(lec) {
  const today = new Date().toISOString().slice(0, 10);
  return lec.status === 'scheduled' && lec.scheduledDate < today;
}

export default function LecturesScreen() {
  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [panels, setPanels] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [createSubjectId, setCreateSubjectId] = useState('');
  const [form, setForm] = useState({ scheduledDate: getTodayISO(), startTime: '09:00', endTime: '10:30' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/api/subjects')
      .then(r => {
        const sorted = [...r.data].sort((a, b) => a.name.localeCompare(b.name));
        setSubjects(sorted);
      })
      .finally(() => setSubjectsLoading(false));
  }, []);

  async function togglePanel(subjectId) {
    const current = panels[subjectId];

    if (current?.open) {
      setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], open: false } }));
      return;
    }

    if (current?.lectures) {
      setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], open: true } }));
      return;
    }

    setPanels(prev => ({ ...prev, [subjectId]: { open: true, loading: true, lectures: null, dateFilter: '' } }));
    try {
      const res = await apiClient.get('/api/lectures', { params: { subject_id: subjectId } });
      const sorted = [...res.data].sort((a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime)
      );
      setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: false, lectures: sorted } }));
    } catch {
      setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: false, lectures: [] } }));
    }
  }

  async function refreshPanel(subjectId) {
    setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: true } }));
    try {
      const res = await apiClient.get('/api/lectures', { params: { subject_id: subjectId } });
      const sorted = [...res.data].sort((a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime)
      );
      setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: false, lectures: sorted } }));
    } catch {
      setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: false } }));
    }
  }

  function openCreateFor(subjectId) {
    setCreateSubjectId(subjectId);
    setForm({ scheduledDate: getTodayISO(), startTime: '09:00', endTime: '10:30' });
    setFormError('');
    setShowCreate(true);
  }

  async function handleCreate() {
    setFormError('');
    if (!form.scheduledDate) { setFormError('Enter a date.'); return; }
    setSaving(true);
    try {
      const subject = subjects.find(s => s.subjectId === createSubjectId);
      await apiClient.post('/api/lectures', {
        subjectId: createSubjectId,
        teacherId: subject?.teacherId || '',
        ...form,
      });
      setShowCreate(false);
      refreshPanel(createSubjectId);
    } catch (e) {
      setFormError(e.response?.data?.detail || 'Failed to create lecture');
    } finally { setSaving(false); }
  }

  async function handleCancel(lectureId, subjectId) {
    Alert.alert('Cancel Lecture', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          await apiClient.patch(`/api/lectures/${lectureId}/cancel`);
          refreshPanel(subjectId);
        }
      }
    ]);
  }

  const createSubjectName = subjects.find(s => s.subjectId === createSubjectId)?.name || '';

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerSection}>
        <Text style={s.eyebrow}>LECTURE MANAGEMENT</Text>
        <Text style={s.title}>Lectures</Text>
        <Text style={s.subtitle}>Tap a subject to view its lectures</Text>
      </View>

      {subjectsLoading ? (
        <View style={s.centered}><ActivityIndicator color="#0B0D14" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
          {subjects.length === 0 && (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No subjects found. Create a subject first.</Text>
            </View>
          )}

          {subjects.map(sub => {
            const panel = panels[sub.subjectId];
            const isOpen = panel?.open ?? false;
            const isLoading = panel?.loading ?? false;
            const lectures = panel?.lectures ?? null;
            const dateFilter = panel?.dateFilter ?? '';

            const filtered = lectures
              ? (dateFilter ? lectures.filter(l => l.scheduledDate === dateFilter) : lectures)
              : [];

            const today = getTodayISO();
            const scheduledCount = lectures ? lectures.filter(l => l.status === 'scheduled' && l.scheduledDate >= today).length : 0;
            const pastCount = lectures ? lectures.filter(l => isPastScheduled(l)).length : 0;
            const completedCount = lectures ? lectures.filter(l => l.status === 'completed').length : 0;
            const ongoingCount = lectures ? lectures.filter(l => l.status === 'ongoing').length : 0;

            return (
              <View key={sub.subjectId} style={[s.subjectCard, isOpen && s.subjectCardOpen]}>
                {/* Header row */}
                <TouchableOpacity style={s.subjectRow} onPress={() => togglePanel(sub.subjectId)} activeOpacity={0.7}>
                  <View style={s.subjectInitials}>
                    <Text style={s.subjectInitialsText}>{sub.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subjectName}>{sub.name}</Text>
                    <Text style={s.subjectMeta}>{sub.courseCode} · {sub.semesterLabel}</Text>
                  </View>
                  <Text style={s.chevron}>{isOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {/* Stat chips when open */}
                {isOpen && !isLoading && lectures && (
                  <View style={s.chipRow}>
                    {scheduledCount > 0 && <View style={[s.chip, s.chipScheduled]}><Text style={s.chipText}>{scheduledCount} upcoming</Text></View>}
                    {ongoingCount > 0 && <View style={[s.chip, s.chipOngoing]}><Text style={s.chipText}>{ongoingCount} ongoing</Text></View>}
                    {completedCount > 0 && <View style={[s.chip, s.chipCompleted]}><Text style={s.chipText}>{completedCount} completed</Text></View>}
                    {pastCount > 0 && <View style={[s.chip, s.chipPast]}><Text style={s.chipText}>⚠ {pastCount} unrecorded</Text></View>}
                  </View>
                )}

                {/* Expanded panel */}
                {isOpen && (
                  <View style={s.panelBody}>
                    {/* Toolbar */}
                    <View style={s.panelToolbar}>
                      <TextInput
                        style={[s.input, { flex: 1 }]}
                        value={dateFilter}
                        onChangeText={v => setPanels(prev => ({ ...prev, [sub.subjectId]: { ...prev[sub.subjectId], dateFilter: v } }))}
                        placeholder="Filter date (YYYY-MM-DD)"
                        placeholderTextColor="#C4BFB8"
                      />
                      {dateFilter ? (
                        <TouchableOpacity style={s.clearBtn} onPress={() => setPanels(prev => ({ ...prev, [sub.subjectId]: { ...prev[sub.subjectId], dateFilter: '' } }))}>
                          <Text style={s.clearBtnText}>Clear</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity style={s.addBtn} onPress={() => openCreateFor(sub.subjectId)}>
                        <Text style={s.addBtnText}>+ Manual</Text>
                      </TouchableOpacity>
                    </View>

                    {isLoading ? (
                      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                        <ActivityIndicator color="#0B0D14" />
                      </View>
                    ) : filtered.length === 0 ? (
                      <View style={s.emptyPanel}>
                        <Text style={s.emptyText}>
                          {dateFilter ? 'No lectures on this date.' : 'No lectures yet.'}
                        </Text>
                      </View>
                    ) : (
                      filtered.map(lec => {
                        const past = isPastScheduled(lec);
                        return (
                          <View key={lec.lectureId} style={[s.lecCard, past && s.lecCardPast]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.lecNum, past && { color: '#9B9790' }]}>Lecture #{lec.lectureNumber}</Text>
                              <Text style={s.lecDate}>{lec.scheduledDate}</Text>
                              <Text style={s.lecTime}>{lec.startTime} – {lec.endTime}</Text>
                              <View style={s.badgeRow}>
                                <View style={[s.badge, { backgroundColor: statusBg(lec.status) }]}>
                                  <Text style={[s.badgeText, { color: statusFg(lec.status) }]}>{lec.status}</Text>
                                </View>
                                {past && (
                                  <View style={[s.badge, { backgroundColor: '#FDE8CC' }]}>
                                    <Text style={[s.badgeText, { color: '#7A3A00' }]}>⚠ Past — No Record</Text>
                                  </View>
                                )}
                                {lec.isManual && (
                                  <View style={[s.badge, { backgroundColor: '#EDE0F5' }]}>
                                    <Text style={[s.badgeText, { color: '#4A1E6B' }]}>Manual</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            {lec.status === 'scheduled' && (
                              <TouchableOpacity style={s.dangerBtn} onPress={() => handleCancel(lec.lectureId, sub.subjectId)}>
                                <Text style={s.dangerBtnText}>Cancel</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
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
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>Manual Lecture</Text>
              <Text style={s.modalSubtitle}>{createSubjectName}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {formError ? <View style={s.errBanner}><Text style={s.errText}>{formError}</Text></View> : null}

          <Field label="Date * (YYYY-MM-DD)">
            <TextInput
              style={s.input}
              value={form.scheduledDate}
              onChangeText={v => setForm(p => ({ ...p, scheduledDate: v }))}
              placeholder="2024-11-15"
              placeholderTextColor="#C4BFB8"
            />
          </Field>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Start Time">
                <TextInput style={s.input} value={form.startTime} onChangeText={v => setForm(p => ({ ...p, startTime: v }))} placeholder="09:00" placeholderTextColor="#C4BFB8" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="End Time">
                <TextInput style={s.input} value={form.endTime} onChangeText={v => setForm(p => ({ ...p, endTime: v }))} placeholder="10:30" placeholderTextColor="#C4BFB8" />
              </Field>
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

function statusBg(status) {
  if (status === 'scheduled') return '#E5E1DA';
  if (status === 'ongoing')   return '#D4DCF0';
  if (status === 'completed') return '#D4EBD8';
  if (status === 'cancelled') return '#F5D8D8';
  return '#EDE9E3';
}
function statusFg(status) {
  if (status === 'scheduled') return '#4A4845';
  if (status === 'ongoing')   return '#0A2460';
  if (status === 'completed') return '#174520';
  if (status === 'cancelled') return '#8A1E1E';
  return '#0B0D14';
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  topBar: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  subtitle: { fontSize: 12, color: '#9B9790', marginTop: 4 },

  emptyCard: { backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center', marginTop: 8 },
  emptyText: { fontSize: 13, color: '#9B9790', textAlign: 'center' },

  subjectCard: { backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', marginBottom: 12, overflow: 'hidden' },
  subjectCardOpen: { borderColor: '#0B0D14' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  subjectInitials: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  subjectInitialsText: { fontSize: 13, fontWeight: '700', color: '#F5F3EF' },
  subjectName: { fontSize: 15, fontWeight: '700', color: '#0B0D14' },
  subjectMeta: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  chevron: { fontSize: 11, color: '#9B9790' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  chip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  chipScheduled: { backgroundColor: '#E5E1DA' },
  chipOngoing: { backgroundColor: '#D4DCF0' },
  chipCompleted: { backgroundColor: '#D4EBD8' },
  chipPast: { backgroundColor: '#FDE8CC' },
  chipText: { fontSize: 11, fontWeight: '500', color: '#0B0D14' },

  panelBody: { borderTopWidth: 1, borderColor: '#E5E1DA', padding: 14 },
  panelToolbar: { flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'center' },
  input: { backgroundColor: '#EDE9E3', borderRadius: 12, padding: 10, fontSize: 13, color: '#0B0D14' },
  clearBtn: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  clearBtnText: { fontSize: 12, color: '#6B6760' },
  addBtn: { backgroundColor: '#0B0D14', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  addBtnText: { color: '#F5F3EF', fontWeight: '700', fontSize: 12 },

  emptyPanel: { paddingVertical: 20, alignItems: 'center' },

  lecCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E1DA', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  lecCardPast: { backgroundColor: '#FAF6F0', borderColor: '#E8C99A' },
  lecNum: { fontSize: 13, fontWeight: '700', color: '#0B0D14' },
  lecDate: { fontSize: 12, color: '#6B6760', marginTop: 2 },
  lecTime: { fontSize: 12, color: '#9B9790', marginTop: 1 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  dangerBtn: { backgroundColor: '#F5D8D8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  dangerBtnText: { fontSize: 12, fontWeight: '600', color: '#8A1E1E' },

  modal: { backgroundColor: '#F5F3EF', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, marginTop: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0B0D14' },
  modalSubtitle: { fontSize: 13, color: '#9B9790', marginTop: 2 },
  modalClose: { fontSize: 18, color: '#9B9790' },
  errBanner: { backgroundColor: '#F5D8D8', borderRadius: 10, padding: 12, marginBottom: 14 },
  errText: { fontSize: 13, color: '#8A1E1E' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#6B6760' },
  submitBtn: { flex: 2, backgroundColor: '#0B0D14', borderRadius: 12, padding: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#F5F3EF' },
});