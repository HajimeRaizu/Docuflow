
import React, { useEffect, useState } from 'react';
import { MoreVertical, Download, Clock, Trash2, Eye, History, X, ChevronRight, Share2, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { GeneratedDocument, DocumentVersion, User, DocumentType, DocumentTypeIcon } from '../types';
import { useNotification } from './NotificationProvider';

interface DocumentListProps {
    user: User;
    onNavigate: (view: string, params?: any) => void;
    initialTab?: 'my' | 'shared';
    initialType?: DocumentType | 'ALL';
}

export const DocumentList: React.FC<DocumentListProps> = ({ user, onNavigate, initialTab = 'my', initialType = 'ALL' }) => {
    const { showToast, confirm: confirmAction } = useNotification();
    const [docs, setDocs] = useState<GeneratedDocument[]>([]);
    const [historyDoc, setHistoryDoc] = useState<GeneratedDocument | null>(null);
    const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);

    const [activeTab, setActiveTab] = useState<'my' | 'shared'>(initialTab);
    const [filterType, setFilterType] = useState<DocumentType | 'ALL'>(initialType);


    // Update state if props change (e.g. navigation from dashboard)
    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
        if (initialType) setFilterType(initialType);
    }, [initialTab, initialType]);

    useEffect(() => {
        const loadDocs = async () => {
            if (!user || !user.id) return;

            try {
                const { data, error } = await supabase
                    .from('documents')
                    .select(`
                        *,
                        profiles:user_id (full_name, avatar_url)
                    `)
                    // Fetch own docs OR docs shared with department
                    .or(`user_id.eq.${user.id},and(visibility.eq.department,department.eq.${user.department})`)
                    .neq('status', 'Archived') // Exclude archived documents
                    .order('updated_at', { ascending: false });

                if (error) throw error;

                const mappedDocs: GeneratedDocument[] = (data || []).map((d: any) => ({
                    id: d.id,
                    title: d.title,
                    type: d.type,
                    content: d.content,
                    status: d.status,
                    createdAt: new Date(d.created_at),
                    updatedAt: new Date(d.updated_at),

                    versions: d.versions || [],
                    visibility: d.visibility,
                    department: d.department,
                    user_id: d.user_id,
                    author_name: d.profiles?.full_name,
                    author_avatar: d.profiles?.avatar_url,
                    template_index: d.template_index,
                    templateUrl: d.templateUrl
                }));

                setDocs(mappedDocs);
            } catch (e) {
                console.error("Failed to load documents", e);
            }
        };
        loadDocs();
    }, [user, historyDoc]); // Reload when user changes or closing history modal

    const handleDelete = (id: string) => {
        confirmAction({
            title: "Delete Document",
            message: "Are you sure you want to delete this document? This action cannot be undone.",
            variant: "error",
            confirmLabel: "Delete",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('documents')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;

                    const updated = docs.filter(d => d.id !== id);
                    setDocs(updated);
                    showToast("Document deleted successfully", "success");
                } catch (e) {
                    showToast("Failed to delete document", "error");
                }
            }
        });
    };

    const handleToggleShare = async (doc: GeneratedDocument) => {
        const newVisibility = doc.visibility === 'department' ? 'private' : 'department';
        try {
            const { error } = await supabase
                .from('documents')
                .update({
                    visibility: newVisibility,
                    department: user.department // Ensure department is set when sharing
                })
                .eq('id', doc.id);

            if (error) throw error;

            setDocs(docs.map(d => d.id === doc.id ? { ...d, visibility: newVisibility, department: user.department } : d));
        } catch (e) {
            console.error("Failed to update visibility", e);
            showToast("Failed to update share settings.", "error");
        }
    };

    const handleRollback = (version: DocumentVersion) => {
        if (!historyDoc || !user.id) return;

        confirmAction({
            title: 'Restore Version',
            message: `Are you sure you want to rollback to Version ${version.versionNumber}? This will overwrite the current content with this version's content.`,
            confirmLabel: 'Restore',
            onConfirm: async () => {
                try {
                    const currentVersions = historyDoc.versions || [];
                    const newVersion: DocumentVersion = {
                        id: Date.now().toString(),
                        content: version.content,
                        savedAt: new Date(),
                        versionNumber: currentVersions.length + 1,
                        modifiedBy: {
                            id: user.id,
                            name: user.full_name
                        }
                    };

                    const updatedVersions = [...currentVersions, newVersion];

                    const { error } = await supabase
                        .from('documents')
                        .update({
                            content: version.content,
                            versions: updatedVersions,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', historyDoc.id);

                    if (error) throw error;

                    const updatedDoc = {
                        ...historyDoc,
                        content: version.content,
                        versions: updatedVersions,
                        updatedAt: new Date()
                    };

                    setHistoryDoc(updatedDoc);
                    setDocs(docs.map(d => d.id === historyDoc.id ? updatedDoc : d));
                    setPreviewVersion(newVersion);
                    showToast("Version restored successfully", "success");
                } catch (e) {
                    console.error("Failed to restore document", e);
                    showToast("Failed to restore document.", "error");
                }
            }
        });
    };

    // Filter Logic
    const filteredDocs = docs.filter(doc => {
        // Tab Filter
        if (activeTab === 'my' && doc.user_id !== user.id) return false;
        if (activeTab === 'shared' && doc.user_id === user.id) return false;

        // Type Filter
        if (filterType !== 'ALL' && doc.type !== filterType) return false;

        return true;
    });

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                    {activeTab === 'my' ? 'My Documents' : `Shared with ${user.department}`}
                </h1>

                <div className="flex gap-4 w-full md:w-auto">
                    {/* Type Filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as DocumentType | 'ALL')}
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm"
                    >
                        <option value="ALL">All Types</option>
                        {Object.values(DocumentType).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('my')}
                    className={`pb-3 text-sm font-medium transition relative ${activeTab === 'my'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    My Documents
                    {activeTab === 'my' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />}
                </button>
                <button
                    onClick={() => setActiveTab('shared')}
                    className={`pb-3 text-sm font-medium transition relative ${activeTab === 'shared'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    Shared with Me
                    {activeTab === 'shared' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />}
                </button>
            </div>


            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {filteredDocs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No documents found.</p>
                        {activeTab === 'my' && <p className="text-sm">Generate a new document to see it here.</p>}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 whitespace-nowrap">
                                        Document Name
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap">Type</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Author</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Last Modified</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredDocs.map((doc) => (
                                    <tr
                                        key={doc.id}
                                        onClick={() => onNavigate('generate', { type: doc.type, doc: doc })}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center text-blue-600">
                                                    {React.createElement(DocumentTypeIcon[doc.type as DocumentType])}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate" title={doc.title}>
                                                        {doc.title}
                                                    </div>
                                                    {doc.user_id !== user.id && (
                                                        <span className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">Shared</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {doc.type}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-medium">
                                            <div className="flex items-center gap-2">
                                                {doc.author_avatar ? (
                                                    <img src={doc.author_avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                        {(doc.author_name || 'S').charAt(0)}
                                                    </div>
                                                )}
                                                <span>{doc.author_name || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${doc.status === 'Final'
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                }`}>
                                                {doc.status || 'Draft'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex gap-2">
                                                {doc.user_id === user.id && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleToggleShare(doc); }}
                                                            className={`transition ${doc.visibility === 'department' ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300' : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
                                                            title={doc.visibility === 'department' ? "Unshare" : "Share with Department"}
                                                        >
                                                            {doc.visibility === 'department' ? <Users className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setHistoryDoc(doc); }}
                                                            className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                                                            title="View Version History"
                                                        >
                                                            <History className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                                                            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {doc.user_id !== user.id && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setHistoryDoc(doc); }}
                                                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                                                        title="View Version History"
                                                    >
                                                        <History className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* History Modal */}
            {historyDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <History className="w-5 h-5" /> Version History
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{historyDoc.title}</p>
                            </div>
                            <button onClick={() => { setHistoryDoc(null); setPreviewVersion(null); }} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Version List */}
                            <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/30">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Saved Versions</h4>
                                <div className="space-y-2">
                                    {historyDoc.versions?.slice().reverse().map((version) => (
                                        <button
                                            key={version.id}
                                            onClick={() => setPreviewVersion(version)}
                                            className={`w-full text-left p-3 rounded-lg border transition flex flex-col gap-1 ${previewVersion?.id === version.id
                                                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 ring-1 ring-blue-500'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{version.versionNumber === 1 ? "Original Version" : `Version ${version.versionNumber}`}</span>
                                                {previewVersion?.id === version.id && <ChevronRight className="w-4 h-4 text-blue-500" />}
                                            </div>
                                            <span className="text-xs text-gray-500 flex flex-col gap-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {new Date(version.savedAt).toLocaleString()}
                                                </span>
                                                {version.modifiedBy && (
                                                    <span className="text-gray-400 italic">
                                                        Modified by: {version.modifiedBy.name}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    )) || <p className="text-sm text-gray-500 italic">No versions saved.</p>}
                                </div>
                            </div>

                            {/* Preview Area */}
                            <div className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-y-auto p-8">
                                {previewVersion ? (
                                    <div className="max-w-[210mm] mx-auto bg-white text-black shadow-lg p-[20mm] min-h-full">
                                        <div className="mb-4 pb-2 border-b border-gray-200 text-xs text-gray-400 uppercase tracking-widest text-center">
                                            Previewing {previewVersion.versionNumber === 1 ? "Original Version" : `Version ${previewVersion.versionNumber}`} • {new Date(previewVersion.savedAt).toLocaleString()}
                                        </div>
                                        {user.id === historyDoc.user_id && (
                                            <div className="mb-4 text-center">
                                                <button
                                                    onClick={() => handleRollback(previewVersion)}
                                                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition"
                                                >
                                                    Restore this Version
                                                </button>
                                            </div>
                                        )}
                                        <div
                                            className="document-content text-[12pt] font-serif"
                                            dangerouslySetInnerHTML={{ __html: previewVersion.content }}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                        <History className="w-16 h-16 mb-4 opacity-20" />
                                        <p>Select a version to preview content</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
