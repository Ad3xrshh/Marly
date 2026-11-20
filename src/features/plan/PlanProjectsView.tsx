import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  FolderKanban,
  LogIn,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  ProgressBar,
  Skeleton,
  type BadgeTone,
} from '../../components/ui';
import { useProjectsAndGoalsData, useTasksOverviewData } from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import {
  getProjectStatusLabel,
  PROJECT_STATUS_OPTIONS,
  type Project,
  type ProjectMilestone,
  type ProjectStatus,
} from '../../types/projectGoal';
import {
  formatShortLocalDate,
  formatTaskDueLabel,
  getPriorityLabel,
  isTaskOverdue,
  type TaskPriority,
} from '../../types/task';

type ProjectFilterMode = 'active_set' | 'all' | ProjectStatus;
type ProjectSortMode = 'target_date' | 'progress' | 'priority' | 'name';

const STATUS_BADGE_TONE: Record<ProjectStatus, BadgeTone> = {
  planned: 'blue',
  active: 'coral',
  on_hold: 'orange',
  completed: 'mint',
  archived: 'neutral',
};

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  low: 'text-[#A3A3A8]',
  medium: 'text-[#A9C8E9]',
  high: 'text-[#F19A50]',
  urgent: 'text-[#E59585]',
};

export function PlanProjectsView() {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    projects,
    tasks,
    isLoading,
    isMutating,
    error,
    refreshProjectsAndGoals,
    updateProject,
    deleteProject,
    createProjectMilestone,
    updateProjectMilestone,
    deleteProjectMilestone,
    reorderProjectMilestones,
    openCreateProject,
    openEditProject,
  } = useProjectsAndGoalsData();

  const { toggleTaskCompleted, updateTask, openCreateTask, openEditTask } =
    useTasksOverviewData();

  const [statusFilter, setStatusFilter] = useState<ProjectFilterMode>('active_set');
  const [sortBy, setSortBy] = useState<ProjectSortMode>('target_date');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Inline milestone add state
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [showMilestoneExtras, setShowMilestoneExtras] = useState(false);

  // Inline milestone edit state
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState('');
  const [editMilestoneDueDate, setEditMilestoneDueDate] = useState('');
  const [editMilestoneDescription, setEditMilestoneDescription] = useState('');

  // Inline project delete confirm
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = projects.filter((project) => {
      if (statusFilter === 'active_set') {
        if (project.status === 'archived') return false;
      } else if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false;
      }
      if (
        query &&
        !project.name.toLowerCase().includes(query) &&
        !(project.description && project.description.toLowerCase().includes(query)) &&
        !(project.goalTitle && project.goalTitle.toLowerCase().includes(query))
      ) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'progress') {
        return b.progress.progressPercent - a.progress.progressPercent;
      }
      if (sortBy === 'priority') {
        return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // target_date
      if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;
      return b.id - a.id;
    });
  }, [projects, statusFilter, sortBy, searchQuery]);

  useEffect(() => {
    if (filteredProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    if (!selectedProjectId || !filteredProjects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0].id);
    }
  }, [filteredProjects, selectedProjectId]);

  const selectedProject: Project | null = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const selectedProjectTasks = useMemo(
    () => (selectedProject ? tasks.filter((t) => t.projectId === selectedProject.id) : []),
    [tasks, selectedProject]
  );

  useEffect(() => {
    setEditingMilestoneId(null);
    setConfirmingDeleteId(null);
    setNewMilestoneTitle('');
    setNewMilestoneDueDate('');
    setNewMilestoneDescription('');
  }, [selectedProjectId]);

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    const trimmed = newMilestoneTitle.trim();
    if (!trimmed) return;

    const ok = await createProjectMilestone(selectedProject.id, {
      title: trimmed,
      dueDate: newMilestoneDueDate.trim() ? newMilestoneDueDate.trim() : null,
      description: newMilestoneDescription.trim() ? newMilestoneDescription.trim() : null,
    });
    if (ok) {
      setNewMilestoneTitle('');
      setNewMilestoneDueDate('');
      setNewMilestoneDescription('');
      setShowMilestoneExtras(false);
    }
  };

  const startEditingMilestone = (milestone: ProjectMilestone) => {
    setEditingMilestoneId(milestone.id);
    setEditMilestoneTitle(milestone.title);
    setEditMilestoneDueDate(milestone.dueDate ?? '');
    setEditMilestoneDescription(milestone.description ?? '');
  };

  const handleSaveMilestoneEdit = async (milestoneId: number) => {
    if (!selectedProject) return;
    const trimmed = editMilestoneTitle.trim();
    if (!trimmed) return;
    const ok = await updateProjectMilestone(selectedProject.id, milestoneId, {
      title: trimmed,
      dueDate: editMilestoneDueDate.trim() ? editMilestoneDueDate.trim() : null,
      description: editMilestoneDescription.trim() ? editMilestoneDescription.trim() : null,
    });
    if (ok) {
      setEditingMilestoneId(null);
    }
  };

  const handleMoveMilestone = async (index: number, direction: -1 | 1) => {
    if (!selectedProject) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedProject.milestones.length) return;
    const reorderedIds = selectedProject.milestones.map((m) => m.id);
    const [moved] = reorderedIds.splice(index, 1);
    reorderedIds.splice(targetIndex, 0, moved);
    await reorderProjectMilestones(selectedProject.id, reorderedIds);
  };

  if (isAuthLoading) {
    return (
      <Card tone="surface" padding="lg">
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card tone="surface" padding="lg">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[#F2F2F2]">
              Sign in to manage your Projects
            </h3>
            <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
              Organize multi-step initiatives, ordered milestones, target dates, and linked tasks with real persistence.
            </p>
          </div>
          <Button
            variant="coral"
            size="md"
            leadingIcon={<LogIn className="h-4 w-4" />}
            disabled={isSigningIn}
            onClick={() => void signInWithGoogle()}
          >
            {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
          </Button>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card tone="surface" padding="lg">
        <ErrorState
          title="Unable to load projects"
          description={error}
          onRetry={refreshProjectsAndGoals}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + Toolbar */}
      <Card tone="surface" padding="none" className="overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[#F2F2F2]">Projects</h3>
            <p className="mt-0.5 font-mono text-xs text-[#A3A3A8] tabular-nums">
              {projects.filter((p) => p.status !== 'archived').length} active ·{' '}
              {projects.filter((p) => p.status === 'archived').length} archived
            </p>
          </div>
          <Button
            variant="coral"
            size="sm"
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => openCreateProject()}
          >
            New Project
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 bg-[#1B1B1B] px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            placeholder="Search projects, descriptions, or linked goals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            leadingIcon={<Search className="h-3.5 w-3.5" />}
            aria-label="Search projects"
          />

          <select
            aria-label="Filter projects by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectFilterMode)}
            className="h-10 rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-xs font-medium text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
          >
            <option value="active_set">Active & Planned (Hide Archived)</option>
            <option value="all">All projects</option>
            {PROJECT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort projects"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ProjectSortMode)}
            className="h-10 rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-xs font-medium text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
          >
            <option value="target_date">Sort: Target date</option>
            <option value="progress">Sort: Progress</option>
            <option value="priority">Sort: Priority</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card tone="surface" padding="lg">
          <EmptyState
            icon={<FolderKanban className="h-5 w-5 text-[#E59585]" />}
            title={projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
            description={
              projects.length === 0
                ? 'Create your first project to organize milestones, target dates, and related tasks.'
                : 'Adjust your status filter or clear your search query to view your projects.'
            }
            actionLabel={projects.length === 0 ? 'Create first project' : 'Reset filters'}
            onAction={
              projects.length === 0
                ? () => openCreateProject()
                : () => {
                    setStatusFilter('active_set');
                    setSearchQuery('');
                  }
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
          {/* Left: Project List */}
          <div className="space-y-3">
            {filteredProjects.map((project) => {
              const isSelected = selectedProject?.id === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
                    isSelected
                      ? 'border-[#E59585]/45 bg-[#252222]'
                      : 'border-white/[0.07] bg-[#202020] hover:border-white/[0.14] hover:bg-[#242424]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={STATUS_BADGE_TONE[project.status]}>
                          {getProjectStatusLabel(project.status)}
                        </Badge>
                        <span className={cn('text-xs font-medium', PRIORITY_TONE[project.priority])}>
                          {getPriorityLabel(project.priority)}
                        </span>
                      </div>
                      <h4 className="mt-2.5 truncate text-sm font-semibold text-[#F2F2F2]">
                        {project.name}
                      </h4>
                      {project.goalTitle && (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[#A3A3A8]">
                          <Target className="h-3 w-3 shrink-0 text-[#E59585]" />
                          <span className="truncate">{project.goalTitle}</span>
                        </p>
                      )}
                    </div>
                    {project.targetDate && (
                      <span className="font-mono text-[11px] text-[#A3A3A8] shrink-0">
                        {formatShortLocalDate(project.targetDate)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                      <span>
                        {project.progress.completedMilestones}/{project.progress.totalMilestones} milestones
                        {' · '}
                        {project.progress.completedTasks}/{project.progress.totalTasks} tasks
                      </span>
                    </div>
                    <ProgressBar
                      value={project.progress.progressPercent}
                      tone={project.status === 'completed' ? 'mint' : 'coral'}
                      showLabel
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Selected Project Detail */}
          {selectedProject && (
            <Card tone="surface" padding="lg" className="space-y-6">
              {/* Project Header */}
              <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone={STATUS_BADGE_TONE[selectedProject.status]}>
                      {getProjectStatusLabel(selectedProject.status)}
                    </Badge>
                    <span className="text-xs text-[#A3A3A8]">{selectedProject.category}</span>
                    <span className="text-xs text-[#737378]" aria-hidden="true">·</span>
                    <span className={cn('text-xs font-medium', PRIORITY_TONE[selectedProject.priority])}>
                      {getPriorityLabel(selectedProject.priority)} Priority
                    </span>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-[#F2F2F2]">
                    {selectedProject.name}
                  </h3>

                  {selectedProject.description && (
                    <p className="text-sm leading-relaxed text-[#A3A3A8]">
                      {selectedProject.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#A3A3A8]">
                    {selectedProject.goalTitle && (
                      <span className="inline-flex items-center gap-1.5 text-[#F2F2F2]">
                        <Target className="h-3.5 w-3.5 text-[#E59585]" />
                        <span>Goal: {selectedProject.goalTitle}</span>
                      </span>
                    )}
                    {(selectedProject.startDate || selectedProject.targetDate) && (
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <Calendar className="h-3.5 w-3.5 text-[#A9C8E9]" />
                        <span>
                          {selectedProject.startDate
                            ? formatShortLocalDate(selectedProject.startDate)
                            : 'Anytime'}
                          {' → '}
                          {selectedProject.targetDate
                            ? formatShortLocalDate(selectedProject.targetDate)
                            : 'Open'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => openEditProject(selectedProject)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isMutating}
                    leadingIcon={
                      selectedProject.status === 'archived' ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )
                    }
                    onClick={() =>
                      void updateProject(selectedProject.id, {
                        status: selectedProject.status === 'archived' ? 'active' : 'archived',
                      })
                    }
                  >
                    {selectedProject.status === 'archived' ? 'Restore' : 'Archive'}
                  </Button>
                  {confirmingDeleteId === selectedProject.id ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => void deleteProject(selectedProject.id)}
                        className="bg-[#E06C75]/15 text-[#E06C75] hover:bg-[#E06C75]/25 hover:text-[#E06C75]"
                      >
                        Confirm delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => setConfirmingDeleteId(selectedProject.id)}
                      className="text-[#E06C75] hover:bg-[#E06C75]/10 hover:text-[#E06C75]"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Project Progress Summary */}
              <div className="rounded-xl border border-white/[0.06] bg-[#1A1A1A] p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#F2F2F2]">Overall Progress</span>
                  <span className="font-mono text-[#A3A3A8] tabular-nums">
                    {selectedProject.progress.completedUnits} of {selectedProject.progress.totalUnits}{' '}
                    units completed ({selectedProject.progress.completedMilestones}/
                    {selectedProject.progress.totalMilestones} milestones ·{' '}
                    {selectedProject.progress.completedTasks}/
                    {selectedProject.progress.totalTasks} tasks)
                  </span>
                </div>
                <ProgressBar
                  value={selectedProject.progress.progressPercent}
                  tone={selectedProject.status === 'completed' ? 'mint' : 'coral'}
                  height="md"
                  showLabel
                />
              </div>

              {/* Ordered Project Milestones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[#F2F2F2]">
                    Project Milestones ({selectedProject.milestones.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowMilestoneExtras((prev) => !prev)}
                    className="text-xs font-medium text-[#A3A3A8] hover:text-[#F2F2F2] cursor-pointer"
                  >
                    {showMilestoneExtras ? 'Hide due date & notes' : '+ Add due date / notes'}
                  </button>
                </div>

                <form onSubmit={handleAddMilestone} className="space-y-2.5 rounded-xl bg-[#1A1A1A] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      placeholder="Add a milestone step..."
                      maxLength={160}
                      aria-label="New project milestone title"
                      className="h-10 flex-1 rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                    />
                    <Button
                      type="submit"
                      variant="coral"
                      size="sm"
                      disabled={isMutating || !newMilestoneTitle.trim()}
                      leadingIcon={<Plus className="h-3.5 w-3.5" />}
                    >
                      Add Milestone
                    </Button>
                  </div>

                  {showMilestoneExtras && (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <input
                        type="date"
                        value={newMilestoneDueDate}
                        onChange={(e) => setNewMilestoneDueDate(e.target.value)}
                        aria-label="Milestone due date"
                        className="h-9 rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-xs text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                      />
                      <input
                        type="text"
                        value={newMilestoneDescription}
                        onChange={(e) => setNewMilestoneDescription(e.target.value)}
                        placeholder="Optional milestone notes..."
                        maxLength={2000}
                        aria-label="Milestone notes"
                        className="h-9 rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                      />
                    </div>
                  )}
                </form>

                {selectedProject.milestones.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-4 text-xs text-[#737378]">
                    No milestones yet. Add ordered milestones above to track phased project progress.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#1A1A1A]">
                    {selectedProject.milestones.map((milestone, index) => {
                      const isEditing = editingMilestoneId === milestone.id;
                      return (
                        <div key={milestone.id} className="px-3.5 py-3">
                          {isEditing ? (
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_165px]">
                                <input
                                  type="text"
                                  value={editMilestoneTitle}
                                  onChange={(e) => setEditMilestoneTitle(e.target.value)}
                                  maxLength={160}
                                  className="h-9 rounded-lg border border-white/[0.1] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                                />
                                <input
                                  type="date"
                                  value={editMilestoneDueDate}
                                  onChange={(e) => setEditMilestoneDueDate(e.target.value)}
                                  className="h-9 rounded-lg border border-white/[0.1] bg-[#262626] px-2.5 font-mono text-xs text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                                />
                              </div>
                              <input
                                type="text"
                                value={editMilestoneDescription}
                                onChange={(e) => setEditMilestoneDescription(e.target.value)}
                                placeholder="Optional milestone description..."
                                className="h-9 w-full rounded-lg border border-white/[0.1] bg-[#262626] px-3 text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="coral"
                                  disabled={isMutating || !editMilestoneTitle.trim()}
                                  leadingIcon={<Check className="h-3.5 w-3.5" />}
                                  onClick={() => void handleSaveMilestoneEdit(milestone.id)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  leadingIcon={<X className="h-3.5 w-3.5" />}
                                  onClick={() => setEditingMilestoneId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="pt-0.5">
                                  <Checkbox
                                    checked={milestone.completed}
                                    onChange={() =>
                                      void updateProjectMilestone(selectedProject.id, milestone.id, {
                                        completed: !milestone.completed,
                                      })
                                    }
                                    tone="mint"
                                    ariaLabel={`Mark milestone "${milestone.title}" ${
                                      milestone.completed ? 'incomplete' : 'complete'
                                    }`}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={cn(
                                      'text-sm font-medium text-[#F2F2F2]',
                                      milestone.completed && 'line-through text-[#737378]'
                                    )}
                                  >
                                    <span className="mr-2 font-mono text-xs text-[#737378]">
                                      {String(index + 1).padStart(2, '0')}
                                    </span>
                                    {milestone.title}
                                  </p>
                                  {milestone.description && (
                                    <p className="mt-0.5 text-xs text-[#A3A3A8]">
                                      {milestone.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {milestone.dueDate && (
                                  <span className="mr-2 font-mono text-[11px] text-[#A3A3A8]">
                                    {formatShortLocalDate(milestone.dueDate)}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={isMutating || index === 0}
                                  onClick={() => void handleMoveMilestone(index, -1)}
                                  aria-label={`Move "${milestone.title}" up`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    isMutating || index === selectedProject.milestones.length - 1
                                  }
                                  onClick={() => void handleMoveMilestone(index, 1)}
                                  aria-label={`Move "${milestone.title}" down`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditingMilestone(milestone)}
                                  aria-label={`Edit milestone "${milestone.title}"`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isMutating}
                                  onClick={() =>
                                    void deleteProjectMilestone(selectedProject.id, milestone.id)
                                  }
                                  aria-label={`Delete milestone "${milestone.title}"`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737378] hover:bg-[#E06C75]/10 hover:text-[#E06C75] cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Associated Tasks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[#F2F2F2]">
                    Linked Tasks ({selectedProjectTasks.length})
                  </h4>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() =>
                      openCreateTask({
                        defaultProjectId: selectedProject.id,
                        defaultGoalId: selectedProject.goalId,
                      })
                    }
                  >
                    Add Task to Project
                  </Button>
                </div>

                {selectedProjectTasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-4 text-xs text-[#737378]">
                    No tasks linked to this project yet. Add a task above or link an existing task from the Tasks tab.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#1A1A1A]">
                    {selectedProjectTasks.map((task) => {
                      const completed = task.status === 'completed';
                      const overdue = isTaskOverdue(task);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Checkbox
                              checked={completed}
                              onChange={() => void toggleTaskCompleted(task)}
                              tone="coral"
                              ariaLabel={`Mark "${task.title}" ${
                                completed ? 'incomplete' : 'complete'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => openEditTask(task)}
                              className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[#F2F2F2] hover:text-[#E59585] cursor-pointer"
                            >
                              <span className={cn(completed && 'line-through text-[#737378]')}>
                                {task.title}
                              </span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-xs">
                            <span
                              className={cn(
                                'font-mono',
                                overdue ? 'text-[#E06C75]' : 'text-[#A3A3A8]'
                              )}
                            >
                              {task.dueDate ? formatTaskDueLabel(task.dueDate) : task.category}
                            </span>
                            <button
                              type="button"
                              title="Unlink task from project"
                              aria-label={`Unlink "${task.title}" from project`}
                              onClick={() => void updateTask(task.id, { projectId: null })}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737378] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
