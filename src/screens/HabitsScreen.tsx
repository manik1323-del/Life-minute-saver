import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Habit } from "../types";
import { 
  Flame, Plus, Dumbbell, Code, BookOpen, 
  Droplet, Smile, Trash2, CheckCircle2, RefreshCw 
} from "lucide-react";

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Creation form
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Meditation");
  const [newFrequency, setNewFrequency] = useState<"Daily" | "Weekly">("Daily");

  useEffect(() => {
    fetchHabits();
  }, []);

  const fetchHabits = async () => {
    setLoading(true);
    try {
      const data = await api.getHabits();
      setHabits(data);
    } catch (err) {
      console.error("Habits fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      const created = await api.createHabit(newTitle, newCategory, newFrequency);
      setHabits(prev => [...prev, created]);
      setNewTitle("");
    } catch (err) {
      console.error("Failed to create habit:", err);
    }
  };

  const handleToggleHabitDay = async (habitId: string, dateStr: string) => {
    try {
      const updated = await api.toggleHabit(habitId, dateStr);
      setHabits(prev => prev.map(h => h.id === habitId ? updated : h));
    } catch (err) {
      console.error("Toggle habit failed:", err);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!confirm("Are you sure you want to delete this habit?")) return;
    try {
      await api.deleteHabit(habitId);
      setHabits(prev => prev.filter(h => h.id !== habitId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Helper to get past 7 days dates and names
  const getPast7Days = () => {
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString(undefined, { weekday: 'narrow' });
      list.push({ dateStr, dayName });
    }
    return list;
  };

  const past7Days = getPast7Days();

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Coding": return <Code className="w-5 h-5 text-indigo-400" />;
      case "Exercise": return <Dumbbell className="w-5 h-5 text-rose-400" />;
      case "Reading": return <BookOpen className="w-5 h-5 text-amber-400" />;
      case "Water": return <Droplet className="w-5 h-5 text-blue-400" />;
      case "Meditation": return <Smile className="w-5 h-5 text-emerald-400" />;
      default: return <CheckCircle2 className="w-5 h-5 text-violet-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left Column: Habits grid */}
      <div className="lg:col-span-8 space-y-4">
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-theme-border pb-4 mb-6">
            <div>
              <h3 className="font-bold text-theme-text-main text-lg">Daily Habits Tracker</h3>
              <p className="text-xs text-theme-text-muted">Log completions over the past week to sustain your streaks.</p>
            </div>
            {loading && <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />}
          </div>

          <div className="space-y-4">
            {habits.length > 0 ? (
              habits.map((h) => (
                <div 
                  key={h.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-theme-active-nav/40 border border-theme-border rounded-xl hover:border-theme-border transition-all gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-theme-input-bg border border-theme-border/80 flex items-center justify-center shrink-0">
                      {getCategoryIcon(h.category)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-theme-text-main truncate">{h.title}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-theme-text-muted font-medium">{h.frequency}</span>
                        <div className="w-1 h-1 rounded-full bg-theme-border" />
                        <div className="flex items-center gap-0.5 text-[10px] text-orange-500 font-bold">
                          <Flame className="w-3.5 h-3.5" />
                          <span>{h.streaks} day streak</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 7 Days Tracker Rows */}
                  <div className="flex items-center gap-2 sm:gap-3.5 self-center">
                    {past7Days.map(({ dateStr, dayName }) => {
                      const isCompleted = h.history.includes(dateStr);
                      const isToday = dateStr === new Date().toISOString().split('T')[0];

                      return (
                        <button
                          key={dateStr}
                          onClick={() => handleToggleHabitDay(h.id, dateStr)}
                          className={`w-8 h-10 rounded-lg flex flex-col items-center justify-center border text-[9px] font-bold cursor-pointer transition-all ${
                            isCompleted 
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500" 
                              : isToday 
                                ? "bg-theme-input-bg border-indigo-500/35 text-indigo-500" 
                                : "bg-theme-input-bg/60 border-theme-border text-theme-text-muted hover:text-theme-text-main"
                          }`}
                        >
                          <span>{dayName}</span>
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                            isCompleted ? "bg-emerald-500" : isToday ? "bg-indigo-500" : "bg-theme-border"
                          }`} />
                        </button>
                      );
                    })}

                    <button
                      onClick={() => handleDeleteHabit(h.id)}
                      className="p-2 text-theme-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg shrink-0 cursor-pointer ml-2 transition-all"
                      title="Delete Habit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-theme-input-bg border border-theme-border flex items-center justify-center text-theme-text-muted mb-3">
                  <Flame className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-theme-text-main mb-1">No habits initialized</h4>
                <p className="text-xs text-theme-text-muted max-w-xs leading-normal">
                  Anchor some routines (like meditation, exercise, water) to build a consistent habit streak.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Creation Sheet */}
      <div className="lg:col-span-4">
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-bold text-theme-text-main text-base mb-4">Initialize New Habit</h3>
          
          <form onSubmit={handleCreateHabit} className="space-y-4">
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-theme-text-muted">Habit Name</label>
              <input
                type="text"
                placeholder="e.g. Morning 10m Meditation"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 text-xs text-theme-text-main"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-theme-text-muted">Category Focus</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 text-xs text-theme-text-main"
              >
                <option value="Meditation">Diaphragmatic Breathing / Meditation</option>
                <option value="Coding">Coding Practice</option>
                <option value="Exercise">Physical Workout / Gym</option>
                <option value="Reading">Book Reading</option>
                <option value="Water">Hydrate 2 Liters Water</option>
                <option value="Sleep">Sleep Quality Sleep</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-theme-text-muted">Frequency</label>
              <select
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value as any)}
                className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 text-xs text-theme-text-main"
              >
                <option value="Daily">Daily Goal</option>
                <option value="Weekly">Weekly Goal</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] font-semibold text-white rounded-lg py-2.5 text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Instantiate Habit</span>
            </button>

          </form>
        </div>
      </div>

    </div>
  );
}
