import React, { useState, useEffect } from 'react';
import { User, SpecificRole, Department, DocumentType } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { Users, FileText, Upload, Trash2, Check, X, Shield, Plus, LogOut, Settings, Database, Archive, Home, Loader, AlertCircle } from 'lucide-react';
import { parseFile } from '../../services/fileUtils';
import { generateDatasetContext, generateEmbedding } from '../../services/geminiService';


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
    const [activeTab, setActiveTab] = useState<'officers' | 'knowledge' | 'archives'>('officers');
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
                .neq('status', 'disabled')
                .order('created_at', { ascending: false });

            if (offError) throw offError;

            const mapUser = (r: any) => ({
                id: r.user_id,
                email: r.profiles?.email,
                full_name: r.profiles?.full_name,
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

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
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
            setSelectedOfficer(null);
            fetchData();
        } catch (err) {
            console.error(err);
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

        try {
            // 1. Parse File to Text
            const textContent = await parseFile(uploadFile);

            if (uploadCategory === 'template') {
                // Upload Template (Storage + DB)
                const fileExt = uploadFile.name.split('.').pop();
                const fileName = `${user.department}_${uploadType}.${fileExt}`;
                const filePath = `${user.department}/${fileName}`;

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
                    department: user.department,
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
                    <p className="text-blue-200 text-sm dark:text-gray-400">{user.department} Admin</p>
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
                        onClick={() => setActiveTab('officers')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'officers' ? 'bg-white/10 text-white dark:bg-gray-700' : 'text-blue-200 hover:bg-white/5 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                    >
                        <Users className="w-5 h-5" />
                        Officers
                    </button>
                    {user.specific_role !== 'University Official' && (
                        <button
                            onClick={() => setActiveTab('knowledge')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'knowledge' ? 'bg-white/10 text-white dark:bg-gray-700' : 'text-blue-200 hover:bg-white/5 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                        >
                            <Database className="w-5 h-5" />
                            Knowledge Base
                        </button>
                    )}
                </nav>

                <div className="p-4 border-t border-blue-800 dark:border-gray-700">
                    <div className="mb-4 px-4">
                        <p className="text-sm font-bold">{user.full_name}</p>
                        <p className="text-xs text-blue-300 dark:text-blue-400">{user.specific_role}</p>
                    </div>
                    <button onClick={onLogout} className="flex items-center gap-2 text-blue-200 hover:text-white transition w-full px-4 dark:text-gray-400 dark:hover:text-white">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </aside>

            <main className="flex-1 ml-64 p-8">
                {activeTab === 'officers' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 dark:text-white">{user.department} Officers</h2>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                            {officers.map(officer => (
                                <div key={officer.role_id} className="p-4 border-b border-gray-100 flex items-center justify-between last:border-0 hover:bg-gray-50 transition dark:border-gray-700 dark:hover:bg-gray-700">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                            {officer.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">{officer.full_name}</h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{officer.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${officer.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                                                    {officer.status}
                                                </span>
                                                {officer.specific_role && <span className="text-xs text-blue-600 font-medium dark:text-blue-400">{officer.specific_role}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {officer.status === 'pending' && (
                                        <button
                                            onClick={() => setSelectedOfficer(officer)}
                                            className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
                                        >
                                            Review Request
                                        </button>
                                    )}

                                    {officer.status === 'active' && (
                                        <button
                                            onClick={() => handleEditOfficer(officer)}
                                            className="p-2 text-gray-400 hover:text-gray-600"
                                        >
                                            <Settings className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {officers.length === 0 && <div className="p-8 text-center text-gray-500">No officers found.</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'knowledge' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 dark:text-white">{user.department} Resources</h2>

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
                    </div>
                )}
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
            {selectedOfficer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
                        <h3 className="text-xl font-bold mb-4 dark:text-white">
                            {selectedOfficer.status === 'pending' ? 'Approve Officer' : 'Edit Officer Access'}
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

                        <div className="flex gap-3">
                            <button onClick={() => setSelectedOfficer(null)} className="flex-1 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
                            <button
                                onClick={handleApproveOfficer}
                                className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg hover:bg-blue-800 font-medium"
                            >
                                {selectedOfficer.status === 'pending' ? 'Confirm Approval' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
