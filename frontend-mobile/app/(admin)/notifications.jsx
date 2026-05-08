import { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator
} from 'react-native';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

export default function NotificationsMobile() {
    const { userProfile } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) return;
        const q = query(
            collection(db, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(50),
        );
        const unsub = onSnapshot(q, snap => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const relevant = all.filter(n => {
                if (n.targetType === 'all') return true;
                if (n.targetType === 'role' && n.targetValue === userProfile.role) return true;
                if (n.targetType === 'individual' && n.targetValue === userProfile.uid) return true;
                return false;
            });
            setNotifications(relevant);
            setLoading(false);
        });
        return unsub;
    }, [userProfile]);

    const markRead = async (id) => {
        await apiClient.patch(`/api/notifications/${id}/read`);
    };

    const markAllRead = async () => {
        await apiClient.patch('/api/notifications/read-all');
    };

    const unreadCount = notifications.filter(n => !(n.readBy || []).includes(userProfile?.uid)).length;

    return (
        <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={s.header}>
                <Text style={s.eyebrow}>NOTIFICATIONS</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={s.heading}>
                        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
                    </Text>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={markAllRead} style={s.markAllBtn}>
                            <Text style={s.markAllText}>Mark all read</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {loading ? (
                <ActivityIndicator color="#0B0D14" style={{ marginTop: 40 }} />
            ) : notifications.length === 0 ? (
                <View style={s.empty}>
                    <Text style={s.emptyIcon}>🔔</Text>
                    <Text style={s.emptyTitle}>No notifications</Text>
                    <Text style={s.emptyText}>Announcements will appear here.</Text>
                </View>
            ) : (
                notifications.map(n => {
                    const isUnread = !(n.readBy || []).includes(userProfile?.uid);
                    const createdAt = n.createdAt?.toDate?.() || (n.createdAt ? new Date(n.createdAt) : null);
                    return (
                        <TouchableOpacity
                            key={n.id}
                            style={[s.card, isUnread && s.cardUnread]}
                            onPress={() => isUnread && markRead(n.id)}
                            activeOpacity={0.8}
                        >
                            {isUnread && <View style={s.unreadDot} />}
                            <View style={{ flex: 1 }}>
                                <Text style={s.notifTitle}>{n.title}</Text>
                                <Text style={s.notifBody}>{n.body}</Text>
                                <View style={s.notifMeta}>
                                    <View style={s.tag}><Text style={s.tagText}>{n.targetType}</Text></View>
                                    {createdAt && (
                                        <Text style={s.notifTime}>
                                            {createdAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
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
    markAllBtn: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    markAllText: { fontSize: 12, color: '#6B6760' },
    empty: { margin: 24, backgroundColor: '#FAF8F4', borderRadius: 20, borderWidth: 1, borderColor: '#E5E1DA', padding: 40, alignItems: 'center' },
    emptyIcon: { fontSize: 32, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0B0D14', marginBottom: 6 },
    emptyText: { fontSize: 13, color: '#9B9790', textAlign: 'center' },
    card: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 16, flexDirection: 'row', gap: 10 },
    cardUnread: { borderColor: '#0B0D14' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0B0D14', marginTop: 5, flexShrink: 0 },
    notifTitle: { fontSize: 14, fontWeight: '700', color: '#0B0D14', marginBottom: 4 },
    notifBody: { fontSize: 13, color: '#6B6760', lineHeight: 19, marginBottom: 8 },
    notifMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tag: { backgroundColor: '#EDE9E3', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
    tagText: { fontSize: 10, fontWeight: '500', color: '#6B6760' },
    notifTime: { fontSize: 11, color: '#9B9790' },
});