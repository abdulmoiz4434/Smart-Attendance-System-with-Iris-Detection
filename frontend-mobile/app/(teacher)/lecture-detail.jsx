import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

export default function LectureDetail() {
  const { lectureId } = useLocalSearchParams();
  const { userProfile } = useAuth();

  const [lecture, setLecture]               = useState(null);
  const [subject, setSubject]               = useState(null);
  const [attendance, setAttendance]         = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [studentMap, setStudentMap]         = useState({});
  const [loading, setLoading]               = useState(true);
  const [filter, setFilter]                 = useState('all');
  const [manualMarkingEnabled, setManualMarkingEnabled] = useState(false);

  // Manual mark modal
  const [showManual, setShowManual]         = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualNote, setManualNote]         = useState('');
  const [manualSaving, setManualSaving]     = useState(false);
  const [manualSearch, setManualSearch]     = useState('');

  useEffect(() => {
    if (lectureId) loadData();
  }, [lectureId]);

  async function loadData() {
    setLoading(true);
    try {
      const [lecRes, attRes, subRes, configRes] = await Promise.all([
        apiClient.get('/api/lectures'),
        apiClient.get('/api/attendance', { params: { lecture_id: lectureId } }),
        apiClient.get('/api/subjects'),
        apiClient.get('/api/system-config'),
      ]);

      const found = lecRes.data.find(l => l.lectureId === lectureId);
      setLecture(found || null);
      setAttendance(attRes.data || []);
      setManualMarkingEnabled(configRes.data?.manualMarkingEnabled ?? false);

      if (found?.subjectId) {
        const sub = subRes.data.find(s => s.subjectId === found.subjectId);
        setSubject(sub || null);

        if (sub?.enrolledStudentIds?.length) {
          const stuRes = await apiClient.get('/api/admin/users', { params: { role: 'student' } });
          const map = {};
          stuRes.data.forEach(u => { map[u.uid] = u; });
          setStudentMap(map);
          setEnrolledStudents(sub.enrolledStudentIds.map(uid => ({ uid, ...map[uid] })));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAttendance() {
    if (!lecture) return;
    try {
      const endpoint = lecture.attendanceOpen
        ? `/api/lectures/${lectureId}/close`
        : `/api/lectures/${lectureId}/open`;
      await apiClient.patch(endpoint);
      setLecture(prev => ({ ...prev, attendanceOpen: !prev.attendanceOpen }));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleApprove(docId) {
    try {
      await apiClient.patch(`/api/attendance/${docId}/approve`);
      setAttendance(prev => prev.map(r => r.attendanceId === docId || r.docId === docId
        ? { ...r, status: 'approved' } : r));
    } catch (e) { console.error(e); }
  }

  async function handleReject(docId) {
    try {
      await apiClient.patch(`/api/attendance/${docId}/reject`);
      setAttendance(prev => prev.map(r => r.attendanceId === docId || r.docId === docId
        ? { ...r, status: 'rejected' } : r));
    } catch (e) { console.error(e); }
  }

  async function handleApproveAll() {
    Alert.alert('Approve All', 'Approve all pending records?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve All', onPress: async () => {
          try {
            await apiClient.post('/api/attendance/approve-all', null, { params: { lecture_id: lectureId } });
            setAttendance(prev => prev.map(r => r.status === 'pending' ? { ...r, status: 'approved' } : r));
          } catch (e) { console.error(e); }
        }
      }
    ]);
  }

  async function handleManualMark() {
    if (!manualStudentId) return;
    setManualSaving(true);
    try {
      await apiClient.post('/api/attendance/manual', {
        lectureId,
        subjectId: lecture.subjectId,
        studentId: manualStudentId,
        markedBy: userProfile.uid,
        note: manualNote,
      });
      setShowManual(false);
      setManualStudentId('');
      setManualNote('');
      setManualSearch('');
      await loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to mark attendance.');
    } finally {
      setManualSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0B0D14" />
      </View>
    );
  }

  const markedUids     = new Set(attendance.map(a => a.studentId));
  const absentStudents = enrolledStudents.filter(st => !markedUids.has(st.uid));
  const pendingCount   = attendance.filter(a => a.status === 'pending').length;
  const approvedCount  = attendance.filter(a => a.status === 'approved').length;

  const FILTERS = ['all', 'pending', 'approved', 'rejected', 'manual'];
  const filtered = filter === 'all' ? attendance : attendance.filter(a => a.status === filter);

  const filteredManualStudents = enrolledStudents.filter(st =>
    !manualSearch ||
    st.fullName?.toLowerCase().includes(manualSearch.toLowerCase()) ||
    (st.roleData?.registrationId || '').toLowerCase().includes(manualSearch.toLowerCase())
  );

  return (
    <View style={s.screen}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        {lecture?.status !== 'cancelled' && lecture?.status !== 'completed' && (
          <TouchableOpacity
            style={[s.toggleBtn, { backgroundColor: lecture?.attendanceOpen ? '#F5D8D8' : '#0B0D14' }]}
            onPress={toggleAttendance}
          >
            <Text style={[s.toggleText, { color: lecture?.attendanceOpen ? '#8A1E1E' : '#F5F3EF' }]}>
              {lecture?.attendanceOpen ? 'Close Window' : 'Open Window'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Header */}
        <View style={s.headerSection}>
          <Text style={s.eyebrow}>LECTURE DETAIL</Text>
          <Text style={s.title}>{subject?.name || lecture?.subjectId || 'Lecture'}</Text>
          <Text style={s.meta}>
            {subject?.courseCode ? `${subject.courseCode} · ` : ''}
            {lecture?.scheduledDate} · {lecture?.startTime} – {lecture?.endTime}
          </Text>
          {lecture?.attendanceOpen && (
            <View style={s.openBadge}>
              <Text style={s.openBadgeText}>🟢 Attendance Open</Text>
            </View>
          )}
        </View>

        {/* Stats hero */}
        <View style={s.heroCard}>
          {[
            { val: enrolledStudents.length, label: 'Enrolled' },
            { val: attendance.length,       label: 'Submitted' },
            { val: pendingCount,            label: 'Pending' },
            { val: approvedCount,           label: 'Approved' },
            { val: absentStudents.length,   label: 'Absent' },
          ].map((item, i, arr) => (
            <View key={item.label} style={[s.heroStat, i < arr.length - 1 && s.heroStatBorder]}>
              <Text style={s.heroVal}>{item.val}</Text>
              <Text style={s.heroLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={s.actionRow}>
          {pendingCount > 0 && (
            <TouchableOpacity style={s.approveAllBtn} onPress={handleApproveAll}>
              <Text style={s.approveAllText}>Approve All ({pendingCount})</Text>
            </TouchableOpacity>
          )}
          {manualMarkingEnabled && (
            <TouchableOpacity style={s.manualBtn} onPress={() => { setManualSearch(''); setManualStudentId(''); setManualNote(''); setShowManual(true); }}>
              <Text style={s.manualBtnText}>+ Manual Mark</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, marginBottom: 12 }}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8, alignItems: 'center' }}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, filter === f && s.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterTabText, filter === f && s.filterTabTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Attendance records */}
        {filtered.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No {filter === 'all' ? '' : filter} records</Text>
          </View>
        ) : (
          filtered.map(rec => {
            const student = studentMap[rec.studentId];
            const recId   = rec.attendanceId || rec.docId;
            const markedAt = rec.markedAt ? new Date(rec.markedAt) : null;
            return (
              <View key={recId || rec.studentId} style={s.recordRow}>
                <View style={s.initials}>
                  <Text style={s.initialsText}>
                    {(student?.fullName || rec.studentId || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.studentName}>{student?.fullName || rec.studentId}</Text>
                  <Text style={s.recordMeta}>
                    {student?.roleData?.registrationId || '—'}
                    {rec.irisConfidence > 0 ? `  ·  ${(rec.irisConfidence * 100).toFixed(1)}% conf.` : ''}
                  </Text>
                  {markedAt && (
                    <Text style={s.recordMeta}>
                      {markedAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                  {rec.note ? <Text style={s.noteText}>📝 {rec.note}</Text> : null}
                </View>
                <View style={s.recordRight}>
                  <View style={[s.statusBadge, { backgroundColor: statusBg(rec.status) }]}>
                    <Text style={[s.statusText, { color: statusColor(rec.status) }]}>{rec.status}</Text>
                  </View>
                  {rec.status === 'pending' && (
                    <View style={s.approveRejectRow}>
                      <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(recId)}>
                        <Text style={s.approveBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(recId)}>
                        <Text style={s.rejectBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Absent students */}
        {absentStudents.length > 0 && lecture?.status !== 'cancelled' && (
          <>
            <Text style={[s.eyebrow, { marginHorizontal: 24, marginTop: 24, marginBottom: 10 }]}>
              ABSENT / NOT SUBMITTED
            </Text>
            {absentStudents.map(st => (
              <View key={st.uid} style={s.absentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.studentName}>{st.fullName || st.uid}</Text>
                  <Text style={s.recordMeta}>{st.roleData?.registrationId || st.email || '—'}</Text>
                </View>
                {manualMarkingEnabled && (
                  <TouchableOpacity
                    style={s.manualBtn}
                    onPress={() => { setManualStudentId(st.uid); setManualNote(''); setShowManual(true); }}
                  >
                    <Text style={s.manualBtnText}>Mark</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Manual Mark Modal */}
      <Modal visible={showManual} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowManual(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Manual Attendance</Text>
            <TouchableOpacity onPress={() => setShowManual(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.fieldLabel}>Student</Text>
          <TextInput
            style={s.input}
            value={manualSearch}
            onChangeText={setManualSearch}
            placeholder="Search by name or reg ID…"
            placeholderTextColor="#C4BFB8"
          />
          <ScrollView style={{ maxHeight: 220, marginBottom: 16 }}>
            {filteredManualStudents.map(st => (
              <TouchableOpacity
                key={st.uid}
                style={[s.studentPickRow, manualStudentId === st.uid && s.studentPickRowActive]}
                onPress={() => setManualStudentId(st.uid)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.studentName}>{st.fullName || st.uid}</Text>
                  <Text style={s.recordMeta}>{st.roleData?.registrationId || st.email || '—'}</Text>
                </View>
                {manualStudentId === st.uid && <Text style={{ color: '#2A6E35', fontWeight: '700' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={[s.input, { marginBottom: 20 }]}
            value={manualNote}
            onChangeText={setManualNote}
            placeholder="Reason for manual entry"
            placeholderTextColor="#C4BFB8"
          />

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowManual(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, !manualStudentId && { opacity: 0.4 }]}
              onPress={handleManualMark}
              disabled={!manualStudentId || manualSaving}
            >
              {manualSaving
                ? <ActivityIndicator color="#F5F3EF" />
                : <Text style={s.submitBtnText}>Mark Attendance</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function statusBg(status) {
  if (status === 'approved') return '#D4EBD8';
  if (status === 'rejected') return '#F5D8D8';
  if (status === 'manual')   return '#EDE0F5';
  return '#FAF0DC'; // pending
}
function statusColor(status) {
  if (status === 'approved') return '#174520';
  if (status === 'rejected') return '#8A1E1E';
  if (status === 'manual')   return '#4A1E6B';
  return '#3D2500'; // pending
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  toggleBtn: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
  toggleText: { fontSize: 13, fontWeight: '700' },

  headerSection: { paddingHorizontal: 24, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title:   { fontSize: 24, fontWeight: '700', color: '#0B0D14' },
  meta:    { fontSize: 12, color: '#9B9790', marginTop: 4 },
  openBadge: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#D4EBD8', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  openBadgeText: { fontSize: 12, color: '#174520', fontWeight: '600' },

  heroCard: { marginHorizontal: 24, backgroundColor: '#0B0D14', borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatBorder: { borderRightWidth: 1, borderColor: '#2A2E40' },
  heroVal:   { fontSize: 20, fontWeight: '700', color: '#F5F3EF' },
  heroLabel: { fontSize: 9, color: '#9B9790', marginTop: 2, textAlign: 'center' },

  actionRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 14 },
  approveAllBtn:  { flex: 1, backgroundColor: '#D4EBD8', borderRadius: 12, padding: 11, alignItems: 'center' },
  approveAllText: { fontSize: 13, fontWeight: '700', color: '#174520' },
  manualBtn:  { flex: 1, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, padding: 11, alignItems: 'center' },
  manualBtnText: { fontSize: 13, color: '#6B6760', fontWeight: '500' },

  filterTab:         { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  filterTabActive:   { backgroundColor: '#0B0D14', borderColor: '#0B0D14' },
  filterTabText:     { fontSize: 12, color: '#6B6760' },
  filterTabTextActive: { color: '#F5F3EF' },

  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },

  recordRow: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  initials:      { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  initialsText:  { color: '#F5F3EF', fontWeight: '700', fontSize: 13 },
  studentName:   { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  recordMeta:    { fontSize: 11, color: '#9B9790', marginTop: 1 },
  noteText:      { fontSize: 11, color: '#6B6760', marginTop: 3 },
  recordRight:   { alignItems: 'flex-end', gap: 6 },
  statusBadge:   { borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3 },
  statusText:    { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  approveRejectRow: { flexDirection: 'row', gap: 6 },
  approveBtn:    { width: 30, height: 30, borderRadius: 8, backgroundColor: '#D4EBD8', justifyContent: 'center', alignItems: 'center' },
  approveBtnText: { color: '#174520', fontWeight: '700', fontSize: 14 },
  rejectBtn:     { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F5D8D8', justifyContent: 'center', alignItems: 'center' },
  rejectBtnText: { color: '#8A1E1E', fontWeight: '700', fontSize: 14 },

  absentRow: { marginHorizontal: 24, marginBottom: 8, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },

  modal:       { flex: 1, backgroundColor: '#F5F3EF', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 12 },
  modalTitle:  { fontSize: 20, fontWeight: '700', color: '#0B0D14' },
  modalClose:  { fontSize: 18, color: '#9B9790' },
  fieldLabel:  { fontSize: 11, fontWeight: '500', color: '#6B6760', marginBottom: 6 },
  input:       { backgroundColor: '#EDE9E3', borderRadius: 12, padding: 12, fontSize: 14, color: '#0B0D14', marginBottom: 10 },
  studentPickRow:       { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E1DA', flexDirection: 'row', alignItems: 'center' },
  studentPickRowActive: { backgroundColor: '#F0F7F1' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn:    { flex: 1, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#6B6760' },
  submitBtn:    { flex: 2, backgroundColor: '#0B0D14', borderRadius: 12, padding: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#F5F3EF' },
});