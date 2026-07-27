import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Goal, Milestone } from "../types";
import { Plus, CheckCircle2, Trash2, Sparkles } from "lucide-react";
import { socket } from "../lib/socket";

interface GoalsScreenProps {
  onRefreshTasks: () => void;
}

export default function GoalsScreen({ onRefreshTasks }: GoalsScreenProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);

  // Creation state
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDesc, setNewGoalDesc] = useState("");
  const [newMilestones, setNewMilestones] = useState<{ title: string; description: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editMilestones, setEditMilestones] = useState<Milestone[]>([]);

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();

    socket?.on('workspace:goal-updated', loadGoals);
    socket?.on('workspace:sync-all', loadGoals);

    return () => {
      socket?.off('workspace:goal-updated', loadGoals);
      socket?.off('workspace:sync-all', loadGoals);
    };
  }, []);

  const loadGoals = async () => {
    setLoading(true);
    try {
      const data = await api.getGoals();
      setGoals(data.goals || []);
      setMilestones(data.milestones || []);
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    setCreating(true);

    try {
      const payload = {
        title: newGoalTitle.trim(),
        description: newGoalDesc.trim(),
        milestones: newMilestones.length > 0 ? newMilestones : [{ title: "Initial Milestone", description: "" }],
      };
      await api.createGoal(payload);
      setNewGoalTitle("");
      setNewGoalDesc("");
      setNewMilestones([]);
      loadGoals();
      // Regenerate today's AI schedule so new goal/tasks reflect in the Dashboard
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        await api.runAISmartScheduler(todayStr);
      } catch (schedErr) {
        console.warn("Auto-schedule regeneration failed (non-critical):", schedErr);
      }
      onRefreshTasks();
    } catch (err) {
      console.error("Create goal failed:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditTitle(goal.title);
    setEditDesc(goal.description);
    setEditMilestones(milestones.filter(m => m.goalId === goal.id));
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editTitle.trim()) return;
    setCreating(true);

    try {
      await api.updateGoal(editingGoal.id, {
        title: editTitle,
        description: editDesc,
        milestones: editMilestones
      });
      setEditingGoal(null);
      loadGoals();
      onRefreshTasks();
    } catch (err) {
      console.error("Update goal failed:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleAddMilestoneField = (isEdit: boolean) => {
    if (isEdit) {
      setEditMilestones([...editMilestones, { id: "", userId: "", goalId: editingGoal?.id || "", title: "", description: "", taskIds: [], status: "Pending", createdAt: new Date().toISOString() }]);
    } else {
      setNewMilestones([...newMilestones, { title: "", description: "" }]);
    }
  };

  const handleToggleGoalStatus = async (goal: Goal) => {
    const nextStatus = goal.status === "Active" ? "Paused" : "Active";
    try {
      await api.updateGoal(goal.id, { status: nextStatus });
      loadGoals();
    } catch (err) {
      console.error("Update goal failed:", err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Delete this goal?")) return;
    try {
      await api.deleteGoal(goalId);
      loadGoals();
    } catch (err) {
      console.error("Delete goal failed:", err);
    }
  };

  const handleToggleMilestoneStatus = async (goalId: string, milestoneId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const goalMilestones = milestones.filter(m => m.goalId === goalId);
    const updatedMilestones = goalMilestones.map(m => {
      if (m.id === milestoneId) {
        const nextStatus = m.status === 'Completed' ? 'Pending' : 'Completed';
        return { ...m, status: nextStatus as any };
      }
      return m;
    });

    try {
      await api.updateGoal(goalId, { milestones: updatedMilestones });
      loadGoals();
    } catch (err) {
      console.error("Update milestone failed:", err);
    }
  };

  const activeGoals = goals.filter((goal) => goal.status !== "Completed");
  const completedGoals = goals.filter((goal) => goal.status === "Completed");

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-theme-text-main tracking-tight">Goal Planner</h2>
          <p className="text-sm text-theme-text-muted">Align your tasks with focused milestones and long-term objectives.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card rounded-2xl p-4 text-center">
            <span className="block text-[10px] uppercase tracking-wider text-theme-text-muted">Active goals</span>
            <strong className="block text-2xl mt-2 text-theme-text-main">{activeGoals.length}</strong>
          </div>
          <div className="glass-card rounded-2xl p-4 text-center">
            <span className="block text-[10px] uppercase tracking-wider text-theme-text-muted">Completed</span>
            <strong className="block text-2xl mt-2 text-theme-text-main">{completedGoals.length}</strong>
          </div>
          <div className="glass-card rounded-2xl p-4 text-center">
            <span className="block text-[10px] uppercase tracking-wider text-theme-text-muted">Milestones</span>
            <strong className="block text-2xl mt-2 text-theme-text-main">{milestones.length}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
        <div className="lg:col-span-5 glass-card rounded-3xl border border-theme-border p-6">
          <div className="flex items-center justify-between border-b border-theme-border pb-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-theme-text-main">Create a Strategic Goal</h3>
              <p className="text-[10px] text-theme-text-muted mt-1">Feed your high-impact commitments into the AI planner.</p>
            </div>
            <Plus className="w-5 h-5 text-indigo-500" />
          </div>

          <form onSubmit={handleCreateGoal} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Goal Title</label>
              <input
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                className="mt-2 w-full bg-theme-input-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                placeholder="E.g. Launch portfolio project"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Description</label>
              <textarea
                value={newGoalDesc}
                onChange={(e) => setNewGoalDesc(e.target.value)}
                className="mt-2 w-full min-h-[110px] bg-theme-input-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                placeholder="What outcome are you targeting with this goal?"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Milestones</label>
                <button
                  type="button"
                  onClick={() => handleAddMilestoneField(false)}
                  className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Milestone
                </button>
              </div>

              {newMilestones.map((m, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    value={m.title}
                    onChange={(e) => {
                      const updated = [...newMilestones];
                      updated[idx].title = e.target.value;
                      setNewMilestones(updated);
                    }}
                    className="flex-1 bg-theme-input-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-main focus:outline-none focus:border-indigo-500"
                    placeholder="Milestone title"
                  />
                  <button
                    type="button"
                    onClick={() => setNewMilestones(newMilestones.filter((_, i) => i !== idx))}
                    className="text-theme-text-muted hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold px-4 py-3 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating goal…" : "Add Goal"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-3 glass-card rounded-3xl border border-theme-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-theme-text-main">Goal Planning Advice</h3>
              <p className="text-[10px] text-theme-text-muted">Use objectives to guide your daily task focus.</p>
            </div>
          </div>
          <div className="space-y-3 text-[11px] text-theme-text-muted leading-relaxed">
            <p>Capture goals that matter and let Socrates-Focus suggest milestones along your most productive path.</p>
            <p>Link tasks to goals through task details and keep your timeline aligned with your highest priorities.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {goals.map((goal) => (
          <div key={goal.id} className="glass-card rounded-3xl border border-theme-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-theme-text-main truncate">{goal.title}</h4>
                <p className="text-[10px] text-theme-text-muted mt-1">{goal.status} • Created {new Date(goal.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => handleToggleGoalStatus(goal)}
                  className="text-[10px] px-3 py-1 rounded-full border border-theme-border bg-theme-active-nav text-theme-text-main transition-all hover:border-indigo-500"
                >
                  {goal.status === "Active" ? "Pause" : "Activate"}
                </button>
                <div className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  {goal.progress || 0}% Done
                </div>
              </div>
            </div>

            <div className="mt-4 h-1.5 w-full bg-theme-input-bg rounded-full overflow-hidden border border-theme-border">
              <div
                className="h-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${goal.progress || 0}%` }}
              />
            </div>

            <p className="text-xs text-theme-text-muted mt-4 leading-relaxed line-clamp-2">{goal.description || "No description added."}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedGoalId(goal.id === selectedGoalId ? null : goal.id)}
                  className="text-[10px] text-indigo-500 hover:underline"
                >
                  {selectedGoalId === goal.id ? "Hide milestones" : "View milestones"}
                </button>
                <button
                  onClick={() => handleEditGoal(goal)}
                  className="text-[10px] text-theme-text-muted hover:text-indigo-500 hover:underline"
                >
                  Edit
                </button>
              </div>
              <button
                onClick={() => handleDeleteGoal(goal.id)}
                className="text-[10px] text-red-500 hover:underline"
              >
                Delete
              </button>
            </div>
            {selectedGoalId === goal.id && (
              <div className="mt-4 space-y-3 text-[10px] text-theme-text-muted">
                {milestones.filter((m) => m.goalId === goal.id).length > 0 ? (
                  milestones
                    .filter((m) => m.goalId === goal.id)
                    .map((milestone) => (
                      <div key={milestone.id} className="rounded-3xl border border-theme-border p-3 bg-theme-active-nav">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-theme-text-main">{milestone.title}</p>
                            <p className="text-[9px] text-theme-text-muted mt-1">{milestone.status}</p>
                          </div>
                          <button
                            onClick={() => handleToggleMilestoneStatus(goal.id, milestone.id)}
                            className={`p-1 rounded-full transition-all ${milestone.status === 'Completed' ? 'text-emerald-400' : 'text-theme-text-muted hover:text-emerald-400'}`}
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] text-theme-text-muted leading-relaxed">{milestone.description || "No further detail."}</p>
                      </div>
                    ))
                ) : (
                  <p className="text-[10px] text-theme-text-muted">No milestones defined yet.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {editingGoal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-2xl glass-card rounded-3xl border border-theme-border p-8 shadow-2xl relative bg-theme-bg my-8">
            <h3 className="text-xl font-bold text-theme-text-main mb-6">Edit Strategic Goal</h3>
            <form onSubmit={handleUpdateGoal} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Goal Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-2 w-full bg-theme-input-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-2 w-full min-h-[110px] bg-theme-input-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-theme-text-muted">Milestones</label>
                  <button
                    type="button"
                    onClick={() => handleAddMilestoneField(true)}
                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Milestone
                  </button>
                </div>
                {editMilestones.map((m, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      value={m.title}
                      onChange={(e) => {
                        const updated = [...editMilestones];
                        updated[idx].title = e.target.value;
                        setEditMilestones(updated);
                      }}
                      className="flex-1 bg-theme-input-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-main focus:outline-none focus:border-indigo-500"
                      placeholder="Milestone title"
                    />
                    <button
                      type="button"
                      onClick={() => setEditMilestones(editMilestones.filter((_, i) => i !== idx))}
                      className="text-theme-text-muted hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="px-6 py-2 bg-theme-input-bg border border-theme-border rounded-xl text-sm text-theme-text-main font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-8 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20"
                >
                  {creating ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
