import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Enter email and password.'); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // AuthContext picks up the auth state change and routes accordingly
    } catch (err) {
      Alert.alert('Sign-in failed', getFirebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { Alert.alert('Enter your email first.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Email sent', 'Check your inbox for a password reset link.');
    } catch {
      Alert.alert('Error', 'Could not send reset email.');
    }
  };

  return (
    <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <View style={s.eyebrowPill}>
          <Text style={s.eyebrowText}>SMART ATTENDANCE</Text>
        </View>
        <Text style={s.heading}>Welcome back</Text>
        <Text style={s.sub}>Sign in to your account</Text>

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#C4BFB8"
        />

        <Text style={s.label}>Password</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          placeholderTextColor="#C4BFB8"
        />

        <TouchableOpacity onPress={handleForgotPassword} style={s.forgotBtn}>
          <Text style={s.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.submitBtn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#F5F3EF" />
            : <Text style={s.submitText}>Sign In</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getFirebaseErrorMessage(code) {
  const map = {
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/invalid-credential': 'Invalid credentials.',
  };
  return map[code] || 'Sign-in failed. Please try again.';
}

const s = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: '#F5F3EF', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#FAF8F4', borderRadius: 20, borderWidth: 1, borderColor: '#E5E1DA', padding: 32 },
  eyebrowPill: { backgroundColor: '#EDE9E3', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 20 },
  eyebrowText: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2 },
  heading: { fontSize: 28, fontWeight: '700', color: '#0B0D14', marginBottom: 6 },
  sub: { fontSize: 13, color: '#6B6760', marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '500', color: '#6B6760', marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: '#EDE9E3', borderRadius: 14, padding: 12, fontSize: 14, color: '#0B0D14' },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 8 },
  forgotText: { fontSize: 12, color: '#9B9790' },
  submitBtn: { backgroundColor: '#0B0D14', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#F5F3EF', fontWeight: '700', fontSize: 14 },
});