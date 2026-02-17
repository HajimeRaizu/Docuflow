import React, { useState, useEffect } from 'react';
import { User, SpecificRole, Department } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { UserCheck, Users, Power, LogOut, Loader, Check, X, ShieldAlert, School, Home } from 'lucide-react';

interface SuperAdminDashboardProps {
    onNavigate: (view: string) => void;
    onLogout: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onNavigate, onLogout }) => {
    const [activeTab, setActiveTab] = useState<'requests' | 'governors'>('requests');
    const [pendingStaff, setPendingStaff] = useState<User[]>([]);
    const [activeGovernors, setActiveGovernors] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Approval Modal State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [assignRole, setAssignRole] = useState<SpecificRole>('CITE Governor');
    const [assignDept, setAssignDept] = useState<Department>('CITE');

    // Auto-assign department based on role
    useEffect(() => {
        if (assignRole.includes('CITE')) setAssignDept('CITE');
        else if (assignRole.includes('CAS')) setAssignDept('CAS');
        else if (assignRole.includes('CBM')) setAssignDept('CBM');
        else if (assignRole.includes('CTE')) setAssignDept('CTE');
        else if (assignRole.includes('CET')) setAssignDept('CET');
        else if (assignRole === 'USG President') setAssignDept('USG');
        else if (assignRole === 'University Official') setAssignDept('System Administration');
    }, [assignRole]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Pending Staff
            const { data: requests, error: reqError } = await supabase
                .from('user_roles')
                .select(`
            *,
            profiles:user_id (full_name, email, avatar_url)
        `)
                .eq('role', 'admin')
                .eq('status', 'pending');

            if (reqError) throw reqError;

            // Fetch Active Governors
            const { data: governors, error: govError } = await supabase
                .from('user_roles')
                .select(`
            *,
            profiles:user_id (full_name, email, avatar_url)
        `)
                .eq('role', 'admin')
                .in('status', ['active', 'disabled']); // Fetch both active and disabled

            if (govError) throw govError;

            const mapUser = (r: any) => ({
                id: r.user_id, // Auth ID
                email: r.profiles?.email,
                full_name: r.profiles?.full_name,
                avatar_url: r.profiles?.avatar_url,
                role_id: r.id, // Role ID
                user_type: r.role,
                specific_role: r.specific_role,
                department: r.department,
                status: r.status,
                academic_year: r.academic_year
            });

            setPendingStaff(requests?.map(mapUser) || []);
            setActiveGovernors(governors?.map(mapUser) || []);

        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedUser) return;
        setActionLoading(selectedUser.role_id!);
        try {
            const { error } = await supabase
                .from('user_roles')
                .update({
                    status: 'active',
                    specific_role: assignRole,
                    department: assignDept,
                    permissions: (assignRole.includes('Governor') || assignRole === 'University Official' || assignRole === 'USG President') ? {
                        official_letter: 'edit',
                        activity_proposal: 'edit',
                        constitution: 'edit'
                    } : {}
                })
                .eq('id', selectedUser.role_id);

            if (error) throw error;
            setSelectedUser(null);
            fetchData();
        } catch (err) {
            console.error('Approval error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (roleId: string) => {
        if (!confirm('Are you sure you want to reject this request?')) return;
        setActionLoading(roleId);
        try {
            const { error } = await supabase
                .from('user_roles')
                .update({ status: 'rejected' })
                .eq('id', roleId);
            if (error) throw error;
            fetchData();
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleEndTerm = async (roleId: string) => {
        if (!confirm('Are you sure you want to END THE TERM for this user? This will disable them and all their officers.')) return;
        setActionLoading(roleId);
        try {
            // 1. Fetch the user details FIRST to ensure we have the academic year and department
            const { data: userToDisable, error: fetchError } = await supabase
                .from('user_roles')
                .select('*')
                .eq('id', roleId)
                .single();

            if (fetchError) throw fetchError;
            if (!userToDisable) throw new Error("User not found");

            // 2. Disable the Governor
            const { error: disableError } = await supabase
                .from('user_roles')
                .update({ status: 'disabled' })
                .eq('id', roleId);

            if (disableError) throw disableError;

            // 3. ARCHIVE DOCUMENTS: Update documents to have the academic_year of the disabled term
            // Using the fetched user details ensures we have the correct data even after disabling
            console.log("Archiving documents for:", userToDisable.department, userToDisable.academic_year);

            const archiveYear = userToDisable.academic_year || '2025-2026'; // Fallback for legacy users

            // 3. ARCHIVE DOCUMENTS: Use RPC to bypass RLS and archive ONLY docs from this term
            // This function targets the Governor and their Officers specifically
            const { data: archivedCount, error: archiveError } = await supabase
                .rpc('archive_specific_term_documents', {
                    target_role_id: roleId, // Pass the Governor's Role ID
                    archive_year: archiveYear
                });

            if (archiveError) {
                console.error("Error archiving documents:", archiveError);
                alert("Error archiving documents. Please check console.");
            } else {
                console.log(`Successfully archived ${archivedCount} documents for term ending ${archiveYear}`);
            }

            // 4. Disable all officers managed by this role
            await supabase
                .from('user_roles')
                .update({ status: 'disabled' })
                .eq('managed_by_role_id', roleId);

            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to end term. See console for details.');
        } finally {
            setActionLoading(null);
        }
    };


    const handleEnable = async (roleId: string) => {
        if (!confirm('Are you sure you want to ENABLE this user?')) return;
        setActionLoading(roleId);
        try {
            // 1. Enable the Governor
            const { error: govError } = await supabase
                .from('user_roles')
                .update({
                    status: 'active',
                    academic_year: '2025-2026' // Ensure academic year is set/updated on enable
                })
                .eq('id', roleId);

            if (govError) throw govError;

            // 2. CASACADE ENABLE: Enable all officers managed by this governor
            // This ensures they don't have to wait for the governor to login
            const { error: cascadeError } = await supabase
                .from('user_roles')
                .update({ status: 'active' })
                .eq('managed_by_role_id', roleId);

            if (cascadeError) console.error("Error re-enabling officers:", cascadeError);

            // 3. UN-ARCHIVE DOCUMENTS: Revert documents to Draft for this term
            const { data: unarchivedCount, error: unarchiveError } = await supabase
                .rpc('unarchive_specific_term_documents', {
                    target_role_id: roleId
                });

            if (unarchiveError) {
                console.error("Error un-archiving documents:", unarchiveError);
            } else {
                console.log(`Successfully restored ${unarchivedCount} documents to Draft`);
            }

            fetchData();
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-blue-900 text-white flex flex-col fixed h-full z-10 dark:bg-gray-800 dark:border-r dark:border-gray-700">
                <div className="p-6">
                    <h1 className="text-2xl font-serif italic">SmartDraft</h1>
                    <p className="text-blue-200 text-sm dark:text-gray-400">Super Admin</p>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <button
                        onClick={() => onNavigate('dashboard')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition text-blue-200 hover:bg-white/5 mb-2 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                        <Home className="w-5 h-5" />
                        Back to Workspace
                    </button>
                    <div className="h-px bg-blue-800 my-2 mx-4 dark:bg-gray-700"></div>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'requests' ? 'bg-white/10 text-white dark:bg-gray-700' : 'text-blue-200 hover:bg-white/5 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                    >
                        <UserCheck className="w-5 h-5" />
                        Staff Requests
                        {pendingStaff.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-auto">{pendingStaff.length}</span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('governors')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'governors' ? 'bg-white/10 text-white dark:bg-gray-700' : 'text-blue-200 hover:bg-white/5 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                    >
                        <Users className="w-5 h-5" />
                        Active Governors
                    </button>
                </nav>

                <div className="p-4 border-t border-blue-800 dark:border-gray-700">
                    <button onClick={onLogout} className="flex items-center gap-2 text-blue-200 hover:text-white transition w-full dark:text-gray-400 dark:hover:text-white">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                <header className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        {activeTab === 'requests' ? 'Pending Staff Approvals' : 'Active Governors & Staff'}
                    </h2>
                </header>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader className="w-8 h-8 animate-spin text-blue-900" />
                    </div>
                ) : (
                    <>
                        {/* Requests Tab */}
                        {activeTab === 'requests' && (
                            <div className="space-y-4">
                                {pendingStaff.length === 0 ? (
                                    <div className="bg-white p-8 rounded-xl text-center text-gray-500 shadow-sm dark:bg-gray-800 dark:text-gray-400">
                                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                        No pending requests.
                                    </div>
                                ) : (
                                    pendingStaff.map(user => (
                                        <div key={user.role_id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-900 font-bold uppercase dark:bg-blue-900/30 dark:text-blue-400">
                                                    {user.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 dark:text-white">{user.full_name}</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                                                    <p className="text-xs text-blue-600 font-medium mt-1 dark:text-blue-400">{user.specific_role}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleReject(user.role_id!)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition dark:text-red-400 dark:hover:bg-red-900/20"
                                                    title="Reject"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setSelectedUser(user)}
                                                    className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition flex items-center gap-2"
                                                >
                                                    <UserCheck className="w-4 h-4" /> Approve
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Governors Tab */}
                        {activeTab === 'governors' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {activeGovernors.map(user => (
                                    <div key={user.role_id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative group dark:bg-gray-800 dark:border-gray-700">
                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition flex gap-2">
                                            {user.status === 'disabled' ? (
                                                <button
                                                    onClick={() => handleEnable(user.role_id!)}
                                                    disabled={actionLoading === user.role_id}
                                                    className="text-green-600 hover:bg-green-50 p-2 rounded-lg text-xs font-bold flex items-center gap-1 dark:text-green-400 dark:hover:bg-green-900/20"
                                                >
                                                    <Power className="w-4 h-4" /> Enable
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleEndTerm(user.role_id!)}
                                                    disabled={actionLoading === user.role_id}
                                                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg text-xs font-bold flex items-center gap-1 dark:text-red-400 dark:hover:bg-red-900/20"
                                                >
                                                    <Power className="w-4 h-4" /> End Term
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center text-center">
                                            <div className="w-16 h-16 bg-blue-100 text-blue-900 rounded-full flex items-center justify-center font-bold text-xl mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                                                {user.full_name.charAt(0)}
                                            </div>
                                            <h3 className="font-bold text-gray-900 text-lg dark:text-white">{user.specific_role}</h3>
                                            <p className="text-gray-500 text-sm mb-4 dark:text-gray-400">{user.department} • {user.academic_year}</p>
                                            <div className={`text-xs px-3 py-1 rounded-full border ${user.status === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                                : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                                }`}>
                                                {user.status === 'active' ? 'Active' : 'Disabled'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Approval Modal */}
                {selectedUser && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
                        <div className="bg-white rounded-xl max-w-md w-full p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
                            <h3 className="text-xl font-bold mb-4 dark:text-white">Approve Staff Request</h3>
                            <p className="text-gray-600 mb-6 dark:text-gray-300">Assign a role and department to <strong>{selectedUser.full_name}</strong>.</p>

                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Specific Role</label>
                                    <select
                                        value={assignRole}
                                        onChange={(e) => setAssignRole(e.target.value as SpecificRole)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500"
                                    >
                                        <option value="CITE Governor">CITE Governor</option>
                                        <option value="CAS Governor">CAS Governor</option>
                                        <option value="CBM Governor">CBM Governor</option>
                                        <option value="CTE Governor">CTE Governor</option>
                                        <option value="CET Governor">CET Governor</option>
                                        <option value="USG President">USG President</option>
                                        <option value="University Official">University Official</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Department</label>
                                    <input
                                        type="text"
                                        value={assignDept}
                                        disabled
                                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
                                    />
                                    <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Department is automatically assigned based on role.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setSelectedUser(null)} className="flex-1 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
                                <button
                                    onClick={handleApprove}
                                    disabled={!!actionLoading}
                                    className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg hover:bg-blue-800 font-medium"
                                >
                                    {actionLoading ? <Loader className="w-5 h-5 animate-spin mx-auto" /> : 'Confirm Approval'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

// CheckCircle Icon needs to be imported or defined
function CheckCircle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    )
}
