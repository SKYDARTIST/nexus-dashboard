import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import {
  Activity,
  Shield,
  CreditCard,
  Search,
  LogOut,
  XCircle,
  Mail,
  Cpu,
  Monitor
} from 'lucide-react';
import { format } from 'date-fns';
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

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
      fetchTransactions();
      subscribeToTransactions();
    }
  }, [session]);

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('purchase_transactions')
      .select('*')
      .order('verified_at', { ascending: false })
      .limit(50);

    if (error) console.error('Fetch error:', error);
    else setTransactions(data || []);
    setLoading(false);
  };

  const subscribeToTransactions = () => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'purchase_transactions'
        },
        (payload) => {
          setTransactions(prev => [payload.new as Transaction, ...prev].slice(0, 50));
          // Trigger browser notification if supported
          if (Notification.permission === 'granted') {
            new Notification(`💰 New Payment: ${payload.new.status.toUpperCase()}`, {
              body: `TX: ${payload.new.transaction_id}`
            });
          }
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
              NEXUS COMMAND <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono mt-1">LIVE_V1.0</span>
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
          { label: 'Total Logs', value: transactions.length, icon: Activity },
          { label: 'Verification Pulse', value: 'ACTIVE', icon: Monitor },
          { label: 'System Health', value: '100%', icon: Shield },
          { label: 'Current Session', value: 'SECURE', icon: CreditCard }
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

      {/* Main Feed */}
      <div className="rounded-[2.5rem] nexus-glass overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">AUTHORITATIVE REAL-TIME FEED</span>
          {loading && <div className="w-2 h-2 rounded-full bg-[#00ffcc] animate-ping" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5">
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6">Transaction ID</th>
                <th className="px-8 py-6">Hardware / Ident</th>
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
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                          <Monitor size={10} /> {tx.device_id.substring(0, 8)}...
                        </div>
                        {tx.google_uid && (
                          <div className="flex items-center gap-2 text-[10px] font-black text-white">
                            <Mail size={10} className="text-[#00ffcc]" /> {tx.google_uid.substring(0, 12)}...
                          </div>
                        )}
                      </div>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;
