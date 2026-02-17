import React, { useState, useEffect } from 'react';
import { User, GeneratedDocument, Department, UserRole } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { Archive, Copy, FileText, Search, Filter, Loader, Calendar } from 'lucide-react';

interface ArchiveViewProps {
    user: User;
    onUseReference: (doc: GeneratedDocument) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ user, onUseReference }) => {
    const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [years, setYears] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    const isSuperAdmin = user.user_type === UserRole.SUPER_ADMIN;
    const departments: Department[] = ['CITE', 'CAS', 'CBM', 'CTE', 'CET', 'USG', 'System Administration'];

    // Initialize with user's department, or first department if super admin (or 'CITE' as fallback)
    const [selectedDepartment, setSelectedDepartment] = useState<string>(
        isSuperAdmin ? 'CITE' : (user.department || 'CITE')
    );

    useEffect(() => {
        console.log("ArchiveView mounted. User:", user);
        console.log("isSuperAdmin:", isSuperAdmin);
        console.log("Initial selectedDepartment:", selectedDepartment);
        fetchYears();
    }, []);

    useEffect(() => {
        fetchYears();
    }, [selectedDepartment]); // Refetch years when department changes

    useEffect(() => {
        if (selectedYear) {
            fetchDocuments(selectedYear);
        }
    }, [selectedYear, selectedDepartment]); // Refetch docs when year or department changes


    const fetchYears = async () => {
        try {
            console.log("Fetching years for department:", selectedDepartment);
            // Fetch distinct school_years
            const { data, error } = await supabase
                .from('documents')
                .select('school_year')
                .eq('department', selectedDepartment) // Use selectedDepartment
                .eq('status', 'Archived') // Only show years with archived docs
                .not('school_year', 'is', null);

            if (error) throw error;

            console.log("Raw years data:", data);

            const distinctYears = Array.from(new Set(data.map(d => d.school_year))).sort().reverse();
            console.log("Distinct years:", distinctYears);

            setYears(distinctYears);
            if (distinctYears.length > 0) setSelectedYear(distinctYears[0]);
            else {
                setSelectedYear('');
                setDocuments([]);
            }
        } catch (err) {
            console.error("Error fetching years:", err);
        }
    };

    const fetchDocuments = async (year: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*, profiles:user_id(full_name)')
                .select('*, profiles:user_id(full_name)')
                .eq('department', selectedDepartment) // Use selectedDepartment
                .eq('school_year', year)
                .eq('status', 'Archived') // Only show archived docs
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log("Fetched documents for archive:", data); // Debugging

            // Transform to GeneratedDocument type
            const docs: (GeneratedDocument & { author?: string })[] = data.map((d: any) => ({
                id: d.id,
                title: d.title,
                type: d.type as any,
                content: d.content,
                status: d.status as any,
                createdAt: new Date(d.created_at),
                department: d.department,
                school_year: d.school_year,
                author: d.profiles?.full_name || 'Unknown Author'
            }));
            setDocuments(docs);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc as any).author?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-serif italic text-blue-900 dark:text-blue-400 mb-2">Document Archives</h1>
                <p className="text-gray-600 dark:text-gray-300">Browse and reference documents from previous academic years.</p>
            </header>

            <div className="flex flex-col md:flex-row gap-4 mb-8">


                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search archives by title, type, or author..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:ring-blue-500"
                    />
                </div>

                {/* Department Filter (Super Admin Only) */}
                {isSuperAdmin && (
                    <div className="w-full md:w-64 relative">
                        <Filter className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none appearance-none bg-white font-medium text-blue-900 dark:bg-gray-800 dark:border-gray-700 dark:text-blue-400"
                        >
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="w-full md:w-64 relative">
                    <Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none appearance-none bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                        {years.length === 0 && <option>No Archives Found</option>}
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {loading && years.length > 0 ? (
                <div className="flex justify-center py-12">
                    <Loader className="w-8 h-8 animate-spin text-blue-900 dark:text-blue-400" />
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 dark:bg-gray-800/50 dark:border-gray-700">
                    <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3 dark:text-gray-600" />
                    <p className="text-gray-500 dark:text-gray-400">No documents found for this year.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDocs.map((doc: any) => (
                        <div key={doc.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition group dark:bg-gray-800 dark:border-gray-700">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center dark:bg-blue-900/30 dark:text-blue-400">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded dark:bg-gray-700 dark:text-gray-300">
                                    {new Date(doc.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1 truncate dark:text-gray-100">{doc.title}</h3>
                            <p className="text-xs text-blue-600 font-medium mb-1 dark:text-blue-400">{doc.type}</p>
                            <p className="text-xs text-gray-500 mb-4 flex items-center gap-1 dark:text-gray-400">
                                <span className="font-semibold">By:</span> {doc.author}
                            </p>

                            <button
                                onClick={() => onUseReference(doc)}
                                className="w-full py-2 border border-blue-900 text-blue-900 rounded-lg font-medium hover:bg-blue-900 hover:text-white transition flex items-center justify-center gap-2 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
                            >
                                <Copy className="w-4 h-4" /> Use as Reference
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
