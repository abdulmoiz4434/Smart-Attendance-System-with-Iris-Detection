import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal
} from 'react-native';
import { router } from 'expo-router';
import apiClient from '../../api/client';

const ROLES = ['student', 'teacher', 'admin'];
const FILTERS = ['all', 'student', 'teacher', 'admin'];

function defaultForm() {
  return {
    fullName: '', email: '', password: '', role: 'student',
    cnic: '', dateOfBirth: '', phone: '',
    registrationId: '', program: '', fatherName: '',
    employeeId: '', department: '',
  };
}

export default function UsersScreen() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, [filter]);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/users', {
        params: filter !== 'all' ? { role: filter } : {},
      });
      setUsers(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    setFormError('');
    if (!form.fullName || !form.email || !form.password || !form.cnic || !form.dateOfBirth) {
      setFormError('Please fill all required fields.'); return;
    }
    setSaving(true);
    try {
      await apiClient.post('/api/admin/users', form);
      setShowCreate(false);
      setForm(defaultForm());
      loadUsers();
    } catch (e) {
      setFormError(e.response?.data?.detail || 'Failed to create user');
    } finally { setSaving(false); }
  }

  async function handleDeactivate(uid) {
    Alert.alert('Deactivate User', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive', onPress: async () => {
          await apiClient.delete(`/api/admin/users/${uid}`);
          loadUsers();
        }
      }
    ]);
  }

  async function handleResetIris(uid) {
    Alert.alert('Reset Iris', 'Student must re-enroll on next login.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', onPress: async () => {
          await apiClient.post(`/api/admin/users/${uid}/reset-iris`);
          Alert.alert('Done', 'Iris enrollment reset.');
        }
      }
    ]);
  }

  const f = form;
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => { setForm(defaultForm()); setFormError(''); setShowCreate(true); }}>
          <Text style={s.addBtnText}>+ Add User</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerSection}>
        <Text style={s.eyebrow}>USER MANAGEMENT</Text>
        <Text style={s.title}>Users</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabStrip} contentContainerStyle={{ paddingHorizontal: 24, gap: 8, alignItems: 'center' }}>
        {FILTERS.map(r => (
          <TouchableOpacity key={r} style={[s.tab, filter === r && s.tabActive]} onPress={() => setFilter(r)}>
            <Text style={[s.tabText, filter === r && s.tabTextActive]}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* User list */}
      {loading ? (
        <View style={s.centered}><ActivityIndicator color="#0B0D14" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {users.length === 0 && (
            <View style={s.emptyCard}><Text style={s.emptyText}>No users found</Text></View>
          )}
          {users.map(user => (
            <View key={user.uid} style={s.userCard}>
              <View style={s.userAvatar}>
                <Text style={s.userAvatarText}>
                  {user.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{user.fullName}</Text>
                <Text style={s.userMeta}>{user.email}</Text>
                <View style={s.badgeRow}>
                  <View style={[s.badge, { backgroundColor: roleColor(user.role) }]}>
                    <Text style={s.badgeText}>{user.role}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: user.status === 'active' ? '#D4EBD8' : '#F5D8D8' }]}>
                    <Text style={[s.badgeText, { color: user.status === 'active' ? '#174520' : '#8A1E1E' }]}>{user.status}</Text>
                  </View>
                </View>
              </View>
              <View style={s.actionCol}>
                {user.status === 'active' && (
                  <TouchableOpacity style={s.dangerBtn} onPress={() => handleDeactivate(user.uid)}>
                    <Text style={s.dangerBtnText}>Deactivate</Text>
                  </TouchableOpacity>
                )}
                {user.role === 'student' && (
                  <TouchableOpacity style={s.ghostBtn} onPress={() => handleResetIris(user.uid)}>
                    <Text style={s.ghostBtnText}>Reset Iris</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create User Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <ScrollView style={s.modal} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Create New User</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {formError ? <View style={s.errBanner}><Text style={s.errText}>{formError}</Text></View> : null}

          <Field label="Full Name *"><TextInput style={s.input} value={f.fullName} onChangeText={v => set('fullName', v)} placeholder="Muhammad Ali" placeholderTextColor="#C4BFB8" /></Field>
          <Field label="Email *"><TextInput style={s.input} value={f.email} onChangeText={v => set('email', v)} placeholder="user@example.com" placeholderTextColor="#C4BFB8" keyboardType="email-address" autoCapitalize="none" /></Field>
          <Field label="Password *"><TextInput style={s.input} value={f.password} onChangeText={v => set('password', v)} placeholder="Min 8 characters" placeholderTextColor="#C4BFB8" secureTextEntry /></Field>
          <Field label="CNIC (13 digits) *"><TextInput style={s.input} value={f.cnic} onChangeText={v => set('cnic', v)} placeholder="3310012345678" placeholderTextColor="#C4BFB8" keyboardType="number-pad" maxLength={13} /></Field>
          <Field label="Date of Birth * (YYYY-MM-DD)"><TextInput style={s.input} value={f.dateOfBirth} onChangeText={v => set('dateOfBirth', v)} placeholder="2000-01-15" placeholderTextColor="#C4BFB8" /></Field>
          <Field label="Phone"><TextInput style={s.input} value={f.phone} onChangeText={v => set('phone', v)} placeholder="03001234567" placeholderTextColor="#C4BFB8" keyboardType="phone-pad" /></Field>

          <Field label="Role">
            <View style={s.roleRow}>
              {ROLES.map(r => (
                <TouchableOpacity key={r} style={[s.roleChip, f.role === r && s.roleChipActive]} onPress={() => set('role', r)}>
                  <Text style={[s.roleChipText, f.role === r && s.roleChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {f.role === 'student' && <>
            <Field label="Registration ID *"><TextInput style={s.input} value={f.registrationId} onChangeText={v => set('registrationId', v)} placeholder="BS-CS-F24-045" placeholderTextColor="#C4BFB8" /></Field>
            <Field label="Program *"><TextInput style={s.input} value={f.program} onChangeText={v => set('program', v)} placeholder="BS Computer Science" placeholderTextColor="#C4BFB8" /></Field>
            <Field label="Father's Name"><TextInput style={s.input} value={f.fatherName} onChangeText={v => set('fatherName', v)} placeholder="Muhammad Akram" placeholderTextColor="#C4BFB8" /></Field>
          </>}

          {f.role === 'teacher' && <>
            <Field label="Employee ID *"><TextInput style={s.input} value={f.employeeId} onChangeText={v => set('employeeId', v)} placeholder="EMP-001" placeholderTextColor="#C4BFB8" /></Field>
            <Field label="Department *"><TextInput style={s.input} value={f.department} onChangeText={v => set('department', v)} placeholder="Computer Science" placeholderTextColor="#C4BFB8" /></Field>
          </>}

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#F5F3EF" /> : <Text style={s.submitBtnText}>Create User</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '500', color: '#6B6760', marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

function roleColor(role) {
  return role === 'admin' ? '#E8D8F5' : role === 'teacher' ? '#D8E8F5' : '#EDE9E3';
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3EF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8 },
  backBtn: {}, backText: { fontSize: 14, color: '#6B6760', fontWeight: '500' },
  addBtn: { backgroundColor: '#0B0D14', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
  addBtnText: { color: '#F5F3EF', fontWeight: '700', fontSize: 13 },
  headerSection: { paddingHorizontal: 24, paddingBottom: 16 },
  eyebrow: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B0D14' },
  tabStrip: { marginBottom: 16, flexGrow: 0, flexShrink: 0 },
  tab: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 6 },
  tabActive: { backgroundColor: '#0B0D14', borderColor: '#0B0D14' },
  tabText: { fontSize: 13, color: '#6B6760' },
  tabTextActive: { color: '#F5F3EF' },
  emptyCard: { backgroundColor: '#FAF8F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E1DA', padding: 24, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 13, color: '#9B9790' },
  userCard: { backgroundColor: '#FAF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#E5E1DA', padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  userAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: '#F5F3EF', fontWeight: '700', fontSize: 14 },
  userName: { fontSize: 14, fontWeight: '600', color: '#0B0D14' },
  userMeta: { fontSize: 12, color: '#9B9790', marginTop: 1 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#0B0D14' },
  actionCol: { gap: 6, alignItems: 'flex-end' },
  dangerBtn: { backgroundColor: '#F5D8D8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  dangerBtnText: { fontSize: 11, fontWeight: '600', color: '#8A1E1E' },
  ghostBtn: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  ghostBtnText: { fontSize: 11, color: '#6B6760' },
  modal: { flex: 1, backgroundColor: '#F5F3EF', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0B0D14' },
  modalClose: { fontSize: 18, color: '#9B9790' },
  errBanner: { backgroundColor: '#F5D8D8', borderRadius: 10, padding: 12, marginBottom: 14 },
  errText: { fontSize: 13, color: '#8A1E1E' },
  input: { backgroundColor: '#EDE9E3', borderRadius: 12, padding: 12, fontSize: 14, color: '#0B0D14' },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  roleChipActive: { backgroundColor: '#0B0D14', borderColor: '#0B0D14' },
  roleChipText: { fontSize: 13, color: '#6B6760' },
  roleChipTextActive: { color: '#F5F3EF' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#6B6760' },
  submitBtn: { flex: 2, backgroundColor: '#0B0D14', borderRadius: 12, padding: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#F5F3EF' },
});