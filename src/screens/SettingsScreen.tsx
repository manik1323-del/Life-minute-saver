import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { 
  User, Clock, Volume2, 
  Check, Moon, Sun, Save, Calendar, Bell 
} from "lucide-react";

export default function SettingsScreen() {
  const { user, updateSettings, refreshUser, applyTheme } = useAuth();
  // Fix: use correct field names that match the User type (workHoursStart/workHoursEnd, no notificationsEnabled)
  const [name, setName] = useState(user?.name || "");
  const [workHoursStart, setWorkHoursStart] = useState(user?.workHoursStart || "09:00");
  const [workHoursEnd, setWorkHoursEnd] = useState(user?.workHoursEnd || "18:00");
  const [focusPeriod, setFocusPeriod] = useState(user?.focusPeriod || 25);
  const [theme, setTheme] = useState<"light" | "dark">(user?.theme || "dark");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(user?.googleCalendarLinked || false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [linkingCalendar, setLinkingCalendar] = useState(false);

  React.useEffect(() => {
    if (user) {
      setGoogleLinked(!!user.googleCalendarLinked);
    }
  }, [user]);

  // Apply theme immediately as a preview when user selects a theme button
  const handleSetTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const validateTime = (time: string): boolean => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Display name cannot be empty.");
      return;
    }
    if (!validateTime(workHoursStart)) {
      setError("Work start time must be in HH:MM format (e.g. 09:00).");
      return;
    }
    if (!validateTime(workHoursEnd)) {
      setError("Work end time must be in HH:MM format (e.g. 18:00).");
      return;
    }
    if (workHoursStart >= workHoursEnd) {
      setError("Work start time must be before work end time.");
      return;
    }

    setSaving(true);
    setSuccess(false);

    try {
      await updateSettings({
        name: name.trim(),
        workHoursStart,
        workHoursEnd,
        focusPeriod: Number(focusPeriod),
        theme,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Save settings failed:", err);
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const requestBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      setError('Browser notifications are not supported in this environment.');
      return;
    }

    setRequestingNotifications(true);
    try {
      const permission = await window.Notification.requestPermission();
      window.dispatchEvent(new Event('notification-permission-changed'));
      setRequestingNotifications(false);
      if (permission === 'granted') {
        setError(null);
        new window.Notification('Last-Minute Life Saver', {
          body: 'Desktop alerts are enabled for productivity reminders.',
          icon: '/icon.svg',
        });
      } else {
        setError('Browser notifications are disabled. Please allow notifications in your browser settings.');
      }
    } catch (err) {
      console.error(err);
      setError('Unable to enable browser notifications.');
      setRequestingNotifications(false);
    }
  };

  const linkGoogleCalendar = () => {
    setLinkingCalendar(true);
    const popup = window.open('/api/calendar/google/link', 'link-google-calendar', 'width=520,height=660');
    if (!popup) {
      setError('Please allow popups to link Google Calendar.');
      setLinkingCalendar(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans">
      
      <div>
        <h2 className="text-xl font-bold text-theme-text-main tracking-tight">System Workspace Settings</h2>
        <p className="text-xs text-theme-text-muted">Calibrate focus windows, coach communication channels, and design themes.</p>
      </div>

      <div className="glass-card rounded-xl p-6">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Section 1: Profile */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-theme-border pb-2">
              <User className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">User Identity Context</h3>
            </div>
            
            <div className="space-y-1.5 max-w-md">
              <label className="text-xs font-semibold text-theme-text-muted">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 text-xs text-theme-text-main transition-colors duration-200"
              />
            </div>
          </div>

          {/* Section 2: Work Schedule */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-theme-border pb-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Circadian Focus Coordinates</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-theme-text-muted">Work Start (HH:MM)</label>
                <input
                  type="text"
                  placeholder="09:00"
                  value={workHoursStart}
                  onChange={(e) => setWorkHoursStart(e.target.value)}
                  className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 text-xs text-theme-text-main font-mono transition-colors duration-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-theme-text-muted">Work End (HH:MM)</label>
                <input
                  type="text"
                  placeholder="18:00"
                  value={workHoursEnd}
                  onChange={(e) => setWorkHoursEnd(e.target.value)}
                  className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 text-xs text-theme-text-main font-mono transition-colors duration-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-theme-text-muted">Focus Period (min)</label>
                <select
                  value={focusPeriod}
                  onChange={(e) => setFocusPeriod(Number(e.target.value))}
                  className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 text-xs text-theme-text-main"
                >
                  <option value={15}>15 minutes</option>
                  <option value={25}>25 minutes (Pomodoro)</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes (Deep Work)</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-theme-text-muted max-w-md leading-normal">
              Socrates-Focus uses these bounding parameters to align automatically compiled study blocks, meetings, and breathing anchors.
            </p>
          </div>

          {/* Section 3: Visual Identity & Theme */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-theme-border pb-2">
              <Sun className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Workspace Visual Mode</h3>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleSetTheme("light")}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                  theme === "light" 
                    ? "bg-indigo-500 text-white border-indigo-500 font-extrabold shadow-md shadow-indigo-500/10" 
                    : "bg-theme-input-bg border-theme-border text-theme-text-muted hover:text-theme-text-main"
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Modern Light Mode</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetTheme("dark")}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                  theme === "dark" 
                    ? "bg-indigo-500 text-white border-indigo-500 font-extrabold shadow-md shadow-indigo-500/10" 
                    : "bg-theme-input-bg border-theme-border text-theme-text-muted hover:text-theme-text-main"
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Cosmic Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Section 4: Notifications info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-theme-border pb-2">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Coach Smart Notifications</h3>
            </div>

            <div className="flex items-start gap-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0 animate-pulse" />
              <p className="text-xs text-theme-text-muted leading-normal">
                Coach Socrates actively monitors deadline risks and habit streaks. Predictive warnings appear automatically in your notification feed on the dashboard and in the header bell icon.
              </p>
            </div>
          </div>

          {/* Section 5: Notification and Calendar Actions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-theme-border pb-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Browser Alerts & Calendar Sync</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={requestBrowserNotifications}
                disabled={requestingNotifications}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-bold transition hover:from-indigo-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestingNotifications ? 'Requesting permission...' : 'Enable browser notifications'}
              </button>

              <button
                type="button"
                onClick={linkGoogleCalendar}
                disabled={linkingCalendar || googleLinked}
                className="w-full px-4 py-3 rounded-xl border border-theme-border bg-theme-input-bg text-xs font-bold text-theme-text-main transition hover:border-indigo-500 hover:text-theme-text-main disabled:cursor-not-allowed disabled:opacity-60"
              >
                {googleLinked ? 'Google Calendar linked' : linkingCalendar ? 'Linking calendar...' : 'Link Google Calendar'}
              </button>
            </div>

            <p className="text-[10px] text-theme-text-muted max-w-xl leading-normal">
              Grant browser alerts for important deadlines and link your Google Calendar to align real-time meetings with your focus windows. If the calendar is already linked, refreshing your profile should reflect the connection.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400 font-semibold">{error}</p>
            </div>
          )}

          {/* Feedback & Actions */}
          <div className="pt-5 border-t border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {success ? (
              <div className="flex items-center gap-2 text-xs text-green-500 font-bold bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg">
                <Check className="w-4 h-4 text-green-500" />
                <span>Settings securely calibrated!</span>
              </div>
            ) : (
              <div className="text-[10px] text-theme-text-muted leading-normal max-w-md">
                * Settings are saved to your profile and used immediately for AI scheduling and coach insights.
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-xs font-bold text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-indigo-500/10 shrink-0"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>

          </div>

        </form>
      </div>

    </div>
  );
}
