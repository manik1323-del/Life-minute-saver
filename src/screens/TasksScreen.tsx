import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Task, Subtask, Comment, Reaction, PriorityLevel, DifficultyLevel } from "../types";
import { socket, joinRealtimeRooms, leaveRealtimeRooms, emitTypingStatus } from "../lib/socket";
import { useAuth } from "../contexts/AuthContext";
import { 
  Plus, Search, Calendar, Clock, AlertTriangle, Sparkles, 
  Trash2, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Layers, X
} from "lucide-react";

interface TasksScreenProps {
  tasks: Task[];
  onRefreshTasks: () => void;
}

export default function TasksScreen({ tasks, onRefreshTasks }: TasksScreenProps) {
  // Filters & State
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<{ [taskId: string]: Subtask[] }>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [typingIndicator, setTypingIndicator] = useState<string>("");

  // Create task modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newPriority, setNewPriority] = useState<PriorityLevel>("Medium");
  const [newEstTime, setNewEstTime] = useState(60);
  const [newCategory, setNewCategory] = useState("Work");
  const [newTags, setNewTags] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<DifficultyLevel>("Medium");
  const [newPreferredTime, setNewPreferredTime] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Night'>('Morning');
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newRecurrence, setNewRecurrence] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');

  // Subtasks state for new task
  const [newSubtasks, setNewSubtasks] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

  // Loading indicators
  const [prioritizing, setPrioritizing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [breakingDown, setBreakingDown] = useState<{ [taskId: string]: boolean }>({});
  const [creatingSubtask, setCreatingSubtask] = useState<{ [taskId: string]: boolean }>({});
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [members, setMembers] = useState<any[]>([]);

  const { user } = useAuth();

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const workspaceMembers = await api.getWorkspaceMembers();
        setMembers(workspaceMembers);
      } catch (err) {
        console.error("Failed to load members:", err);
      }
    };
    fetchMembers();
  }, []);

  const getUserName = (userId: string) => {
    const member = members.find(m => m.id === userId);
    return member ? member.name : userId;
  };

  const handleExpandTask = async (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      return;
    }

    setExpandedTaskId(taskId);

    // Load subtasks if not already loaded or to refresh
    try {
      const subs = await api.getSubtasks(taskId);
      setSubtasks(prev => ({ ...prev, [taskId]: subs }));
    } catch (err) {
      console.error("Subtask load failed for task ", taskId, err);
    }
  };

  const handleAnalyzeTask = async () => {
    if (!newTitle.trim()) return;
    setAnalyzing(true);
    try {
      const result = await api.analyzeTask(newTitle, newDesc);
      setAiSuggestions(result);
      setNewSubtasks(result.subtasks);
      setNewPriority(result.aiSuggestedPriority);
      // Auto-set some fields from AI
    } catch (err) {
      console.error("AI Analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddEmptySubtask = () => {
    const remainingWeight = 100 - newSubtasks.reduce((sum, s) => sum + (s.weightage || 0), 0);
    setNewSubtasks([...newSubtasks, {
      title: "",
      description: "",
      estimatedTime: 15,
      weightage: Math.max(0, remainingWeight),
      priority: "Medium"
    }]);
  };

  const handleRemoveSubtask = (index: number) => {
    setNewSubtasks(newSubtasks.filter((_, i) => i !== index));
  };

  const handleUpdateSubtask = (index: number, field: string, value: any) => {
    const updated = [...newSubtasks];
    updated[index] = { ...updated[index], [field]: value };
    setNewSubtasks(updated);
  };

  const totalWeight = newSubtasks.reduce((sum, s) => sum + (Number(s.weightage) || 0), 0);
  const isWeightValid = newSubtasks.length === 0 || totalWeight === 100;

  const handleCreateTask = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newTitle || !isWeightValid) return;
    setCreatingTask(true);

    try {
      const formattedTags = newTags ? newTags.split(',').map(tag => tag.trim()) : [];
      const defaultDeadline = newDeadline 
        ? new Date(newDeadline).toISOString() 
        : new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      await api.createTask({
        title: newTitle,
        description: newDesc,
        deadline: defaultDeadline,
        priority: newPriority,
        estimatedTime: Number(newEstTime),
        category: newCategory,
        tags: formattedTags,
        difficulty: newDifficulty,
        preferredWorkingTime: newPreferredTime,
        isRecurring: newIsRecurring,
        recurringFrequency: newRecurrence,
        subtasks: newSubtasks,
        estimatedEffort: aiSuggestions?.estimatedEffort,
        aiSuggestedPriority: aiSuggestions?.aiSuggestedPriority,
        aiSuggestedTimeBlock: aiSuggestions?.aiSuggestedTimeBlock
      });

      // Clear form
      resetForm();
      setShowCreateModal(false);
      // Regenerate today's AI schedule so new task appears on the Dashboard
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        await api.runAISmartScheduler(todayStr);
      } catch (schedErr) {
        console.warn("Auto-schedule regeneration failed (non-critical):", schedErr);
      }
      onRefreshTasks();
    } catch (err) {
      console.error("Create task failed:", err);
    } finally {
      setCreatingTask(false);
    }
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewDeadline("");
    setNewPriority("Medium");
    setNewEstTime(60);
    setNewCategory("Work");
    setNewTags("");
    setNewDifficulty("Medium");
    setNewPreferredTime("Morning");
    setNewIsRecurring(false);
    setNewSubtasks([]);
    setAiSuggestions(null);
  };

  const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.deleteTask(id);
      onRefreshTasks();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleUpdateStatus = async (id: string, status: "Pending" | "In Progress" | "Completed" | "Missed", e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    try {
      await api.updateTask(id, { status });
      onRefreshTasks();
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const toggleSubtask = async (sub: Subtask) => {
    try {
      const updated = await api.updateSubtask(sub.id, !sub.completed);
      // Refresh local subtasks list
      setSubtasks(prev => ({
        ...prev,
        [sub.taskId]: (prev[sub.taskId] || []).map(s => s.id === sub.id ? { ...s, completed: updated.completed } : s)
      }));
    } catch (err) {
      console.error("Subtask toggle failed:", err);
    }
  };

  const handleCreateSubtask = async (taskId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle) return;
    setCreatingSubtask(prev => ({ ...prev, [taskId]: true }));

    try {
      const newSub = await api.createSubtask(taskId, newSubtaskTitle);
      setSubtasks(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), newSub]
      }));
      setNewSubtaskTitle("");
    } catch (err) {
      console.error("Subtask create failed:", err);
    } finally {
      setCreatingSubtask(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handlePostComment = async (taskId: string, e: React.FormEvent) => {
    e.preventDefault();
    const content = commentDrafts[taskId]?.trim();
    if (!content) return;

    try {
      const comment = await api.createWorkspaceComment('task', taskId, content);
      setComments((prev) => [comment, ...prev]);
      setCommentDrafts((prev) => ({ ...prev, [taskId]: '' }));
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  };

  const handleReaction = async (taskId: string, emoji: string) => {
    try {
      const reaction = await api.createWorkspaceReaction('task', taskId, emoji);
      setReactions((prev) => [reaction, ...prev]);
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  };

  const handleAIBreakdown = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBreakingDown(prev => ({ ...prev, [taskId]: true }));

    try {
      const list = await api.runAIBreakdown(taskId);
      setSubtasks(prev => ({ ...prev, [taskId]: list }));
    } catch (err) {
      console.error("AI breakdown failed:", err);
    } finally {
      setBreakingDown(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleAIPrioritize = async () => {
    setPrioritizing(true);
    try {
      await api.runAIPrioritization();
      // Auto-trigger suggestions refresh as well for dashboard consistency
      await api.refreshAISuggestions();
      onRefreshTasks();
    } catch (err) {
      console.error("AI prioritization failed:", err);
    } finally {
      setPrioritizing(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = (t.title?.toLowerCase() || "").includes(search.toLowerCase()) ||
                          (t.description?.toLowerCase() || "").includes(search.toLowerCase()) ||
                          (t.category?.toLowerCase() || "").includes(search.toLowerCase());
    const matchesFilter = filterStatus === "All" || t.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-theme-text-muted" />
          <input
            type="text"
            placeholder="Search tasks, descriptions, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 pl-10 pr-4 text-sm text-theme-text-main placeholder-theme-text-muted/65 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* AI Prioritize Trigger */}
          <button
            onClick={handleAIPrioritize}
            disabled={prioritizing || tasks.length === 0}
            className="px-4 py-2 bg-theme-input-bg border border-theme-border hover:border-indigo-500 hover:bg-theme-active-nav rounded-lg text-sm text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            {prioritizing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            )}
            <span>AI Risk Audit</span>
          </button>

          {/* Create Task Trigger */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm text-white font-medium flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Status Tabs Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-theme-border pb-3">
        {["All", "Pending", "In Progress", "Completed", "Missed"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
              filterStatus === status 
                ? "bg-indigo-500/15 text-indigo-500 border border-indigo-500/30" 
                : "text-theme-text-muted hover:text-theme-text-main border border-transparent hover:bg-theme-active-nav"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Task List Container */}
      <div className="space-y-4">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((t) => {
            const isExpanded = expandedTaskId === t.id;
            const taskSubs = subtasks[t.id] || [];
            const completedSubs = taskSubs.filter(s => s.completed).length;

            return (
              <div 
                key={t.id}
                className={`glass-card rounded-xl border transition-all duration-200 overflow-hidden ${
                  isExpanded ? "border-indigo-500/35 glow-primary" : "border-theme-border hover:border-theme-border"
                }`}
              >
                {/* Header Summary Row */}
                <div 
                  onClick={() => handleExpandTask(t.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex-1 min-w-0 flex items-start gap-3.5">
                    {/* Urgency indicators */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                      t.priority === 'Critical' ? 'bg-red-500 animate-pulse' :
                      t.priority === 'High' ? 'bg-orange-500' :
                      t.priority === 'Medium' ? 'bg-amber-400' :
                      'bg-emerald-500'
                    }`} />
                    
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h4 className={`text-base font-bold text-theme-text-main truncate ${t.status === 'Completed' ? 'line-through opacity-50' : ''}`}>
                          {t.title}
                        </h4>
                        <span className="text-[10px] bg-theme-input-bg border border-theme-border text-theme-text-muted font-medium px-2 py-0.5 rounded-full">
                          {t.category}
                        </span>
                      </div>
                      <p className="text-xs text-theme-text-muted mt-1 line-clamp-1">
                        {t.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  {/* Task Metadata Pillars */}
                  <div className="flex items-center gap-6 shrink-0 font-sans">
                    <div className="hidden sm:block text-right">
                      <div className="flex items-center gap-1 text-xs text-theme-text-muted justify-end">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{new Date(t.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-theme-text-muted justify-end mt-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{t.estimatedTime} mins</span>
                      </div>
                    </div>

                    {/* AI Scoring widgets */}
                    {t.status !== 'Completed' && (
                      <div className="flex items-center gap-3">
                        <div className="text-center bg-theme-input-bg border border-theme-border rounded-lg px-2.5 py-1.5 min-w-[70px]">
                          <span className="block text-[9px] text-theme-text-muted uppercase tracking-wide font-semibold">Progress</span>
                          <span className="text-sm font-extrabold font-mono text-indigo-500">
                            {t.progress}%
                          </span>
                        </div>
                        <div className="text-center bg-theme-input-bg border border-theme-border rounded-lg px-2.5 py-1.5 min-w-[70px]">
                          <span className="block text-[9px] text-theme-text-muted uppercase tracking-wide font-semibold">AI Risk</span>
                          <span className={`text-sm font-extrabold font-mono ${
                            t.deadlineRisk > 70 ? 'text-red-500' :
                            t.deadlineRisk > 40 ? 'text-orange-500' : 'text-emerald-500'
                          }`}>
                            {t.deadlineRisk}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Status Dropdown */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <select
                        value={t.status}
                        onChange={(e) => handleUpdateStatus(t.id, e.target.value as any, e)}
                        className={`text-xs font-bold rounded-lg px-2.5 py-1.5 bg-theme-input-bg border border-theme-border text-theme-text-main focus:outline-none focus:border-indigo-500 cursor-pointer ${
                          t.status === 'Completed' ? 'text-green-500 border-green-500/20' :
                          t.status === 'Missed' ? 'text-red-500 border-red-500/20' :
                          t.status === 'In Progress' ? 'text-indigo-500 border-indigo-500/20' : 'text-theme-text-main'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Missed">Missed</option>
                      </select>
                    </div>

                    {/* Expand/Collapse arrows */}
                    <div className="text-theme-text-muted">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details and Subtasks Area */}
                {isExpanded && (
                  <div className="border-t border-theme-border bg-theme-active-nav/40 p-5 space-y-4">
                    
                    {/* Description Paragraph & Tags */}
                    <div>
                      <h5 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider mb-1">Details</h5>
                      <p className="text-sm text-theme-text-main leading-relaxed whitespace-pre-line">
                        {t.description || "No full description configured."}
                      </p>
                      {t.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          {t.tags.map((tag) => (
                            <span key={tag} className="text-[10px] font-semibold text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Subtasks Section */}
                    <div className="pt-4 border-t border-theme-border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4.5 h-4.5 text-indigo-500" />
                          <h5 className="text-xs font-bold text-theme-text-main uppercase tracking-wider">
                            Subtask Milestones
                          </h5>
                          {taskSubs.length > 0 && (
                            <span className="text-[10px] text-theme-text-muted bg-theme-input-bg border border-theme-border px-1.5 py-0.5 rounded">
                              {completedSubs} of {taskSubs.length} done
                            </span>
                          )}
                        </div>

                        {/* AI Breakdown triggers */}
                        {t.status !== 'Completed' && (
                          <button
                            onClick={(e) => handleAIBreakdown(t.id, e)}
                            disabled={breakingDown[t.id]}
                            className="text-xs text-indigo-500 hover:text-white hover:bg-indigo-600 border border-indigo-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            {breakingDown[t.id] ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            )}
                            <span>AI Auto-Breakdown</span>
                          </button>
                        )}
                      </div>

                      {/* Subtasks Checkboxes */}
                      <div className="space-y-2">
                        {taskSubs.map((sub) => (
                          <div 
                            key={sub.id}
                            className="flex items-center justify-between p-2.5 bg-theme-input-bg/40 rounded-lg border border-theme-border hover:bg-theme-input-bg/70 transition-all select-none"
                          >
                            <label className="flex items-center gap-3 cursor-pointer min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={sub.completed}
                                onChange={() => toggleSubtask(sub)}
                                className="w-4 h-4 rounded border-theme-border text-indigo-600 focus:ring-indigo-500 bg-theme-input-bg"
                              />
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs block font-bold ${sub.completed ? 'line-through text-theme-text-muted' : 'text-theme-text-main'}`}>
                                  {sub.title}
                                </span>
                                {sub.description && (
                                  <span className="text-[10px] text-theme-text-muted line-clamp-1">{sub.description}</span>
                                )}
                              </div>
                            </label>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                {sub.weightage}%
                              </span>
                              <span className="text-[10px] text-theme-text-muted font-mono">
                                {sub.estimatedTime}m
                              </span>
                              {t.status !== 'Completed' && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm("Remove subtask?")) {
                                      await api.deleteSubtask(sub.id);
                                      handleExpandTask(t.id); // Reload
                                    }
                                  }}
                                  className="text-theme-text-muted hover:text-red-500 p-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Manual Subtask Append Form */}
                        {t.status !== 'Completed' && (
                          <form onSubmit={(e) => handleCreateSubtask(t.id, e)} className="flex items-center gap-2 pt-2">
                            <input
                              type="text"
                              placeholder="Add milestone subtask..."
                              value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              className="flex-1 bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-theme-text-main placeholder-theme-text-muted/60"
                            />
                            <button
                              type="submit"
                              disabled={creatingSubtask[t.id]}
                              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-xs text-white font-semibold rounded-lg shrink-0 cursor-pointer"
                            >
                              Add
                            </button>
                          </form>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-theme-border">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <h5 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Discussion</h5>
                          <p className="text-[11px] text-theme-text-muted">Comments, reactions, and typing status update in real time.</p>
                        </div>
                        <span className="text-[10px] text-indigo-400 font-semibold">{typingIndicator || `${comments.length} comments • ${reactions.length} reactions`}</span>
                      </div>

                      <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
                        {comments.length === 0 ? (
                          <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">
                            No discussion yet. Leave the first comment.
                          </div>
                        ) : comments.map((comment) => (
                          <div key={comment.id} className="rounded-3xl border border-theme-border bg-theme-bg/60 p-4">
                            <div className="flex items-center justify-between gap-3 text-xs text-theme-text-muted mb-2">
                              <span className="font-semibold text-theme-text-main">{getUserName(comment.userId)}</span>
                              <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-theme-text-main leading-relaxed">{comment.content}</p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-theme-text-main text-sm mb-2">
                          {['👍', '🔥', '🚀', '🎉', '👀', '❤️'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReaction(t.id, emoji as any)}
                              className="rounded-full border border-theme-border bg-theme-input-bg px-2.5 py-2 text-base transition-colors hover:bg-indigo-500/10"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] text-theme-text-muted">
                          {reactions.slice(0, 6).map((reaction) => (
                            <div key={reaction.id} className="rounded-2xl bg-theme-active-nav border border-theme-border p-2 text-center">
                              <span className="block text-base">{reaction.emoji}</span>
                              <span className="block truncate font-medium text-theme-text-main">{getUserName(reaction.userId)}</span>
                            </div>
                          ))}
                        </div>

                        <form onSubmit={(e) => handlePostComment(t.id, e)} className="flex gap-2">
                          <input
                            type="text"
                            value={commentDrafts[t.id] || ''}
                            onChange={(e) => {
                              setCommentDrafts((prev) => ({ ...prev, [t.id]: e.target.value }));
                              if (expandedTaskId) {
                                emitTypingStatus({ targetId: expandedTaskId, targetType: 'task', userName: user?.name || 'Teammate' });
                              }
                            }}
                            placeholder="Write a comment..."
                            className="flex-1 bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-theme-text-main"
                          />
                          <button
                            type="submit"
                            className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                          >
                            Post
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Delete Trigger */}
                    <div className="pt-4 border-t border-theme-border flex justify-end">
                      <button
                        onClick={(e) => handleDeleteTask(t.id, e)}
                        className="text-xs text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Task</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-xl p-8 border border-theme-border">
            <div className="w-14 h-14 rounded-full bg-theme-input-bg border border-theme-border flex items-center justify-center text-theme-text-muted mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-theme-text-main mb-1.5">No tasks match selected filter</h4>
            <p className="text-sm text-theme-text-muted max-w-sm leading-normal">
              Your workflow is completely clear, or you might need to try selecting a different status filter above.
            </p>
          </div>
        )}
      </div>

      {/* New Task modal sheet */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-4xl glass-card rounded-xl border border-theme-border p-8 shadow-2xl relative glow-primary bg-theme-bg my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-theme-text-main">Create New Focus Task</h3>
                <p className="text-sm text-theme-text-muted mt-1">Design your high-intensity workload with AI precision.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-theme-text-muted hover:text-theme-text-main p-2 rounded-full hover:bg-theme-active-nav transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCreateTask(e);
              }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              
              {/* Left Column: Basic Info & Scheduling */}
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Task Title</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. Draft Executive Hackathon Pitch"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-theme-text-main"
                    />
                    <button
                      type="button"
                      onClick={handleAnalyzeTask}
                      disabled={analyzing || !newTitle.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
                      title="AI Analysis Breakdown"
                    >
                      {analyzing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Description</label>
                  <textarea
                    placeholder="What details are critical to finish before the deadline?"
                    value={newDesc}
                    rows={3}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-theme-text-main resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Deadline</label>
                    <input
                      type="datetime-local"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-theme-text-main font-sans"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Duration (Mins)</label>
                    <input
                      type="number"
                      value={newEstTime}
                      min={15}
                      step={15}
                      onChange={(e) => setNewEstTime(Number(e.target.value))}
                      className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-theme-text-main font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Priority</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-theme-text-main"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Difficulty</label>
                    <select
                      value={newDifficulty}
                      onChange={(e) => setNewDifficulty(e.target.value as any)}
                      className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-theme-text-main"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Preferred Window</label>
                    <select
                      value={newPreferredTime}
                      onChange={(e) => setNewPreferredTime(e.target.value as any)}
                      className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-theme-text-main"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Category</label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-theme-text-main"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsRecurring}
                      onChange={(e) => setNewIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded border-theme-border text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-theme-text-main">Recurring Task</span>
                  </label>
                  {newIsRecurring && (
                    <select
                      value={newRecurrence}
                      onChange={(e) => setNewRecurrence(e.target.value as any)}
                      className="bg-theme-input-bg border border-theme-border rounded-lg px-2 py-1 text-xs text-theme-text-main"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Right Column: Subtasks & AI Suggestions */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">Implementation Subtasks</label>
                    <button
                      type="button"
                      onClick={handleAddEmptySubtask}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Subtask
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {newSubtasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-theme-border p-8 text-center">
                        <p className="text-xs text-theme-text-muted">No subtasks defined. Use AI analysis for a recommended breakdown.</p>
                      </div>
                    ) : (
                      newSubtasks.map((st, idx) => (
                        <div key={idx} className="bg-theme-active-nav/40 border border-theme-border rounded-xl p-4 space-y-3 relative group">
                          <button
                            type="button"
                            onClick={() => handleRemoveSubtask(idx)}
                            className="absolute top-2 right-2 text-theme-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <input
                            type="text"
                            placeholder="Subtask title"
                            value={st.title}
                            onChange={(e) => handleUpdateSubtask(idx, 'title', e.target.value)}
                            className="w-full bg-transparent border-b border-theme-border/50 focus:border-indigo-500 focus:outline-none text-sm text-theme-text-main font-bold"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-theme-text-muted">Weight (%)</span>
                              <input
                                type="number"
                                value={st.weightage}
                                onChange={(e) => handleUpdateSubtask(idx, 'weightage', Number(e.target.value))}
                                className="w-16 bg-theme-input-bg border border-theme-border rounded px-2 py-1 text-xs text-theme-text-main"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-theme-text-muted">Mins</span>
                              <input
                                type="number"
                                value={st.estimatedTime}
                                onChange={(e) => handleUpdateSubtask(idx, 'estimatedTime', Number(e.target.value))}
                                className="w-16 bg-theme-input-bg border border-theme-border rounded px-2 py-1 text-xs text-theme-text-main"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Weightage Validation & Progress Preview */}
                  <div className="pt-4 border-t border-theme-border">
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                      <span className="text-theme-text-muted">Total Subtask Weightage</span>
                      <span className={isWeightValid ? "text-emerald-500" : "text-red-500"}>{totalWeight}% / 100%</span>
                    </div>
                    <div className="h-2 w-full bg-theme-input-bg rounded-full overflow-hidden border border-theme-border">
                      <div
                        className={`h-full transition-all duration-500 ${totalWeight === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100, totalWeight)}%` }}
                      />
                    </div>
                    {!isWeightValid && (
                      <p className="text-[10px] text-red-500 mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Subtask weightages must sum exactly to 100% for precise progress tracking.
                      </p>
                    )}
                  </div>
                </div>

                {/* AI Insight Box */}
                {aiSuggestions && (
                  <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <h4 className="text-xs font-bold text-theme-text-main uppercase tracking-wider">AI Forecast Insights</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-[9px] text-theme-text-muted uppercase font-bold">Estimated Effort</span>
                        <span className="text-sm font-black text-indigo-500">{aiSuggestions.estimatedEffort}/100</span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-theme-text-muted uppercase font-bold">Deadline Risk</span>
                        <span className="text-sm font-black text-theme-text-main">{aiSuggestions.riskLevel}%</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[9px] text-theme-text-muted uppercase font-bold">Recommended Schedule Block</span>
                        <span className="text-sm font-black text-theme-text-main">{aiSuggestions.aiSuggestedTimeBlock} Today</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="lg:col-span-2 flex justify-end gap-3 pt-6 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 bg-theme-input-bg hover:bg-theme-active-nav border border-theme-border text-sm text-theme-text-main font-bold rounded-xl cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateTask(e);
                  }}
                  disabled={creatingTask || !isWeightValid}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-sm text-white font-bold rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-500/20"
                >
                  {creatingTask ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Calibrating Task...</span>
                    </div>
                  ) : (
                    <span>Initiate High-Output Task</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
