import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function StudentLayout() {
    const { userProfile, loading } = useAuth();
    const [irisChecked, setIrisChecked] = useState(false);
    const [irisEnrolled, setIrisEnrolled] = useState(false);

    useEffect(() => {
        if (!userProfile?.uid) return;

        const unsub = onSnapshot(doc(db, 'students', userProfile.uid), (snap) => {
            if (snap.exists()) {
                const enrolled = snap.data().irisEnrolled === true;
                setIrisEnrolled(enrolled);
            }
            setIrisChecked(true);
        });

        return unsub;
    }, [userProfile]);

    useEffect(() => {
        if (!irisChecked) return;
        if (!irisEnrolled) {
            router.replace('/(student)/enroll-iris');
        }
    }, [irisChecked, irisEnrolled]);

    if (loading || !irisChecked) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3EF' }}>
                <ActivityIndicator color="#0B0D14" />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }} />
    );
}