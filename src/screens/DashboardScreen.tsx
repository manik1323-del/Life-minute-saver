import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Task, DailySchedule, AISuggestion, Analytic, Notification, Prediction, ConsistencyMetrics, Goal } from "../types";
import { socket } from "../lib/socket";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "motion/react";
import { 
  Sparkles, CheckCircle, AlertTriangle, Clock, Calendar, 
  Flame, TrendingUp, RefreshCw, ChevronRight, UserCheck 
} from "lucide-react";

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
  tasks: Task[];
  onRefreshTasks: () => void;
}

export default function DashboardScreen({ onNavigate, tasks, onRefreshTasks }: DashboardScreenProps) {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<DailySchedule | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [analytics, setAnalytics] = useState<Analytic[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyMetrics | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [runningSimulation, setRunningSimulation] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [selectedTaskForSim, setSelectedTaskForSim] = useState<string>("");
  const [simDelay, setSimDelay] = useState<number>(1);
  const [simPriority, setSimPriority] = useState<"Critical" | "High" | "Medium" | "Low">("Medium");
  const [simDeadline, setSimDeadline] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [loadingConsistency, setLoadingConsistency] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    socket?.on('workspace:dashboard-refresh', fetchDashboardData);
    socket?.on('workspace:goal-updated', fetchDashboardData);
    return () => {
      socket?.off('workspace:dashboard-refresh', fetchDashboardData);
      socket?.off('workspace:goal-updated', fetchDashboardData);
    };
  }, [user, tasks]);

  const fetchDashboardData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      setLoadingPredictions(true);
      setLoadingConsistency(true);

      const [sched, sugs, notes, anals, preds, cons, goalData] = await Promise.all([
        api.getSchedule(todayStr),
        api.getAISuggestions(),
        api.getNotifications(),
        api.getAnalytics(),
        api.getPredictions(),
        api.getConsistency(),
        api.getGoals()
      ]);

      setSchedule(sched);
      setSuggestions(sugs);
      setNotifications(notes);
      setAnalytics(anals);
      setPrediction(preds);
      setConsistency(cons);
      setGoals(goalData?.goals || []);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoadingPredictions(false);
      setLoadingConsistency(false);
    }
  };

  const handleAISmartSchedule = async () => {
    setGeneratingSchedule(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await api.runAISmartScheduler(todayStr);
      if (res.success) {
        setSchedule(res.schedule);
        const notes = await api.getNotifications();
        setNotifications(notes);
      }
    } catch (err) {
      console.error("AI scheduler error:", err);
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const handleRefreshSuggestions = async () => {
    setLoadingSchedule(true);
    try {
      await api.refreshAISuggestions();
      const sugs = await api.getAISuggestions();
      setSuggestions(sugs);
      const notes = await api.getNotifications();
      setNotifications(notes);
    } catch (err) {
      console.error("AI suggestions refresh failed:", err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSimulateWhatIf = async () => {
    if (!selectedTaskForSim) return;
    setRunningSimulation(true);
    try {
      const res = await api.simulateWhatIf(selectedTaskForSim, "deadline_shift", {
        delayDays: simDelay,
        newPriority: simPriority,
        newDeadline: simDeadline
      });
      setSimulationResult(res);
    } catch (err) {
      console.error("What-if simulation failed:", err);
    } finally {
      setRunningSimulation(false);
    }
  };

  // Compute status totals
  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const pendingCount = tasks.filter(t => t.status === 'Pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const missedCount = tasks.filter(t => t.status === 'Missed').length;

  const priorityTasks = tasks.filter(t => t.status !== 'Completed' && (t.priority === 'Critical' || t.priority === 'High'));
  const taskById = Object.fromEntries(tasks.map((task) => [task.id, task]));
  const suggestionByTaskId = Object.fromEntries(suggestions.filter((s) => !!s.taskId).map((s) => [s.taskId!, s]));
  const upcomingDeadlines = tasks
    .filter((t) => t.status !== 'Completed')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">
      
      {/* Dynamic Header Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-theme-text-main tracking-tight">
            Welcome back, <span className="text-indigo-500 font-extrabold">{user?.name}</span>!
          </h2>
          <p className="text-sm text-theme-text-muted">
            Your personal Socrates-Focus productivity coach is active. 
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchDashboardData}
            className="p-2 bg-theme-card border border-theme-border rounded-lg text-theme-text-muted hover:text-theme-text-main hover:bg-theme-active-nav active:scale-95 transition-all cursor-pointer"
            title="Refresh All Dashboard Cards"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleAISmartSchedule}
            disabled={generatingSchedule}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 active:scale-[0.98] rounded-lg text-sm text-white font-medium flex items-center gap-2 shadow-lg shadow-indigo-500/10 cursor-pointer transition-all"
          >
            {generatingSchedule ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            )}
            <span>AI Smart Re-Schedule</span>
          </button>
        </div>
      </div>

      {/* Executive AI Dashboard Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-5 overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-theme-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Success Prediction</span>
            <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <div className="mt-3">
            <span className="text-4xl font-black text-theme-text-main">{prediction ? `${prediction.estimatedSuccessRate}%` : '—'}</span>
            <p className="text-xs text-theme-text-muted mt-2 leading-snug">
              {prediction?.explanation || 'Live AI success forecast from your current workload.'}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-theme-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Burnout</span>
            <Flame className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-4xl font-black text-theme-text-main">{prediction ? `${prediction.burnoutProbability}%` : '—'}</span>
            <p className="text-xs text-theme-text-muted mt-2 leading-snug">
              {prediction ? `Recommended breaks every ${(prediction.recommendedBreakFrequency || 'hour').toLowerCase()}.` : 'Back-end AI calculates your risk in real-time.'}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-theme-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Best Focus Window</span>
            <Clock className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <div className="mt-3">
            <span className="text-4xl font-black text-theme-text-main">{prediction?.bestFocusWindow || '—'}</span>
            <p className="text-xs text-theme-text-muted mt-2 leading-snug">
              {prediction ? `Use this window for your most challenging tasks.` : 'AI analysis will populate here shortly.'}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-theme-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Daily Consistency</span>
            <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-4xl font-black text-theme-text-main">{consistency ? `${consistency.weeklyConsistency}%` : '—'}</span>
            <p className="text-xs text-theme-text-muted mt-2 leading-snug">
              {consistency ? `${consistency.focusTrend} momentum` : 'Engine is calculating your consistency profile.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Split Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Daily Schedule Planner */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="glass-card rounded-xl p-6 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-theme-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-theme-text-main">Today's Dynamic AI Schedule</h3>
              </div>
              <span className="text-xs text-theme-text-muted bg-theme-active-nav border border-theme-border px-2.5 py-1 rounded-full">
                {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {/* Schedule Timeline */}
            <div className="space-y-3 overflow-y-auto flex-1 max-h-[400px] pr-1">
              {schedule && schedule.items && schedule.items.length > 0 ? (
                schedule.items.map((item, idx) => {
                  const task = item.referenceId ? taskById[item.referenceId] : undefined;
                  const suggestion = task ? suggestionByTaskId[task.id] : undefined;
                  return (
                    <div
                      key={item.id || idx}
                      className={`flex flex-col gap-3 p-4 rounded-3xl border transition-all hover:scale-[1.01] ${
                        item.type === 'task' ? 'bg-indigo-500/10 border-indigo-500/20' :
                        item.type === 'meeting' ? 'bg-rose-500/10 border-rose-500/20' :
                        item.type === 'habit' ? 'bg-emerald-500/10 border-emerald-500/20' :
                        'bg-theme-active-nav/40 border-theme-border/60'
                      }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-theme-text-muted">{item.startTime} — {item.endTime}</p>
                          <h4 className="mt-1 text-sm font-bold text-theme-text-main leading-snug truncate">{item.title}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-theme-text-muted">{item.type}</span>
                          {task && (
                            <div className="mt-2 text-[10px] font-semibold text-theme-text-main">
                              {task.priority} • {task.estimatedTime}m
                            </div>
                          )}
                        </div>
                      </div>

                      {task && (
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-theme-text-muted">
                          <div className="rounded-2xl bg-theme-input-bg/70 p-2 border border-theme-border">Status: {task.status}</div>
                          <div className="rounded-2xl bg-theme-input-bg/70 p-2 border border-theme-border">Deadline risk: {task.deadlineRisk}%</div>
                        </div>
                      )}

                      {suggestion && (
                        <div className="rounded-3xl border border-theme-border bg-theme-card p-3 text-[11px] text-theme-text-main">
                          <span className="font-semibold text-xs text-indigo-500">AI Suggestion</span>
                          <p className="mt-1 text-[11px] text-theme-text-muted leading-snug">{suggestion.suggestion}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-theme-active-nav border border-theme-border flex items-center justify-center text-theme-text-muted mb-3">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-theme-text-main mb-1">No Schedule Seeded</h4>
                  <p className="text-xs text-theme-text-muted max-w-xs leading-normal">
                    Let Socrates-Focus organize your tasks and meetings into an efficient daily timeline.
                  </p>
                  <button
                    onClick={handleAISmartSchedule}
                    className="mt-4 px-4 py-1.5 bg-theme-active-nav border border-theme-border hover:bg-theme-active-nav/80 text-xs text-indigo-500 hover:text-indigo-600 rounded-lg transition-all"
                  >
                    Generate Daily Schedule
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Coach Predictive Warnings & Suggestions */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* AI Real-time Advice Alert */}
          <div className="glass-card rounded-xl p-6 flex flex-col relative overflow-hidden border-indigo-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -z-10" />
            <div className="flex items-center justify-between border-b border-theme-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                <h3 className="font-bold text-theme-text-main">Live Coach Predictions</h3>
              </div>
              <button 
                onClick={handleRefreshSuggestions}
                disabled={loadingSchedule}
                className="text-[10px] text-indigo-500 hover:text-indigo-600 flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded transition-all cursor-pointer"
              >
                {loadingSchedule ? (
                  <div className="w-3 h-3 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    <span>Run Gemini Diagnosis</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-4 flex-1">
              {suggestions.length > 0 ? (
                suggestions.map((sug) => (
                  <div 
                    key={sug.id} 
                    className={`p-4 rounded-xl border flex flex-col justify-between ${
                      sug.type === 'urgency_warning' 
                        ? 'bg-red-500/5 border-red-500/15' 
                        : 'bg-theme-accent/5 border-theme-accent/15'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          sug.type === 'urgency_warning' ? 'bg-red-500' : 'bg-indigo-500'
                        }`} />
                        <h4 className="text-xs font-bold text-theme-text-main uppercase tracking-wider">
                          {sug.title}
                        </h4>
                      </div>
                      <p className="text-xs text-theme-text-muted leading-relaxed">
                        {sug.suggestion}
                      </p>
                    </div>
                    
                    <div className="flex justify-end mt-4 pt-3 border-t border-theme-border/60">
                      {sug.type === 'urgency_warning' ? (
                        <button 
                          onClick={() => onNavigate('tasks')}
                          className="text-[10px] text-red-500 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Go to Critical Task</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => onNavigate('coach')}
                          className="text-[10px] text-indigo-500 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Formulate Strategy</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-10 h-10 rounded-full bg-theme-active-nav border border-theme-border flex items-center justify-center text-theme-text-muted mb-2">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-theme-text-main mb-1">Your schedule is secure!</h4>
                  <p className="text-[10px] text-theme-text-muted max-w-xs leading-normal">
                    Coach Socrates reports zero missed deadlines and perfect planning anchors.
                  </p>
                  <button
                    onClick={handleRefreshSuggestions}
                    className="mt-3 text-[10px] text-indigo-500 hover:underline"
                  >
                    Run Fresh Diagnostics
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Active Task Widget */}
          {priorityTasks.length > 0 && (
            <div className="glass-card rounded-xl p-5 border border-red-500/20">
              <h4 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider mb-3">
                High Priority Workload Focus
              </h4>
              <div className="space-y-2">
                {priorityTasks.slice(0, 2).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 bg-theme-active-nav rounded-lg border border-theme-border">
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-theme-text-main truncate">{t.title}</h5>
                      <span className="text-[9px] text-red-500 font-mono">
                        Deadline Risk: {t.deadlineRisk}%
                      </span>
                    </div>
                    <button 
                      onClick={() => onNavigate('tasks')}
                      className="px-2 py-1 bg-theme-active-nav hover:bg-theme-active-nav/80 text-[10px] text-theme-text-main rounded transition-all cursor-pointer"
                    >
                      Focus
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goals Progress Widget */}
          {goals.filter(g => g.status === 'Active').length > 0 && (
            <div className="glass-card rounded-xl p-5 border border-indigo-500/20">
              <h4 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider mb-3">
                Strategic Goal Progress
              </h4>
              <div className="space-y-4">
                {goals.filter(g => g.status === 'Active').slice(0, 3).map(goal => (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-theme-text-main font-bold truncate pr-2">{goal.title}</span>
                      <span className="text-indigo-500 font-mono font-bold shrink-0">{goal.progress}%</span>
                    </div>
                    <div className="w-full bg-theme-input-bg h-1.5 rounded-full overflow-hidden border border-theme-border">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onNavigate('goals')}
                className="w-full mt-4 py-1.5 bg-theme-active-nav hover:bg-theme-active-nav/80 text-[10px] text-theme-text-muted hover:text-theme-text-main rounded transition-all cursor-pointer border border-theme-border"
              >
                View Goal Planner
              </button>
            </div>
          )}

          {/* What-If Scenario Simulator */}
          <div className="glass-card rounded-xl p-5 border border-theme-border">
            <div className="flex items-center justify-between gap-3 border-b border-theme-border pb-3 mb-4">
              <div>
                <h4 className="text-xs font-bold text-theme-text-main uppercase tracking-wider">What If Simulator</h4>
                <p className="text-[10px] text-theme-text-muted mt-1">Model the impact of shifting deadlines and priorities.</p>
              </div>
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] uppercase tracking-wider text-theme-text-muted">Select Task</label>
              <select
                value={selectedTaskForSim}
                onChange={(e) => setSelectedTaskForSim(e.target.value)}
                className="w-full bg-theme-input-bg border border-theme-border rounded-2xl px-3 py-2 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
              >
                <option value="">Choose a task</option>
                {tasks.filter(t => t.status !== 'Completed').map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Delay (days)</label>
                  <input
                    type="number"
                    min={0}
                    value={simDelay}
                    onChange={(e) => setSimDelay(Number(e.target.value))}
                    className="mt-2 w-full bg-theme-input-bg border border-theme-border rounded-2xl px-3 py-2 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">New Priority</label>
                  <select
                    value={simPriority}
                    onChange={(e) => setSimPriority(e.target.value as any)}
                    className="mt-2 w-full bg-theme-input-bg border border-theme-border rounded-2xl px-3 py-2 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                  >
                    {['Critical', 'High', 'Medium', 'Low'].map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Projected Deadline</label>
                <input
                  type="date"
                  value={simDeadline}
                  onChange={(e) => setSimDeadline(e.target.value)}
                  className="mt-2 w-full bg-theme-input-bg border border-theme-border rounded-2xl px-3 py-2 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleSimulateWhatIf}
                disabled={runningSimulation || !selectedTaskForSim}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold px-4 py-3 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {runningSimulation ? 'Running simulation…' : 'Run Scenario'}
              </button>

              {simulationResult && (
                <div className="rounded-3xl border border-theme-border bg-theme-card p-4 text-sm text-theme-text-main">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-xs uppercase tracking-wider text-theme-text-muted">Simulation Outcome</span>
                    <span className="text-[10px] text-emerald-400">Live AI estimate</span>
                  </div>
                  <p className="text-[11px] text-theme-text-muted leading-relaxed whitespace-pre-line">
                    {simulationResult.result?.notes || simulationResult.notes || 'Review the projected impacts of the scenario.'}
                  </p>
                  {simulationResult.result?.predictedChange && (
                    <div className="mt-3 grid grid-cols-1 gap-2 text-[10px] text-theme-text-muted">
                      {Object.entries(simulationResult.result.predictedChange).map(([key, value]) => (
                        <div key={key} className="rounded-2xl bg-theme-active-nav/70 p-2 border border-theme-border">
                          <span className="font-semibold text-theme-text-main capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>: {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
