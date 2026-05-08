import { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator
} from 'react-native';
import { collection, query, where, onSnapshot, doc, onSnapshot as onDocSnap } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router, useLocalSearchParams } from 'expo-router';

export default function LectureDetailMobile() {
    const { lectureId } = useLocalSearchParams();
    const { userProfile } = useAuth();
    const [lecture, setLecture] = useState(null);
    const [subject, setSubject] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [studentMap, setStudentMap] = useState({});
    const [toggling, setToggling] = useState(false);
    const [approvingAll, setApprovingAll] = useState(false);

    useEffect(() => {
        const unsub = onDocSnap(doc(db, 'lectures', lectureId), snap => {
            if (snap.exists()) setLecture(snap.data());
        });
        return unsub;
    }, [lectureId]);

    useEffect(() => {
        if (!lecture) return;
        apiClient.get('/api/subjects').then(r => {
            const s = r.data.find(s => s.subjectId === lecture.subjectId);
            setSubject(s);
        });
        apiClient.get('/api/admin/users', { params: { role: 'student' } }).then(r => {
            const map = {};
            r.data.forEach(u => { map[u.uid] = u; });
            setStudentMap(map);
        });
    }, [lecture?.subjectId]);

    useEffect(() => {
        const q = query(collection(db, 'attendance'), where('lectureId', '==', lectureId));
        return onSnapshot(q, snap => {
            const data = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
            data.sort((a, b) => (b.markedAt?.seconds || 0) - (a.markedAt?.seconds || 0));
            setAttendance(data);
        });
    }, [lectureId]);

    const handleToggle = async () => {
        setToggling(true);
        try {
            const ep = lecture.attendanceOpen
                ? `/api/lectures/${lectureId}/close`
                : `/api/lectures/${lectureId}/open`;
            await apiClient.patch(ep);
        } finally { setToggling(false); }
    };

    const handleApproveAll = async () => {
        setApprovingAll(true);
        try {
            await apiClient.post('/api/attendance/approve-all', null, { params: { lecture_id: lectureId } });
        } finally { setApprovingAll(false); }
    };

    const handleApprove = (docId) => apiClient.patch(`/api/attendance/${docId}/approve`);
    const handleReject = (docId) => apiClient.patch(`/api/attendance/${docId}/reject`);

    const pending = attendance.filter(a => a.status === 'pending');

    if (!lecture) return (
        <View style={s.centered}><ActivityIndicator color="#0B0D14" /></View>
    );

    return (
        <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={s.back}>← Back</Text>
                </TouchableOpacity>
                <Text style={s.heading}>{subject?.name || 'Lecture'}</Text>
                <Text style={s.meta}>{subject?.courseCode} · {lecture.scheduledDate} · {lecture.startTime}–{lecture.endTime}</Text>
            </View>

            {/* Toggle button */}
            {lecture.status !== 'cancelled' && lecture.status !== 'completed' && (
                <TouchableOpacity
                    style={[s.toggleBtn, lecture.attendanceOpen ? s.closeStyle : s.openStyle]}
                    onPress={handleToggle}
                    disabled={toggling}
                >
                    <Text style={[s.toggleText, { color: lecture.attendanceOpen ? '#8A1E1E' : '#F5F3EF' }]}>
                        {toggling ? '…' : lecture.attendanceOpen ? 'Close Attendance Window' : 'Open Attendance Window'}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Approve All */}
            {pending.length > 0 && (
                <TouchableOpacity style={s.approveAllBtn} onPress={handleApproveAll} disabled={approvingAll}>
                    <Text style={s.approveAllText}>
                        {approvingAll ? 'Approving…' : `Approve All (${pending.length})`}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Attendance list */}
            <Text style={s.sectionLabel}>SUBMISSIONS ({attendance.length})</Text>
            {attendance.map(rec => {
                const student = studentMap[rec.studentId];
                return (
                    <View key={rec.docId} style={s.recCard}>
                        <View style={s.recLeft}>
                            <Text style={s.recName}>{student?.fullName || rec.studentId}</Text>
                            <Text style={s.recMeta}>{student?.roleData?.registrationId || ''}</Text>
                            {rec.irisConfidence > 0 && (
                                <Text style={s.recConf}>Confidence: {(rec.irisConfidence * 100).toFixed(1)}%</Text>
                            )}
                        </View>
                        <View style={s.recRight}>
                            <View style={[s.statusPill, { backgroundColor: STATUS_BG[rec.status] }]}>
                                <Text style={[s.statusText, { color: STATUS_TEXT[rec.status] }]}>{rec.status}</Text>
                            </View>
                            {rec.status === 'pending' && (
                                <View style={s.approveRow}>
                                    <TouchableOpacity style={s.appBtn} onPress={() => handleApprove(rec.docId)}>
                                        <Text style={s.appBtnText}>✓</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={s.rejBtn} onPress={() => handleReject(rec.docId)}>
                                        <Text style={s.rejBtnText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                );
            })}
            {attendance.length === 0 && (
                <Text style={s.emptyText}>No submissions yet.</Text>
            )}
        </ScrollView>
    );
}

const STATUS_BG = { pending: '#FAF0DC', approved: '#D4EBD8', rejected: '#F5D8D8', manual: '#EDE0F5' };
const STATUS_TEXT = { pending: '#3D2500', approved: '#174520', rejected: '#8A1E1E', manual: '#4A1E6B' };

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F5F3EF' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 24, paddingTop: 52 },
    back: { color: '#9B9790', fontSize: 13, marginBottom: 12 },
    heading: { fontSize: 22, fontWeight: '700', color: '#0B0D14', marginBottom: 4 },
    meta: { fontSize: 12, color: '#9B9790' },
    toggleBtn: { marginHorizontal: 24, marginTop: 12, borderRadius: 14, padding: 16, alignItems: 'center' },
    openStyle: { backgroundColor: '#0B0D14' },
    closeStyle: { backgroundColor: '#F5D8D8' },
    toggleText: { fontSize: 14, fontWeight: '700' },
    approveAllBtn: { marginHorizontal: 24, marginTop: 10, backgroundColor: '#D4EBD8', borderRadius: 14, padding: 14, alignItems: 'center' },
    approveAllText: { color: '#174520', fontWeight: '700', fontSize: 14 },
    sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginTop: 24, marginBottom: 10 },
    recCard: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    recLeft: { flex: 1 },
    recName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
    recMeta: { fontSize: 12, color: '#9B9790' },
    recConf: { fontSize: 11, color: '#6B6760', marginTop: 2 },
    recRight: { alignItems: 'flex-end', gap: 6 },
    statusPill: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 },
    statusText: { fontSize: 11, fontWeight: '500' },
    approveRow: { flexDirection: 'row', gap: 6 },
    appBtn: { backgroundColor: '#D4EBD8', width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    appBtnText: { color: '#174520', fontWeight: '700' },
    rejBtn: { backgroundColor: '#F5D8D8', width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    rejBtnText: { color: '#8A1E1E', fontWeight: '700' },
    emptyText: { textAlign: 'center', color: '#9B9790', fontSize: 13, marginTop: 24 },
});