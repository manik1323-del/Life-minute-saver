import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ActivityLog, Organization, Project, Team, PresenceStatus, User } from "../types";
import { Activity, Users, FolderTree, Sparkles, Plus, ShieldCheck } from "lucide-react";
import { socket } from "../lib/socket";

export default function WorkspaceScreen() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceStatus>>({});
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadWorkspaceData();
    loadWorkspaceMembers();

    const onPresenceUpdate = (presenceUpdate: PresenceStatus) => {
      setPresence((prev) => ({ ...prev, [presenceUpdate.userId]: presenceUpdate }));
    };

    socket?.on("workspace:presence", onPresenceUpdate);
    socket?.on("workspace:project-updated", loadWorkspaceData);
    socket?.on("workspace:sync-all", loadWorkspaceData);

    return () => {
      socket?.off("workspace:presence", onPresenceUpdate);
      socket?.off("workspace:project-updated", loadWorkspaceData);
      socket?.off("workspace:sync-all", loadWorkspaceData);
    };
  }, []);

  const loadWorkspaceData = async () => {
    setIsLoading(true);
    try {
      const [organizations, teams, projects, activity] = await Promise.all([
        api.getOrganizations(),
        api.getTeams(),
        api.getProjects(),
        api.getWorkspaceActivity()
      ]);
      setOrganizations(organizations);
      setTeams(teams);
      setProjects(projects);
      setActivity(activity);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
      setError("Unable to sync workspace collaboration data.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadWorkspaceMembers = async () => {
    try {
      const users = await api.getWorkspaceMembers();
      setMembers(users);
    } catch (err) {
      console.error("Failed to load workspace members:", err);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) return;
    setIsCreatingOrg(true);
    try {
      const org = await api.createOrganization(newOrgName.trim(), newOrgDescription.trim());
      setOrganizations((prev) => [org, ...prev]);
      setNewOrgName("");
      setNewOrgDescription("");
      setError("");
    } catch (err) {
      console.error(err);
      setError("Could not create workspace. Please try again.");
    } finally {
      setIsCreatingOrg(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-3xl bg-indigo-500/10 px-4 py-2 text-indigo-200 text-xs font-semibold uppercase tracking-[0.2em]">
            <Sparkles className="w-4 h-4" />
            Collaborative Workspace
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-theme-text-main">Team Collaboration Hub</h1>
          <p className="mt-2 max-w-2xl text-sm text-theme-text-muted">
            Connect projects, teams, and activity in a shared AI productivity operating system.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="glass-card rounded-3xl border border-theme-border p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em] text-theme-text-muted">Organizations</span>
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="mt-4 text-4xl font-bold text-theme-text-main">{organizations.length}</div>
          </div>
          <div className="glass-card rounded-3xl border border-theme-border p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em] text-theme-text-muted">Projects</span>
              <FolderTree className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="mt-4 text-4xl font-bold text-theme-text-main">{projects.length}</div>
          </div>
          <div className="glass-card rounded-3xl border border-theme-border p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em] text-theme-text-muted">Teams</span>
              <Activity className="w-5 h-5 text-sky-400" />
            </div>
            <div className="mt-4 text-4xl font-bold text-theme-text-main">{teams.length}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="space-y-6">
          <div className="glass-card rounded-3xl border border-theme-border p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-theme-text-main">Workspace quick launch</h2>
                <p className="text-sm text-theme-text-muted mt-1">Build a new organization or review the latest project activity.</p>
              </div>
              <button
                onClick={handleCreateOrganization}
                disabled={isCreatingOrg}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-white text-sm font-semibold hover:bg-indigo-400 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                New organization
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="New organization name"
                className="w-full rounded-3xl border border-theme-border bg-theme-input-bg px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
              />
              <input
                value={newOrgDescription}
                onChange={(e) => setNewOrgDescription(e.target.value)}
                placeholder="Short description"
                className="w-full rounded-3xl border border-theme-border bg-theme-input-bg px-4 py-3 text-sm text-theme-text-main focus:outline-none focus:border-indigo-500"
              />
            </div>
            {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
          </div>

          <div className="glass-card rounded-3xl border border-theme-border p-6">
            <h3 className="text-lg font-semibold text-theme-text-main">Recent workspace activity</h3>
            <div className="mt-4 space-y-3">
              {isLoading ? (
                <div className="text-theme-text-muted">Loading activity...</div>
              ) : activity.length === 0 ? (
                <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">No workspace activity yet.</div>
              ) : (
                activity.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-3xl border border-theme-border bg-theme-active-nav p-4">
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-theme-text-muted">
                      <span>{entry.action}</span>
                      <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="mt-2 text-sm text-theme-text-main">{entry.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="glass-card rounded-3xl border border-theme-border p-6">
            <h3 className="text-lg font-semibold text-theme-text-main">Active organizations</h3>
            <div className="mt-4 space-y-3">
              {isLoading ? (
                <div className="text-theme-text-muted">Fetching organizations...</div>
              ) : organizations.length === 0 ? (
                <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">No organizations yet. Create one to collaborate with teammates.</div>
              ) : (
                organizations.map((org) => (
                  <div key={org.id} className="rounded-3xl border border-theme-border bg-theme-bg/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-theme-text-main">{org.name}</h4>
                        <p className="text-[11px] text-theme-text-muted mt-1">{org.description}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-300">{org.memberIds.length} members</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-theme-border p-6">
            <h3 className="text-lg font-semibold text-theme-text-main">Team presence</h3>
            <p className="text-sm text-theme-text-muted mt-1">Live member availability and collaboration status.</p>
            <div className="mt-4 space-y-3">
              {members.length === 0 ? (
                <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">No team members are available yet.</div>
              ) : (
                members.slice(0, 5).map((member) => {
                  const status = presence[member.id]?.status || "offline";
                  const lastActive = presence[member.id]?.lastActiveAt ? new Date(presence[member.id].lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "unknown";
                  const badgeClass = status === "online" ? "bg-emerald-500/10 text-emerald-300" : status === "typing" ? "bg-indigo-500/10 text-indigo-300" : status === "away" ? "bg-amber-500/10 text-amber-300" : "bg-slate-500/10 text-slate-300";

                  return (
                    <div key={member.id} className="rounded-3xl border border-theme-border bg-theme-bg/60 p-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-theme-text-main">{member.name}</h4>
                        <p className="text-[11px] text-theme-text-muted mt-1">{member.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] ${badgeClass}`}>{status}</span>
                        <span className="text-[10px] text-theme-text-muted">Last active {lastActive}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-theme-border p-6">
            <h3 className="text-lg font-semibold text-theme-text-main">Project pulse</h3>
            <div className="mt-4 space-y-3">
              {isLoading ? (
                <div className="text-theme-text-muted">Fetching projects...</div>
              ) : projects.length === 0 ? (
                <div className="rounded-3xl border border-theme-border bg-theme-active-nav p-4 text-sm text-theme-text-muted">No active projects assigned. Create a project from an organization.</div>
              ) : (
                projects.slice(0, 3).map((project) => (
                  <div key={project.id} className="rounded-3xl border border-theme-border bg-theme-bg/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-theme-text-main">{project.title}</h4>
                        <p className="text-[11px] text-theme-text-muted mt-1">{project.description}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-[10px] text-sky-300">{project.status}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-theme-text-muted">
                      <span>{project.memberIds.length} owner / member</span>
                      <span>{project.progress}% progress</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
