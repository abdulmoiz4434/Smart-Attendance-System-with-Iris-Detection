import { useState, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { router, useLocalSearchParams } from 'expo-router';

export default function MarkAttendanceScreen() {
    const { lectureId, subjectName } = useLocalSearchParams();
    const { userProfile } = useAuth();
    const [permission, requestPermission] = useCameraPermissions();
    const [phase, setPhase] = useState('ready'); // ready | capturing | uploading | verifying | result
    const [result, setResult] = useState(null);
    const [retries, setRetries] = useState(0);
    const cameraRef = useRef(null);

    const MAX_RETRIES = 3; // Will be replaced by systemConfig.maxIrisRetries in Phase 5

    const startCapture = async () => {
        if (!permission?.granted) {
            const r = await requestPermission();
            if (!r.granted) { Alert.alert('Camera permission required'); return; }
        }
        setPhase('capturing');
    };

    const captureAndVerify = async () => {
        if (!cameraRef.current) return;
        setPhase('uploading');

        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
            const path = `iris/${userProfile.uid}/verify_${lectureId}_${Date.now()}.jpg`;

            const response = await fetch(photo.uri);
            const blob = await response.blob();
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, blob);

            setPhase('verifying');

            const res = await apiClient.post('/api/iris/verify', {
                studentId: userProfile.uid,
                lectureId,
                imagePath: path,
            });

            setResult(res.data);
            setPhase('result');
        } catch (err) {
            const detail = err.response?.data?.detail || 'Verification failed';
            setResult({ matched: false, message: detail, score: 0 });
            setPhase('result');
        }
    };

    const retry = () => {
        setRetries(r => r + 1);
        setResult(null);
        setPhase('capturing');
    };

    // ── Loading states ────────────────────────────────────────────────────────
    if (phase === 'uploading' || phase === 'verifying') {
        return (
            <View style={s.centeredScreen}>
                <ActivityIndicator size="large" color="#0B0D14" />
                <Text style={s.loadingText}>{phase === 'uploading' ? 'Uploading image…' : 'Verifying iris…'}</Text>
            </View>
        );
    }

    // ── Result screen ─────────────────────────────────────────────────────────
    if (phase === 'result' && result) {
        const canRetry = !result.matched && retries < MAX_RETRIES - 1;
        return (
            <View style={s.centeredScreen}>
                <View style={result.matched ? s.successIcon : s.errorIcon}>
                    <Text style={{ fontSize: 32 }}>{result.matched ? '✓' : '✕'}</Text>
                </View>
                <Text style={s.resultTitle}>{result.matched ? 'Attendance Submitted' : 'Iris Not Matched'}</Text>
                <Text style={s.resultSub}>{result.message}</Text>
                {result.score > 0 && (
                    <Text style={s.scoreText}>Confidence: {(result.score * 100).toFixed(1)}%</Text>
                )}

                <View style={s.resultActions}>
                    {canRetry && (
                        <TouchableOpacity style={s.retryBtn} onPress={retry}>
                            <Text style={s.retryBtnText}>Retry ({MAX_RETRIES - 1 - retries} left)</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                        <Text style={s.backBtnText}>Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ── Camera view ───────────────────────────────────────────────────────────
    if (phase === 'capturing') {
        return (
            <View style={s.screen}>
                <View style={s.cameraContainer}>
                    <CameraView ref={cameraRef} style={s.camera} facing="front">
                        <View style={s.overlay}>
                            <View style={s.ovalGuide} />
                            <Text style={s.guideText}>Hold still, then tap Scan</Text>
                        </View>
                    </CameraView>
                </View>

                <View style={s.capturePanel}>
                    <Text style={s.captureTitle}>{subjectName || 'Mark Attendance'}</Text>
                    <Text style={s.captureSub}>Position your eye within the oval guide and ensure good lighting.</Text>
                    <TouchableOpacity style={s.captureBtn} onPress={captureAndVerify}>
                        <Text style={s.captureBtnText}>Scan Iris</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.cancelLink} onPress={() => router.back()}>
                        <Text style={s.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ── Ready screen ──────────────────────────────────────────────────────────
    return (
        <View style={s.centeredScreen}>
            <View style={s.eyebrowPill}>
                <Text style={s.eyebrowText}>MARK ATTENDANCE</Text>
            </View>
            <Text style={s.readyTitle}>{subjectName || 'Mark Attendance'}</Text>
            <Text style={s.readySub}>Your iris will be scanned and matched against your enrolled template.</Text>
            <TouchableOpacity style={s.startBtn} onPress={startCapture}>
                <Text style={s.startBtnText}>Open Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelLink} onPress={() => router.back()}>
                <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#0B0D14' },
    centeredScreen: { flex: 1, backgroundColor: '#F5F3EF', justifyContent: 'center', alignItems: 'center', padding: 32 },
    eyebrowPill: { backgroundColor: '#EDE9E3', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 18 },
    eyebrowText: { fontSize: 9, fontWeight: '500', color: '#9B9790', letterSpacing: 2 },
    readyTitle: { fontSize: 22, fontWeight: '700', color: '#0B0D14', marginBottom: 10, textAlign: 'center' },
    readySub: { fontSize: 13, color: '#6B6760', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    startBtn: { backgroundColor: '#0B0D14', borderRadius: 14, padding: 16, paddingHorizontal: 40, alignItems: 'center', marginBottom: 12 },
    startBtnText: { color: '#F5F3EF', fontSize: 15, fontWeight: '700' },

    cameraContainer: { flex: 1 },
    camera: { flex: 1 },
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
    ovalGuide: { width: 200, height: 260, borderRadius: 130, borderWidth: 3, borderColor: '#F5F3EF', borderStyle: 'dashed', opacity: 0.85 },
    guideText: { color: '#F5F3EF', fontSize: 13, opacity: 0.8 },

    capturePanel: { backgroundColor: '#FAF8F4', padding: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    captureTitle: { fontSize: 18, fontWeight: '700', color: '#0B0D14', marginBottom: 6 },
    captureSub: { fontSize: 13, color: '#6B6760', marginBottom: 20 },
    captureBtn: { backgroundColor: '#0B0D14', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
    captureBtnText: { color: '#F5F3EF', fontSize: 15, fontWeight: '700' },

    loadingText: { marginTop: 20, fontSize: 16, fontWeight: '600', color: '#0B0D14' },

    successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#D4EBD8', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    errorIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5D8D8', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    resultTitle: { fontSize: 22, fontWeight: '700', color: '#0B0D14', marginBottom: 8 },
    resultSub: { fontSize: 13, color: '#6B6760', textAlign: 'center', marginBottom: 8, lineHeight: 20 },
    scoreText: { fontSize: 12, color: '#9B9790', marginBottom: 24 },
    resultActions: { gap: 12, alignItems: 'center' },
    retryBtn: { backgroundColor: '#0B0D14', borderRadius: 14, padding: 14, paddingHorizontal: 36 },
    retryBtnText: { color: '#F5F3EF', fontSize: 14, fontWeight: '700' },
    backBtn: { borderWidth: 1, borderColor: '#E5E1DA', borderRadius: 14, padding: 14, paddingHorizontal: 36 },
    backBtnText: { color: '#6B6760', fontSize: 14 },
    cancelLink: { marginTop: 8, padding: 12 },
    cancelText: { color: '#9B9790', fontSize: 13 },
});