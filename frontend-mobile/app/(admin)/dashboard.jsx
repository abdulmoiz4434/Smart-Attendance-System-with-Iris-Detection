import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

export default function AdminDashboard() {
  const { userProfile, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [usersRes, subjectsRes, configRes] = await Promise.all([
        apiClient.get('/api/admin/users'),
        apiClient.get('/api/subjects'),
        apiClient.get('/api/system-config'),
      ]);
      const users = usersRes.data;
      setStats({
        totalUsers: users.length,
        students: users.filter(u => u.role === 'student').length,
        teachers: users.filter(u => u.role === 'teacher').length,
        subjects: subjectsRes.data.length,
        threshold: configRes.data?.attendanceThreshold || 75,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const firstName = userProfile?.name?.split(' ')[0] || userProfile?.email;

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0B0D14" />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>ADMIN PORTAL</Text>
          <Text style={s.greeting}>Hi, {firstName}</Text>
          <Text style={s.date}>
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.avatarTile}>
          <Text style={s.avatarText}>
            {userProfile?.name?.split(' ').map(w => w[0]).join('').slice(0, 2) || 'A'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats grid */}
      {stats && (
        <View style={s.statsGrid}>
          {[
            { label: 'Total Users', value: stats.totalUsers },
            { label: 'Students', value: stats.students },
            { label: 'Teachers', value: stats.teachers },
            { label: 'Subjects', value: stats.subjects },
          ].map(item => (
            <View key={item.label} style={s.statCard}>
              <Text style={s.statVal}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick actions */}
      <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
      <View style={s.actionsGrid}>
        {[
          { label: 'Users',     icon: '👥', path: '/(admin)/users'     },
          { label: 'Subjects',  icon: '📚', path: '/(admin)/subjects'  },
          { label: 'Lectures',  icon: '🎓', path: '/(admin)/lectures'  },
          { label: 'Reports',   icon: '📊', path: '/(admin)/reports'   },
          { label: 'Settings',  icon: '⚙️', path: '/(admin)/settings'  },
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={s.actionCard}
            onPress={() => item.path && router.push(item.path)}
          >
            <View style={s.iconTile}><Text style={{ fontSize: 18 }}>{item.icon}</Text></View>
            <Text style={s.actionLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {stats && (
        <View style={s.configBanner}>
          <Text style={s.configText}>Attendance threshold: <Text style={{ fontWeight: '700' }}>{stats.threshold}%</Text></Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, paddingTop: 52 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  greeting: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  date: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  avatarTile: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#F5F3EF', fontWeight: '700', fontSize: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, gap: 12, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '40%', backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 18 },
  statVal: { fontSize: 28, fontWeight: '700', color: '#0B0D14' },
  statLabel: { fontSize: 11, color: '#9B9790', marginTop: 4 },
  sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 10 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, gap: 12, marginBottom: 24 },
  actionCard: { flex: 1, minWidth: '40%', backgroundColor: '#FAF8F4', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1DA', padding: 18, alignItems: 'flex-start' },
  iconTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: '#0B0D14' },
  configBanner: { marginHorizontal: 24, backgroundColor: '#EDE9E3', borderRadius: 14, padding: 14 },
  configText: { fontSize: 13, color: '#6B6760' },
});