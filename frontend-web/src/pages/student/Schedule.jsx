import { useEffect, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import StatusPill from '../../components/shared/StatusPill';
import { listSubjects, listLectures } from '../../api/studentApi';
import { useAuth } from '../../context/AuthContext';
import { getTodayISO } from '../../shared';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulePage() {
    const { userProfile } = useAuth();
    const [mySubjects, setMySubjects] = useState([]);
    const [todayLectures, setTodayLectures] = useState([]);
    const [subjectMap, setSubjectMap] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) return;
        loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const today = getTodayISO();
            const [subRes, lecRes] = await Promise.all([
                listSubjects(),
                listLectures({ date: today }),
            ]);

            const enrolled = subRes.data.filter(s =>
                (s.enrolledStudentIds || []).includes(userProfile.uid)
            );
            setMySubjects(enrolled);
            const map = Object.fromEntries(enrolled.map(s => [s.subjectId, s]));
            setSubjectMap(map);

            // Only today's lectures for enrolled subjects
            const myToday = lecRes.data
                .filter(l => enrolled.some(s => s.subjectId === l.subjectId) && l.status !== 'cancelled')
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
            setTodayLectures(myToday);
        } finally {
            setLoading(false);
        }
    }

    const today = getTodayISO();
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    if (loading) {
        return (
            <StudentLayout>
                <p style={muted}>Loading schedule…</p>
            </StudentLayout>
        );
    }

    return (
        <StudentLayout>
            <span style={eyebrow}>MY SCHEDULE</span>
            <h1 style={heading}>Schedule</h1>

            {/* Today's lectures */}
            <span style={sectionLabel}>TODAY — {todayName.toUpperCase()}</span>
            {todayLectures.length === 0 ? (
                <div style={emptyCard}>
                    <p style={muted}>No lectures scheduled for today.</p>
                </div>
            ) : (
                <div style={lectureList}>
                    {todayLectures.map(lec => {
                        const sub = subjectMap[lec.subjectId];
                        const isOpen = lec.attendanceOpen;
                        return (
                            <div key={lec.lectureId} style={{ ...lectureCard, ...(isOpen ? openHighlight : {}) }}>
                                <div style={lectureLeft}>
                                    {isOpen && <span style={openTag}>Attendance Open</span>}
                                    <p style={lectureName}>{sub?.name || lec.subjectId}</p>
                                    <p style={lectureMeta}>{sub?.courseCode} · Lecture #{lec.lectureNumber}</p>
                                </div>
                                <div style={lectureRight}>
                                    <p style={lectureTime}>{lec.startTime} – {lec.endTime}</p>
                                    <StatusPill status={lec.attendanceOpen ? 'ongoing' : lec.status} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Weekly timetable — from subject.schedule[], no extra API calls */}
            <span style={{ ...sectionLabel, marginTop: 32 }}>WEEKLY TIMETABLE</span>
            {mySubjects.length === 0 ? (
                <div style={emptyCard}><p style={muted}>No subjects enrolled yet.</p></div>
            ) : (
                <div style={timetableList}>
                    {mySubjects.map(sub => (
                        <div key={sub.subjectId} style={subjectCard}>
                            <div style={subjectHeader}>
                                <div style={subjectInitials}>
                                    {sub.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p style={subjectName}>{sub.name}</p>
                                    <p style={subjectMeta}>{sub.courseCode} · {sub.semesterLabel}</p>
                                </div>
                            </div>
                            {(sub.schedule || []).length === 0 ? (
                                <p style={noSchedule}>No schedule set</p>
                            ) : (
                                <div style={slotsGrid}>
                                    {(sub.schedule || []).map((slot, i) => {
                                        const isToday = slot.day === todayName;
                                        return (
                                            <div key={i} style={{ ...slotRow, ...(isToday ? slotRowToday : {}) }}>
                                                <span style={{ ...dayBadge, ...(isToday ? dayBadgeToday : {}) }}>
                                                    {slot.day?.slice(0, 3).toUpperCase()}
                                                </span>
                                                <span style={slotTime}>{slot.startTime} – {slot.endTime}</span>
                                                {slot.room && <span style={roomBadge}>{slot.room}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </StudentLayout>
    );
}

const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14', marginBottom: '20px' };
const sectionLabel = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' };
const lectureList = { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '0' };
const emptyCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '16px', padding: '32px', textAlign: 'center', marginBottom: '0' };
const lectureCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 };
const openHighlight = { borderColor: '#2A6E35', background: '#D4EBD8' };
const lectureLeft = {};
const openTag = { fontSize: '10px', fontWeight: 600, color: '#174520', background: '#fff', borderRadius: '100px', padding: '2px 8px', display: 'inline-block', marginBottom: '6px', border: '1px solid #2A6E35' };
const lectureName = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '14px', color: '#0B0D14', margin: 0 };
const lectureMeta = { fontSize: '12px', color: '#9B9790', margin: '2px 0 0' };
const lectureRight = { textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' };
const lectureTime = { fontSize: '13px', fontWeight: 600, color: '#0B0D14', margin: 0 };
const timetableList = { display: 'flex', flexDirection: 'column', gap: '14px' };
const subjectCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '18px 20px' };
const subjectHeader = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' };
const subjectInitials = { width: 40, height: 40, borderRadius: 12, background: '#0B0D14', color: '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 };
const subjectName = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '15px', color: '#0B0D14', margin: 0 };
const subjectMeta = { fontSize: '12px', color: '#9B9790', margin: '2px 0 0' };
const noSchedule = { fontSize: '13px', color: '#C4BFB8', fontStyle: 'italic', margin: 0 };
const slotsGrid = { display: 'flex', flexDirection: 'column', gap: '8px' };
const slotRow = { display: 'flex', alignItems: 'center', gap: '12px', background: '#EDE9E3', borderRadius: '12px', padding: '10px 14px' };
const slotRowToday = { background: '#D4DCF0', border: '1px solid #1A3A7A' };
const dayBadge = { background: '#0B0D14', color: '#F5F3EF', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, minWidth: '42px', textAlign: 'center' };
const dayBadgeToday = { background: '#1A3A7A' };
const slotTime = { fontSize: '13px', fontWeight: 600, color: '#0B0D14', flex: 1 };
const roomBadge = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '8px', padding: '3px 8px', fontSize: '11px', color: '#6B6760', fontWeight: 500 };
const muted = { color: '#9B9790', fontSize: '13px', margin: 0 };
