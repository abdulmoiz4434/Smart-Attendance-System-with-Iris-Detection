import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

export default function NotificationsScreen() {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
      <View style={s.headerSection}>
        <Text style={s.eyebrow}>NOTIFICATIONS</Text>
        <Text style={s.title}>Inbox</Text>
      </View>

      {notifications.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No notifications</Text>
        </View>
      ) : (
        notifications.map((n, i) => (
          <View key={i} style={s.notifCard}>
            <Text style={s.notifTitle}>{n.title || 'Notification'}</Text>
            <Text style={s.notifBody}>{n.message || n.body}</Text>
            {n.createdAt && (
              <Text style={s.notifMeta}>{new Date(n.createdAt).toLocaleDateString()}</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },
  topBar: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  emptyCard: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9B9790' },
  notifCard: { marginHorizontal: 24, marginBottom: 10, backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 16 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#0B0D14', marginBottom: 4 },
  notifBody: { fontSize: 13, color: '#6B6760' },
  notifMeta: { fontSize: 11, color: '#9B9790', marginTop: 8 },
});