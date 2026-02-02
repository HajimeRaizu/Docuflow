
import React, { useEffect, useState } from 'react';
import { FileText, MoreVertical, Download, Clock, Trash2, Eye, History, X, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { GeneratedDocument, DocumentVersion, User } from '../types';

interface DocumentListProps {
    user: User;
    onNavigate: (view: string, params?: any) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ user, onNavigate }) => {
    const [docs, setDocs] = useState<GeneratedDocument[]>([]);
    const [historyDoc, setHistoryDoc] = useState<GeneratedDocument | null>(null);
    const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);

    useEffect(() => {
        const loadDocs = async () => {
            if (!user || !user.id) return;

            try {
                const { data, error } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false });

                if (error) throw error;

                // Map database fields to frontend types if necessary (though they should match mostly)
                // The Supabase query returns columns as snake_case if we didn't alias them?
                // Wait, my type definition has camelCase (createdAt, updatedAt).
                // But my table has snake_case (created_at, updated_at).
                // I need to map them or update the type. 
                // Let's assume the GeneratedDocument type expects camelCase.

                const mappedDocs: GeneratedDocument[] = (data || []).map((d: any) => ({
                    id: d.id,
                    title: d.title,
                    type: d.type,
                    content: d.content,
                    status: d.status,
                    createdAt: new Date(d.created_at),
                    updatedAt: new Date(d.updated_at),
                    versions: d.versions || [] // Handle if versions are stored in JSONB or separate table
                }));

                setDocs(mappedDocs);
            } catch (e) {
                console.error("Failed to load documents", e);
            }
        };
        loadDocs();
    }, [user, historyDoc]); // Reload when user changes or closing history modal

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this document?")) {
            try {
                const { error } = await supabase
                    .from('documents')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                const updated = docs.filter(d => d.id !== id);
                setDocs(updated);
            } catch (e) {
                console.error("Failed to delete document", e);
                alert("Failed to delete document.");
            }
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white mb-6">My Documents</h1>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {docs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No saved documents found.</p>
                        <p className="text-sm">Generate a new document to see it here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 whitespace-nowrap">Document Name</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Type</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Last Modified</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {docs.map((doc) => (
                                    <tr
                                        key={doc.id}
                                        onClick={() => onNavigate('generate', { type: doc.type, doc: doc })}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center text-blue-600">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate" title={doc.title}>
                                                        {doc.title}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {doc.type}
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
                                                <span className="font-bold text-sm text-gray-800 dark:text-gray-200">Version {version.versionNumber}</span>
                                                {previewVersion?.id === version.id && <ChevronRight className="w-4 h-4 text-blue-500" />}
                                            </div>
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {new Date(version.savedAt).toLocaleString()}
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
                                            Previewing Version {previewVersion.versionNumber} • {new Date(previewVersion.savedAt).toLocaleString()}
                                        </div>
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
