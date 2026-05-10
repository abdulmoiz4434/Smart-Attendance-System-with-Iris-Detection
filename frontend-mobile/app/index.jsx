import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' }}>
        <ActivityIndicator color="#0B0D14" />
      </View>
    );
  }

  if (!userProfile) return <Redirect href="/auth/login" />;

  const roleRoutes = {
    admin: '/(admin)/dashboard',
    teacher: '/(teacher)/dashboard',
    student: '/(student)/dashboard',
  };

  return <Redirect href={roleRoutes[userProfile.role] || '/auth/login'} />;
}