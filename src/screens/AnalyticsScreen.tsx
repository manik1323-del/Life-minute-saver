import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Analytic, Task, ConsistencyMetrics, TeamHealth, ProjectHealth, AITeamBalancerRecommendation } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { 
  TrendingUp, BarChart3, Activity, BrainCircuit, 
  Award, RefreshCw, Calendar, Flame, Zap 
} from "lucide-react";
import { socket } from "../lib/socket";

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytic[]>([]);
  const [consistency, setConsistency] = useState<ConsistencyMetrics | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamSummary, setTeamSummary] = useState<{ teams: TeamHealth[]; projects: ProjectHealth[] } | null>(null);
  const [standup, setStandup] = useState<any[]>([]);
  const [aiBalancer, setAiBalancer] = useState<AITeamBalancerRecommendation | null>(null);
  const [balancerLoading, setBalancerLoading] = useState(false);
  const [acceptedBalancer, setAcceptedBalancer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
    fetchMembers();

    socket?.on('workspace:analytics-refresh', fetchAnalytics);
    socket?.on('workspace:sync-all', fetchAnalytics);

    return () => {
      socket?.off('workspace:analytics-refresh', fetchAnalytics);
      socket?.off('workspace:sync-all', fetchAnalytics);
    };
  }, []);

  const fetchMembers = async () => {
    try {
      const workspaceMembers = await api.getWorkspaceMembers();
      setMembers(workspaceMembers);
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  };

  const getUserName = (userId: string) => {
    const member = members.find(m => m.id === userId);
    return member ? member.name : userId;
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [data, taskData, consistencyData, teamSummaryData, standupData] = await Promise.all([
        api.getAnalytics(),
        api.getTasks(),
        api.getConsistency(),
        api.getWorkspaceTeamSummary(),
        api.getDailyStandup(),
      ]);
      setAnalytics(data);
      setTasks(taskData);
      setConsistency(consistencyData);
      setTeamSummary(teamSummaryData);
      setStandup(standupData);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAIBalancer = async () => {
    setBalancerLoading(true);
    setAcceptedBalancer(false);
    try {
      const recommendation = await api.getAITeamBalancer();
      setAiBalancer(recommendation);
    } catch (err) {
      console.error('Failed to load AI team balancer recommendation:', err);
    } finally {
      setBalancerLoading(false);
    }
  };

  const handleAcceptBalancer = async () => {
    if (!aiBalancer || aiBalancer.suggestedReallocation.length === 0) return;
    setBalancerLoading(true);
    try {
      const suggestion = aiBalancer.suggestedReallocation[0];
      await api.acceptAITeamBalancer(suggestion.taskId, suggestion.toUserId);
      setAcceptedBalancer(true);
      fetchAnalytics();
    } catch (err) {
      console.error('Failed to accept AI workload recommendation:', err);
    } finally {
      setBalancerLoading(false);
    }
  };

  // === REAL DATA DERIVATIONS (replaces all hardcoded fake data) ===

  // Build last 7 days chart data from real analytics records
  const getLast7DaysChartData = () => {
    const days: { day: string; score: number; completed: number; missed: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      const record = analytics.find(a => a.date === dateStr);
      days.push({
        day: dayName,
        date: dateStr,
        score: record?.score ?? 0,
        completed: record?.tasksCompleted ?? 0,
        missed: record?.tasksMissed ?? 0,
      });
    }
    return days;
  };

  const chartDays = getLast7DaysChartData();

  // Real category distribution from actual tasks
  const getCategoryDistribution = () => {
    const countMap: { [key: string]: number } = {};
    tasks.forEach(t => {
      const cat = t.category || "Other";
      countMap[cat] = (countMap[cat] || 0) + 1;
    });
    const total = tasks.length || 1;
    const colorMap: { [key: string]: string } = {
      "Work": "bg-indigo-500",
      "Coding": "bg-indigo-500",
      "Study": "bg-amber-500",
      "Personal": "bg-emerald-500",
      "Health": "bg-emerald-500",
      "Admin": "bg-slate-500",
    };
    return Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100),
        color: colorMap[name] || "bg-violet-500",
      }));
  };

  const categoryDist = getCategoryDistribution();

  // Aggregate totals from real analytics
  const totalCompleted = analytics.reduce((s, a) => s + (a.tasksCompleted || 0), 0);
  const totalMissed = analytics.reduce((s, a) => s + (a.tasksMissed || 0), 0);
  const totalFocusTime = analytics.reduce((s, a) => s + (a.focusTime || 0), 0);
  const avgScore = analytics.length > 0
    ? Math.round(analytics.reduce((s, a) => s + (a.score || 0), 0) / analytics.length)
    : 0;

  // Trend label based on real score comparison
  const getTrendLabel = () => {
    if (chartDays.length < 2) return "Insufficient data";
    const firstHalf = chartDays.slice(0, 3).map(d => d.score);
    const secondHalf = chartDays.slice(4).map(d => d.score);
    const avg1 = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
    const avg2 = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
    const diff = Math.round(avg2 - avg1);
    if (diff > 0) return `Improving (+${diff} pts)`;
    if (diff < 0) return `Declining (${diff} pts)`;
    return "Stable trend";
  };

  // Real SVG chart points computed from actual scores (0-100 mapped to 10-185 in viewBox y-axis, inverted)
  const getSvgPoints = () => {
    const xPositions = [50, 150, 250, 350, 450, 550, 650];
    return chartDays.map((d, i) => {
      const yVal = d.score > 0 ? 185 - Math.round((d.score / 100) * 175) : 185;
      return { x: xPositions[i], y: yVal, ...d };
    });
  };

  const svgPoints = getSvgPoints();
  const polylinePoints = svgPoints.map(p => `${p.x},${p.y}`).join(" ");

  // Habit streak insight from user
  const streakDays = user?.streakCount || 0;
  const workStartHour = user?.workHoursStart || "09:00";
  const focusPeriod = user?.focusPeriod || 25;

  // Peak efficiency hour derived from workHoursStart
  const peakEnd = (() => {
    const [h, m] = workStartHour.split(":").map(Number);
    const endH = h + 2;
    const endM = m + 30;
    return `${String(endH).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")} ${endM >= 60 ? "PM" : "AM"}`;
  })();

  // Completions rate
  const completionRate = totalCompleted + totalMissed > 0
    ? Math.round((totalCompleted / (totalCompleted + totalMissed)) * 100)
    : 0;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-theme-text-main tracking-tight">Focus Productivity Analytics</h2>
          <p className="text-xs text-theme-text-muted">In-depth statistical assessment compiled by Socrates-Focus.</p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="p-2.5 bg-theme-input-bg hover:bg-theme-active-nav border border-theme-border text-theme-text-main rounded-lg cursor-pointer transition-all active:scale-95"
          title="Refresh statistics"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] text-theme-text-muted uppercase tracking-wider font-semibold">AI Productivity Score</span>
          <span className="text-2xl font-black text-theme-text-main">{consistency ? `${consistency.aiProductivityScore}` : avgScore || "—"}</span>
          <span className="text-[10px] text-indigo-400 font-semibold">
            {consistency ? consistency.focusTrend : getTrendLabel()}
          </span>
        </div>
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] text-theme-text-muted uppercase tracking-wider font-semibold">Weekly Consistency</span>
          <span className="text-2xl font-black text-theme-text-main">{consistency ? `${consistency.weeklyConsistency}%` : "—"}</span>
          <span className="text-[10px] text-emerald-400 font-semibold">
            {consistency ? `${consistency.weeklyConsistency >= 75 ? "Strong momentum" : "Needs stability"}` : `${completionRate}% completion`}
          </span>
        </div>
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] text-theme-text-muted uppercase tracking-wider font-semibold">Monthly Consistency</span>
          <span className="text-2xl font-black text-theme-text-main">{consistency ? `${consistency.monthlyConsistency}%` : "—"}</span>
          <span className="text-[10px] text-indigo-400 font-semibold">{consistency ? `${consistency.progressRings?.[0]?.description || "Monthly trend available"}` : `${totalFocusTime} min focus`}</span>
        </div>
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] text-theme-text-muted uppercase tracking-wider font-semibold">Burnout Risk</span>
          <span className="text-2xl font-black text-theme-text-main">{consistency ? `${consistency.burnoutLevel}%` : totalMissed}</span>
          <span className="text-[10px] text-red-400 font-semibold">
            {consistency ? (consistency.burnoutLevel > 50 ? "Reduce load" : "Healthy balance") : (totalMissed > 0 ? "Needs attention" : "None missed!")}
          </span>
        </div>
      </div>

      {/* Main bento split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Productivity score trend: Real Data SVG Line Chart */}
        <div className="lg:col-span-8 glass-card rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-theme-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-theme-text-main text-sm">Productivity Curve (Last 7 Days)</h3>
              </div>
              <span className="text-xs text-indigo-500 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                {getTrendLabel()}
              </span>
            </div>
            
            {/* SVG Plotting — points derived from real analytics data */}
            <div className="h-56 w-full relative pt-4">
              {analytics.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-theme-text-muted">
                  <Activity className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No analytics data yet. Complete tasks to populate your chart.</p>
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200">
                  {/* Horizontal guide grids */}
                  <line x1="0" y1="10" x2="700" y2="10" className="stroke-theme-border" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="0" y1="70" x2="700" y2="70" className="stroke-theme-border" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="0" y1="128" x2="700" y2="128" className="stroke-theme-border" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="0" y1="185" x2="700" y2="185" className="stroke-theme-border" strokeWidth="1" strokeDasharray="4 4" />

                  {/* Grid label values */}
                  <text x="695" y="14" className="fill-theme-text-muted" fontSize="8" textAnchor="end">100</text>
                  <text x="695" y="74" className="fill-theme-text-muted" fontSize="8" textAnchor="end">65</text>
                  <text x="695" y="132" className="fill-theme-text-muted" fontSize="8" textAnchor="end">35</text>
                  <text x="695" y="189" className="fill-theme-text-muted" fontSize="8" textAnchor="end">0</text>

                  {/* Polyline using REAL score data */}
                  {polylinePoints && (
                    <polyline
                      fill="none"
                      stroke="url(#gradient-indigo)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={polylinePoints}
                    />
                  )}

                  {/* Data point circles */}
                  {svgPoints.map((p, i) => (
                    <g key={i}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="5"
                        className="fill-theme-bg stroke-indigo-400 stroke-[3]"
                      />
                      {p.score > 0 && (
                        <text x={p.x} y={p.y - 10} className="fill-theme-text-muted" fontSize="8" textAnchor="middle">
                          {p.score}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Day Labels */}
                  {svgPoints.map((p, i) => (
                    <text key={i} x={p.x} y="198" className="fill-theme-text-muted" fontSize="9" textAnchor="middle">
                      {p.day}
                    </text>
                  ))}

                  {/* Gradient Definition */}
                  <defs>
                    <linearGradient id="gradient-indigo" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
              )}
            </div>
          </div>

          <p className="text-[10px] text-theme-text-muted mt-4 leading-relaxed">
            * Score is calculated by weighting task completions against missed deadline ratios and consecutive habit streak patterns. Zero score days indicate no recorded sessions.
          </p>
        </div>

        {/* Workload distribution bar charts — REAL data from tasks */}
        <div className="lg:col-span-4 glass-card rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-theme-border pb-3 mb-4">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-theme-text-main text-sm">Task Category Breakdown</h3>
            </div>
            
            {categoryDist.length > 0 ? (
              <div className="space-y-4">
                {categoryDist.map((c) => (
                  <div key={c.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-theme-text-main font-medium">{c.name}</span>
                      <span className="text-theme-text-muted font-semibold">{c.count} tasks ({c.pct}%)</span>
                    </div>
                    <div className="w-full bg-theme-input-bg h-2 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-theme-text-muted">
                <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs text-center">Add tasks to see your category distribution here.</p>
              </div>
            )}
          </div>

          {categoryDist.length > 0 && (
            <div className="mt-6 pt-4 border-t border-theme-border">
              <div className="flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-lg">
                <Award className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-[10px] text-indigo-500 leading-relaxed font-semibold">
                  {categoryDist[0]?.name} tasks dominate your workload at {categoryDist[0]?.pct}% allocation.
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* AI Diagnostic Insights panel — dynamic from real user data */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-theme-border pb-3">
          <BrainCircuit className="w-5 h-5 text-indigo-500 animate-pulse" />
          <h3 className="font-bold text-theme-text-main text-sm">Socrates Diagnostic Insights</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="p-4 bg-theme-active-nav/40 border border-theme-border rounded-xl">
            <div className="flex items-center gap-2 text-indigo-500 mb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Peak Focus Window</h4>
            </div>
            <p className="text-xs text-theme-text-main leading-relaxed">
              Based on your configured work start of {workStartHour}, your peak cognitive window is estimated between {workStartHour} and {peakEnd}. Schedule complex work in this block for maximum output.
            </p>
          </div>

          <div className="p-4 bg-theme-active-nav/40 border border-theme-border rounded-xl">
            <div className="flex items-center gap-2 text-indigo-500 mb-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Focus Rhythm</h4>
            </div>
            <p className="text-xs text-theme-text-main leading-relaxed">
              {consistency ? (
                `Your AI productivity score is ${consistency.aiProductivityScore}, with ${consistency.weeklyConsistency}% weekly consistency. Keep using ${focusPeriod}-minute focus intervals to sustain momentum.`
              ) : completionRate >= 70 ? (
                `Your ${completionRate}% task completion rate reflects solid execution discipline. Maintain this rhythm and leverage your ${focusPeriod}-minute Pomodoro blocks.`
              ) : (
                `Your ${completionRate}% completion rate has room to grow. Coach recommends starting with your top-priority task each morning to raise this score.`
              )}
            </p>
          </div>

          <div className="p-4 bg-theme-active-nav/40 border border-theme-border rounded-xl">
            <div className="flex items-center gap-2 text-indigo-500 mb-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Streak Intelligence</h4>
            </div>
            <p className="text-xs text-theme-text-main leading-relaxed">
              {consistency ? (
                consistency.currentStreak > 0
                  ? `You are on a ${consistency.currentStreak}-day streak. Keep the momentum by closing one prioritized task today.`
                  : `No active streak yet. Start with a single completion and let the AI maintain your momentum curve.`
              ) : streakDays > 0 ? (
                `You are on a ${streakDays}-day active streak. Coach recommends logging at least 1 subtask milestone today to extend your momentum into tomorrow.`
              ) : (
                `No active streak yet. Log a task or habit completion today to start building your momentum chain.`
              )}
            </p>
          </div>

        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-theme-text-main">Manager & Project Health</h3>
                <p className="text-xs text-theme-text-muted mt-1">Team overview, risk signals, and AI recommendations for leadership.</p>
              </div>
              <button
                onClick={handleAIBalancer}
                disabled={balancerLoading}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full text-xs font-semibold transition-all disabled:opacity-50"
              >
                {balancerLoading ? 'Assessing...' : 'Run AI Balancer'}
              </button>
            </div>

            {teamSummary ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {teamSummary.teams.map((team) => (
                    <div key={team.teamId} className="rounded-3xl border border-theme-border bg-theme-active-nav p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-theme-text-main">{team.name || 'Team'}</h4>
                          <p className="text-[11px] text-theme-text-muted mt-1">{team.memberCount} members</p>
                        </div>
                        <span className="text-[10px] text-theme-text-muted uppercase">Health</span>
                      </div>
                      <div className="mt-4 grid gap-2 text-[11px] text-theme-text-main">
                        <div className="flex items-center justify-between"><span>Overall score</span><span>{team.healthScore}%</span></div>
                        <div className="flex items-center justify-between"><span>Balance</span><span>{team.workloadBalanceScore}%</span></div>
                        <div className="flex items-center justify-between"><span>Active tasks</span><span>{team.activeTaskCount}</span></div>
                        <div className="flex items-center justify-between"><span>Overdue</span><span>{team.overdueTaskCount}</span></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3">
                  {teamSummary.projects.map((project) => (
                    <div key={project.projectId} className="rounded-3xl border border-theme-border bg-theme-active-nav p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-theme-text-main">{project.title || 'Project'}</h4>
                          <p className="text-[11px] text-theme-text-muted mt-1">Progress and risk posture</p>
                        </div>
                        <span className="text-[10px] text-theme-text-muted uppercase">Health</span>
                      </div>
                      <div className="mt-4 grid gap-2 text-[11px] text-theme-text-main">
                        <div className="flex items-center justify-between"><span>Progress</span><span>{project.progress}%</span></div>
                        <div className="flex items-center justify-between"><span>Deadline risk</span><span>{project.deadlineRisk}%</span></div>
                        <div className="flex items-center justify-between"><span>Burnout risk</span><span>{project.burnoutRisk}%</span></div>
                        <div className="flex items-center justify-between"><span>AI health</span><span>{project.aiHealthScore}%</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-6 text-sm text-theme-text-muted">Loading team health data…</div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-theme-text-main">Stand-up & Workload Alerts</h3>
                <p className="text-xs text-theme-text-muted mt-1">Daily updates for team blockers and priorities.</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {standup.length === 0 ? (
                <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">No stand-up data available yet.</div>
              ) : standup.map((item) => (
                <div key={item.userId} className="rounded-3xl border border-theme-border bg-theme-bg/60 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-theme-text-muted mb-2">
                    <span>{item.name}</span>
                    <span>{item.blocked === 'No current blockers.' ? 'Clear' : 'Blocked'}</span>
                  </div>
                  <p className="text-[12px] text-theme-text-main leading-relaxed"><strong>Yesterday:</strong> {item.yesterday}</p>
                  <p className="text-[12px] text-theme-text-main leading-relaxed mt-2"><strong>Today:</strong> {item.today}</p>
                  <p className="text-[12px] text-theme-text-muted mt-2"><strong>Blocked:</strong> {item.blocked}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 border border-theme-border">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-theme-text-main">AI Workload Balancer</h3>
                <p className="text-xs text-theme-text-muted mt-1">Use AI guidance to rebalance a high-pressure task.</p>
              </div>
            </div>
            {aiBalancer ? (
              <div className="space-y-4">
                <div className="rounded-3xl bg-theme-active-nav border border-theme-border p-4 text-sm text-theme-text-main">
                  <h4 className="text-sm font-semibold text-theme-text-main">{aiBalancer.title}</h4>
                  <p className="mt-2 text-[12px] text-theme-text-muted leading-relaxed">{aiBalancer.description}</p>
                </div>
                {aiBalancer.suggestedReallocation.length > 0 ? (
                  <div className="rounded-3xl border border-theme-border bg-theme-bg/60 p-4 text-sm">
                    {aiBalancer.suggestedReallocation.map((suggestion, index) => (
                      <div key={`${suggestion.taskId}-${index}`} className="space-y-2">
                        <p><strong>From:</strong> {getUserName(suggestion.fromUserId)}</p>
                        <p><strong>To:</strong> {getUserName(suggestion.toUserId)}</p>
                        <p><strong>Task:</strong> {suggestion.taskId}</p>
                        <p className="text-xs text-theme-text-muted">{suggestion.reasoning}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">No reallocation required, workload looks balanced.</div>
                )}
                <button
                  onClick={handleAcceptBalancer}
                  disabled={balancerLoading || acceptedBalancer || !aiBalancer.suggestedReallocation.length}
                  className="w-full px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {acceptedBalancer ? 'Recommendation Accepted' : 'Accept Recommendation'}
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">Run the AI balancer to evaluate a workload shift.</div>
            )}
          </div>
        </aside>
      </div>

    </div>
  );
}
