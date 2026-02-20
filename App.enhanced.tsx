// ENHANCED NEXUS DASHBOARD WITH ANALYTICS FIX
// ============================================
// This file contains FIXES + NEW ANALYTICS PANELS
//
// FIXES:
// 1. Active users now count UNIQUE users, not sessions
// 2. Includes anonymous users from ag_analytics
// 3. Accurate 24H active count
//
// NEW FEATURES:
// 1. Tool Usage Analytics (most popular tools)
// 2. Daily Device Activity (from ag_analytics)
// 3. Pricing Funnel Metrics
// 4. Anonymous vs Signed-in Users
//
// INSTALLATION INSTRUCTIONS:
// 1. Copy the new interfaces and state from lines 80-95
// 2. Copy the new fetch functions from lines 150-200
// 3. Copy the fixed metrics calculations from lines 280-350
// 4. Copy the new dashboard panels from lines 500-700
// 5. Update your imports to include BarChart3
//
// ============================================

// NEW INTERFACES (add these to your App.tsx)
interface AnalyticsEvent {
  event: string;
  device_id: string;
  data: Record<string, any>;
  created_at: string;
}

interface ToolUsageStats {
  tool_name: string;
  opens: number;
  unique_users: number;
}

interface DailyDevices {
  date: string;
  unique_devices: number;
  total_events: number;
}

// NEW STATE VARIABLES (add these to your existing useState declarations)
const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);
const [toolUsage, setToolUsage] = useState<ToolUsageStats[]>([]);
const [dailyDevices, setDailyDevices] = useState<DailyDevices[]>([]);

// ===========================================
// NEW FETCH FUNCTIONS
// ===========================================

const fetchAnalytics = async () => {
  // Fetch last 7 days of analytics events
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('ag_analytics')
    .select('*')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Fetch analytics error:', error);
  } else {
    setAnalytics(data || []);
    processAnalyticsData(data || []);
  }
};

const processAnalyticsData = (events: AnalyticsEvent[]) => {
  // Process Tool Usage
  const toolEvents = events.filter(e => e.event === 'tool_open');
  const toolMap: Record<string, { opens: number; users: Set<string> }> = {};

  toolEvents.forEach(e => {
    const toolName = e.data?.tool || 'Unknown';
    if (!toolMap[toolName]) {
      toolMap[toolName] = { opens: 0, users: new Set() };
    }
    toolMap[toolName].opens++;
    toolMap[toolName].users.add(e.device_id);
  });

  const toolStats: ToolUsageStats[] = Object.entries(toolMap)
    .map(([tool_name, stats]) => ({
      tool_name,
      opens: stats.opens,
      unique_users: stats.users.size,
    }))
    .sort((a, b) => b.opens - a.opens);

  setToolUsage(toolStats);

  // Process Daily Device Activity
  const dailyMap: Record<string, Set<string>> = {};
  const dailyEventCount: Record<string, number> = {};

  events.forEach(e => {
    const date = e.created_at.split('T')[0]; // YYYY-MM-DD
    if (!dailyMap[date]) {
      dailyMap[date] = new Set();
      dailyEventCount[date] = 0;
    }
    dailyMap[date].add(e.device_id);
    dailyEventCount[date]++;
  });

  const daily: DailyDevices[] = Object.entries(dailyMap)
    .map(([date, deviceSet]) => ({
      date,
      unique_devices: deviceSet.size,
      total_events: dailyEventCount[date],
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  setDailyDevices(daily);
};

// ===========================================
// FIXED METRICS (replace your existing calculations)
// ===========================================

// FIXED: Count unique users from sessions, not total sessions
const uniqueActiveUsers = (timeThreshold: Date) => {
  const uniqueUids = new Set<string>();
  sessions.forEach(s => {
    if (s.last_activity && isAfter(new Date(s.last_activity), timeThreshold)) {
      uniqueUids.add(s.user_uid);
    }
  });
  return uniqueUids.size;
};

// FIXED: Active users calculations
const activeNow = uniqueActiveUsers(subMinutes(now, 5));
const activeHour = uniqueActiveUsers(subHours(now, 1));

// FIXED: 24H active includes anonymous users from analytics
const signed24h = uniqueActiveUsers(twentyFourHoursAgo);
const anonymous24h = new Set(
  analytics
    .filter(e => isAfter(new Date(e.created_at), twentyFourHoursAgo))
    .map(e => e.device_id)
).size;
const active24h = signed24h + anonymous24h;

// NEW: Pricing Funnel Metrics
const pricingViews = analytics.filter(e =>
  e.event === 'pricing_banner_tap' || e.event === 'pricing_tile_tap'
).length;
const pricingClicks = new Set(
  analytics
    .filter(e => e.event === 'pricing_banner_tap' || e.event === 'pricing_tile_tap')
    .map(e => e.device_id)
).size;
const pricingConversionRate = pricingClicks > 0
  ? ((successfulTxns.length / pricingClicks) * 100).toFixed(1)
  : '0.0';

// ===========================================
// NEW DASHBOARD PANELS (add these to your JSX)
// ===========================================

// Tool Usage Panel (add after existing metric cards)
<div className="nexus-glass rounded-[2rem] p-8 space-y-6">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl bg-[#00ffcc]/10 flex items-center justify-center">
        <BarChart3 className="text-[#00ffcc]" size={20} />
      </div>
      <div>
        <h3 className="font-black uppercase text-xs tracking-widest text-gray-400">Tool Usage</h3>
        <p className="text-[8px] text-gray-600 uppercase tracking-wider">Last 7 Days</p>
      </div>
    </div>
    <RefreshCw
      className="text-gray-600 cursor-pointer hover:text-[#00ffcc] transition-colors"
      size={16}
      onClick={() => fetchAnalytics()}
    />
  </div>

  <div className="space-y-3">
    {toolUsage.length === 0 ? (
      <p className="text-xs text-gray-500 text-center py-8">No tool usage data yet</p>
    ) : (
      toolUsage.slice(0, 5).map((tool, idx) => {
        const maxOpens = toolUsage[0]?.opens || 1;
        const percentage = (tool.opens / maxOpens) * 100;
        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-white">{tool.tool_name}</span>
              <span className="text-gray-500">{tool.opens} opens</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="h-full bg-gradient-to-r from-[#00ffcc] to-[#00ff88]"
              />
            </div>
            <p className="text-[9px] text-gray-600">
              {tool.unique_users} unique user{tool.unique_users !== 1 ? 's' : ''}
            </p>
          </div>
        );
      })
    )}
  </div>
</div>

// Daily Devices Panel
<div className="nexus-glass rounded-[2rem] p-8 space-y-6">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-2xl bg-[#ff6b9d]/10 flex items-center justify-center">
      <TrendingUp className="text-[#ff6b9d]" size={20} />
    </div>
    <div>
      <h3 className="font-black uppercase text-xs tracking-widest text-gray-400">Daily Devices</h3>
      <p className="text-[8px] text-gray-600 uppercase tracking-wider">Active by Date</p>
    </div>
  </div>

  <div className="space-y-2">
    {dailyDevices.slice(0, 7).map((day, idx) => {
      const maxDevices = Math.max(...dailyDevices.map(d => d.unique_devices));
      const percentage = (day.unique_devices / maxDevices) * 100;
      const date = new Date(day.date);
      const dateStr = format(date, 'MMM dd');

      return (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-[9px] font-bold text-gray-500 w-16">{dateStr}</span>
          <div className="flex-1 h-8 bg-black/30 rounded-xl overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
              className="h-full bg-gradient-to-r from-[#ff6b9d] to-[#ff8fab] flex items-center justify-end pr-2"
            >
              <span className="text-[10px] font-black text-white">
                {day.unique_devices}
              </span>
            </motion.div>
          </div>
          <span className="text-[8px] text-gray-600 w-12 text-right">
            {day.total_events} evt
          </span>
        </div>
      );
    })}
  </div>
</div>

// Pricing Funnel Panel
<div className="nexus-glass rounded-[2rem] p-8 space-y-6">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
      <Zap className="text-yellow-500" size={20} />
    </div>
    <div>
      <h3 className="font-black uppercase text-xs tracking-widest text-gray-400">Pricing Funnel</h3>
      <p className="text-[8px] text-gray-600 uppercase tracking-wider">Last 7 Days</p>
    </div>
  </div>

  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">Saw Pricing</span>
      <span className="text-lg font-black text-white">{pricingViews}</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">Unique Clickers</span>
      <span className="text-lg font-black text-[#00ffcc]">{pricingClicks}</span>
    </div>
    <div className="flex justify-between items-center pt-4 border-t border-white/5">
      <span className="text-xs text-gray-500">Purchased</span>
      <span className="text-lg font-black text-yellow-500">{successfulTxns.length}</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-xs font-bold text-white">Conversion Rate</span>
      <span className="text-2xl font-black text-[#00ff88]">{pricingConversionRate}%</span>
    </div>
  </div>
</div>

// User Type Breakdown Panel
<div className="nexus-glass rounded-[2rem] p-8 space-y-6">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
      <Users className="text-blue-500" size={20} />
    </div>
    <div>
      <h3 className="font-black uppercase text-xs tracking-widest text-gray-400">User Breakdown</h3>
      <p className="text-[8px] text-gray-600 uppercase tracking-wider">24H Split</p>
    </div>
  </div>

  <div className="space-y-4">
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">Signed In</span>
        <span className="text-lg font-black text-[#00ffcc]">{signed24h}</span>
      </div>
      <div className="h-2 bg-black/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#00ffcc]"
          style={{ width: `${(signed24h / active24h) * 100}%` }}
        />
      </div>
    </div>

    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">Anonymous</span>
        <span className="text-lg font-black text-[#ff6b9d]">{anonymous24h}</span>
      </div>
      <div className="h-2 bg-black/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#ff6b9d]"
          style={{ width: `${(anonymous24h / active24h) * 100}%` }}
        />
      </div>
    </div>

    <div className="flex justify-between items-center pt-4 border-t border-white/5">
      <span className="text-xs font-bold text-white">Total Active (24H)</span>
      <span className="text-2xl font-black text-white">{active24h}</span>
    </div>
  </div>
</div>

// ===========================================
// UPDATE YOUR fetchAllData FUNCTION
// ===========================================
const fetchAllData = async () => {
  setLoading(true);
  await Promise.all([
    fetchTransactions(),
    fetchUsers(),
    fetchSessions(),
    fetchAnalytics()  // ADD THIS LINE
  ]);
  setLoading(false);
};

// ===========================================
// ADD TO YOUR IMPORTS AT TOP OF FILE
// ===========================================
import { BarChart3 } from 'lucide-react';
