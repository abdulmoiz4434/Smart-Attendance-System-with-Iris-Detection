import { useEffect, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import StatusPill from '../../components/shared/StatusPill';
import { listSubjects, listLectures } from '../../api/studentApi';
import { useAuth } from '../../context/AuthContext';
import { getTodayISO } from '@smart-attendance/shared';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulePage() {
    const { userProfile } = useAuth();
    const [view, setView] = useState('list');     // list | week
    const [mySubjects, setMySubjects] = useState([]);
    const [lectures, setLectures] = useState([]);
    const [subjectMap, setSubjectMap] = useState({});
    const [weekOffset, setWeekOffset] = useState(0);      // 0 = current week

    useEffect(() => {
        if (!userProfile?.uid) return;
        loadData();
    }, [userProfile]);

    async function loadData() {
        const subRes = await listSubjects();
        const enrolled = subRes.data.filter(s =>
            (s.enrolledStudentIds || []).includes(userProfile.uid)
        );
        setMySubjects(enrolled);
        const map = Object.fromEntries(enrolled.map(s => [s.subjectId, s]));
        setSubjectMap(map);

        // Fetch all lectures for enrolled subjects
        const allLectures = [];
        await Promise.all(
            enrolled.map(async s => {
                const r = await listLectures({ subject_id: s.subjectId });
                allLectures.push(...r.data);
            })
        );
        allLectures.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime));
        setLectures(allLectures);
    }

    // ── Week grid helpers ─────────────────────────────────────────────────────
    function getWeekStart(offset = 0) {
        const today = new Date();
        const day = today.getDay();
        const diff = day === 0 ? -6 : 1 - day;  // Monday
        const mon = new Date(today);
        mon.setDate(today.getDate() + diff + offset * 7);
        mon.setHours(0, 0, 0, 0);
        return mon;
    }

    function getWeekDates(offset = 0) {
        const mon = getWeekStart(offset);
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            return d.toISOString().split('T')[0];
        });
    }

    const weekDates = getWeekDates(weekOffset);
    const weekLecMap = {};
    weekDates.forEach(d => { weekLecMap[d] = []; });
    lectures.forEach(l => {
        if (weekLecMap[l.scheduledDate] !== undefined) {
            weekLecMap[l.scheduledDate].push(l);
        }
    });

    const today = getTodayISO();
    const upcomingLectures = lectures.filter(l =>
        l.scheduledDate >= today && l.status !== 'cancelled'
    );

    return (
        <StudentLayout>
            <div style={pageHeader}>
                <div>
                    <span style={eyebrow}>MY SCHEDULE</span>
                    <h1 style={heading}>Schedule</h1>
                </div>
                <div style={viewToggle}>
                    {['list', 'week'].map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            style={{ ...viewBtn, ...(view === v ? viewBtnActive : {}) }}
                        >
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
            {view === 'list' && (
                <div style={lectureList}>
                    {upcomingLectures.length === 0 && (
                        <div style={emptyCard}><p style={muted}>No upcoming lectures.</p></div>
                    )}
                    {upcomingLectures.map(lec => {
                        const sub = subjectMap[lec.subjectId];
                        const isToday = lec.scheduledDate === today;
                        return (
                            <div key={lec.lectureId} style={{ ...lectureCard, ...(isToday ? todayHighlight : {}) }}>
                                <div style={lectureLeft}>
                                    {isToday && <span style={todayTag}>Today</span>}
                                    <p style={lectureName}>{sub?.name || lec.subjectId}</p>
                                    <p style={lectureMeta}>{sub?.courseCode} · Lecture #{lec.lectureNumber}</p>
                                </div>
                                <div style={lectureRight}>
                                    <p style={lectureDate}>{lec.scheduledDate}</p>
                                    <p style={lectureTime}>{lec.startTime} – {lec.endTime}</p>
                                    <StatusPill status={lec.attendanceOpen ? 'ongoing' : lec.status} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── WEEK VIEW ──────────────────────────────────────────────────────── */}
            {view === 'week' && (
                <>
                    <div style={weekNav}>
                        <button style={navBtn} onClick={() => setWeekOffset(w => w - 1)}>← Prev</button>
                        <span style={weekLabel}>
                            {weekOffset === 0 ? 'This Week' : weekOffset > 0 ? `+${weekOffset} week` : `${weekOffset} week`}
                        </span>
                        <button style={navBtn} onClick={() => setWeekOffset(w => w + 1)}>Next →</button>
                    </div>

                    <div style={weekGrid}>
                        {weekDates.map((date, i) => {
                            const dayLecs = weekLecMap[date] || [];
                            const isToday_ = date === today;
                            return (
                                <div key={date} style={{ ...dayCol, ...(isToday_ ? dayColToday : {}) }}>
                                    <p style={dayName}>{DAYS[i]}</p>
                                    <p style={{ ...dayDate, color: isToday_ ? '#0B0D14' : '#9B9790' }}>
                                        {new Date(date).getDate()}
                                    </p>
                                    <div style={daySlots}>
                                        {dayLecs.map(lec => {
                                            const sub = subjectMap[lec.subjectId];
                                            return (
                                                <div key={lec.lectureId} style={weekSlot}>
                                                    <p style={weekSlotName}>{sub?.courseCode || '—'}</p>
                                                    <p style={weekSlotTime}>{lec.startTime}</p>
                                                </div>
                                            );
                                        })}
                                        {dayLecs.length === 0 && <p style={noLec}>—</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </StudentLayout>
    );
}

const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' };
const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14' };
const viewToggle = { display: 'flex', gap: '6px' };
const viewBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '100px', padding: '7px 16px', fontSize: '13px', color: '#6B6760', cursor: 'pointer' };
const viewBtnActive = { background: '#0B0D14', color: '#F5F3EF', borderColor: '#0B0D14' };
const lectureList = { display: 'flex', flexDirection: 'column', gap: '10px' };
const emptyCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '16px', padding: '32px', textAlign: 'center' };
const lectureCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 };
const todayHighlight = { borderColor: '#0B0D14', borderWidth: '1.5px' };
const lectureLeft = {};
const todayTag = { fontSize: '10px', fontWeight: 600, color: '#0B0D14', background: '#EDE9E3', borderRadius: '100px', padding: '2px 8px', display: 'inline-block', marginBottom: '6px' };
const lectureName = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '14px', color: '#0B0D14', margin: 0 };
const lectureMeta = { fontSize: '12px', color: '#9B9790', margin: '2px 0 0' };
const lectureRight = { textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' };
const lectureDate = { fontSize: '12px', fontWeight: 500, color: '#0B0D14', margin: 0 };
const lectureTime = { fontSize: '12px', color: '#9B9790', margin: 0 };
const weekNav = { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' };
const navBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '10px', padding: '7px 14px', fontSize: '13px', color: '#6B6760', cursor: 'pointer' };
const weekLabel = { fontSize: '14px', fontWeight: 600, color: '#0B0D14', flex: 1, textAlign: 'center' };
const weekGrid = { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', overflowX: 'auto' };
const dayCol = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '14px', padding: '14px 10px', minWidth: '100px' };
const dayColToday = { border: '1.5px solid #0B0D14' };
const dayName = { fontSize: '11px', fontWeight: 500, color: '#9B9790', margin: '0 0 2px', textAlign: 'center' };
const dayDate = { fontSize: '18px', fontWeight: 700, textAlign: 'center', margin: '0 0 10px' };
const daySlots = { display: 'flex', flexDirection: 'column', gap: '6px' };
const weekSlot = { background: '#EDE9E3', borderRadius: '8px', padding: '6px 8px' };
const weekSlotName = { fontSize: '11px', fontWeight: 600, color: '#0B0D14', margin: 0 };
const weekSlotTime = { fontSize: '10px', color: '#9B9790', margin: 0 };
const noLec = { fontSize: '12px', color: '#C4BFB8', textAlign: 'center', margin: 0 };
const muted = { color: '#9B9790', fontSize: '13px' };