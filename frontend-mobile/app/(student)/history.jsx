import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

const STATUS_COLORS = {
    approved: { bg: '#D4EBD8', text: '#174520' },
    pending: { bg: '#FAF0DC', text: '#3D2500' },
    rejected: { bg: '#F5D8D8', text: '#8A1E1E' },
    manual: { bg: '#EDE0F5', text: '#4A1E6B' },
};

export default function HistoryScreenMobile() {
    const { userProfile } = useAuth();
    const [records, setRecords] = useState([]);
    const [subjectMap, setSubjectMap] = useState({});
    const [lectureMap, setLectureMap] = useState({});
    const [subjectStats, setSubjectStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) return;
        loadData();
    }, [userProfile]);

    async function loadData() {
        const subRes = await apiClient.get('/api/subjects');
        const enrolled = subRes.data.filter(s =>
            (s.enrolledStudentIds || []).includes(userProfile.uid)
        );
        const map = Object.fromEntries(enrolled.map(s => [s.subjectId, s]));
        setSubjectMap(map);

        const [attRes, ...lecArrays] = await Promise.all([
            apiClient.get('/api/attendance', { params: { student_id: userProfile.uid } }),
            ...enrolled.map(s => apiClient.get('/api/lectures', { params: { subject_id: s.subjectId } })),
        ]);

        const allLecs = lecArrays.flatMap(r => r.data);
        setLectureMap(Object.fromEntries(allLecs.map(l => [l.lectureId, l])));

        const sorted = attRes.data.sort((a, b) =>
            (b.markedAt ? new Date(b.markedAt) : 0) - (a.markedAt ? new Date(a.markedAt) : 0)
        );
        setRecords(sorted);

        const statsMap = {};
        await Promise.all(enrolled.map(async s => {
            try {
                const r = await apiClient.get(`/api/reports/student/${userProfile.uid}/subject/${s.subjectId}`);
                statsMap[s.subjectId] = r.data;
            } catch { }
        }));
        setSubjectStats(statsMap);
        setLoading(false);
    }

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' }}>
                <ActivityIndicator color="#0B0D14" />
            </View>
        );
    }

    return (
        <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={s.header}>
                <Text style={s.eyebrow}>ATTENDANCE HISTORY</Text>
                <Text style={s.heading}>History</Text>
            </View>

            {/* Subject summary cards */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.summaryStrip}>
                {Object.entries(subjectMap).map(([id, sub]) => {
                    const stats = subjectStats[id];
                    const pct = stats?.percentage ?? null;
                    const below = stats?.belowThreshold;
                    return (
                        <View key={id} style={[s.summaryCard, below && s.summaryCardWarning]}>
                            <Text style={s.summaryCode}>{sub.courseCode}</Text>
                            <Text style={[s.summaryPct, { color: below ? '#C47018' : '#2A6E35' }]}>
                                {pct !== null ? `${pct}%` : '—'}
                            </Text>
                            <Text style={s.summarySub}>{stats ? `${stats.approved}/${stats.total}` : 'No data'}</Text>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Records */}
            <Text style={s.sectionLabel}>ALL RECORDS ({records.length})</Text>
            {records.map((rec, i) => {
                const sub = subjectMap[rec.subjectId];
                const lec = lectureMap[rec.lectureId];
                const pill = STATUS_COLORS[rec.status] || STATUS_COLORS.pending;
                return (
                    <View key={`${rec.lectureId}_${i}`} style={s.recCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.recSubject}>{sub?.name || rec.subjectId}</Text>
                            <Text style={s.recMeta}>
                                {sub?.courseCode} · Lecture #{lec?.lectureNumber || '—'} · {lec?.scheduledDate || ''}
                            </Text>
                            {rec.irisConfidence > 0 && (
                                <Text style={s.recConf}>Confidence: {(rec.irisConfidence * 100).toFixed(1)}%</Text>
                            )}
                        </View>
                        <View style={[s.pill, { backgroundColor: pill.bg }]}>
                            <Text style={[s.pillText, { color: pill.text }]}>{rec.status}</Text>
                        </View>
                    </View>
                );
            })}
            {records.length === 0 && (
                <View style={s.empty}><Text style={s.emptyText}>No attendance records yet.</Text></View>
            )}
        </ScrollView>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F5F3EF' },
    header: { padding: 24, paddingTop: 52 },
    eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 6 },
    heading: { fontSize: 24, fontWeight: '700', color: '#0B0D14' },
    summaryStrip: { paddingHorizontal: 24, marginBottom: 20 },
    summaryCard: { backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 16, marginRight: 10, minWidth: 110, alignItems: 'center' },
    summaryCardWarning: { borderColor: '#C47018', backgroundColor: '#FFFBF5' },
    summaryCode: { fontSize: 11, color: '#9B9790', marginBottom: 4 },
    summaryPct: { fontSize: 24, fontWeight: '700' },
    summarySub: { fontSize: 11, color: '#9B9790', marginTop: 2 },
    sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 10 },
    recCard: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, flexDirection: 'row', alignItems: 'center' },
    recSubject: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
    recMeta: { fontSize: 12, color: '#9B9790', marginTop: 2 },
    recConf: { fontSize: 11, color: '#6B6760', marginTop: 2 },
    pill: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 10 },
    pillText: { fontSize: 11, fontWeight: '500' },
    empty: { margin: 24, backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 32, alignItems: 'center' },
    emptyText: { color: '#9B9790', fontSize: 13 },
});