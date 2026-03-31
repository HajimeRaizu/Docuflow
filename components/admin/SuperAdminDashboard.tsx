import React, { useState, useEffect } from 'react';
import { User, SpecificRole, Department, DocumentType, DocumentTypeIcon } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { UserCheck, Users, Power, LogOut, Loader, Check, X, ShieldAlert, School, Home, Database, FileText, Plus, Trash2, Upload, AlertCircle, Settings, BarChart3, Menu } from 'lucide-react';
import { useNotification } from '../NotificationProvider';
import { parseFile } from '../../services/fileUtils';
import { generateDatasetContext, generateEmbedding } from '../../services/geminiService';
import { Analytics } from './Analytics';

// Helper to get API Key for Embeddings
const getApiKey = () => {
    // @ts-ignore
    return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
};

interface SuperAdminDashboardProps {
    user: User;
    onNavigate: (view: string, params?: any) => void;
    onLogout: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ user, onNavigate, onLogout }) => {
    const { showToast, confirm: confirmAction } = useNotification();
    const [activeTab, setActiveTab] = useState<'requests' | 'governors' | 'knowledge' | 'settings' | 'analytics'>('analytics');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [isSavingOrg, setIsSavingOrg] = useState(false);
    const [isImportingPriceList, setIsImportingPriceList] = useState(false);
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
    const [uploadTemplateIndex, setUploadTemplateIndex] = useState<number>(1);
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

            // Fetch Organization Name
            const { data: settingsData } = await supabase
                .from('department_settings')
                .select('organization_name')
                .eq('department', user.department)
                .maybeSingle();
            if (settingsData) setOrgName(settingsData.organization_name);

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

    const handleReject = (roleId: string) => {
        confirmAction({
            title: "Reject Request",
            message: "Are you sure you want to reject this request?",
            variant: "warning",
            onConfirm: async () => {
                setActionLoading(roleId);
                try {
                    const { error } = await supabase
                        .from('user_roles')
                        .update({ status: 'rejected' })
                        .eq('id', roleId);
                    if (error) throw error;
                    fetchData();
                    showToast("Request rejected", "info");
                } catch (err) {
                    showToast("Failed to reject request", "error");
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const handleEndTerm = (roleId: string) => {
        confirmAction({
            title: "End Term",
            message: "Are you sure you want to END THE TERM for this user? This will disable them and all their officers.",
            variant: "error",
            confirmLabel: "End Term",
            onConfirm: async () => {
                setActionLoading(roleId);
                try {
                    const { data: userToDisable, error: fetchError } = await supabase
                        .from('user_roles')
                        .select('*')
                        .eq('id', roleId)
                        .single();

                    if (fetchError) throw fetchError;
                    if (!userToDisable) throw new Error("User not found");

                    const { error: disableError } = await supabase
                        .from('user_roles')
                        .update({ status: 'disabled' })
                        .eq('id', roleId);

                    if (disableError) throw disableError;

                    const archiveYear = userToDisable.academic_year || '2025-2026';
                    const { data: archivedCount, error: archiveError } = await supabase
                        .rpc('archive_specific_term_documents', {
                            target_role_id: roleId,
                            archive_year: archiveYear
                        });

                    if (archiveError) {
                        showToast("Error archiving documents. Please check console.", "error");
                    } else {
                        showToast(`Successfully archived ${archivedCount} documents`, "success");
                    }

                    await supabase
                        .from('user_roles')
                        .update({ status: 'disabled' })
                        .eq('managed_by_role_id', roleId);

                    fetchData();
                } catch (err) {
                    showToast("Failed to end term.", "error");
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const handleEnable = (roleId: string) => {
        confirmAction({
            title: "Enable User",
            message: "Are you sure you want to ENABLE this user?",
            onConfirm: async () => {
                setActionLoading(roleId);
                try {
                    const { error: govError } = await supabase
                        .from('user_roles')
                        .update({
                            status: 'active',
                            academic_year: '2025-2026'
                        })
                        .eq('id', roleId);

                    if (govError) throw govError;

                    await supabase
                        .from('user_roles')
                        .update({ status: 'active' })
                        .eq('managed_by_role_id', roleId);

                    const { data: unarchivedCount, error: unarchiveError } = await supabase
                        .rpc('unarchive_specific_term_documents', {
                            target_role_id: roleId
                        });

                    if (unarchiveError) {
                        showToast("Error un-archiving documents", "error");
                    } else {
                        showToast(`Successfully restored ${unarchivedCount} documents`, "success");
                    }

                    fetchData();
                } catch (err) {
                    showToast("Failed to enable user", "error");
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const openUploadModal = (category: 'template' | 'dataset', type?: DocumentType, templateIndex: number = 1) => {
        setUploadCategory(category);
        setUploadType(type || DocumentType.ACTIVITY_PROPOSAL);
        setUploadTemplateIndex(templateIndex);
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
                showToast("Failed to analyze file content. Please try another file.", "error");
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
                // 1. Check for existing template to delete old storage file
                const { data: existingTemplate } = await supabase
                    .from('department_templates')
                    .select('file_url')
                    .eq('department', department)
                    .eq('document_type', uploadType)
                    .eq('template_index', uploadTemplateIndex)
                    .maybeSingle();

                if (existingTemplate && existingTemplate.file_url) {
                    try {
                        const urlParts = existingTemplate.file_url.split('/templates/');
                        if (urlParts.length > 1 && urlParts[1]) {
                            const oldFilePath = decodeURIComponent(urlParts[1]);
                            await supabase.storage.from('templates').remove([oldFilePath]);
                        }
                    } catch (e) {
                        console.warn("Could not delete old template file:", e);
                    }
                }

                // Upload Template (Storage + DB)
                const fileExt = uploadFile.name.split('.').pop();
                const sanitizedType = uploadType.split(' ').join('_');
                const timestamp = new Date().getTime();
                const fileName = `${department}_${sanitizedType}_${uploadTemplateIndex}_${timestamp}.${fileExt}`;
                const filePath = `${department}/${fileName}`;

                // 2. Upload to Storage
                const { error: uploadError } = await supabase.storage
                    .from('templates')
                    .upload(filePath, uploadFile, { upsert: true });

                if (uploadError) throw uploadError;

                // 3. Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('templates')
                    .getPublicUrl(filePath);

                // 4. Upsert DB Record
                const { error } = await supabase.from('department_templates').upsert({
                    department: department,
                    document_type: uploadType,
                    template_index: uploadTemplateIndex,
                    content: textContent,
                    file_url: publicUrl,
                    file_name: uploadFile.name,
                    updated_by: user.id
                }, { onConflict: 'department,document_type,template_index' });

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

        } catch (err: any) {
            console.error("Critical Upload Error Details:", {
                message: err.message,
                details: err.details,
                hint: err.hint,
                code: err.code,
                context: uploadCategory,
                fullError: err
            });
            showToast(`Failed to upload ${uploadCategory}. ${err.message || 'Unknown error'}`, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteDataset = (id: string) => {
        confirmAction({
            title: "Delete Dataset",
            message: "Are you sure you want to delete this dataset? This action cannot be undone.",
            variant: "error",
            confirmLabel: "Delete",
            onConfirm: async () => {
                try {
                    await supabase.from('department_datasets').delete().eq('id', id);
                    fetchData();
                    showToast("Dataset deleted successfully", "success");
                } catch (e) {
                    showToast("Failed to delete dataset", "error");
                }
            }
        });
    };

    const handleSaveSettings = async () => {
        setIsSavingOrg(true);
        try {
            const { error } = await supabase
                .from('department_settings')
                .upsert({
                    department: user.department,
                    organization_name: orgName,
                    updated_at: new Date().toISOString(),
                    updated_by: user.id
                }, { onConflict: 'department' });

            if (error) throw error;
            showToast("Settings updated successfully!", "success");
        } catch (err) {
            console.error("Error saving settings:", err);
            showToast("Failed to save settings.", "error");
        } finally {
            setIsSavingOrg(false);
        }
    };

    const handleImportPriceList = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImportingPriceList(true);
        try {
            const data = await file.arrayBuffer();
            // Dynamically import xlsx to avoid huge bundle
            const xlsx = await import('xlsx');

            const workbook = xlsx.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

            let currentCategory = 'Uncategorized';
            const validItems: any[] = [];

            // Example rows strategy from the previous read_excel output:
            // Column 1 is Item Name, Column 2 is Unit, Column 3 is Price
            for (let i = 2; i < rows.length; i++) {
                const row = rows[i];

                // If it's a category row (only one string in the 2nd column index 1)
                if (row.length === 2 && typeof row[1] === 'string' && !row[2] && !row[3]) {
                    currentCategory = row[1];
                    continue;
                }

                const itemName = row[1]?.toString().trim();
                const unit = row[2]?.toString().trim() || null;
                const priceMatch = row[3]?.toString().replace(/[^0-9.]/g, '');
                const price = priceMatch ? parseFloat(priceMatch) : null;

                // User requested to SKIP items if ANY field (name, unit, price) is missing
                if (!itemName || !unit || price === null || isNaN(price)) {
                    continue;
                }

                validItems.push({
                    category: currentCategory,
                    item_name: itemName,
                    unit: unit,
                    price: price
                });
            }

            if (validItems.length === 0) {
                showToast("No valid items found in the Excel file.", "error");
                setIsImportingPriceList(false);
                return;
            }

            // Wipe existing table
            const { error: deleteError } = await supabase
                .from('price_list')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

            if (deleteError) {
                console.error("Failed to clear old price list:", deleteError);
                throw new Error("Failed to clear old price list");
            }

            // Chunk the insertion
            const chunkSize = 100;
            for (let i = 0; i < validItems.length; i += chunkSize) {
                const chunk = validItems.slice(i, i + chunkSize);
                const { error } = await supabase.from('price_list').insert(chunk);
                if (error) throw error;
            }

            showToast(`Successfully imported ${validItems.length} items from Excel!`, 'success');
        } catch (e) {
            console.error("Import Error:", e);
            showToast(`Failed to import price list: ${(e as Error).message}`, 'error');
        } finally {
            setIsImportingPriceList(false);
            // Reset input file value
            e.target.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 flex">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-gray-800/95 flex items-center px-4 z-20 text-gray-900 dark:text-white shadow-sm backdrop-blur-md border-b border-gray-100 dark:border-gray-700">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <div className="flex-1 flex justify-center mr-10">
                        <h1 className="text-xl font-serif italic text-blue-950 dark:text-white whitespace-nowrap">NEMSify</h1>
                </div>
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`w-72 bg-gray-50 flex flex-col fixed h-full z-40 dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 h-16">
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="md:hidden p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>

                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <h1 className="text-xl font-serif italic text-blue-950 dark:text-white whitespace-nowrap">NEMSify</h1>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
                    <button
                        onClick={() => { onNavigate('dashboard'); setIsSidebarOpen(false); }}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition bg-gray-50/50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800 group"
                    >
                        <Home className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        <span className="font-bold text-lg">Home</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('analytics'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${activeTab === 'analytics'
                            ? 'bg-blue-50 text-blue-600 shadow-sm'
                            : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                    >
                        <BarChart3 className={`w-6 h-6 ${activeTab === 'analytics' ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'} transition-colors`} />
                        <span className="font-bold text-lg">Analytics</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('knowledge'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${activeTab === 'knowledge'
                            ? 'bg-blue-50 text-blue-600 shadow-sm'
                            : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                    >
                        <Database className={`w-6 h-6 ${activeTab === 'knowledge' ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'} transition-colors`} />
                        <span className="font-bold text-lg">Archive</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('requests'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${activeTab === 'requests'
                            ? 'bg-blue-50 text-blue-600 shadow-sm'
                            : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                    >
                        <UserCheck className={`w-6 h-6 ${activeTab === 'requests' ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'} transition-colors`} />
                        <span className="font-bold text-lg">Staff</span>
                        {pendingStaff.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto">
                                {pendingStaff.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => { setActiveTab('governors'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${activeTab === 'governors'
                            ? 'bg-blue-50 text-blue-600 shadow-sm'
                            : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                    >
                        <Users className={`w-6 h-6 ${activeTab === 'governors' ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'} transition-colors`} />
                        <span className="font-bold text-lg">Governors</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${activeTab === 'settings'
                            ? 'bg-blue-50 text-blue-600 shadow-sm'
                            : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                    >
                        <Settings className={`w-6 h-6 ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'} transition-colors`} />
                        <span className="font-bold text-lg">Settings</span>
                    </button>
                </nav>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={onLogout} className="flex items-center gap-3 text-gray-400 hover:text-red-500 transition-colors w-full font-bold">
                        <LogOut className="w-5 h-5" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-72 min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden">
                <div className="p-4 md:p-8 pt-20 md:pt-8 max-w-[1600px] mx-auto">
                    <header className="flex justify-between items-center mb-10">
                        <h2 className="text-3xl font-bold text-gray-950 dark:text-white tracking-tight">
                            {activeTab === 'requests' ? 'Staff Requests' : activeTab === 'governors' ? 'Active Governors' : activeTab === 'knowledge' ? 'Archive' : activeTab === 'analytics' ? 'Dashboard' : 'Settings'}
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
                                            <div key={user.role_id} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between dark:bg-gray-800 dark:border-gray-700 gap-4">
                                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                                    <div className="w-12 h-12 bg-blue-50 rounded-full flex-shrink-0 flex items-center justify-center text-blue-900 font-bold uppercase dark:bg-blue-900/30 dark:text-blue-400">
                                                        {user.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 dark:text-white">{user.full_name}</h3>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                                                        <p className="text-xs text-blue-600 font-medium mt-1 dark:text-blue-400">{user.specific_role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto justify-end">
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
                                        <div key={user.role_id} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 relative group dark:bg-gray-800 dark:border-gray-700 flex flex-col items-center text-center">
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition flex gap-2">
                                                {user.status === 'disabled' ? (
                                                    <button
                                                        onClick={() => handleEnable(user.role_id!)}
                                                        disabled={actionLoading === user.role_id}
                                                        className="bg-green-100 text-green-600 hover:bg-green-200 p-2 rounded-lg text-xs font-bold flex items-center gap-1 dark:bg-green-900/30 dark:text-green-400"
                                                    >
                                                        <Power className="w-4 h-4" /> Enable
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleEndTerm(user.role_id!)}
                                                        disabled={actionLoading === user.role_id}
                                                        className="bg-red-100 text-red-600 hover:bg-red-200 p-2 rounded-lg text-xs font-bold flex items-center gap-1 dark:bg-red-900/30 dark:text-red-400"
                                                    >
                                                        <Power className="w-4 h-4" /> End Term
                                                    </button>
                                                )}
                                            </div>

                                            <div className="w-16 h-16 bg-blue-100 text-blue-900 rounded-full flex items-center justify-center font-bold text-xl mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                                                {user.full_name.charAt(0)}
                                            </div>
                                            <h3 className="font-bold text-gray-900 text-lg dark:text-white">{user.full_name}</h3>
                                            <p className="text-gray-500 text-sm mb-1 dark:text-gray-400">{user.email}</p>
                                            <p className="text-blue-600 text-sm font-medium mb-4 dark:text-blue-400">{user.specific_role} • {user.department}</p>
                                            <div className={`text-xs px-3 py-1 rounded-full border ${user.status === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                                : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                                }`}>
                                                {user.status === 'active' ? 'Active' : 'Disabled'}
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
                                        <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">Upload up to TWO standard templates per document type (Docx/PDF).</p>

                                        <div className="space-y-4">
                                            {[DocumentType.ACTIVITY_PROPOSAL, DocumentType.OFFICIAL_LETTER, DocumentType.CONSTITUTION].map(type => (
                                                <div key={type} className="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
                                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 border-b pb-2 dark:border-gray-600">{type}</p>
                                                    {[1, 2].map(index => {
                                                        const exists = templates.find(t => t.document_type === type && t.template_index === index);
                                                        const Icon = DocumentTypeIcon[type as DocumentType] || FileText;
                                                        return (
                                                            <div key={index} className="flex items-center justify-between pl-2">
                                                                <div className="flex items-center gap-3">
                                                                    <Icon className={`w-4 h-4 ${exists ? 'text-green-500' : 'text-gray-400'}`} />
                                                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Template {index}</span>
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${exists ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400'}`}>
                                                                        {exists ? 'Uploaded' : 'Missing'}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => openUploadModal('template', type, index)}
                                                                    className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded shadow-sm hover:bg-gray-50 dark:bg-gray-600 dark:border-gray-500 dark:text-white dark:hover:bg-gray-500"
                                                                >
                                                                    {exists ? 'Replace' : 'Upload'}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
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
                    {activeTab === 'analytics' && (
                        <Analytics type="global" />
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 dark:text-white">System Settings</h2>

                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2 dark:text-gray-300">Organization Name</label>
                                    <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">This will be auto-filled in the Manual Drafting form for all members of the system administration.</p>
                                    <input
                                        type="text"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        placeholder="e.g. Docuflow Administration"
                                        className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>

                                <button
                                    onClick={handleSaveSettings}
                                    disabled={isSavingOrg}
                                    className="px-6 py-2.5 bg-blue-900 text-white rounded-lg font-bold hover:bg-blue-800 transition disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSavingOrg ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Save Changes
                                </button>

                                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">System Maintenance</h3>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-start gap-3">
                                            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                            <div>
                                                <h4 className="font-medium text-blue-900 dark:text-blue-100">Price List Ingestion</h4>
                                                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                                    Upload the latest Basis PMPP Price List Excel file (.xlsx) into the database.
                                                    Empty or improperly formatted rows will be skipped.
                                                </p>
                                                <div className="mt-4">
                                                    <input
                                                        type="file"
                                                        accept=".xlsx"
                                                        onChange={handleImportPriceList}
                                                        disabled={isImportingPriceList}
                                                        className="hidden"
                                                        id="price-list-upload"
                                                    />
                                                    <label
                                                        htmlFor="price-list-upload"
                                                        className={`inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm cursor-pointer ${isImportingPriceList ? 'opacity-50 pointer-events-none' : ''}`}
                                                    >
                                                        {isImportingPriceList ? <Loader className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                                                        {isImportingPriceList ? "Importing..." : "Upload Price List (.xlsx)"}
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
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
