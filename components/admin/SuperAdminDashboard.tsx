import React, { useState, useEffect } from 'react';
import { User, SpecificRole, Department, DocumentType } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { UserCheck, Users, Power, LogOut, Loader, Check, X, ShieldAlert, School, Home, Database, FileText, Plus, Trash2, Upload, AlertCircle } from 'lucide-react';
import { parseFile } from '../../services/fileUtils';
import { generateDatasetContext, generateEmbedding } from '../../services/geminiService';

// Helper to get API Key for Embeddings
const getApiKey = () => {
    // @ts-ignore
    return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
};

interface SuperAdminDashboardProps {
    user: User;
    onNavigate: (view: string) => void;
    onLogout: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ user, onNavigate, onLogout }) => {
    const [activeTab, setActiveTab] = useState<'requests' | 'governors' | 'knowledge'>('requests');
    const [pendingStaff, setPendingStaff] = useState<User[]>([]);
    const [activeGovernors, setActiveGovernors] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Knowledge Base State
    const [templates, setTemplates] = useState<any[]>([]);
    const [datasets, setDatasets] = useState<any[]>([]);

    // Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadCategory, setUploadCategory] = useState<'template' | 'dataset'>('dataset');
    const [uploadType, setUploadType] = useState<DocumentType>(DocumentType.ACTIVITY_PROPOSAL);
    const [uploadContext, setUploadContext] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

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

            // Fetch Templates
            const { data: tmplData } = await supabase
                .from('department_templates')
                .select('*')
                .eq('department', 'System Administration');
            setTemplates(tmplData || []);

            // Fetch Datasets
            const { data: dsData } = await supabase
                .from('department_datasets')
                .select('*')
                .eq('department', 'System Administration');
            setDatasets(dsData || []);

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

    const openUploadModal = (category: 'template' | 'dataset', type?: DocumentType) => {
        setUploadCategory(category);
        setUploadType(type || DocumentType.ACTIVITY_PROPOSAL);
        setUploadFile(null);
        setIsUploadModalOpen(true);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setUploadFile(file);

        if (file && uploadCategory === 'dataset') {
            setIsAnalyzing(true);
            setUploadContext(''); // Reset prev context
            try {
                const text = await parseFile(file);
                const generatedContext = await generateDatasetContext(text);
                setUploadContext(generatedContext);
            } catch (error) {
                console.error("Failed to analyze dataset:", error);
                alert("Failed to analyze file content for context. Please try another file.");
            } finally {
                setIsAnalyzing(false);
            }
        } else {
            setUploadContext('');
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        setIsUploading(true);
        const department = "System Administration";

        try {
            // 1. Parse File to Text
            const textContent = await parseFile(uploadFile);

            if (uploadCategory === 'template') {
                // Upload Template (Storage + DB)
                const fileExt = uploadFile.name.split('.').pop();
                const fileName = `${department}_${uploadType}.${fileExt}`;
                const filePath = `${department}/${fileName}`;

                // 1. Upload to Storage
                const { error: uploadError } = await supabase.storage
                    .from('templates')
                    .upload(filePath, uploadFile, { upsert: true });

                if (uploadError) throw uploadError;

                // 2. Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('templates')
                    .getPublicUrl(filePath);

                // 3. Upsert DB Record
                const { error } = await supabase.from('department_templates').upsert({
                    department: department,
                    document_type: uploadType,
                    content: textContent, // Keep text for AI reference
                    file_url: publicUrl,
                    file_name: uploadFile.name,
                    updated_by: user.id
                }, { onConflict: 'department, document_type' }); // Ensure constraints match DB

                if (error) throw error;

            } else {
                // Upload Dataset (Insert with Embedding)
                if (!uploadContext) throw new Error("Context required for datasets");

                const apiKey = getApiKey();
                let embedding: number[] = [];

                if (apiKey) {
                    try {
                        // Embed context + start of file to capture essence
                        embedding = await generateEmbedding(uploadContext + "\n" + textContent.substring(0, 1000));
                    } catch (e) {
                        console.warn("Embedding generation failed, proceeding without vector:", e);
                        // Don't fail the whole upload, just skip embedding if API fails
                    }
                }

                const { error } = await supabase.from('department_datasets').insert({
                    department: department,
                    document_type: uploadType,
                    description: uploadFile.name,
                    detailed_context: uploadContext,
                    file_content: textContent,
                    embedding: embedding.length > 0 ? embedding : null,
                    uploaded_by: user.id
                });
                if (error) throw error;
            }

            setIsUploadModalOpen(false);
            setUploadFile(null);
            setUploadContext('');
            fetchData();

        } catch (err) {
            console.error("Upload Error:", err);
            alert(`Failed to upload ${uploadCategory}. ${(err as Error).message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteDataset = async (id: string) => {
        try {
            await supabase.from('department_datasets').delete().eq('id', id);
            fetchData();
        } catch (e) { console.error(e); }
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
                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'knowledge' ? 'bg-white/10 text-white dark:bg-gray-700' : 'text-blue-200 hover:bg-white/5 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                    >
                        <Database className="w-5 h-5" />
                        Knowledge Base
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
                        {activeTab === 'requests' ? 'Pending Staff Approvals' : activeTab === 'governors' ? 'Active Governors & Staff' : 'System Administration Resources'}
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

                        {/* Knowledge Database Tab */}
                        {activeTab === 'knowledge' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Templates Section */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 dark:text-white">
                                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Templates
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">Upload ONE standard template per document type (Docx/PDF).</p>

                                    <div className="space-y-4">
                                        {[DocumentType.ACTIVITY_PROPOSAL, DocumentType.OFFICIAL_LETTER, DocumentType.CONSTITUTION].map(type => {
                                            const exists = templates.find(t => t.document_type === type);
                                            return (
                                                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${exists ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-300'}`}>
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{type}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">{exists ? 'Uploaded' : 'Missing'}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => openUploadModal('template', type)}
                                                        className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded shadow-sm hover:bg-gray-50 dark:bg-gray-600 dark:border-gray-500 dark:text-white dark:hover:bg-gray-500"
                                                    >
                                                        {exists ? 'Replace' : 'Upload'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Datasets Section (Categorized) */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white">
                                            <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Datasets
                                        </h3>
                                        <button
                                            onClick={() => openUploadModal('dataset')}
                                            className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg flex items-center gap-1 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
                                        >
                                            <Plus className="w-3 h-3" /> Add New
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">Upload multiple reference files for AI context.</p>

                                    <div className="space-y-4">
                                        {[DocumentType.ACTIVITY_PROPOSAL, DocumentType.OFFICIAL_LETTER, DocumentType.CONSTITUTION].map(type => {
                                            const typeDatasets = datasets.filter(d => d.document_type === type);
                                            return (
                                                <div key={type} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">{type}</h4>
                                                        <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full dark:text-gray-300">{typeDatasets.length} files</span>
                                                    </div>

                                                    {typeDatasets.length === 0 ? (
                                                        <div className="text-xs text-gray-400 italic py-2 text-center">No datasets uploaded</div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {typeDatasets.map(ds => (
                                                                <div key={ds.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition group">
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        <FileText className="w-3 h-3 text-gray-400 dark:text-gray-400 flex-shrink-0" />
                                                                        <span className="text-sm text-gray-700 truncate dark:text-gray-200" title={ds.description}>{ds.description}</span>
                                                                    </div>
                                                                    <button onClick={() => handleDeleteDataset(ds.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400">
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Upload Modal for Templates AND Datasets */}
                {isUploadModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
                        <div className="bg-white rounded-xl max-w-md w-full p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold dark:text-white">
                                    Upload {uploadCategory === 'template' ? 'Template' : 'Dataset'}
                                </h3>
                                <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Document Type</label>
                                    <select
                                        value={uploadType}
                                        onChange={(e) => setUploadType(e.target.value as DocumentType)}
                                        disabled={uploadCategory === 'template'}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-900 disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value={DocumentType.ACTIVITY_PROPOSAL}>Activity Proposal</option>
                                        <option value={DocumentType.OFFICIAL_LETTER}>Official Letter</option>
                                        <option value={DocumentType.CONSTITUTION}>Constitution & By-Laws</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">File (PDF, Docx, or Text)</label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/50 transition">
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="dataset-upload"
                                            accept=".pdf,.docx,.txt"
                                        />
                                        <label htmlFor="dataset-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                            {uploadFile ? (
                                                <>
                                                    <FileText className="w-8 h-8 text-purple-600" />
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{uploadFile.name}</span>
                                                    <span className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-8 h-8 text-gray-400" />
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">Click to Select File</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                {uploadCategory === 'dataset' && (
                                    <div>
                                        <div className="flex items-start gap-2 bg-purple-50 p-3 rounded-lg dark:bg-purple-900/20 mb-2">
                                            <Database className="w-4 h-4 text-purple-600 mt-0.5 dark:text-purple-400" />
                                            <p className="text-xs text-purple-800 dark:text-purple-300">
                                                The AI will automatically analyze this document to generate a detailed description and context for better retrieval.
                                            </p>
                                        </div>
                                        {isAnalyzing && (
                                            <div className="text-sm text-purple-600 animate-pulse flex items-center gap-2 mt-2">
                                                <Loader className="w-4 h-4 animate-spin" />
                                                Analyzing document content for RAG context...
                                            </div>
                                        )}
                                        {uploadContext && !isAnalyzing && (
                                            <div className="text-xs text-green-600 flex items-center gap-1 mt-2">
                                                <Check className="w-3 h-3" />
                                                Context generated successfully
                                            </div>
                                        )}
                                        {isUploading && (
                                            <div className="text-xs text-gray-500 animate-pulse mt-1">
                                                Status: Saving to database...
                                            </div>
                                        )}
                                    </div>
                                )}

                                {uploadCategory === 'template' && (
                                    <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-lg dark:bg-blue-900/20">
                                        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 dark:text-blue-400" />
                                        <p className="text-xs text-blue-800 dark:text-blue-300">
                                            Templates are used as the "base layout" if no specific dataset reference is found. Upload a clean, standard document.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={!uploadFile || isUploading || isAnalyzing}
                                className="w-full bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {(isUploading || isAnalyzing) ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {isAnalyzing ? 'Analyzing...' : (isUploading ? 'Processing...' : `Upload ${uploadCategory === 'template' ? 'Template' : 'Dataset'}`)}
                            </button>
                        </div>
                    </div>
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
