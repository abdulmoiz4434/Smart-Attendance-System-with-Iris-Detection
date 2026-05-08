import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import FormField, { Input } from '../../components/shared/FormField';
import { getConfig, updateConfig } from '../../api/adminApi';

export default function ConfigPage() {
    const [config, setConfig] = useState(null);
    const [form, setForm] = useState({});
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getConfig().then(r => {
            setConfig(r.data);
            setForm({
                attendanceThreshold: r.data.attendanceThreshold,
                irisMatchThreshold: r.data.irisMatchThreshold,
                maxIrisRetries: r.data.maxIrisRetries,
                manualMarkingEnabled: r.data.manualMarkingEnabled,
            });
            setLoading(false);
        });
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        await updateConfig(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    if (loading) return <AdminLayout><p style={muted}>Loading…</p></AdminLayout>;

    return (
        <AdminLayout>
            <span style={eyebrow}>SYSTEM CONFIGURATION</span>
            <h1 style={heading}>System Config</h1>
            <p style={sub}>Adjust thresholds and global toggles. Changes apply immediately.</p>

            <div style={card}>
                <form onSubmit={handleSave}>
                    {saved && <div style={successBanner}>Configuration saved!</div>}

                    <FormField label="Attendance Shortage Threshold (%)">
                        <Input
                            type="number" min={0} max={100}
                            value={form.attendanceThreshold}
                            onChange={e => setForm({ ...form, attendanceThreshold: +e.target.value })}
                        />
                        <p style={hint}>Students below this % will see a shortage warning.</p>
                    </FormField>

                    <FormField label="Iris Match Threshold (0 – 1 cosine similarity)">
                        <Input
                            type="number" min={0} max={1} step={0.01}
                            value={form.irisMatchThreshold}
                            onChange={e => setForm({ ...form, irisMatchThreshold: +e.target.value })}
                        />
                        <p style={hint}>Minimum cosine similarity to accept an iris match.</p>
                    </FormField>

                    <FormField label="Max Iris Retries per Lecture">
                        <Input
                            type="number" min={1} max={10}
                            value={form.maxIrisRetries}
                            onChange={e => setForm({ ...form, maxIrisRetries: +e.target.value })}
                        />
                    </FormField>

                    <div style={toggleRow}>
                        <div>
                            <p style={toggleLabel}>Manual Marking</p>
                            <p style={toggleSub}>Allow teachers to manually mark student attendance.</p>
                        </div>
                        <label style={toggle}>
                            <input
                                type="checkbox"
                                checked={form.manualMarkingEnabled}
                                onChange={e => setForm({ ...form, manualMarkingEnabled: e.target.checked })}
                                style={{ display: 'none' }}
                            />
                            <div style={{ ...toggleTrack, background: form.manualMarkingEnabled ? '#0B0D14' : '#E5E1DA' }}>
                                <div style={{ ...toggleThumb, transform: form.manualMarkingEnabled ? 'translateX(22px)' : 'translateX(2px)' }} />
                            </div>
                        </label>
                    </div>

                    <button type="submit" style={primaryBtn}>Save Changes</button>
                </form>
            </div>
        </AdminLayout>
    );
}

const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14', marginBottom: '4px' };
const sub = { fontSize: '13px', color: '#6B6760', marginBottom: '28px' };
const card = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '28px', maxWidth: 540 };
const hint = { fontSize: '11px', color: '#9B9790', marginTop: 4 };
const toggleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid #E5E1DA', marginTop: 8, marginBottom: 20 };
const toggleLabel = { fontSize: 14, fontWeight: 600, color: '#0B0D14', margin: 0 };
const toggleSub = { fontSize: 12, color: '#9B9790', margin: '2px 0 0' };
const toggle = { cursor: 'pointer' };
const toggleTrack = { width: 46, height: 26, borderRadius: 100, transition: 'background 0.2s', position: 'relative' };
const toggleThumb = { position: 'absolute', top: 3, width: 20, height: 20, background: '#F5F3EF', borderRadius: '50%', transition: 'transform 0.2s' };
const primaryBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const successBanner = { background: '#D4EBD8', color: '#174520', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' };
const muted = { color: '#9B9790', fontSize: '13px' };