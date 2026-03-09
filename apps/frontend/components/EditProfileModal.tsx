'use client';

import { useState, useEffect } from 'react';
import { X, User, Mail, Ruler, Weight, Target, ChevronDown, ChevronUp, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { userService, UpdateProfilePayload } from '@/lib/api/users';
import { healthService } from '@/lib/api/health';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called after a successful save with the new values so the parent can update global state */
    onSaved: (updated: UpdateProfilePayload) => void;
    /** Current values to pre-fill the form */
    initialValues: {
        name: string;
        email: string;
        age?: number;
        weight?: number;
        targetWeight?: number;
        height?: number;
    };
}

type AlertState = { type: 'success' | 'error'; message: string } | null;

export default function EditProfileModal({
    isOpen,
    onClose,
    onSaved,
    initialValues,
}: EditProfileModalProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState('');
    const [targetWeight, setTargetWeight] = useState('');
    const [height, setHeight] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState<AlertState>(null);

    // Sync form when initialValues change (modal open)
    useEffect(() => {
        if (isOpen) {
            setName(initialValues.name || '');
            setEmail(initialValues.email || '');
            setAge(initialValues.age != null ? String(initialValues.age) : '');
            setWeight(initialValues.weight != null ? String(initialValues.weight) : '');
            setTargetWeight(initialValues.targetWeight != null ? String(initialValues.targetWeight) : '');
            setHeight(initialValues.height != null ? String(initialValues.height) : '');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPassword(false);
            setAlert(null);
        }
    }, [isOpen, initialValues]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setAlert(null);

        // Validate password if section is open
        if (showPassword && (currentPassword || newPassword || confirmPassword)) {
            if (!currentPassword) {
                setAlert({ type: 'error', message: 'Ingresá tu contraseña actual.' });
                return;
            }
            if (newPassword.length < 6) {
                setAlert({ type: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
                return;
            }
            if (newPassword !== confirmPassword) {
                setAlert({ type: 'error', message: 'Las contraseñas nuevas no coinciden.' });
                return;
            }
        }

        setSaving(true);
        try {
            const profilePayload: UpdateProfilePayload = {};
            if (name.trim()) profilePayload.name = name.trim();
            if (email.trim()) profilePayload.email = email.trim();
            if (age !== '') profilePayload.age = Number(age);
            if (weight !== '') profilePayload.weight = Number(weight);
            if (targetWeight !== '') profilePayload.targetWeight = Number(targetWeight);
            if (height !== '') profilePayload.height = Number(height);

            await userService.updateProfile(profilePayload);

            if (showPassword && currentPassword && newPassword) {
                await userService.updatePassword({ currentPassword, newPassword });
            }

            // Sync the weight with the health microservice to ensure accurate Calorie computations
            if (profilePayload.weight !== undefined) {
                try {
                    await healthService.updateGoals({ weightKg: profilePayload.weight });
                } catch (healthErr) {
                    console.error('Failed to sync weight to health service:', healthErr);
                    // Decide if we want to fail the whole process or just log. We just log for now.
                }
            }

            setAlert({ type: 'success', message: '¡Perfil actualizado correctamente!' });
            onSaved(profilePayload);
            setTimeout(() => {
                onClose();
            }, 1200);
        } catch (err: any) {
            setAlert({ type: 'error', message: err.message || 'Error al guardar los cambios.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-100">Editar Perfil</h2>
                        <p className="text-xs text-zinc-500 mt-0.5">Actualizá tu información personal</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">

                    {/* Alert */}
                    {alert && (
                        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${alert.type === 'success'
                            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                            : 'bg-red-500/10 border border-red-500/30 text-red-400'
                            }`}>
                            {alert.type === 'success'
                                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                                : <AlertCircle className="w-4 h-4 shrink-0" />}
                            {alert.message}
                        </div>
                    )}

                    {/* Name + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <User className="w-3 h-3" /> Nombre
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Tu nombre"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Mail className="w-3 h-3" /> Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Biometrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Edad</label>
                            <input
                                type="number"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="—"
                                min={10} max={120}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Weight className="w-3 h-3" /> Peso (kg)
                            </label>
                            <div className="flex items-center gap-1">
                                <select
                                    value={weight === '' ? '' : Math.floor(Number(weight))}
                                    onChange={(e) => {
                                        const newInt = e.target.value;
                                        const currentDec = weight === '' ? '0' : Math.round((Number(weight) - Math.floor(Number(weight))) * 10).toString();
                                        setWeight(`${newInt}.${currentDec}`);
                                    }}
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-rose-500 transition-colors appearance-none"
                                >
                                    <option value="" disabled>Kg</option>
                                    {Array.from({ length: 271 }, (_, i) => i + 30).map((kg) => (
                                        <option key={kg} value={kg}>{kg}</option>
                                    ))}
                                </select>
                                <span className="text-sm font-bold text-zinc-500">.</span>
                                <select
                                    value={weight === '' ? '' : Math.round((Number(weight) - Math.floor(Number(weight))) * 10)}
                                    onChange={(e) => {
                                        const newDec = e.target.value;
                                        const currentInt = weight === '' ? '75' : Math.floor(Number(weight)).toString();
                                        setWeight(`${currentInt}.${newDec}`);
                                    }}
                                    className="w-16 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-rose-500 transition-colors appearance-none text-center"
                                >
                                    <option value="" disabled>Gr</option>
                                    {Array.from({ length: 10 }, (_, i) => i).map((g) => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Target className="w-3 h-3" /> Meta (kg)
                            </label>
                            <div className="flex items-center gap-1">
                                <select
                                    value={targetWeight === '' ? '' : Math.floor(Number(targetWeight))}
                                    onChange={(e) => {
                                        const newInt = e.target.value;
                                        const currentDec = targetWeight === '' ? '0' : Math.round((Number(targetWeight) - Math.floor(Number(targetWeight))) * 10).toString();
                                        setTargetWeight(`${newInt}.${currentDec}`);
                                    }}
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-rose-500 transition-colors appearance-none"
                                >
                                    <option value="" disabled>Kg</option>
                                    {Array.from({ length: 271 }, (_, i) => i + 30).map((kg) => (
                                        <option key={kg} value={kg}>{kg}</option>
                                    ))}
                                </select>
                                <span className="text-sm font-bold text-zinc-500">.</span>
                                <select
                                    value={targetWeight === '' ? '' : Math.round((Number(targetWeight) - Math.floor(Number(targetWeight))) * 10)}
                                    onChange={(e) => {
                                        const newDec = e.target.value;
                                        const currentInt = targetWeight === '' ? '75' : Math.floor(Number(targetWeight)).toString();
                                        setTargetWeight(`${currentInt}.${newDec}`);
                                    }}
                                    className="w-16 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-rose-500 transition-colors appearance-none text-center"
                                >
                                    <option value="" disabled>Gr</option>
                                    {Array.from({ length: 10 }, (_, i) => i).map((g) => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Ruler className="w-3 h-3" /> Altura (cm)
                            </label>
                            <input
                                type="number"
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                                placeholder="—"
                                min={100} max={250}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Change password — collapsible */}
                    <div className="border border-zinc-800 rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                Cambiar contraseña
                            </span>
                            {showPassword ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {showPassword && (
                            <div className="px-4 pb-4 pt-1 space-y-3 bg-zinc-800/20">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contraseña actual</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Nueva contraseña</label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Confirmar</label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950/40">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-rose-900/30"
                    >
                        {saving
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                            : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}
