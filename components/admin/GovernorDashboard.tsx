import React, { useState, useEffect } from 'react';
import { User, SpecificRole, Department, DocumentType, DocumentTypeIcon } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { Users, FileText, Upload, Trash2, Check, X, Shield, Plus, LogOut, Settings, Library, Archive, Home, Loader, AlertCircle, Power, BarChart3, Menu } from 'lucide-react';
import { useNotification } from '../NotificationProvider';
import { parseFile } from '../../services/fileUtils';
import { generateDatasetContext, generateEmbedding } from '../../services/geminiService';
import { Analytics } from './Analytics';


interface GovernorDashboardProps {
    user: User;
    onNavigate: (view: string) => void;
    onLogout: () => void;
}

// Helper to get API Key for Embeddings
const getApiKey = () => {
    // @ts-ignore
    return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
};

export const GovernorDashboard: React.FC<GovernorDashboardProps> = ({ user, onNavigate, onLogout }) => {
    const { showToast, confirm: confirmAction } = useNotification();
    const [activeTab, setActiveTab] = useState<'officers' | 'knowledge' | 'settings' | 'analytics'>('analytics');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [isSavingOrg, setIsSavingOrg] = useState(false);
    const [officers, setOfficers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

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
    const [isAnalyzing, setIsAnalyzing] = useState(false); // New State for Context Generation

    // Approval Modal
    const [selectedOfficer, setSelectedOfficer] = useState<User | null>(null);
    const [assignRole, setAssignRole] = useState<string>('Vice Governor');
    const [customRole, setCustomRole] = useState('');
    const [permissions, setPermissions] = useState({
        official_letter: false,
        activity_proposal: false,
        constitution: false
    });

    useEffect(() => {
        fetchData();
    }, [user.department]);

    const fetchData = async () => {
        if (!user.department) return;
        setLoading(true);
        try {
            // Fetch Officers
            const { data: officerData, error: offError } = await supabase
                .from('user_roles')
                .select(`*, profiles:user_id (full_name, email, avatar_url)`)
                .eq('department', user.department)
                .eq('role', 'officer')
                .in('status', ['active', 'pending', 'disabled'])
                .order('created_at', { ascending: false });

            if (offError) throw offError;

            const mapUser = (r: any) => ({
                id: r.user_id,
                email: r.profiles?.email,
                full_name: r.profiles?.full_name,
                avatar_url: r.profiles?.avatar_url,
                role_id: r.id,
                user_type: r.role,
                specific_role: r.specific_role,
                department: r.department,
                status: r.status,
                permissions: r.permissions
            });
            setOfficers(officerData?.map(mapUser) || []);

            // Fetch Templates
            const { data: tmplData } = await supabase
                .from('department_templates')
                .select('*')
                .eq('department', user.department);
            setTemplates(tmplData || []);

            // Fetch Datasets
            const { data: dsData } = await supabase
                .from('department_datasets')
                .select('*')
                .eq('department', user.department);
            setDatasets(dsData || []);

            // Fetch Organization Name
            const { data: settingsData } = await supabase
                .from('department_settings')
                .select('organization_name')
                .eq('department', user.department)
                .maybeSingle();
            if (settingsData) setOrgName(settingsData.organization_name);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDisableOfficer = async (officer: User) => {
        confirmAction({
            title: "Disable Account",
            message: `Are you sure you want to disable ${officer.full_name}'s account? They will no longer be able to access their workspace.`,
            variant: "error",
            confirmLabel: "Disable Account",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('user_roles')
                        .update({ status: 'disabled' })
                        .eq('id', officer.role_id);

                    if (error) throw error;
                    showToast("Account disabled successfully", "success");
                    setSelectedOfficer(null);
                    fetchData();
                } catch (err) {
                    console.error(err);
                    showToast("Failed to disable account", "error");
                }
            }
        });
    };

    const handleApproveOfficer = async () => {
        if (!selectedOfficer) return;
        const finalRole = assignRole === 'Other' ? customRole : assignRole;

        const finalPermissions = {
            official_letter: permissions.official_letter ? 'edit' : 'view',
            activity_proposal: permissions.activity_proposal ? 'edit' : 'view',
            constitution: permissions.constitution ? 'edit' : 'view'
        };

        try {
            const { error } = await supabase.from('user_roles').update({
                status: 'active',
                specific_role: finalRole,
                permissions: finalPermissions,
                managed_by_role_id: user.role_id
            }).eq('id', selectedOfficer.role_id);

            if (error) throw error;
            showToast(selectedOfficer.status === 'disabled' ? "Account re-enabled successfully" : "Officer approved successfully", "success");
            setSelectedOfficer(null);
            fetchData();
        } catch (err) {
            console.error(err);
            showToast("Failed to update account", "error");
        }
    };

    const handleEditOfficer = (officer: User) => {
        setSelectedOfficer(officer);
        if (['Vice Governor', 'Secretary', 'Treasurer', 'Auditor', 'P.I.O', 'Business Manager', 'Sgt. at Arms'].includes(officer.specific_role || '')) {
            setAssignRole(officer.specific_role || 'Vice Governor');
            setCustomRole('');
        } else {
            setAssignRole('Other');
            setCustomRole(officer.specific_role || '');
        }
        setPermissions({
            official_letter: officer.permissions?.official_letter === 'edit',
            activity_proposal: officer.permissions?.activity_proposal === 'edit',
            constitution: officer.permissions?.constitution === 'edit'
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

        try {
            // 1. Parse File to Text
            const textContent = await parseFile(uploadFile);

            if (uploadCategory === 'template') {
                // 1. Check for existing template to delete old storage file
                const { data: existingTemplate } = await supabase
                    .from('department_templates')
                    .select('file_url')
                    .eq('department', user.department)
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
                const fileName = `${user.department}_${sanitizedType}_${uploadTemplateIndex}_${timestamp}.${fileExt}`;
                const filePath = `${user.department}/${fileName}`;

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
                // Remove onConflict so supabase uses primary key / unique constraint automatically
                const { error } = await supabase.from('department_templates').upsert({
                    department: user.department,
                    document_type: uploadType,
                    template_index: uploadTemplateIndex,
                    content: textContent, // Keep text for AI reference
                    file_url: publicUrl,
                    file_name: uploadFile.name,
                    updated_by: user.id
                });

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
                    department: user.department,
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
            showToast(`Failed to upload ${uploadCategory}. ${(err as Error).message}`, "error");
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

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 flex">
            {/* Mobile Header */}
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

                    {user.specific_role !== 'University Official' && (
                        <button
                            onClick={() => { setActiveTab('knowledge'); setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${activeTab === 'knowledge'
                                ? 'bg-blue-50 text-blue-600 shadow-sm'
                                : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800'
                                }`}
                        >
                            <Library className={`w-6 h-6 ${activeTab === 'knowledge' ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'} transition-colors`} />
                            <span className="font-bold text-lg">Archive</span>
                        </button>
                    )}

                    <button
                        onClick={() => { setActiveTab('officers'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${activeTab === 'officers'
                            ? 'bg-blue-50 text-blue-600 shadow-sm'
                            : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                    >
                        <Users className={`w-6 h-6 ${activeTab === 'officers' ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'} transition-colors`} />
                        <span className="font-bold text-lg">Officers</span>
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
                    {activeTab === 'officers' && (
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 dark:text-white">{user.department} Officers</h2>

                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                                {officers.map(officer => (
                                    <div key={officer.role_id} className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between last:border-0 hover:bg-gray-50 transition dark:border-gray-700 dark:hover:bg-gray-700 gap-4">
                                        <div className="flex items-center gap-4 w-full sm:w-auto">
                                            <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300 overflow-hidden">
                                                {officer.avatar_url ? (
                                                    <img src={officer.avatar_url} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    officer.full_name.charAt(0)
                                                )}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h4 className="font-bold text-gray-900 dark:text-white truncate">{officer.full_name}</h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{officer.email}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${officer.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                                                        {officer.status}
                                                    </span>
                                                    {officer.specific_role && <span className="text-xs text-blue-600 font-medium dark:text-blue-400">{officer.specific_role}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-full sm:w-auto flex justify-end">
                                            {officer.status === 'pending' && (
                                                <button
                                                    onClick={() => setSelectedOfficer(officer)}
                                                    className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
                                                >
                                                    Review Request
                                                </button>
                                            )}

                                            {(officer.status === 'active' || officer.status === 'disabled') && (
                                                <button
                                                    onClick={() => handleEditOfficer(officer)}
                                                    className={`p-2 transition ${officer.status === 'disabled' ? 'text-red-400 hover:text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                                                    title={officer.status === 'disabled' ? "Re-enable & Edit" : "Edit Permissions"}
                                                >
                                                    {officer.status === 'disabled' ? <Power className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {officers.length === 0 && <div className="p-8 text-center text-gray-500">No officers found.</div>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'knowledge' && (
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 dark:text-white">{user.department} Resources</h2>

                            <div className="hidden lg:grid grid-cols-2 gap-8">
                                {/* Previous Desktop UI: Grouped Templates & Datasets */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
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

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white">
                                            <Library className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Datasets
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
                                        {[DocumentType.ACTIVITY_PROPOSAL, DocumentType.OFFICIAL_LETTER].map(type => {
                                            const typeDatasets = datasets.filter(d => d.document_type === type);
                                            return (
                                                <div key={type} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider text-[10px]">{type}</h4>
                                                        <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full dark:text-gray-300 text-[10px]">{typeDatasets.length} files</span>
                                                    </div>

                                                    {typeDatasets.length === 0 ? (
                                                        <div className="text-xs text-gray-400 italic py-2 text-center">No datasets uploaded</div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {typeDatasets.map(ds => (
                                                                <div key={ds.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition group">
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        <FileText className="w-3 h-3 text-gray-400 dark:text-gray-400 flex-shrink-0" />
                                                                        <span className="text-[11px] text-gray-700 truncate dark:text-gray-200 font-medium" title={ds.description}>{ds.description}</span>
                                                                    </div>
                                                                    <button onClick={() => handleDeleteDataset(ds.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors">
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

                            {/* Mobile Grid Layout */}
                            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[DocumentType.ACTIVITY_PROPOSAL, DocumentType.OFFICIAL_LETTER, DocumentType.CONSTITUTION].map(type => (
                                    <div key={type} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-4 border-b pb-4 dark:border-gray-700">
                                            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{type}</h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Templates</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {[1, 2].map(index => {
                                                const exists = templates.find(t => t.document_type === type && t.template_index === index);
                                                return (
                                                    <div key={index} className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Template {index}</span>
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 w-fit ${exists ? 'bg-green-50 text-green-600 dark:bg-green-900/30' : 'bg-gray-50 text-gray-400 dark:bg-gray-700/50'}`}>
                                                                {exists ? 'Ready' : 'Missing'}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => openUploadModal('template', type, index)}
                                                            className="text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg"
                                                        >
                                                            {exists ? 'Replace' : 'Upload'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                                                    <Library className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 dark:text-white leading-tight">Archive</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Reference Materials</p>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">AI-powered knowledge base for smarter document drafts.</p>
                                    </div>
                                    <button
                                        onClick={() => openUploadModal('dataset')}
                                        className="w-full py-3 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-xl font-bold text-sm hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Add Dataset
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'analytics' && (
                        <Analytics type="department" department={user.department} />
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 dark:text-white">Department Settings</h2>

                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2 dark:text-gray-300">Organization Name</label>
                                    <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">This will be auto-filled in the Manual Drafting form for all members of your department.</p>
                                    <input
                                        type="text"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        placeholder="e.g. CITE Student Organization"
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
                            </div>
                        </div>
                    )}
                </div>
            </main>

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
                                    disabled={uploadCategory === 'template'} // Template type is fixed by the button clicked
                                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-900 disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value={DocumentType.ACTIVITY_PROPOSAL}>Activity Proposal</option>
                                    <option value={DocumentType.OFFICIAL_LETTER}>Official Letter</option>
                                    {uploadCategory === 'template' && (
                                        <option value={DocumentType.CONSTITUTION}>Constitution & By-Laws</option>
                                    )}
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
                                        <Library className="w-4 h-4 text-purple-600 mt-0.5 dark:text-purple-400" />
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
            {selectedOfficer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
                        <h3 className="text-xl font-bold mb-4 dark:text-white">
                            {selectedOfficer.status === 'pending' ? 'Approve Officer' : (selectedOfficer.status === 'disabled' ? 'Re-enable Officer' : 'Edit Officer Access')}
                        </h3>
                        <p className="text-gray-600 mb-6 dark:text-gray-300">Assign role and permissions for <strong>{selectedOfficer.full_name}</strong>.</p>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Role</label>
                                <select
                                    value={assignRole}
                                    onChange={(e) => setAssignRole(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500"
                                >
                                    <option>Vice Governor</option>
                                    <option>Secretary</option>
                                    <option>Treasurer</option>
                                    <option>Auditor</option>
                                    <option>P.I.O</option>
                                    <option>Business Manager</option>
                                    <option>Sgt. at Arms</option>
                                    <option>Other</option>
                                </select>
                                {assignRole === 'Other' && (
                                    <input
                                        type="text"
                                        placeholder="Enter Role Name"
                                        value={customRole}
                                        onChange={(e) => setCustomRole(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 mt-2 outline-none focus:ring-2 focus:ring-blue-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Edit Access</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={permissions.official_letter}
                                            onChange={(e) => setPermissions({ ...permissions, official_letter: e.target.checked })}
                                            className="rounded text-blue-900 focus:ring-blue-900 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Official Letter</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={permissions.activity_proposal}
                                            onChange={(e) => setPermissions({ ...permissions, activity_proposal: e.target.checked })}
                                            className="rounded text-blue-900 focus:ring-blue-900 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Activity Proposal</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={permissions.constitution}
                                            onChange={(e) => setPermissions({ ...permissions, constitution: e.target.checked })}
                                            className="rounded text-blue-900 focus:ring-blue-900 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Constitution & By-Laws</span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">* Unchecked items will be View Only.</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <button onClick={() => setSelectedOfficer(null)} className="flex-1 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
                                <button
                                    onClick={handleApproveOfficer}
                                    className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg hover:bg-blue-800 font-medium"
                                >
                                    {selectedOfficer.status === 'pending' ? 'Confirm Approval' : (selectedOfficer.status === 'disabled' ? 'Enable & Save' : 'Save Changes')}
                                </button>
                            </div>
                            {selectedOfficer.status === 'active' && (
                                <button
                                    onClick={() => handleDisableOfficer(selectedOfficer)}
                                    className="w-full py-2.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-red-100 dark:text-red-400 dark:hover:bg-red-900/20 dark:border-red-900/50"
                                >
                                    <Power className="w-4 h-4" /> Disable Account
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
