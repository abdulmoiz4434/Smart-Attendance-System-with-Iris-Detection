import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

/**
 * Real-time notifications hook.
 * Fetches all notifications and filters client-side per the plan spec.
 */
export function useNotifications() {
    const { userProfile } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!userProfile?.uid) return;

        const q = query(
            collection(db, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(100),
        );

        const unsub = onSnapshot(q, snap => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Client-side targeting filter
            const relevant = all.filter(n => {
                if (n.targetType === 'all') return true;
                if (n.targetType === 'role' && n.targetValue === userProfile.role) return true;
                if (n.targetType === 'individual' && n.targetValue === userProfile.uid) return true;
                // 'subject' targeting — checked in component where subject list is available
                return false;
            });

            setNotifications(relevant);
            setUnreadCount(relevant.filter(n => !(n.readBy || []).includes(userProfile.uid)).length);
        });

        return unsub;
    }, [userProfile]);

    return { notifications, unreadCount };
}