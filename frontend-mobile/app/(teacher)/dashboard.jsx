import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TeacherDashboard() {
  const { userProfile, logout } = useAuth();
  const [mySubjects, setMySubjects] = useState([]);
  const [todayLectures, setTodayLectures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.uid) loadData();
  }, [userProfile]);

  async function loadData() {
    try {
      const [subRes, lecRes] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get('/api/lectures', { params: { date: getTodayISO() } }),
      ]);
      const mine = subRes.data.filter(s => s.teacherId === userProfile.uid);
      setMySubjects(mine);
      const myIds = mine.map(s => s.subjectId);
      const myLectures = lecRes.data.filter(l => myIds.includes(l.subjectId));
      setTodayLectures(myLectures);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const firstName = userProfile?.name?.split(' ')[0] || userProfile?.email;
  const initials = userProfile?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'T';
  const openLectures = todayLectures.filter(l => l.attendanceOpen).length;

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0B0D14" />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 48 }}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>TEACHER PORTAL</Text>
          <Text style={s.greeting}>Hi, {firstName}</Text>
          <Text style={s.date}>
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <TouchableOpacity
          style={s.bellBtn}
          onPress={() => router.push('/(teacher)/notifications')}
        >
          <Text style={s.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Hero stats card */}
      <View style={s.heroCard}>
        <View style={s.heroStats}>
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{mySubjects.length}</Text>
            <Text style={s.heroLabel}>My Subjects</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{todayLectures.length}</Text>
            <Text style={s.heroLabel}>Today</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroVal}>{openLectures}</Text>
            <Text style={s.heroLabel}>Open</Text>
          </View>
        </View>
      </View>

      {/* Module cards */}
      <Text style={s.sectionLabel}>QUICK ACCESS</Text>
      <View style={s.cardsGrid}>

        <TouchableOpacity
          style={s.moduleCard}
          onPress={() => router.push('/(teacher)/lectures')}
        >
          <View style={s.iconTile}>
            <Text style={s.iconText}>🎓</Text>
          </View>
          <Text style={s.moduleTitle}>Today's Lectures</Text>
          <Text style={s.moduleSub}>
            {todayLectures.length} lecture{todayLectures.length !== 1 ? 's' : ''} · {openLectures} open
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.moduleCard}
          onPress={() => router.push('/(teacher)/subjects')}
        >
          <View style={s.iconTile}>
            <Text style={s.iconText}>📚</Text>
          </View>
          <Text style={s.moduleTitle}>My Subjects</Text>
          <Text style={s.moduleSub}>
            {mySubjects.length} subject{mySubjects.length !== 1 ? 's' : ''} assigned
          </Text>
        </TouchableOpacity>

      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={s.signOutBtn}
        onPress={() =>
          Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
          ])
        }
      >
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  greeting: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  date: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  bellBtn: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FAF8F4', borderWidth: 1, borderColor: '#E5E1DA', justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 20 },

  heroCard: { marginHorizontal: 24, backgroundColor: '#0B0D14', borderRadius: 22, padding: 24, marginBottom: 28 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  heroStat: { alignItems: 'center' },
  heroVal: { fontSize: 28, fontWeight: '700', color: '#F5F3EF' },
  heroLabel: { fontSize: 11, color: '#9B9790', marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: '#2A2E40' },

  sectionLabel: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginHorizontal: 24, marginBottom: 12 },

  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, gap: 12, marginBottom: 28 },
  moduleCard: { flex: 1, minWidth: '44%', backgroundColor: '#FAF8F4', borderRadius: 20, borderWidth: 1, borderColor: '#E5E1DA', padding: 20 },
  iconTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  iconText: { fontSize: 18 },
  moduleTitle: { fontSize: 14, fontWeight: '700', color: '#0B0D14', marginBottom: 4 },
  moduleSub: { fontSize: 11, color: '#9B9790' },

  signOutBtn: { marginHorizontal: 24, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 14, padding: 14, alignItems: 'center' },
  signOutText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
});