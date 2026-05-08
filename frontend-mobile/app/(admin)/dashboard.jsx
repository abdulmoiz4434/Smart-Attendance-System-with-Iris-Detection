import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { userProfile, logout } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F3EF', padding: 32 }}>
      <Text style={{ fontSize: 9, color: '#9B9790', letterSpacing: 2 }}>ADMIN PORTAL</Text>
      <Text style={{ fontSize: 26, fontWeight: '700', marginTop: 8, color: '#0B0D14' }}>
        Hello, {userProfile?.fullName?.split(' ')[0]}
      </Text>
      <TouchableOpacity onPress={logout} style={{ marginTop: 24, padding: 12, backgroundColor: '#0B0D14', borderRadius: 12 }}>
        <Text style={{ color: '#F5F3EF', textAlign: 'center' }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}