import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import {
  Users,
  FileText,
  Activity,
  TrendingUp,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Search,
  Library
} from 'lucide-react';
import { DocumentType } from '../../types';

interface AnalyticsProps {
  type: 'global' | 'department';
  department?: string;
}

interface StatItem {
  id: string;
  label: string;
  value: string | number;
  trend?: string;
  isPositive?: boolean;
  icon: React.ElementType;
  color: string;
  bg: string;
}

export const Analytics: React.FC<AnalyticsProps> = ({ type, department }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [docTypeBreakdown, setDocTypeBreakdown] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAnalyticsData();

    // Real-time subscription for instant updates
    const channel = supabase
      .channel('analytics_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        () => {
          fetchAnalyticsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [type, department]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Summary Stats
      let usersQuery: any = supabase.from('profiles').select('id', { count: 'exact', head: true });
      let docsQuery: any = supabase.from('documents').select('id', { count: 'exact', head: true });
      let rolesQuery: any = supabase.from('user_roles').select('id', { count: 'exact', head: true });

      if (type === 'department' && department) {
        usersQuery = supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('department', department);
        docsQuery = docsQuery.eq('department', department);
        rolesQuery = rolesQuery.eq('department', department);
      }

      const [{ count: userCount }, { count: docCount }, { count: roleCount }] = await Promise.all([
        usersQuery,
        docsQuery,
        rolesQuery
      ]);

      // DEBUG: Log all users/roles to help identify "Student Leader" or other accounts
      const { data: debugRoles } = await supabase
        .from('user_roles')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `);

      const mainStats: StatItem[] = [
        {
          id: 'users',
          label: type === 'global' ? 'Total Platform Users' : `${department} Members`,
          value: userCount || 0,
          icon: Users,
          color: 'text-blue-600',
          bg: 'bg-blue-50'
        },
        {
          id: 'docs',
          label: 'Documents Generated',
          value: docCount || 0,
          icon: FileText,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50'
        }
      ];

      // SuperAdmin (global) only needs Users and Docs
      const finalStats = type === 'global' ? mainStats.slice(0, 2) : [
        ...mainStats,
        {
          id: 'active_roles',
          label: 'Active Officers',
          value: roleCount || 0,
          icon: Shield,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50'
        }
      ];

      setStats(finalStats);

      // 2. Doc Type Breakdown
      let breakdownQuery = supabase.from('documents').select('type');
      if (type === 'department' && department) {
        breakdownQuery = breakdownQuery.eq('department', department);
      }
      const { data: breakdownData } = await breakdownQuery;

      const counts: Record<string, number> = {};
      breakdownData?.forEach(d => {
        counts[d.type] = (counts[d.type] || 0) + 1;
      });

      setDocTypeBreakdown(Object.entries(counts).map(([name, value]) => ({ name, value })));

      // 3. Real Activity Data (Fixed Monday - Sunday Week)
      const now = new Date();
      const currentDay = now.getDay(); // 0 is Sun, 1 is Mon
      const diff = currentDay === 0 ? 6 : currentDay - 1; // Days since Monday

      const monday = new Date(now);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(now.getDate() - diff);

      let historyQuery = supabase
        .from('documents')
        .select('created_at')
        .gte('created_at', monday.toISOString());

      if (type === 'department' && department) {
        historyQuery = historyQuery.eq('department', department);
      }

      const { data: historyData } = await historyQuery;

      const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      const weekData: any[] = [];

      // Initialize week from Monday to Sunday
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekData.push({
          day: dayNames[i],
          date: d.toLocaleDateString(),
          count: 0
        });
      }

      historyData?.forEach(doc => {
        const docDate = new Date(doc.created_at).toLocaleDateString();
        const dayEntry = weekData.find(d => d.date === docDate);
        if (dayEntry) {
          dayEntry.count++;
        }
      });

      setActivityData(weekData);

      // 4. Fetch Top Contributors (Real Data with Counts)
      let contribQuery = supabase
        .from('user_roles')
        .select(`
          *,
          profiles(id, full_name, email)
        `);

      if (type === 'department' && department) {
        contribQuery = contribQuery.eq('department', department);
      }

      const { data: allRoles } = await contribQuery;

      // Fetch doc counts for these specific users
      if (allRoles && allRoles.length > 0) {
        const userIds = allRoles.map(r => r.profiles?.id).filter(Boolean);
        const { data: userDocCounts } = await supabase
          .from('documents')
          .select('user_id')
          .in('user_id', userIds);

        const countMap: Record<string, number> = {};
        userDocCounts?.forEach(d => {
          countMap[d.user_id] = (countMap[d.user_id] || 0) + 1;
        });

        const enrichedUsers = allRoles.map(r => ({
          ...r,
          doc_count: countMap[r.profiles?.id] || 0
        }))
          .filter(u => u.doc_count > 0) // Only show users who actually contributed
          .sort((a, b) => b.doc_count - a.doc_count);

        setContributors(enrichedUsers);
      }

    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const [contributors, setContributors] = useState<any[]>([]);

  const filteredContributors = contributors.filter(c =>
    c.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${type === 'global' ? 'lg:grid-cols-2 max-w-4xl' : 'lg:grid-cols-3'} gap-6`}>
        {stats.map((stat) => (
          <div key={stat.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} dark:bg-opacity-10 group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Activity Chart & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Activity */}
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Document Output</h3>
              <p className="text-sm text-gray-500">Activity over the past 7 days</p>
            </div>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>

          <div className="h-64 flex items-end justify-between gap-1 md:gap-3 pt-4">
            {activityData.map((data, i) => {
              const maxVal = Math.max(...activityData.map(d => d.count), 5);
              const heightPercentage = Math.max((data.count / maxVal) * 100, data.count > 0 ? 10 : 2);

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full">
                  <div className="relative w-full flex-1 flex items-end justify-center">
                    <div
                      className={`w-full max-w-[32px] bg-blue-500 hover:bg-blue-400 rounded-t-lg transition-all duration-300 ease-out cursor-pointer relative group/bar shadow-[0_-4px_12px_rgba(59,130,246,0.3)] ${data.count > 0 ? 'opacity-100' : 'opacity-10'}`}
                      style={{ height: `${heightPercentage}%` }}
                    >
                      {data.count > 0 && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all transform translate-y-2 group-hover/bar:translate-y-0 shadow-xl whitespace-nowrap z-20 border border-blue-500/30">
                          {data.count} Documents
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{data.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Type Breakdown Pie/Donut Chart */}
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Documents</h3>
              <p className="text-sm text-gray-500">Breakdown by document type</p>
            </div>
            <PieChartIcon className="w-5 h-5 text-gray-400" />
          </div>

          <div className="flex flex-col items-center justify-around gap-6 md:gap-8 min-h-[16rem] py-4">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 32 32">
                {docTypeBreakdown.length > 0 ? (
                  (() => {
                    const total = docTypeBreakdown.reduce((sum, item) => sum + item.value, 0);
                    let currentOffset = 0;
                    const colors = ['#3B82F6', '#818CF8', '#C084FC'];

                    return docTypeBreakdown.map((item, idx) => {
                      const percentage = (item.value / (total || 1)) * 100;
                      const strokeDasharray = `${percentage} 100`;
                      const strokeDashoffset = -currentOffset;
                      currentOffset += percentage;

                      return (
                        <circle
                          key={idx}
                          cx="16"
                          cy="16"
                          r="14"
                          fill="transparent"
                          stroke={colors[idx % colors.length]}
                          strokeWidth="4"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-1000 ease-out"
                        />
                      );
                    });
                  })()
                ) : (
                  <circle cx="16" cy="16" r="14" fill="transparent" stroke="#E5E7EB" strokeWidth="4" />
                )}
                <circle cx="16" cy="16" r="10" fill="white" className="dark:fill-gray-800" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold dark:text-white">
                  {docTypeBreakdown.reduce((sum, i) => sum + i.value, 0)}
                </span>
                <span className="text-[10px] uppercase text-gray-500 font-bold">Total</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 max-w-sm">
              {docTypeBreakdown.map((item, idx) => {
                const colors = ['bg-blue-500', 'bg-indigo-400', 'bg-purple-400'];
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]} flex-shrink-0`}></div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate" title={item.name}>{item.name}</p>
                      <p className="text-[10px] text-gray-500">{item.value} documents</p>
                    </div>
                  </div>
                );
              })}
              {docTypeBreakdown.length === 0 && <p className="text-xs text-gray-500 italic">No data yet</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard / Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 dark:bg-gray-800/50 gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {type === 'global' ? 'Users' : 'Active Contributors'}
            </h3>
            <p className="text-sm text-gray-500">Efficiency tracking for the current term</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 md:px-6 py-4">{type === 'global' ? 'Department' : 'Officer'}</th>
                <th className="px-3 md:px-6 py-4">Status</th>
                <th className="px-3 md:px-6 py-4 text-center">Output</th>
                <th className="px-3 md:px-6 py-4">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredContributors.map((c, i) => (
                <tr key={c.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {c.profiles?.full_name?.substring(0, 2).toUpperCase() || '??'}
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {c.profiles?.full_name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                      {c.status || 'Offline'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-sm">{c.doc_count}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">{new Date(c.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {contributors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 italic">No contributors found in this scope.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
