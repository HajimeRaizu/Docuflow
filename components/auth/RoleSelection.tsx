import React, { useState } from 'react';
import { User, Department, UserRole } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { Shield, GraduationCap, ChevronRight, Loader, CheckCircle, AlertCircle } from 'lucide-react';

interface RoleSelectionProps {
    user: User;
    onRequestSubmitted: () => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ user, onRequestSubmitted }) => {
    const [step, setStep] = useState<'selection' | 'staff-confirm' | 'officer-details' | 'success'>('selection');
    const [loading, setLoading] = useState(false);
    const [selectedDept, setSelectedDept] = useState<Department>('CITE');
    const [error, setError] = useState('');

    const handleStaffRequest = async () => {
        setLoading(true);
        setError('');
        try {
            // Ensure profile exists
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                updated_at: new Date().toISOString(),
            });

            if (profileError) throw profileError;

            const { error } = await supabase.from('user_roles').insert({
                user_id: user.id,
                role: UserRole.ADMIN,
                specific_role: 'University Official (Applicant)',
                status: 'pending',
                academic_year: '2025-2026'
            });
            if (error) throw error;
            setStep('success');
        } catch (err: any) {
            setError(err.message || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    const handleOfficerRequest = async () => {
        setLoading(true);
        setError('');
        try {
            // Ensure profile exists
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                updated_at: new Date().toISOString(),
            });

            if (profileError) throw profileError;

            const { error } = await supabase.from('user_roles').insert({
                user_id: user.id,
                role: UserRole.OFFICER,
                department: selectedDept,
                status: 'pending',
                academic_year: '2025-2026'
            });
            if (error) throw error;
            setStep('success');
        } catch (err: any) {
            setError(err.message || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100 dark:border-gray-700">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Request Submitted</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Your request has been sent to the relevant administrator for approval. You will be notified once your account is active.
                    </p>
                    <button
                        onClick={onRequestSubmitted}
                        className="w-full bg-blue-900 text-white py-3 rounded-lg hover:bg-blue-800 transition"
                    >
                        Check Status / Refresh
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-6 transition-colors">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-serif italic text-blue-900 dark:text-blue-400 mb-4 transition-colors">Complete Your Profile</h1>
                    <p className="text-gray-600 dark:text-gray-400">Please select your role to proceed with the registration.</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 flex items-center justify-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {step === 'selection' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={() => setStep('officer-details')}
                            className="group bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 hover:border-blue-900 dark:hover:border-blue-500 p-8 rounded-2xl transition-all hover:shadow-xl text-left flex flex-col items-center justify-center gap-4"
                        >
                            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 rounded-full flex items-center justify-center group-hover:bg-blue-900 group-hover:text-white transition">
                                <GraduationCap className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Student Officer</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">For elected officers (Vice Governor and below)</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setStep('staff-confirm')}
                            className="group bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 hover:border-blue-900 dark:hover:border-blue-500 p-8 rounded-2xl transition-all hover:shadow-xl text-left flex flex-col items-center justify-center gap-4"
                        >
                            <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-full flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition">
                                <Shield className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">University Officials</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">For administrative staff, faculty, university employees, Department Governors, and Organization Presidents.</p>
                            </div>
                        </button>
                    </div>
                )}

                {step === 'staff-confirm' && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 rounded-2xl max-w-lg mx-auto shadow-lg">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Confirm Request</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            You are applying as <strong>University Official</strong>. This request will be sent to the System SuperAdmin for validation.
                        </p>
                        <div className="flex gap-4">
                            <button onClick={() => setStep('selection')} className="flex-1 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">Back</button>
                            <button
                                onClick={handleStaffRequest}
                                disabled={loading}
                                className="flex-1 bg-blue-900 text-white py-3 rounded-lg hover:bg-blue-800 transition flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'officer-details' && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 rounded-2xl max-w-lg mx-auto shadow-lg">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Select Department</h3>

                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {(['CITE', 'CAS', 'CBM', 'CTE', 'CET', 'USG'] as Department[]).map(dept => (
                                <button
                                    key={dept}
                                    onClick={() => setSelectedDept(dept)}
                                    className={`py-3 px-4 rounded-lg font-medium transition ${selectedDept === dept
                                        ? 'bg-blue-900 text-white shadow-md'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {dept}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep('selection')} className="flex-1 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">Back</button>
                            <button
                                onClick={handleOfficerRequest}
                                disabled={loading}
                                className="flex-1 bg-blue-900 text-white py-3 rounded-lg hover:bg-blue-800 transition flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
