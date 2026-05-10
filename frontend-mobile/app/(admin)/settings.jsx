import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Switch, Alert
} from 'react-native';
import { router } from 'expo-router';
import apiClient from '../../api/client';

export default function SettingsScreen() {
  const [form, setForm] = useState({
    attendanceThreshold: 75,
    irisMatchThreshold: 0.7,
    maxIrisRetries: 3,
    manualMarkingEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/api/system-config').then(res => {
      const d = res.data;
      setForm({
        attendanceThreshold: d.attendanceThreshold ?? 75,
        irisMatchThreshold: d.irisMatchThreshold ?? 0.7,
        maxIrisRetries: d.maxIrisRetries ?? 3,
        manualMarkingEnabled: d.manualMarkingEnabled ?? false,
      });
      setLoading(false);
    });
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.patch('/api/system-config', form);
      Alert.alert('Saved', 'Configuration updated successfully.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save.');
    } finally { setSaving(false); }
  }

  if (loading) {
    return <View style={s.centered}><ActivityIndicator color="#0B0D14" /></View>;
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
      </View>

      <View style={s.headerSection}>
        <Text style={s.eyebrow}>SYSTEM CONFIGURATION</Text>
        <Text style={s.title}>Settings</Text>
        <Text style={s.sub}>Changes apply immediately across the system.</Text>
      </View>

      <View style={s.card}>
        <Field label="Attendance Shortage Threshold (%)" hint="Students below this % will see a shortage warning.">
          <TextInput
            style={s.input}
            value={String(form.attendanceThreshold)}
            onChangeText={v => set('attendanceThreshold', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
            placeholder="75"
            placeholderTextColor="#C4BFB8"
          />
        </Field>

        <Field label="Iris Match Threshold (0.0 – 1.0)" hint="Minimum cosine similarity to accept an iris match.">
          <TextInput
            style={s.input}
            value={String(form.irisMatchThreshold)}
            onChangeText={v => set('irisMatchThreshold', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
            placeholder="0.70"
            placeholderTextColor="#C4BFB8"
          />
        </Field>

        <Field label="Max Iris Retries per Lecture">
          <TextInput
            style={s.input}
            value={String(form.maxIrisRetries)}
            onChangeText={v => set('maxIrisRetries', parseInt(v) || 1)}
            keyboardType="number-pad"
            placeholder="3"
            placeholderTextColor="#C4BFB8"
          />
        </Field>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Manual Marking</Text>
            <Text style={s.toggleSub}>Allow teachers to manually mark student attendance.</Text>
          </View>
          <Switch
            value={form.manualMarkingEnabled}
            onValueChange={v => set('manualMarkingEnabled', v)}
            trackColor={{ false: '#E5E1DA', true: '#0B0D14' }}
            thumbColor="#F5F3EF"
          />
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#F5F3EF" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 13, fontWeight: '500', color: '#0B0D14', marginBottom: 6 }}>{label}</Text>
      {children}
      {hint && <Text style={{ fontSize: 11, color: '#9B9790', marginTop: 4 }}>{hint}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  headerSection: { paddingHorizontal: 24, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  sub: { fontSize: 13, color: '#6B6760', marginTop: 4 },
  card: { marginHorizontal: 24, backgroundColor: '#FAF8F4', borderRadius: 20, borderWidth: 1, borderColor: '#E5E1DA', padding: 24 },
  input: { backgroundColor: '#EDE9E3', borderRadius: 12, padding: 12, fontSize: 14, color: '#0B0D14' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderColor: '#E5E1DA', marginTop: 4, marginBottom: 20, gap: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  toggleSub: { fontSize: 12, color: '#9B9790', marginTop: 2 },
  saveBtn: { backgroundColor: '#0B0D14', borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#F5F3EF', fontWeight: '700', fontSize: 15 },
});