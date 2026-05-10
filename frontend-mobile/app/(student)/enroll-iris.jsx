import { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router } from 'expo-router';

const REQUIRED_FRAMES = 3;

export default function EnrollIrisScreen() {
    const { userProfile } = useAuth();
    const [permission, requestPermission] = useCameraPermissions();
    const [phase, setPhase] = useState('intro');   // intro | capture | uploading | enrolling | done | error
    const [capturedPaths, setCapturedPaths] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [countdown, setCountdown] = useState(null);
    const cameraRef = useRef(null);

    // Watch irisEnrolled in Firestore — navigate away as soon as it flips true
    useEffect(() => {
        if (!userProfile?.uid) return;
        const unsub = onSnapshot(doc(db, 'students', userProfile.uid), (snap) => {
            if (snap.exists() && snap.data().irisEnrolled) {
                router.replace('/(student)/dashboard');
            }
        });
        return unsub;
    }, [userProfile]);

    const requestCameraAndStart = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera permission required', 'Please allow camera access in your device settings.');
                return;
            }
        }
        setPhase('capture');
        setCapturedPaths([]);
    };

    const captureFrame = async () => {
        if (!cameraRef.current || capturedPaths.length >= REQUIRED_FRAMES) return;

        // 3-second countdown
        for (let i = 3; i >= 1; i--) {
            setCountdown(i);
            await sleep(1000);
        }
        setCountdown(null);

        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });

            setPhase('uploading');

            // Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', {
                uri: photo.uri,
                type: 'image/jpeg',
                name: `enroll_${capturedPaths.length + 1}_${Date.now()}.jpg`,
            });
            formData.append('upload_preset', 'iris_unsigned');
            formData.append('folder', `iris/${userProfile.uid}`);

            let cloudRes;
try {
    cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/dvqwqpwyo/image/upload`,
        { method: 'POST', body: formData }
    );
    console.log('FETCH STATUS:', cloudRes.status, cloudRes.ok);
} catch (fetchErr) {
    console.error('FETCH FAILED (network error):', fetchErr.message);
    throw fetchErr;
}
const cloudData = await cloudRes.json();
console.log('CLOUDINARY RESPONSE:', JSON.stringify(cloudData));
if (!cloudData.secure_url) throw new Error(`Cloudinary upload failed: ${JSON.stringify(cloudData)}`);

            const newPaths = [...capturedPaths, cloudData.secure_url];
            setCapturedPaths(newPaths);

            if (newPaths.length < REQUIRED_FRAMES) {
                setPhase('capture');
            } else {
                // All 3 frames captured — call enroll endpoint
                setPhase('enrolling');
                await enrollIris(newPaths);
            }
        } catch (err) {
            console.error('CAPTURE ERROR:', err);
            console.error('ERROR MESSAGE:', err.message);
            console.error('ERROR STACK:', err.stack);
            setErrorMsg(err.message || 'Image capture failed. Please try again.');
            setPhase('error');
        }
    };

    const enrollIris = async (paths) => {
        try {
            await apiClient.post('/api/iris/enroll', {
                studentId: userProfile.uid,
                imageStoragePaths: paths,
            });
            setPhase('done');
            // Firestore listener above will redirect
        } catch (err) {
            const detail = err.response?.data?.detail || 'Enrollment failed. Please try again.';
            setErrorMsg(detail);
            setPhase('error');
        }
    };

    const reset = () => {
        setCapturedPaths([]);
        setErrorMsg('');
        setPhase('intro');
    };

    // ── Render ──────────────────────────────────────────────────────────────────

    if (phase === 'capture') {
        return (
            <View style={s.screen}>
                <View style={s.cameraContainer}>
                    <CameraView ref={cameraRef} style={s.camera} facing="front" />
                    {/* Iris guide overlay — outside CameraView, absolutely positioned */}
                    <View style={s.overlay}>
                        <View style={s.ovalGuide} />
                        {countdown !== null && (
                            <Text style={s.countdown}>{countdown}</Text>
                        )}
                    </View>
                </View>

                <View style={s.capturePanel}>
                    <Text style={s.captureTitle}>Frame {capturedPaths.length + 1} of {REQUIRED_FRAMES}</Text>
                    <Text style={s.captureSub}>
                        Position your eye within the oval and hold still.
                    </Text>

                    {/* Progress dots */}
                    <View style={s.dots}>
                        {[0, 1, 2].map(i => (
                            <View
                                key={i}
                                style={[s.dot, i < capturedPaths.length && s.dotFilled]}
                            />
                        ))}
                    </View>

                    <TouchableOpacity style={s.captureBtn} onPress={captureFrame}>
                        <Text style={s.captureBtnText}>Capture</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (phase === 'uploading' || phase === 'enrolling') {
        return (
            <View style={s.centeredScreen}>
                <ActivityIndicator size="large" color="#0B0D14" />
                <Text style={s.loadingText}>
                    {phase === 'uploading' ? 'Uploading frame…' : 'Processing iris…'}
                </Text>
                {phase === 'enrolling' && (
                    <Text style={s.loadingSub}>This may take a few seconds.</Text>
                )}
            </View>
        );
    }

    if (phase === 'done') {
        return (
            <View style={s.centeredScreen}>
                <View style={s.successIcon}>
                    <Text style={{ fontSize: 32 }}>✓</Text>
                </View>
                <Text style={s.doneTitle}>Iris Enrolled!</Text>
                <Text style={s.doneSub}>Redirecting to your dashboard…</Text>
                <ActivityIndicator color="#0B0D14" style={{ marginTop: 16 }} />
            </View>
        );
    }

    if (phase === 'error') {
        return (
            <View style={s.centeredScreen}>
                <View style={s.errorIcon}>
                    <Text style={{ fontSize: 28 }}>✕</Text>
                </View>
                <Text style={s.errorTitle}>Enrollment Failed</Text>
                <Text style={s.errorSub}>{errorMsg}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={reset}>
                    <Text style={s.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Intro screen
    return (
        <ScrollView contentContainerStyle={s.introScreen}>
            <View style={s.introCard}>
                <View style={s.eyebrowPill}>
                    <Text style={s.eyebrowText}>IRIS ENROLLMENT</Text>
                </View>
                <Text style={s.introTitle}>Set up Iris Recognition</Text>
                <Text style={s.introBody}>
                    Before you can mark attendance, you need to enroll your iris. This is a one-time setup.
                </Text>

                <View style={s.steps}>
                    {[
                        { num: '1', text: 'Allow camera access when prompted' },
                        { num: '2', text: 'Position your eye within the oval guide' },
                        { num: '3', text: 'Capture 3 frames for the best accuracy' },
                    ].map(step => (
                        <View key={step.num} style={s.stepRow}>
                            <View style={s.stepNum}><Text style={s.stepNumText}>{step.num}</Text></View>
                            <Text style={s.stepText}>{step.text}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={s.startBtn} onPress={requestCameraAndStart}>
                    <Text style={s.startBtnText}>Start Enrollment</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#0B0D14' },
    centeredScreen: { flex: 1, backgroundColor: '#F5F3EF', justifyContent: 'center', alignItems: 'center', padding: 32 },
    introScreen: { flexGrow: 1, backgroundColor: '#F5F3EF', padding: 24, justifyContent: 'center' },
    introCard: { backgroundColor: '#FAF8F4', borderRadius: 20, borderWidth: 1, borderColor: '#E5E1DA', padding: 28 },
    eyebrowPill: { backgroundColor: '#EDE9E3', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 18 },
    eyebrowText: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2 },
    introTitle: { fontSize: 24, fontWeight: '700', color: '#0B0D14', marginBottom: 10 },
    introBody: { fontSize: 13, color: '#6B6760', lineHeight: 20, marginBottom: 24 },
    steps: { gap: 14, marginBottom: 28 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0B0D14', justifyContent: 'center', alignItems: 'center' },
    stepNumText: { color: '#F5F3EF', fontSize: 13, fontWeight: '700' },
    stepText: { fontSize: 13, color: '#0B0D14', flex: 1 },
    startBtn: { backgroundColor: '#0B0D14', borderRadius: 14, padding: 16, alignItems: 'center' },
    startBtnText: { color: '#F5F3EF', fontSize: 15, fontWeight: '700' },

    // Camera
    cameraContainer: { flex: 1, position: 'relative' },
    camera: { flex: 1 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },    ovalGuide: {
        width: 200, height: 260,
        borderRadius: 130,
        borderWidth: 3, borderColor: '#F5F3EF',
        borderStyle: 'dashed',
        opacity: 0.8,
    },
    countdown: {
        position: 'absolute',
        fontSize: 72, fontWeight: '800',
        color: '#F5F3EF', opacity: 0.9,
    },

    // Capture panel
    capturePanel: { backgroundColor: '#FAF8F4', padding: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    captureTitle: { fontSize: 18, fontWeight: '700', color: '#0B0D14', marginBottom: 6 },
    captureSub: { fontSize: 13, color: '#6B6760', marginBottom: 20 },
    dots: { flexDirection: 'row', gap: 10, marginBottom: 22 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E1DA' },
    dotFilled: { backgroundColor: '#0B0D14' },
    captureBtn: { backgroundColor: '#0B0D14', borderRadius: 14, padding: 16, alignItems: 'center' },
    captureBtnText: { color: '#F5F3EF', fontSize: 15, fontWeight: '700' },

    // Loading
    loadingText: { marginTop: 20, fontSize: 16, fontWeight: '600', color: '#0B0D14' },
    loadingSub: { marginTop: 8, fontSize: 13, color: '#9B9790' },

    // Done
    successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#D4EBD8', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    doneTitle: { fontSize: 22, fontWeight: '700', color: '#0B0D14', marginBottom: 8 },
    doneSub: { fontSize: 13, color: '#6B6760' },

    // Error
    errorIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5D8D8', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    errorTitle: { fontSize: 22, fontWeight: '700', color: '#0B0D14', marginBottom: 8 },
    errorSub: { fontSize: 13, color: '#6B6760', textAlign: 'center', marginBottom: 28 },
    retryBtn: { backgroundColor: '#0B0D14', borderRadius: 14, padding: 14, paddingHorizontal: 32 },
    retryBtnText: { color: '#F5F3EF', fontSize: 14, fontWeight: '700' },
});