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
  Clock
} from 'lucide-react';
import { format, isAfter, subHours } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const ADMIN_EMAIL = 'antigravitybybulla@gmail.com';

interface Transaction {
  id: string;
  transaction_id: string;
  device_id: string;
  google_uid: string | null;
  product_id: string;
  status: 'success' | 'failed' | 'pending';
  verified_at: string;
  error_message?: string;
}

interface UserAccount {
  id: string;
  google_uid: string;
  tier: string;
  created_at: string;
  last_login?: string;
}

interface UserSession {
  session_token: string;
  user_uid: string;
  created_at: string;
}

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
      return () => {
        unsubscribe();
      };
    }
  }, [session]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchTransactions(),
      fetchUsers(),
      fetchSessions()
    ]);
    setLoading(false);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('purchase_transactions')
      .select('*')
      .order('verified_at', { ascending: false })
      .limit(50);

    if (error) console.error('Fetch transactions error:', error);
    else setTransactions(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) console.error('Fetch users error:', error);
    else setUsers(data || []);
  };

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) console.error('Fetch sessions error:', error);
    else setSessions(data || []);
  };

  const subscribeToAllChanges = () => {
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'purchase_transactions' },
        (payload) => {
          setTransactions(prev => [payload.new as Transaction, ...prev].slice(0, 50));
          if (Notification.permission === 'granted') {
            new Notification(`💰 New Payment: ${payload.new.status.toUpperCase()}`, {
              body: `TX: ${payload.new.transaction_id}`
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_accounts' },
        (payload) => {
          setUsers(prev => [payload.new as UserAccount, ...prev].slice(0, 50));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sessions' },
        (payload) => {
          setSessions(prev => [payload.new as UserSession, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
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

  const twentyFourHoursAgo = subHours(new Date(), 24);
  const newUsersToday = users.filter(u => isAfter(new Date(u.created_at), twentyFourHoursAgo)).length;

  const oneHourAgo = subHours(new Date(), 1);
  const activeUsers = sessions.filter(s => isAfter(new Date(s.created_at), oneHourAgo)).length;

  const filteredTransactions = transactions.filter(tx =>
    tx.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.device_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.google_uid?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen p-4 sm:p-10 relative">
      <div className="nexus-grid" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-[#00ffcc]/20 flex items-center justify-center nexus-pulse">
            <Cpu size={24} className="text-[#00ffcc]" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              NEXUS COMMAND <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono mt-1">LIVE_V1.1</span>
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
            onClick={handleLogout}
            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Stats Mini Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total Users', value: users.length, icon: Users },
          { label: 'New Today', value: newUsersToday, icon: Clock },
          { label: 'Active Now', value: activeUsers, icon: Activity },
          { label: 'System Health', value: '100%', icon: Shield }
        ].map((stat, i) => (
          <div key={i} className="p-6 rounded-3xl nexus-glass space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black tracking-widest text-gray-500 uppercase">{stat.label}</span>
              <stat.icon size={14} className="text-[#00ffcc]/50" />
            </div>
            <div className="text-xl font-black tracking-tighter uppercase">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed */}
        <div className="lg:col-span-2 rounded-[2.5rem] nexus-glass overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">TRANSACTION FEED</span>
            {loading && <div className="w-2 h-2 rounded-full bg-[#00ffcc] animate-ping" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5">
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6">Transaction ID</th>
                  <th className="px-8 py-6">Product</th>
                  <th className="px-8 py-6 text-right">Timestamp</th>
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
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          {tx.status === 'success' ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-[#00ffcc] shadow-[0_0_10px_#00ffcc]" />
                              <span className="text-[10px] font-black uppercase text-[#00ffcc]">SUCCESS</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
                              <span className="text-[10px] font-black uppercase text-red-500">FAILED</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <code className="text-[11px] text-gray-300 group-hover:text-[#00ffcc] transition-colors">
                          {tx.transaction_id || 'NULL_BUFFER'}
                        </code>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-black bg-white/5 px-3 py-1 rounded-full text-gray-400">
                          {tx.product_id.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className="text-[10px] font-bold text-gray-500">
                          {format(new Date(tx.verified_at), 'MMM d, HH:mm:ss')}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-gray-500 uppercase text-[10px] font-black tracking-widest">
                      No transactions detected in buffer
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Activity Sidebar */}
        <div className="rounded-[2.5rem] nexus-glass overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">USER ACTIVITY</span>
            <Users size={14} className="text-gray-500" />
          </div>
          <div className="flex-1 overflow-y-auto max-h-[600px] p-6 space-y-6">
            <AnimatePresence>
              {users.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 pb-4 border-b border-white/5 last:border-0"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#00ffcc]/10 flex items-center justify-center">
                        <Mail size={12} className="text-[#00ffcc]" />
                      </div>
                      <span className="text-[10px] font-black text-white">{user.google_uid.substring(0, 15)}...</span>
                    </div>
                    <span className="text-[8px] font-black bg-[#00ffcc]/20 text-[#00ffcc] px-2 py-0.5 rounded-full uppercase">
                      {user.tier}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                    <span>Joined {format(new Date(user.created_at), 'MMM d')}</span>
                    {user.last_login && (
                      <span className="flex items-center gap-1 text-[#00ffcc]/60">
                        <Activity size={8} /> Active {format(new Date(user.last_login), 'HH:mm')}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {users.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                <Users size={32} className="text-gray-700" />
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-loose">
                  Waiting for<br />first protocol entry
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
