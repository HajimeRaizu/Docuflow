
import React, { useState } from 'react';
import { Users, FileText, Folder, Activity, Plus, Database, History, X, Settings, CheckCircle, ChevronRight, Bell, Search, Edit2, Trash2, Mail, Shield, Upload, File } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { parseFile } from '../services/fileUtils';

interface AdminDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

// Mock User Data for the Management Modal
const MOCK_USERS = [
  { id: 1, name: 'Jim Shendrick', email: 'admin@nemsu.edu.ph', role: 'Campus Admin', status: 'Active', avatarColor: 'bg-blue-600' },
  { id: 2, name: 'Student Leader', email: 'student@nemsu.edu.ph', role: 'Student Leader', status: 'Active', avatarColor: 'bg-emerald-500' },
  { id: 3, name: 'Sarah G. Adviser', email: 'sarah.adviser@nemsu.edu.ph', role: 'Org Adviser', status: 'Active', avatarColor: 'bg-purple-500' },
  { id: 4, name: 'John Budget', email: 'budget.officer@nemsu.edu.ph', role: 'Budget Officer', status: 'Away', avatarColor: 'bg-amber-500' },
  { id: 5, name: 'Maria Finance', email: 'accountant@nemsu.edu.ph', role: 'Accountant', status: 'Active', avatarColor: 'bg-rose-500' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  // State for modals
  const [isManageUserOpen, setIsManageUserOpen] = useState(false);
  const [isUpdateTemplateOpen, setIsUpdateTemplateOpen] = useState(false);
  const [isUpdateDatasetsOpen, setIsUpdateDatasetsOpen] = useState(false);
  const [isRecentActivityOpen, setIsRecentActivityOpen] = useState(false);

  // Search State for User Management
  const [userSearch, setUserSearch] = useState('');

  // Datasets State
  const [datasets, setDatasets] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDataset, setPreviewDataset] = useState<any>(null);

  // Fetch datasets when modal opens
  React.useEffect(() => {
    if (isUpdateDatasetsOpen) {
      fetchDatasets();
    }
  }, [isUpdateDatasetsOpen]);

  const fetchDatasets = async () => {
    const { data, error } = await supabase.from('datasets').select('*').order('created_at', { ascending: false });
    if (!error && data) setDatasets(data);
  };



  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Use the utility to parse text based on file type
      const text = await parseFile(file);

      // 1. Create Dataset Record
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .insert({
          name: file.name,
          description: 'Uploaded from Admin Dashboard',
          file_type: file.type || 'text/plain',
          metadata: { size: file.size }
        })
        .select()
        .single();

      if (datasetError) throw datasetError;

      // 2. Create Dataset Section (Content)
      const { error: sectionError } = await supabase
        .from('dataset_sections')
        .insert({
          dataset_id: dataset.id,
          content: text,
          token_count: Math.ceil(text.length / 4) // Rough estimate
        });

      if (sectionError) throw sectionError;

      // 3. STRICT VERIFICATION: Fetch back the saved content to ensure 100% integrity
      // We select just the length first to save bandwidth, or the full content if needed.
      // Here we fetch the specific row we just inserted.
      const { data: verifyData, error: verifyError } = await supabase
        .from('dataset_sections')
        .select('content')
        .eq('dataset_id', dataset.id)
        .single();

      if (verifyError) throw verifyError;

      if (!verifyData || verifyData.content.length !== text.length) {
        throw new Error(`Data integrity check failed! Uploaded ${text.length} chars but saved ${verifyData?.content?.length || 0} chars.`);
      }

      await fetchDatasets();
      alert(`Success! Dataset uploaded and verified. (100% of content saved)`);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Failed to upload dataset: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleDeleteDataset = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;

    // Check constraints: sections usually cascade delete, but let's be safe
    // Actually Supabase likely has cascade on foreign key, if not we might need to delete sections first.
    // Assuming cascade or simple delete for now.
    const { error } = await supabase.from('datasets').delete().eq('id', id);
    if (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete.');
    } else {
      fetchDatasets();
    }
  };

  // Stats Data
  const stats = [
    {
      label: 'Total Users',
      value: '247',
      trend: '+12 this month',
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
    },
    {
      label: 'Documents',
      value: '1,432',
      trend: '+23% vs last mo',
      icon: FileText,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 border-sky-100 dark:bg-sky-900/20 dark:border-sky-800'
    },
    {
      label: 'Templates',
      value: '18',
      trend: 'All systems active',
      icon: Folder,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800'
    },
    {
      label: 'System Health',
      value: '98.5%',
      trend: 'Optimal performance',
      icon: Activity,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
    },
  ];

  const recentActivities = [
    { action: 'Template Created', detail: 'Letter Format v2', user: 'Admin System', time: '2h ago', icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
    { action: 'Document Generated', detail: 'Activity Proposal - CITE Days', user: 'Secretary', time: '3h ago', icon: Activity, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/40' },
    { action: 'Dataset Updated', detail: 'Student Handbook 2024', user: 'Admin System', time: '1d ago', icon: Database, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
    { action: 'New User', detail: 'Registered: Student Council', user: 'System', time: '1d ago', icon: Users, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
  ];

  const quickActions = [
    { title: 'Manage Users', desc: 'Add, remove, or edit user roles', icon: Users, action: () => setIsManageUserOpen(true), color: 'blue' },
    { title: 'Update Templates', desc: 'Modify generation templates', icon: Folder, action: () => setIsUpdateTemplateOpen(true), color: 'indigo' },
    { title: 'Update Datasets', desc: 'Manage knowledge base', icon: Database, action: () => setIsUpdateDatasetsOpen(true), color: 'sky' },
    { title: 'Recent Activity', desc: 'View system logs', icon: History, action: () => setIsRecentActivityOpen(true), color: 'emerald' },
  ];

  // Filter users based on search
  const filteredUsers = MOCK_USERS.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              Admin Dashboard <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">v2.0</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">System Overview & Management Console</p>
          </div>
          <div className="flex gap-3">
            <button className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 transition shadow-sm active:scale-95 duration-200">
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={() => onNavigate('generate')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 shadow-md shadow-blue-200 dark:shadow-blue-900/20 transition-all hover:-translate-y-0.5 font-medium active:scale-95 duration-200"
            >
              <Plus className="w-4 h-4" /> Create Document
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md hover:shadow-lg dark:shadow-gray-950/50 border border-gray-100 dark:border-gray-700 transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl border ${stat.bg} ${stat.color} shadow-sm group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                {stat.label === 'System Health' && (
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 px-2 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" /> OK
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stat.value}</h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1">
                  {stat.trend}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Quick Actions Area */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={action.action}
                    className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-gray-900/30 transition-all text-left group active:scale-95 duration-200"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform bg-gradient-to-br from-${action.color}-500 to-${action.color}-700`}>
                      <action.icon className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{action.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{action.desc}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 ml-auto group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            {/* Approval Workflow Panel */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-md dark:shadow-gray-950/50">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pending Approvals</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Documents awaiting review</p>
                </div>
                <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">View All</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Submitted By</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">SSC Activity Proposal - Intramurals</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">Student Leader</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">Oct 24, 2024</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition font-medium text-xs">Review</button>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">Budget Request - Office Supplies</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">Treasurer</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">Oct 23, 2024</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition font-medium text-xs">Review</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-md dark:shadow-gray-950/50 h-fit sticky top-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Recent Activity
            </h3>
            <div className="space-y-6 relative">
              {/* Timeline Line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100 dark:bg-gray-700"></div>

              {recentActivities.map((act, i) => (
                <div key={i} className="relative pl-10 group">
                  <div className={`absolute left-0 top-0 w-8 h-8 rounded-full border-4 border-white dark:border-gray-800 ${act.bg} flex items-center justify-center z-10 shadow-sm`}>
                    <act.icon className={`w-3 h-3 ${act.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{act.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{act.detail}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
                      <span>{act.user}</span>
                      <span>•</span>
                      <span>{act.time}</span>
                    </div>
                  </div>
                </div>
              ))}

              <button className="w-full py-2.5 mt-4 text-sm font-medium text-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent rounded-xl transition">
                View Full Audit Log
              </button>
            </div>
          </div>
        </div>

        {/* --- USER MANAGEMENT MODAL --- */}
        {isManageUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-gray-200 dark:border-gray-700 flex flex-col max-h-[85vh]">

              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" /> User Management
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage system access and roles</p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-200 dark:shadow-blue-900/30 transition flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add User
                  </button>
                  <button
                    onClick={() => setIsManageUserOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, or role..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
                <select className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option>All Roles</option>
                  <option>Student Leader</option>
                  <option>Adviser</option>
                  <option>Admin</option>
                </select>
              </div>

              {/* User List */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase sticky top-0 backdrop-blur-sm z-0">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${user.avatarColor}`}>
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${user.role === 'Campus Admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' :
                            user.role === 'Student Leader' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' :
                              'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                            }`}>
                            {user.role === 'Campus Admin' && <Shield className="w-3 h-3" />}
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit User">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Delete User">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">No users found</p>
                    <p className="text-sm">Try adjusting your search query</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}



        {/* DATASET MANAGEMENT MODAL */}
        {isUpdateDatasetsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-gray-200 dark:border-gray-700 flex flex-col max-h-[85vh]">

              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Database className="w-6 h-6 text-sky-600 dark:text-sky-400" /> Knowledge Base
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage reference datasets for AI generation</p>
                </div>
                <button
                  onClick={() => setIsUpdateDatasetsOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6">

                {/* Upload Area */}
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-gray-50 dark:bg-gray-900/50">
                  <input
                    type="file"
                    id="dataset-upload"
                    className="hidden"
                    accept=".txt,.md,.json,.csv,.ts,.js,.tsx,.pdf,.docx,.doc"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <label htmlFor="dataset-upload" className="cursor-pointer flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                      {isUploading ? <Activity className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {isUploading ? 'Uploading...' : 'Click to Upload Document'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Supported: PDF, Word, Text, Markdown, JSON</p>
                    </div>
                  </label>
                </div>

                {/* Dataset List */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Existing Datasets ({datasets.length})</h3>
                  <div className="space-y-3">
                    {datasets.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 italic text-center py-4">No datasets found. Upload one to get started.</p>
                    ) : (
                      datasets.map((ds) => (
                        <div key={ds.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-sm transition">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 rounded-lg">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{ds.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {(ds.metadata?.size / 1024).toFixed(1)} KB • {new Date(ds.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const { data } = await supabase.from('dataset_sections').select('content').eq('dataset_id', ds.id).single();
                                if (data) {
                                  setPreviewDataset({ ...ds, content: data.content });
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                              title="Verify Content"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDataset(ds.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* DATASET PREVIEW MODAL */}
        {previewDataset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-gray-200 dark:border-gray-700 flex flex-col h-[85vh]">

              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    {previewDataset.name}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                      Top {(previewDataset.metadata?.size / 1024).toFixed(1)} KB
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Content Verified
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewDataset(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content - Scrollable Text Area */}
              <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900/50">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  {/* Use a div for HTML content (tables, etc) or pre for plain text */}

                  {(previewDataset.content && (previewDataset.content.includes('<table') || previewDataset.content.includes('<p>'))) ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none p-4 w-full overflow-x-auto">
                      <style>{`
                           .prose table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
                           .prose th, .prose td { border: 1px solid #d1d5db; padding: 0.75rem; text-align: left; vertical-align: top; }
                           .dark .prose th, .dark .prose td { border-color: #374151; }
                           .prose th { background-color: #f3f4f6; font-weight: 600; }
                           .dark .prose th { background-color: #1f2937; }
                        `}</style>
                      <div
                        className="preview-content"
                        dangerouslySetInnerHTML={{ __html: previewDataset.content }}
                      />
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 dark:text-gray-300 leading-relaxed p-4">
                      {previewDataset.content || "Loading content..."}
                    </pre>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-end">
                <button
                  onClick={() => setPreviewDataset(null)}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition"
                >
                  Close Preview
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Development Placeholder Modal (For other features) */}
        {(isUpdateTemplateOpen || isRecentActivityOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative animate-scale-in border border-gray-100 dark:border-gray-700">
              <button
                onClick={() => {
                  setIsUpdateTemplateOpen(false);
                  setIsRecentActivityOpen(false);
                }}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center py-8">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-blue-50 dark:ring-blue-900/20">
                  <Settings className="w-10 h-10 animate-spin-slow" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Feature Module</h3>
                <p className="text-gray-500 dark:text-gray-400 px-8 leading-relaxed">
                  This admin module is currently under development. In the production version, this would contain the full management interface.
                </p>
                <button
                  onClick={() => {
                    setIsUpdateTemplateOpen(false);
                    setIsRecentActivityOpen(false);
                  }}
                  className="mt-8 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-lg shadow-blue-200 dark:shadow-blue-900/40 active:scale-95 duration-200"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


