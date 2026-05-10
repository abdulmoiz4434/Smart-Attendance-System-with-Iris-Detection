import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

function getNotifIcon(n) {
  const title = (n.title || '').toLowerCase();
  if (title.includes('approved')) return '✅';
  if (title.includes('reject')) return '❌';
  if (title.includes('warning') || title.includes('shortage') || title.includes('below')) return '⚠️';
  if (title.includes('attendance')) return '📋';
  return '🔔';
}

export default function NotificationsScreen() {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const res = await apiClient.get('/api/notifications');
      setNotifications(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0B0D14" />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
      <View style={s.headerSection}>
        <Text style={s.eyebrow}>NOTIFICATIONS</Text>
        <Text style={s.title}>Inbox</Text>
        <Text style={s.subtitle}>{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</Text>
      </View>

      {notifications.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyEmoji}>🔔</Text>
          <Text style={s.emptyTitle}>All caught up</Text>
          <Text style={s.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        notifications.map((n, i) => (
          <View key={i} style={s.notifCard}>
            <View style={s.notifIconBox}>
              <Text style={s.notifIcon}>{getNotifIcon(n)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.notifTitle}>{n.title || 'Notification'}</Text>
              <Text style={s.notifBody}>{n.message || n.body}</Text>
              {n.createdAt && (
                <Text style={s.notifMeta}>
                  {new Date(n.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },
  topBar: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 24 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  subtitle: { fontSize: 12, color: '#9B9790', marginTop: 4 },
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 20, borderWidth: 1, borderColor: '#E5E1DA', padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0B0D14', marginBottom: 4 },
  emptyText: { fontSize: 13, color: '#9B9790' },
  notifCard: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  notifIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EDE9E3', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifIcon: { fontSize: 18 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#0B0D14', marginBottom: 3 },
  notifBody: { fontSize: 13, color: '#6B6760', lineHeight: 18 },
  notifMeta: { fontSize: 11, color: '#C4BFB8', marginTop: 8 },
});