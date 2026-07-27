import React, { useState, useEffect, Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { api } from "./lib/api";
import { Task, Notification, RecoveryPlan, PresenceStatus } from "./types";
import { initRealtimeConnection, joinRealtimeRooms, leaveRealtimeRooms, disconnectRealtime } from "./lib/socket";
import { DEMO_MODE } from "./lib/demoUser";

// Lazy-loaded screens for faster initial load
const AuthScreen = lazy(() => import("./screens/AuthScreen"));
const DashboardScreen = lazy(() => import("./screens/DashboardScreen"));
const TasksScreen = lazy(() => import("./screens/TasksScreen"));
const HabitsScreen = lazy(() => import("./screens/HabitsScreen"));
const CoachScreen = lazy(() => import("./screens/CoachScreen"));
const GoalsScreen = lazy(() => import("./screens/GoalsScreen"));
const FocusScreen = lazy(() => import("./screens/FocusScreen"));
const AnalyticsScreen = lazy(() => import("./screens/AnalyticsScreen"));
const WorkspaceScreen = lazy(() => import("./screens/WorkspaceScreen"));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen"));

// Icons & motion
import { motion, AnimatePresence } from "motion/react";
import { 
  Flame, LayoutDashboard, CheckSquare, Dumbbell, 
  Bot, Timer, BarChart3, Award, Settings, LogOut, Menu, X, 
  Bell, Sparkles, ShieldCheck, Users 
} from "lucide-react";

function AppContent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceStatus>>({});
  const [typingStatus, setTypingStatus] = useState<Record<string, string>>({});
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [availableHours, setAvailableHours] = useState(4);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [deadlineNotes, setDeadlineNotes] = useState("");
  const [rescuePlan, setRescuePlan] = useState<RecoveryPlan | null>(null);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false);
  const [calendarLinked, setCalendarLinked] = useState<boolean>(false);

  useEffect(() => {
    // In demo mode the user object is always set — guard against null
    if (!user) return;

    fetchCoreAppData();

    // In demo mode use the demo token so the socket server can authorise the connection
    const socket = initRealtimeConnection(localStorage.getItem("last_minute_token") || "", user.id);
    joinRealtimeRooms(["workspace-global", `user-${user.id}`]);

    const handleTaskEvent = (payload: any) => {
      if (!payload?.task) return;
      setTasks(prev => {
        const existing = prev.find((item) => item.id === payload.task.id);
        if (existing) {
          return prev.map((item) => item.id === payload.task.id ? payload.task : item);
        }
        return [...prev, payload.task];
      });
    };

    const handleTaskDeleted = (payload: any) => {
      setTasks(prev => prev.filter((item) => item.id !== payload.taskId));
    };

    const handleNotifications = (note: Notification) => {
      setNotifications(prev => [note, ...prev].slice(0, 50));
      if (desktopNotificationsEnabled && window.Notification?.permission === 'granted') {
        try {
          const notification = new window.Notification(note.title, {
            body: note.message,
            icon: '/icon.svg',
          });
          notification.onclick = () => window.focus();
        } catch (error) {
          console.warn('Desktop notification failed:', error);
        }
      }
    };

    const handlePresence = (presence: PresenceStatus) => {
      setPresenceMap((prev) => ({ ...prev, [presence.userId]: presence }));
    };

    const handleTyping = (payload: any) => {
      if (!payload?.targetId || !payload?.userName) return;
      setTypingStatus((prev) => ({ ...prev, [payload.targetId]: `${payload.userName} is typing...` }));
      window.setTimeout(() => {
        setTypingStatus((prev) => {
          if (prev[payload.targetId]?.includes(payload.userName)) {
            const { [payload.targetId]: _, ...rest } = prev;
            return rest;
          }
          return prev;
        });
      }, 3000);
    };

    const handleLinkMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_CALENDAR_LINKED' && event.origin === window.location.origin) {
        setCalendarLinked(Boolean(event.data.success));
        window.location.reload();
      }
    };

    const handlePermissionChange = () => {
      setDesktopNotificationsEnabled(window.Notification?.permission === 'granted');
    };

    socket.on("workspace:task-created", handleTaskEvent);
    socket.on("workspace:task-updated", handleTaskEvent);
    socket.on("workspace:task-deleted", handleTaskDeleted);
    socket.on("notification:created", handleNotifications);
    socket.on("workspace:presence", handlePresence);
    socket.on("workspace:typing", handleTyping);
    socket.on("workspace:dashboard-refresh", fetchCoreAppData);
    socket.on("workspace:analytics-refresh", fetchCoreAppData);
    window.addEventListener('message', handleLinkMessage);
    window.addEventListener('notification-permission-changed', handlePermissionChange);

    const interval = setInterval(() => {
      fetchCoreAppData();
    }, 15000);

    return () => {
      clearInterval(interval);
      socket.off("workspace:task-created", handleTaskEvent);
      socket.off("workspace:task-updated", handleTaskEvent);
      socket.off("workspace:task-deleted", handleTaskDeleted);
      socket.off("notification:created", handleNotifications);
      socket.off("workspace:presence", handlePresence);
      socket.off("workspace:typing", handleTyping);
      window.removeEventListener('message', handleLinkMessage);
      window.removeEventListener('notification-permission-changed', handlePermissionChange);
      leaveRealtimeRooms(["workspace-global", `user-${user.id}`]);
      disconnectRealtime();
    };
  }, [isAuthenticated, user, desktopNotificationsEnabled]);

  useEffect(() => {
    if (!user) return;
    setCalendarLinked(!!user.googleCalendarLinked);
    setDesktopNotificationsEnabled(window.Notification?.permission === 'granted');
  }, [user]);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const fetchCoreAppData = async () => {
    try {
      const [allTasks, allNotes] = await Promise.all([
        api.getTasks(),
        api.getNotifications()
      ]);
      setTasks(allTasks);
      setNotifications(allNotes);
    } catch (err) {
      console.error("Failed to load core app background sync:", err);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const submitRescueRequest = async () => {
    if (!availableHours || availableHours <= 0) return;
    setRescueLoading(true);
    try {
      const response = await api.rescueMyDay({
        availableHours,
        pendingTasks: selectedTaskIds,
        meetings: meetingNotes ? meetingNotes.split(",").map(item => item.trim()).filter(Boolean) : undefined,
        deadlines: deadlineNotes ? deadlineNotes.split(",").map(item => item.trim()).filter(Boolean) : undefined,
      });
      setRescuePlan(response);
    } catch (err) {
      console.error("Rescue plan generation failed:", err);
    } finally {
      setRescueLoading(false);
    }
  };

  const markNoteRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const requestBrowserNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await window.Notification.requestPermission();
    setDesktopNotificationsEnabled(permission === 'granted');
    if (permission === 'granted') {
      new window.Notification('Last-Minute Life Saver', {
        body: 'Desktop alerts are enabled for AI productivity reminders.',
        icon: '/icon.svg',
      });
    }
  };

  const openGoogleCalendarLink = () => {
    const popup = window.open('/api/calendar/google/link', 'google-calendar-link', 'width=520,height=660,noopener,noreferrer');
    if (!popup) {
      alert('Please enable popups to link Google Calendar.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin relative" />
        </div>
        <h2 className="text-white text-base font-bold font-sans mt-6 animate-pulse">
          Calibrating Focus Workspace...
        </h2>
      </div>
    );
  }

  // Auth gate: show login screen when user is not authenticated
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-theme-bg flex items-center justify-center text-theme-text-main">Loading authentication...</div>}>
        <AuthScreen />
      </Suspense>
    );
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardScreen onNavigate={setActiveTab} tasks={tasks} onRefreshTasks={fetchCoreAppData} />;
      case "tasks":
        return <TasksScreen tasks={tasks} onRefreshTasks={fetchCoreAppData} />;
      case "goals":
        return <GoalsScreen onRefreshTasks={fetchCoreAppData} />;
      case "workspaces":
        return <WorkspaceScreen />;
      case "habits":
        return <HabitsScreen />;
      case "coach":
        return <CoachScreen />;
      case "focus":
        return <FocusScreen />;
      case "analytics":
        return <AnalyticsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={setActiveTab} tasks={tasks} onRefreshTasks={fetchCoreAppData} />;
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "tasks", label: "Task Board", icon: <CheckSquare className="w-4 h-4" /> },
    { id: "goals", label: "Goal Planner", icon: <Award className="w-4 h-4" /> },
    { id: "workspaces", label: "Workspace", icon: <Users className="w-4 h-4" /> },
    { id: "habits", label: "Habit Tracker", icon: <Dumbbell className="w-4 h-4" /> },
    { id: "coach", label: "AI Coach", icon: <Bot className="w-4 h-4" /> },
    { id: "focus", label: "Focus Mode", icon: <Timer className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  const unreadNotes = notifications.filter(n => !n.read);

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-main flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden transition-colors duration-300">
      
      {/* Top Header Bar */}
      <header className="h-16 border-b border-theme-border bg-theme-header backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6 transition-colors duration-300">
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Trigger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-active-nav rounded-lg cursor-pointer transition-all"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white glow-primary">
              <Flame className="w-4.5 h-4.5 animate-bounce" />
            </div>
            <span className="font-extrabold text-sm text-theme-text-main tracking-tight">
              Last-Minute <span className="text-indigo-400">Life Saver</span>
            </span>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-4">
          
          {/* Real-time notification Alerts */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-active-nav rounded-lg cursor-pointer transition-all relative"
            >
              <Bell className="w-5 h-5" />
              {unreadNotes.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotes.length}
                </span>
              )}
            </button>

            {/* Notifications Popover Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="absolute right-0 mt-2 w-80 glass-card rounded-xl shadow-2xl p-4 overflow-hidden z-50 text-xs text-theme-text-muted border-theme-border"
                >
                  <div className="flex items-center justify-between border-b border-theme-border pb-2.5 mb-2.5">
                    <span className="font-bold text-theme-text-main">Focus Notifications</span>
                    {unreadNotes.length > 0 && (
                      <span className="text-[10px] text-indigo-400 font-semibold">{unreadNotes.length} unread warnings</span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {notifications.length > 0 ? (
                      notifications.map((note) => (
                        <div 
                          key={note.id} 
                          onClick={() => markNoteRead(note.id)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                            note.read 
                              ? 'bg-theme-bg/40 border-theme-border opacity-60' 
                              : 'bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-theme-text-main">{note.title}</span>
                            {!note.read && (
                              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-theme-text-muted mt-1 leading-normal">
                            {note.message}
                          </p>
                          <span className="block text-[8px] text-theme-text-muted font-mono text-right mt-1.5">
                            {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-theme-text-muted">
                        No recent focus notifications.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User profile capsule */}
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-theme-active-nav border border-theme-border rounded-full text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-theme-text-main">{user?.name}</span>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className={`font-semibold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

        </div>
      </header>

      {/* Main Workspace split */}
      <div className="flex-1 flex relative">
        
        {/* Sidebar Navigation */}
        <aside className={`
          fixed md:sticky top-16 left-0 bottom-0 w-64 bg-theme-sidebar border-r border-theme-border z-30 flex flex-col justify-between p-4 transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="space-y-6">
            <div className="px-3">
              <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Workspace Core</span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                    activeTab === item.id 
                      ? 'bg-theme-accent/10 text-theme-accent border border-theme-accent/25 font-bold shadow-sm shadow-indigo-500/5' 
                      : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-active-nav'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Bottom user logout info */}
          <div className="pt-4 border-t border-theme-border/80 space-y-3">
            <div className="flex items-center justify-between px-3 text-xs">
              <span className="text-theme-text-muted">Core Sync status:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>

            {/* Logout button — hidden in demo mode */}
            {!DEMO_MODE && (
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-theme-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Calibrate Log Out</span>
              </button>
            )}

            {/* Demo mode badge */}
            {DEMO_MODE && (
              <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Sparkles className="w-3 h-3" />
                <span>DEMO MODE ACTIVE</span>
              </div>
            )}
          </div>
        </aside>

        {/* Sidebar backdrop overlay (mobile only) */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-theme-bg/60 backdrop-blur-xs z-20 md:hidden"
          />
        )}

        {/* Master Active Content Canvas */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-theme-text-muted">Loading workspace view…</div>}>
            {renderActiveScreen()}
          </Suspense>
        </main>

        {/* Emergency Rescue Floating Action */}
        <button
          onClick={() => setShowRescueModal(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-2xl shadow-rose-500/20 border border-white/10 backdrop-blur-xl hover:scale-[1.02] transition-transform"
        >
          <span className="text-base">🚨</span>
          <span className="text-sm font-semibold">Rescue My Day</span>
        </button>

        {/* Rescue Plan Modal */}
        {showRescueModal && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl glass-card rounded-3xl border border-theme-border shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-theme-border">
                <div>
                  <h3 className="text-lg font-bold text-theme-text-main">Emergency Rescue Mode</h3>
                  <p className="text-xs text-theme-text-muted mt-1">Generate a recovery schedule without committing changes.</p>
                </div>
                <button
                  onClick={() => setShowRescueModal(false)}
                  className="text-theme-text-muted hover:text-theme-text-main p-2 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Available Hours</label>
                    <input
                      type="number"
                      min={1}
                      value={availableHours}
                      onChange={(e) => setAvailableHours(Number(e.target.value))}
                      className="mt-2 w-full bg-theme-input-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Pending Tasks</label>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                      {tasks.filter(t => t.status !== 'Completed').map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => toggleTaskSelection(task.id)}
                          className={`w-full text-left rounded-2xl border px-3 py-3 text-sm transition-all ${selectedTaskIds.includes(task.id) ? 'border-indigo-500 bg-indigo-500/10 text-theme-text-main' : 'border-theme-border bg-theme-active-nav text-theme-text-muted hover:border-indigo-500'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold truncate">{task.title}</span>
                            <span className="text-[10px] text-theme-text-muted">{task.deadlineRisk}% risk</span>
                          </div>
                          <span className="text-[10px] text-theme-text-muted block mt-1 truncate">{new Date(task.deadline).toLocaleDateString()}</span>
                        </button>
                      ))}
                      {tasks.filter(t => t.status !== 'Completed').length === 0 && (
                        <div className="rounded-2xl border border-theme-border bg-theme-active-nav px-3 py-4 text-xs text-theme-text-muted">No pending tasks currently available.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Meetings</label>
                    <textarea
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      placeholder="E.g. Standup 10am, Review 2pm"
                      className="mt-2 w-full min-h-[90px] bg-theme-input-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Deadlines</label>
                    <textarea
                      value={deadlineNotes}
                      onChange={(e) => setDeadlineNotes(e.target.value)}
                      placeholder="E.g. Pitch due tomorrow, Review due Friday"
                      className="mt-2 w-full min-h-[90px] bg-theme-input-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    onClick={submitRescueRequest}
                    disabled={rescueLoading}
                    className="w-full mt-2 rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-500 text-sm text-white font-semibold px-4 py-3 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rescueLoading ? 'Generating Recovery Plan…' : 'Generate Rescue Plan'}
                  </button>
                </div>

                <div className="space-y-4">
                  {rescuePlan ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl bg-theme-active-nav border border-theme-border p-4">
                        <h4 className="text-sm font-bold text-theme-text-main">Recovery Summary</h4>
                        <div className="mt-3 text-[12px] text-theme-text-muted space-y-2">
                          <div className="flex items-center justify-between">
                            <span>Estimated Success</span>
                            <span className="font-semibold text-theme-text-main">{rescuePlan.estimatedSuccess}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Estimated Risk</span>
                            <span className="font-semibold text-theme-text-main">{rescuePlan.estimatedRisk}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Completion Probability</span>
                            <span className="font-semibold text-theme-text-main">{rescuePlan.completionProbability}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-theme-active-nav border border-theme-border p-4">
                        <h4 className="text-sm font-bold text-theme-text-main">Recovery Timeline</h4>
                        <div className="mt-3 space-y-3">
                          {rescuePlan.schedule.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-theme-border p-3 bg-theme-card">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-theme-text-muted uppercase tracking-wider">{item.startTime} — {item.endTime}</span>
                                <span className="text-[10px] text-indigo-400">{item.type}</span>
                              </div>
                              <p className="mt-2 text-sm font-semibold text-theme-text-main truncate">{item.title}</p>
                              {item.referenceId && <p className="text-[10px] text-theme-text-muted mt-1">Task reference: {item.referenceId}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">
                      Submit your recovery inputs to see an emergency schedule, critical tasks, and risk assessment.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
