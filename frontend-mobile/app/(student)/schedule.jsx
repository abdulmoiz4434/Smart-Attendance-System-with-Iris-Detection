import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

function getTodayISO() { return new Date().toISOString().split('T')[0]; }

const STATUS_COLORS = {
    scheduled: { bg: '#E5E1DA', text: '#4A4845' },
    ongoing: { bg: '#D4DCF0', text: '#0A2460' },
    completed: { bg: '#D4EBD8', text: '#174520' },
    cancelled: { bg: '#F5D8D8', text: '#8A1E1E' },
};

export default function ScheduleScreenMobile() {
    const { userProfile } = useAuth();
    const [lectures, setLectures] = useState([]);
    const [subjectMap, setSubjectMap] = useState({});
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

        const all = [];
        await Promise.all(enrolled.map(async s => {
            const r = await apiClient.get('/api/lectures', { params: { subject_id: s.subjectId } });
            all.push(...r.data);
        }));

        const today = getTodayISO();
        const upcoming = all
            .filter(l => l.scheduledDate >= today && l.status !== 'cancelled')
            .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime));

        setLectures(upcoming);
        setLoading(false);
    }

    const today = getTodayISO();

    return (
        <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={s.header}>
                <Text style={s.eyebrow}>MY SCHEDULE</Text>
                <Text style={s.heading}>Upcoming Lectures</Text>
            </View>

            {loading ? (
                <ActivityIndicator color="#0B0D14" style={{ marginTop: 40 }} />
            ) : lectures.length === 0 ? (
                <View style={s.empty}><Text style={s.emptyText}>No upcoming lectures.</Text></View>
            ) : (
                lectures.map(lec => {
                    const sub = subjectMap[lec.subjectId];
                    const isToday = lec.scheduledDate === today;
                    const pill = STATUS_COLORS[lec.attendanceOpen ? 'ongoing' : lec.status] || STATUS_COLORS.scheduled;
                    return (
                        <View key={lec.lectureId} style={[s.card, isToday && s.cardToday]}>
                            <View style={s.cardLeft}>
                                {isToday && <View style={s.todayTag}><Text style={s.todayTagText}>Today</Text></View>}
                                <Text style={s.name}>{sub?.name || lec.subjectId}</Text>
                                <Text style={s.meta}>{sub?.courseCode} · Lecture #{lec.lectureNumber}</Text>
                            </View>
                            <View style={s.cardRight}>
                                <Text style={s.date}>{lec.scheduledDate}</Text>
                                <Text style={s.time}>{lec.startTime}–{lec.endTime}</Text>
                                <View style={[s.pill, { backgroundColor: pill.bg }]}>
                                    <Text style={[s.pillText, { color: pill.text }]}>
                                        {lec.attendanceOpen ? 'open' : lec.status}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    );
                })
            )}
        </ScrollView>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F5F3EF' },
    header: { padding: 24, paddingTop: 52 },
    eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 6 },
    heading: { fontSize: 24, fontWeight: '700', color: '#0B0D14' },
    empty: { margin: 24, backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 32, alignItems: 'center' },
    emptyText: { color: '#9B9790', fontSize: 13 },
    card: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardToday: { borderColor: '#0B0D14', borderWidth: 1.5 },
    cardLeft: { flex: 1, marginRight: 12 },
    todayTag: { backgroundColor: '#EDE9E3', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
    todayTagText: { fontSize: 10, fontWeight: '600', color: '#0B0D14' },
    name: { fontSize: 14, fontWeight: '700', color: '#0B0D14' },
    meta: { fontSize: 12, color: '#9B9790', marginTop: 2 },
    cardRight: { alignItems: 'flex-end', gap: 4 },
    date: { fontSize: 12, fontWeight: '500', color: '#0B0D14' },
    time: { fontSize: 11, color: '#9B9790' },
    pill: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
    pillText: { fontSize: 10, fontWeight: '500' },
});