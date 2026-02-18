import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import {
  Activity,
  Shield,
  Search,
  LogOut,
  XCircle,
  Mail,
  Cpu,
  Users,
  Clock,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Trophy,
  X,
  ChevronRight,
  RefreshCw,
  BarChart2,
  Zap,
} from 'lucide-react';
import { format, isAfter, subHours, subMinutes, subDays, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const ADMIN_EMAIL = 'antigravitybybulla@gmail.com';

// Fallback prices (USD) for transactions where amount was not recorded.
// Update these to match your Google Play Console prices.
const PRODUCT_PRICES: Record<string, number> = {
  lifetime_pro_access: 4.99,
  pro_access_lifetime: 4.99,
  monthly_pro_pass: 1.99,
};

const getTxnAmount = (tx: Transaction): number => {
  if (tx.amount && tx.amount > 0) return tx.amount;
  return PRODUCT_PRICES[tx.product_id?.toLowerCase()] ?? 0;
};

interface Transaction {
  id: string;
  transaction_id: string;
  device_id: string;
  google_uid: string | null;
  product_id: string;
  status: 'success' | 'failed' | 'pending';
  verified_at: string;
  error_message?: string;
  amount?: number;
  currency?: string;
}

interface UserAccount {
  id: string;
  google_uid: string;
  email?: string;
  tier: string;
  created_at: string;
  last_login?: string;
}

interface UserSession {
  session_token: string;
  user_uid: string;
  created_at: string;
  last_activity?: string;
  is_active?: boolean;
}

interface UserDetail {
  user: UserAccount;
  sessions: UserSession[];
  transactions: Transaction[];
}

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) {
      fetchAllData();
      const unsubscribe = subscribeToAllChanges();
      return () => { unsubscribe(); };
    }
  }, [session]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchTransactions(), fetchUsers(), fetchSessions()]);
    setLoading(false);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('purchase_transactions')
      .select('*')
      .order('verified_at', { ascending: false })
      .limit(200);
    if (error) console.error('Fetch transactions error:', error);
    else setTransactions(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) console.error('Fetch users error:', error);
    else setUsers(data || []);
  };

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) console.error('Fetch sessions error:', error);
    else setSessions(data || []);
  };

  const openUserDetail = async (user: UserAccount) => {
    setLoadingDetail(true);
    setSelectedUserDetail({ user, sessions: [], transactions: [] });

    const [{ data: userSessions }, { data: userTxns }] = await Promise.all([
      supabase
        .from('sessions')
        .select('*')
        .eq('user_uid', user.google_uid)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('purchase_transactions')
        .select('*')
        .eq('google_uid', user.google_uid)
        .order('verified_at', { ascending: false })
        .limit(20),
    ]);

    setSelectedUserDetail({ user, sessions: userSessions || [], transactions: userTxns || [] });
    setLoadingDetail(false);
  };

  const handleGrant = async (tx: Transaction) => {
    if (!tx.google_uid && !tx.device_id) return;
    if (!window.confirm(`Grant Lifetime to ${tx.google_uid || tx.device_id}?`)) return;
    setGrantingId(tx.id);
    try {
      const { error } = await supabase
        .from('user_accounts')
        .update({ tier: 'lifetime' })
        .eq('google_uid', tx.google_uid);
      if (!error) {
        setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'success' as const } : t));
      } else {
        alert('Grant failed: ' + error.message);
      }
    } catch (err: any) {
      alert('Grant error: ' + err.message);
    } finally {
      setGrantingId(null);
    }
  };

  const subscribeToAllChanges = () => {
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'purchase_transactions' }, (payload) => {
        const tx = payload.new as Transaction;
        setTransactions(prev => [tx, ...prev].slice(0, 200));
        if (Notification.permission === 'granted') {
          const emoji = tx.status === 'success' ? '💰✅' : '❌💸';
          new Notification(`${emoji} ${tx.status === 'success' ? 'Payment Success' : 'Payment Failed'}: ${tx.product_id}`, {
            body: tx.amount ? `Amount: $${tx.amount} | TX: ${tx.transaction_id.slice(0, 20)}...` : `TX: ${tx.transaction_id}`
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'purchase_transactions' }, (payload) => {
        setTransactions(prev => prev.map(tx => tx.id === payload.new.id ? payload.new as Transaction : tx));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_accounts' }, (payload) => {
        setUsers(prev => [payload.new as UserAccount, ...prev].slice(0, 500));
        if (Notification.permission === 'granted') {
          new Notification('👤 New User Joined', { body: `Email: ${payload.new.email || 'Unknown'}` });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions' }, (payload) => {
        setSessions(prev => [payload.new as UserSession, ...prev].slice(0, 500));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505]">
        <div className="nexus-grid" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-10 rounded-[2.5rem] nexus-glass text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-[#00ffcc]/10 flex items-center justify-center">
              <Shield className="text-[#00ffcc]" size={40} />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tighter">NEXUS TERMINAL</h1>
            <p className="text-gray-500 text-sm font-medium tracking-widest uppercase">Admin Verification Required</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full py-5 rounded-2xl bg-[#00ffcc] text-black font-black uppercase text-sm tracking-[0.2em] hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
          >
            Authenticate via Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="text-center space-y-4">
          <XCircle className="text-red-500 mx-auto" size={48} />
          <h2 className="text-xl font-black uppercase tracking-widest text-red-500">Access Restricted</h2>
          <p className="text-gray-500">Identity failure. You do not have owner clearance.</p>
          <button onClick={handleLogout} className="text-[#00ffcc] text-xs font-black uppercase tracking-widest underline underline-offset-8">Switch Account</button>
        </div>
      </div>
    );
  }

  // --- COMPUTED METRICS ---
  const now = new Date();
  const twentyFourHoursAgo = subHours(now, 24);
  const sevenDaysAgo = subDays(now, 7);
  const fourteenDaysAgo = subDays(now, 14);

  // User metrics
  const newUsersToday = users.filter(u => isAfter(new Date(u.created_at), twentyFourHoursAgo)).length;
  const returningToday = users.filter(u =>
    u.last_login &&
    isAfter(new Date(u.last_login), twentyFourHoursAgo) &&
    !isAfter(new Date(u.created_at), twentyFourHoursAgo)
  ).length;

  // Session metrics
  const activeNow = sessions.filter(s => s.last_activity && isAfter(new Date(s.last_activity), subMinutes(now, 5))).length;
  const activeHour = sessions.filter(s => s.last_activity && isAfter(new Date(s.last_activity), subHours(now, 1))).length;
  const active24h = sessions.filter(s => isAfter(new Date(s.created_at), twentyFourHoursAgo)).length;

  // Revenue metrics
  const successfulTxns = transactions.filter(tx => tx.status === 'success');
  const totalRevenue = successfulTxns.reduce((sum, tx) => sum + getTxnAmount(tx), 0);
  const revenueToday = successfulTxns
    .filter(tx => isAfter(new Date(tx.verified_at), twentyFourHoursAgo))
    .reduce((sum, tx) => sum + getTxnAmount(tx), 0);
  const avgTxnValue = successfulTxns.length > 0 ? totalRevenue / successfulTxns.length : 0;
  const failedToday = transactions.filter(tx => tx.status === 'failed' && isAfter(new Date(tx.verified_at), twentyFourHoursAgo)).length;
  const successRate = transactions.length > 0 ? ((successfulTxns.length / transactions.length) * 100).toFixed(1) : '100.0';

  // D1 Retention: users who joined 24-48h ago and came back
  const d1Cohort = users.filter(u => {
    const c = new Date(u.created_at);
    return !isAfter(c, twentyFourHoursAgo) && isAfter(c, subHours(now, 48));
  });
  const d1Retained = d1Cohort.filter(u =>
    u.last_login && new Date(u.last_login).getTime() > new Date(u.created_at).getTime() + 120000
  );
  const d1Retention = d1Cohort.length > 0 ? `${((d1Retained.length / d1Cohort.length) * 100).toFixed(0)}%` : 'N/A';

  // D7 Retention: users who joined 7-14 days ago and came back
  const d7Cohort = users.filter(u => {
    const c = new Date(u.created_at);
    return !isAfter(c, sevenDaysAgo) && isAfter(c, fourteenDaysAgo);
  });
  const d7Retained = d7Cohort.filter(u =>
    u.last_login && new Date(u.last_login).getTime() > new Date(u.created_at).getTime() + 120000
  );
  const d7Retention = d7Cohort.length > 0 ? `${((d7Retained.length / d7Cohort.length) * 100).toFixed(0)}%` : 'N/A';

  // Power Users: top 10 by session count
  const sessionCountMap: Record<string, number> = {};
  sessions.forEach(s => { sessionCountMap[s.user_uid] = (sessionCountMap[s.user_uid] || 0) + 1; });
  const powerUsers = Object.entries(sessionCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid, count]) => {
      const user = users.find(u => u.google_uid === uid);
      return { uid, count, email: user?.email, tier: user?.tier, user };
    });

  // Churn Risk: users with no login in 7+ days
  const churnRisk = users
    .filter(u => {
      const lastActive = u.last_login ? new Date(u.last_login) : new Date(u.created_at);
      return !isAfter(lastActive, sevenDaysAgo);
    })
    .slice(0, 10);

  const filteredTransactions = transactions.filter(tx =>
    tx.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.device_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.google_uid?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen p-4 sm:p-10 relative">
      <div className="nexus-grid" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-[#00ffcc]/20 flex items-center justify-center nexus-pulse">
            <Cpu size={24} className="text-[#00ffcc]" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 flex-wrap">
              NEXUS COMMAND
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono">LIVE_V2.0</span>
              <div className="flex items-center gap-1.5 bg-[#00ffcc]/10 border border-[#00ffcc]/20 px-2 py-0.5 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00ffcc] animate-pulse" />
                <span className="text-[9px] font-mono font-black text-[#00ffcc] tabular-nums">{format(currentTime, 'HH:mm:ss')}</span>
              </div>
            </h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Authorized: {ADMIN_EMAIL}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="SEARCH PROTOCOL DATA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest focus:border-[#00ffcc]/50 focus:bg-white/10 transition-all outline-none"
            />
          </div>
          <button
            onClick={fetchAllData}
            title="Refresh data"
            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-[#00ffcc] transition-all"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={handleLogout}
            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Failed Transaction Alert Banner */}
      {failedToday > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-widest text-red-400">
              {failedToday} failed payment{failedToday > 1 ? 's' : ''} today — check transaction feed
            </span>
          </div>
          <span className="text-[9px] font-bold text-red-500/60 uppercase tracking-widest">action required</span>
        </motion.div>
      )}

      {/* Stats Row 1: User Engagement */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-0.5 h-3 bg-[#00ffcc] rounded-full" />
          <p className="text-[9px] font-black tracking-[0.4em] text-gray-600 uppercase">USER ENGAGEMENT</p>
          <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-white/5 text-gray-600 uppercase tracking-widest">signed-in only</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Users', value: users.length, icon: Users, color: 'white', note: 'logged in ever' },
            { label: 'New Today', value: newUsersToday, icon: TrendingUp, color: newUsersToday > 0 ? '#00ffcc' : 'white', note: null },
            { label: 'Returning Today', value: returningToday, icon: RefreshCw, color: returningToday > 0 ? '#00ffcc' : 'white', note: null },
            { label: 'Active Now', value: activeNow, icon: Activity, color: activeNow > 0 ? '#00ff88' : 'white', note: null },
            { label: 'Active (1h)', value: activeHour, icon: Clock, color: activeHour > 0 ? '#00ffcc' : 'white', note: null },
            { label: 'Active (24h)', value: active24h, icon: Users, color: active24h > 0 ? '#00ffcc' : 'white', note: null },
          ].map((stat, i) => (
            <div key={i} className="p-5 rounded-3xl nexus-glass space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black tracking-widest text-gray-500 uppercase">{stat.label}</span>
                <stat.icon size={13} className="text-[#00ffcc]/40" />
              </div>
              <div className="text-2xl font-black tracking-tighter" style={{ color: stat.color }}>{stat.value}</div>
              {stat.note && <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{stat.note}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Stats Row 2: Revenue + Retention */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-0.5 h-3 bg-[#ffd700] rounded-full" />
          <p className="text-[9px] font-black tracking-[0.4em] text-gray-600 uppercase">REVENUE & RETENTION</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: '#ffd700' },
            { label: 'Revenue Today', value: `$${revenueToday.toFixed(2)}`, icon: DollarSign, color: revenueToday > 0 ? '#ffd700' : 'white' },
            { label: 'Avg Txn', value: `$${avgTxnValue.toFixed(2)}`, icon: BarChart2, color: '#ffd700' },
            { label: 'Success Rate', value: `${successRate}%`, icon: Shield, color: '#00ffcc' },
            { label: 'Failed Today', value: failedToday, icon: XCircle, color: failedToday > 0 ? '#ef4444' : 'white' },
            { label: 'D1 Retention', value: d1Retention, icon: RefreshCw, color: '#a78bfa' },
            { label: 'D7 Retention', value: d7Retention, icon: BarChart2, color: '#a78bfa' },
          ].map((stat, i) => (
            <div
              key={i}
              className={`p-5 rounded-3xl nexus-glass space-y-3 ${
                i === 0
                  ? 'border border-[#ffd700]/25 shadow-[0_0_24px_rgba(255,215,0,0.07)]'
                  : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black tracking-widest text-gray-500 uppercase">{stat.label}</span>
                <stat.icon size={13} className={i === 0 ? 'text-[#ffd700]/40' : 'text-white/20'} />
              </div>
              <div
                className={`font-black tracking-tighter ${i === 0 ? 'text-2xl' : 'text-xl'}`}
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main 3-col grid: Transaction Feed + User Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Transaction Feed */}
        <div className="lg:col-span-2 rounded-[2.5rem] nexus-glass overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">TRANSACTION FEED</span>
            {loading && <div className="w-2 h-2 rounded-full bg-[#00ffcc] animate-ping" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5">
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Transaction ID</th>
                  <th className="px-6 py-5">Product</th>
                  <th className="px-6 py-5">Amount</th>
                  <th className="px-6 py-5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="terminal-text">
                <AnimatePresence>
                  {filteredTransactions.map((tx) => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors group border-l-2 ${
                        tx.status === 'success' ? 'border-l-[#00ffcc]/40' : 'border-l-red-500/50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {tx.status === 'success' ? (
                            <><div className="w-2 h-2 rounded-full bg-[#00ffcc] shadow-[0_0_10px_#00ffcc]" /><span className="text-[9px] font-black uppercase text-[#00ffcc]">OK</span></>
                          ) : (
                            <><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" /><span className="text-[9px] font-black uppercase text-red-500">FAIL</span></>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-[10px] text-gray-300 group-hover:text-[#00ffcc] transition-colors">
                          {tx.transaction_id ? tx.transaction_id.slice(0, 14) + '...' : 'NULL'}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[9px] font-black bg-white/5 px-2 py-1 rounded-full text-gray-400">
                          {tx.product_id.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-black text-[#ffd700]">
                          ${getTxnAmount(tx).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-[9px] font-bold text-gray-500">
                            {format(new Date(tx.verified_at), 'MMM d, HH:mm')}
                          </span>
                          {tx.status === 'failed' && tx.google_uid && (
                            <button
                              disabled={grantingId === tx.id}
                              onClick={() => handleGrant(tx)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ffcc]/10 text-[#00ffcc] border border-[#00ffcc]/20 rounded-full text-[8px] font-black uppercase tracking-widest hover:bg-[#00ffcc]/20 transition-all disabled:opacity-40"
                            >
                              {grantingId === tx.id
                                ? <RefreshCw size={9} className="animate-spin" />
                                : <Zap size={9} fill="currentColor" />}
                              GRANT
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-gray-500 uppercase text-[10px] font-black tracking-widest">
                      No transactions in buffer
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Activity Sidebar — clickable */}
        <div className="rounded-[2.5rem] nexus-glass overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">USER ACTIVITY</span>
            <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">click for detail</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-1">
            <AnimatePresence>
              {users.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => openUserDetail(user)}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.05] cursor-pointer transition-colors group border border-transparent hover:border-white/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#00ffcc]/10 flex items-center justify-center flex-shrink-0">
                      <Mail size={12} className="text-[#00ffcc]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white truncate max-w-[120px]">
                        {user.email || user.google_uid.substring(0, 12) + '...'}
                      </p>
                      <p className="text-[9px] text-gray-500 font-bold">
                        {format(new Date(user.created_at), 'MMM d')}
                        {user.last_login && ` · ${format(new Date(user.last_login), 'HH:mm')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[8px] font-black bg-[#00ffcc]/10 text-[#00ffcc] px-2 py-0.5 rounded-full uppercase">{user.tier}</span>
                    <ChevronRight size={12} className="text-gray-600 group-hover:text-[#00ffcc] transition-colors" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {users.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                <Users size={32} className="text-gray-700" />
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-loose">Waiting for<br />first protocol entry</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom 2-col: Power Users + Churn Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Power Users Leaderboard */}
        <div className="rounded-[2.5rem] nexus-glass overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="w-0.5 h-3 bg-[#ffd700] rounded-full" />
            <Trophy size={14} className="text-[#ffd700]" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">POWER USERS</span>
            <span className="text-[9px] text-gray-600 font-bold ml-auto uppercase tracking-widest">by sessions</span>
          </div>
          <div className="p-4 space-y-1">
            {powerUsers.length === 0 ? (
              <p className="text-center text-[10px] text-gray-600 uppercase font-black tracking-widest py-8">No session data</p>
            ) : powerUsers.map((pu, i) => (
              <div
                key={pu.uid}
                onClick={() => pu.user && openUserDetail(pu.user)}
                className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${pu.user ? 'cursor-pointer hover:bg-white/[0.05]' : ''}`}
              >
                <span className={`text-[11px] font-black w-5 text-center flex-shrink-0 ${
                  i === 0 ? 'text-[#ffd700]' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-[#cd7f32]' : 'text-gray-600'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white truncate">
                    {pu.email || pu.uid.substring(0, 18) + '...'}
                  </p>
                  {pu.tier && <span className="text-[8px] font-black text-[#00ffcc]/50 uppercase">{pu.tier}</span>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="h-1.5 rounded-full bg-white/10 w-20 overflow-hidden">
                    <div
                      className="h-full bg-[#00ffcc] rounded-full transition-all"
                      style={{ width: `${Math.min(100, (pu.count / (powerUsers[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black text-[#00ffcc] w-6 text-right">{pu.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Churn Risk */}
        <div className="rounded-[2.5rem] nexus-glass overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="w-0.5 h-3 bg-[#ff6b6b] rounded-full" />
            <AlertTriangle size={14} className="text-[#ff6b6b]" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">CHURN RISK</span>
            <span className="text-[9px] text-gray-600 font-bold ml-auto uppercase tracking-widest">7+ days silent</span>
          </div>
          <div className="p-4 space-y-1">
            {churnRisk.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[10px] text-[#00ffcc] uppercase font-black tracking-widest">All users active ✓</p>
              </div>
            ) : churnRisk.map((user) => {
              const lastActive = user.last_login ? new Date(user.last_login) : new Date(user.created_at);
              const daysInactive = differenceInDays(now, lastActive);
              return (
                <div
                  key={user.id}
                  onClick={() => openUserDetail(user)}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.05] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={11} className="text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white truncate max-w-[180px]">
                        {user.email || user.google_uid.substring(0, 18) + '...'}
                      </p>
                      <p className="text-[9px] text-gray-500 font-bold uppercase">{user.tier}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-[13px] font-black ${daysInactive > 14 ? 'text-red-400' : 'text-[#ff8c69]'}`}>
                      {daysInactive}d
                    </span>
                    <p className="text-[8px] text-gray-600 font-bold uppercase">inactive</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUserDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedUserDetail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl nexus-glass rounded-[2.5rem] overflow-hidden max-h-[85vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#00ffcc]/10 flex items-center justify-center">
                    <Mail size={18} className="text-[#00ffcc]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{selectedUserDetail.user.email || selectedUserDetail.user.google_uid}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[8px] font-black bg-[#00ffcc]/10 text-[#00ffcc] px-2 py-0.5 rounded-full uppercase">{selectedUserDetail.user.tier}</span>
                      <span className="text-[9px] text-gray-500 font-bold">Joined {format(new Date(selectedUserDetail.user.created_at), 'MMM d, yyyy')}</span>
                      {selectedUserDetail.user.last_login && (
                        <span className="text-[9px] text-gray-500 font-bold">
                          Last login {differenceInDays(now, new Date(selectedUserDetail.user.last_login))}d ago
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedUserDetail(null)} className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[#00ffcc]/30 border-t-[#00ffcc] rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-y-auto flex-1 p-6 space-y-6">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Total Sessions', value: selectedUserDetail.sessions.length },
                      { label: 'Purchases', value: selectedUserDetail.transactions.filter(t => t.status === 'success').length },
                      { label: 'Total Spent', value: `$${selectedUserDetail.transactions.filter(t => t.status === 'success').reduce((s, t) => s + getTxnAmount(t), 0).toFixed(2)}` },
                    ].map((s, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white/5 text-center">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">{s.label}</p>
                        <p className="text-xl font-black text-[#00ffcc]">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Login History */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-500 mb-3">LOGIN HISTORY ({selectedUserDetail.sessions.length})</p>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {selectedUserDetail.sessions.length === 0 ? (
                        <p className="text-[10px] text-gray-600 font-bold text-center py-4">No sessions found</p>
                      ) : selectedUserDetail.sessions.map((s, i) => (
                        <div key={s.session_token || i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.is_active ? 'bg-[#00ffcc] shadow-[0_0_8px_#00ffcc]' : 'bg-gray-700'}`} />
                            <span className="text-[10px] font-bold text-gray-300">{format(new Date(s.created_at), 'MMM d, yyyy · HH:mm')}</span>
                          </div>
                          {s.last_activity && (
                            <span className="text-[9px] text-gray-500 font-bold">
                              active {format(new Date(s.last_activity), 'HH:mm')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Purchase History */}
                  {selectedUserDetail.transactions.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-500 mb-3">PURCHASE HISTORY ({selectedUserDetail.transactions.length})</p>
                      <div className="space-y-2">
                        {selectedUserDetail.transactions.map((tx, i) => (
                          <div key={tx.id || i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.status === 'success' ? 'bg-[#00ffcc]' : 'bg-red-500'}`} />
                              <div>
                                <p className="text-[10px] font-black text-white">{tx.product_id.toUpperCase()}</p>
                                <p className="text-[9px] text-gray-500 font-bold">{format(new Date(tx.verified_at), 'MMM d, yyyy · HH:mm')}</p>
                              </div>
                            </div>
                            <span className={`text-[11px] font-black flex-shrink-0 ${tx.status === 'success' ? 'text-[#ffd700]' : 'text-red-400'}`}>
                              {tx.status === 'success' ? `$${getTxnAmount(tx).toFixed(2)}` : tx.status.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
