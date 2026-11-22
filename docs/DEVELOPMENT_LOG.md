# Marly — Development Log & Checkpoint Strategy

---

## Git Checkpoint Strategy

Before every major phase or structural change:
1. Ensure working tree compiles (`npm run lint` and `npm run build`).
2. Commit cleanly with a phase-scoped message (e.g., `chore(phase-0): initialize foundation and living documentation`, `feat(phase-1): build marly design system and responsive ui shell`).
3. Verify the running preview in browser before beginning the next phase.

---

## Phase 0 — Project Foundation
**Focus:** Environment verification, documentation baseline, metadata setup, and architectural guardrails.

### Environment Findings
- Runtime verified: Node `v22.23.2`, npm `10.9.8`, Git `2.34.1`.
- Workspace runs Vite 8 + React 19 + Tailwind CSS v4 (`@tailwindcss/vite`) on port `3000`.
- `lucide-react` and `motion` are pre-installed; `express` and `@google/genai` are present for future backend and Phase 11 THINK phases.
- Workspace did not yet contain a `.git` repository; initialized Git baseline as part of Phase 0 checkpointing.

### Deliverables Completed
- Updated `metadata.json` and `index.html` with Marly identity (`Plan with purpose. Live with intention. Think with clarity.`) and Google Fonts (`Manrope` + `JetBrains Mono`).
- Created full living documentation suite in `README.md` and `docs/`.

---

## Phase 1 — Design System & UI Shell
**Focus:** Reusable component library, responsive navigation shell, URL-aware routing, isolated-demo Home dashboard, and reference-inspired LIVE visual previews.

### Deliverables Completed
1. **Design Tokens (`src/index.css`):** Dark-first `#151515` dotted canvas, `#202020` surface, `#292929` elevated state, plus Coral (`#E59585`), Mint (`#96D2C5`), Orange (`#F19A50`), Blue (`#A9C8E9`), and Purple (`#8C82E8`) tokens.
2. **Custom Brand Identity (`BrandMark`):** Abstract geometric lily-inspired SVG emblem representing the three converging pillars (PLAN, LIVE, THINK).
3. **Reusable UI Kit & Feedback (`src/components/ui/`, `src/context/ToastContext.tsx`):** Button, IconButton, Card, Input, Checkbox (with accessible hit targets and label truncation), ProgressBar, ProgressRing, Badge, SegmentedTabs (with optional `<a href>` link semantics), Dialog, EmptyState, Skeleton, ErrorState, PreviewNotice, and ToastProvider.
4. **Responsive Shell (`src/components/layout/`):** Persistent 244px desktop sidebar, compact 64px top utility bar (with Search filter, Quick Add menu, and Demo User link), tablet slide-over navigation, and mobile bottom navigation bar using semantic `<a href>` links.
5. **URL-Aware Router (`src/lib/router.ts`):** Clean History API navigation across `/`, `/plan/*`, `/live/*`, `/think`, `/statistics`, and `/settings`, with canonical alias normalization (`/plan` -> `/plan/tasks`, `/live` -> `/live/calendar`), query/hash preservation, and recoverable route-not-found UI.
6. **Isolated Data Boundary (`src/hooks/useMarlyData.ts`, `src/context/DemoStateContext.tsx`):** All feature components read demo datasets through domain-scoped hooks rather than importing `src/data/demoData.ts` directly.
7. **HOME Dashboard (`src/features/home/`):** Balanced 3-column layout anchored on **Tuesday, March 24, 2026**, featuring interactive local-demo task completion, category filtering, daily habit momentum & 7-day success chart, streak summary, and Morning/Noon/Evening schedule timeline.
8. **LIVE Visual Previews (`src/features/live/`):** Reference-inspired Streak Banner, calendar-accurate Monthly Habit Calendar (28-day Feb / 31-day Mar / 30-day Apr 2026), interactive Weekly Habit Matrix (Mar 23–29 with 40px cell hit targets), Yearly Activity Heatmap (distinguishing unscheduled rest days from 0% missed days + 12-month trend & weekday breakdown), plus Fitness & Routines Phase 8 preview.
9. **PLAN, THINK, STATISTICS & SETTINGS Previews:** Structured destinations clearly distinguished as upcoming-phase previews, plus an interactive UI Kit & State Showcase in Settings.

### Known Phase 1 Boundaries (By Design)
- All data resets on page reload; there is no database persistence yet.
- Quick Add opens the creation menu and explains the target workflow with honest demo feedback rather than writing to a backend.
- THINK displays its Phase 11 architecture and confirmation workflow without making any Gemini API calls.

---

## Phase 3 — First Real Backend Implementation (Task CRUD + Auth)
**Focus:** PostgreSQL (Cloud SQL) + Drizzle ORM + Express API + Zod validation + Firebase Authentication + real HOME & PLAN Task CRUD integration.

### Deliverables Completed
1. **Database & Drizzle Schema (`src/db/`):** Provisioned Cloud SQL PostgreSQL and pushed `users` and `tasks` schema (`src/db/schema.ts`, `src/db/drizzle.config.ts`, `src/db/index.ts`) with object-method pooling (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`) and user-scoped repository helpers (`src/db/users.ts`, `src/db/tasks.ts`), verified against `information_schema.columns`.
2. **Firebase Auth & Express Middleware (`src/lib/firebase-admin.ts`, `src/middleware/auth.ts`):** Verified Bearer Firebase ID tokens via `firebase-admin` and synced `users` rows via `onConflictDoUpdate` on every authenticated request.
3. **Validated Task REST API (`src/validators/taskValidator.ts`, `src/routes/tasks.ts`, `server.ts`):** Implemented `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks`, `PATCH /api/tasks/:id`, and `DELETE /api/tasks/:id` with Zod v4 request/param validation, automatic `completedAt` lifecycle handling, sanitized error layers, and Express + Vite middleware serving on port `3000`.
4. **Frontend Auth & Task CRUD UI:** Added `src/lib/firebase.ts`, `AuthContext`, `TasksContext`, `taskApi.ts`, normalized `Task` DTO (`src/types/task.ts`), `TaskFormDialog`, and integrated real task management into `TasksOverviewColumn` (HOME), `PlanPage` (`PLAN → Tasks`), `QuickAddDialog`, `TopBar`, `Sidebar`, and `SettingsPage`, while keeping unimplemented modules cleanly isolated on `DemoStateContext`.

---

## Phase 4 — PLAN → Calendar (Events CRUD + Task Due-Date Integration)
**Focus:** Real PostgreSQL `calendar_events` persistence, authenticated `/api/calendar-events` CRUD API, Month/Week/Day calendar views, and non-destructive task due-date overlay.

### Deliverables Completed
1. **Calendar Events Schema & Repository (`src/db/schema.ts`, `src/db/calendarEvents.ts`):** Added `calendar_events` table separating date-only all-day bounds (`start_date`, `end_date`) from timezone-aware timed events (`start_at`, `end_at`), with nullable `task_id` FK and strict `user_id` ownership scoping; verified against `information_schema.columns`.
2. **Validation & Express API (`src/validators/calendarEventValidator.ts`, `src/routes/calendarEvents.ts`, `server.ts`):** Implemented `GET /api/calendar-events`, `GET /api/calendar-events/:id`, `POST /api/calendar-events`, `PATCH /api/calendar-events/:id`, and `DELETE /api/calendar-events/:id` behind `requireAuth`, enforcing `endAt > startAt` (timed) and `endDate >= startDate` (all-day) on both create and partial `PATCH` updates.
3. **Frontend Calendar & Task Coexistence (`src/types/calendar.ts`, `src/services/calendarApi.ts`, `src/context/CalendarContext.tsx`, `src/features/plan/CalendarEventFormDialog.tsx`, `src/features/plan/PlanCalendarView.tsx`):** Built real Month, Week, and Day views with Prev/Today/Next navigation, local-timezone date/grid utilities, category & task-visibility filters (`All`, `Open only`, `Hidden`), full Event CRUD with delete confirmation, and click-to-edit / checkbox integration with existing Tasks without duplicating tasks into `calendar_events`.

---

## Phase 5 — PLAN → Projects & Goals (Milestones, Task Associations & Progress)
**Focus:** Real PostgreSQL `goals`, `goal_milestones`, `projects`, and `project_milestones` persistence, authenticated CRUD & milestone-reordering APIs, task–project–goal associations, deterministic progress calculations, and HOME/PLAN UI integration.

### Deliverables Completed
1. **Database Schema & Repositories (`src/db/schema.ts`, `src/db/goals.ts`, `src/db/projects.ts`, `src/db/tasks.ts`):** Added `goals`, `goal_milestones`, `projects`, and `project_milestones` tables in Cloud SQL PostgreSQL plus `ON DELETE SET NULL` foreign keys and indexes on `tasks.project_id` and `tasks.goal_id`. Verified via `information_schema.columns`. Enforced strict `userId` ownership on every project, goal, milestone, and task association.
2. **Validation, Progress Engine & REST API (`src/lib/progress.ts`, `src/validators/projectGoalValidator.ts`, `src/validators/taskValidator.ts`, `src/routes/goals.ts`, `src/routes/projects.ts`, `src/routes/tasks.ts`, `server.ts`):** Implemented `/api/goals` and `/api/projects` (plus nested `/milestones` CRUD and `PUT .../milestones/reorder`), date-bound validation (`targetDate >= startDate`), cross-user ownership rejection on task linking, and deterministic double-counting-free progress rules shared across backend and frontend.
3. **Frontend UI & HOME Integration (`src/types/projectGoal.ts`, `src/services/projectsGoalsApi.ts`, `src/context/ProjectsGoalsContext.tsx`, `src/features/plan/PlanProjectsView.tsx`, `src/features/plan/PlanGoalsView.tsx`, `src/features/plan/ProjectFormDialog.tsx`, `src/features/plan/GoalFormDialog.tsx`, `src/features/plan/TaskFormDialog.tsx`, `src/features/plan/PlanPage.tsx`, `src/features/home/TasksOverviewColumn.tsx`, `src/components/layout/QuickAddDialog.tsx`):** Built master-detail Projects and Goals workspaces with filtering, sorting, archive/restore, ordered milestone controls, measurable goal targets, task association selectors, and live HOME Goal Progress tracking.

---

## Phase 6 — LIVE Backend Foundation (Habits, Schedules & Historical Logs)
**Focus:** Real PostgreSQL `habits`, `habit_schedules`, `habit_logs`, and `users.timezone` persistence, authoritative user-timezone local-date evaluation, deterministic daily & weekly streaks, and HOME / LIVE → Habits / Settings integration.

### Deliverables Completed
1. **Database Schema & Repositories (`src/db/schema.ts`, `src/db/users.ts`, `src/db/habits.ts`):** Added nullable `users.timezone`, `habits` (boolean & measurable targets, optional `goalId`, active/archived status), `habit_schedules` (`daily`, `weekdays` bitmask, `times_per_week`), and `habit_logs` with unique `(habit_id, local_date)` index and preserved `target_snapshot` / server-derived `status_snapshot`. Pushed to Cloud SQL and verified via `information_schema.columns`.
2. **Schedule, Timezone & Streak Engine (`src/lib/habitSchedule.ts`, `src/validators/habitValidator.ts`):** Enforced schedule-type validation rules, non-negative measurable values, `completed` vs `partial` status derivation (partial logs preserved but never advancing streaks), schedule-edit historical log immutability, and deterministic daily (`days`) vs weekly (`weeks`) streak calculation without penalizing in-progress days or weeks.
3. **Express API (`src/routes/me.ts`, `src/routes/habits.ts`, `server.ts`):** Implemented `GET/PATCH /api/me` for authoritative user timezone persistence and initialization, plus ownership-scoped `/api/habits`, `/api/habits/:id/schedule`, `/api/habits/:id/logs`, `/api/habits/:id/logs/:localDate`, and `/api/habit-logs`.
4. **Frontend Integration (`src/types/habit.ts`, `src/services/habitsApi.ts`, `src/context/HabitsContext.tsx`, `src/hooks/useMarlyData.ts`, `src/features/live/HabitFormDialog.tsx`, `src/features/live/LiveHabitsView.tsx`, `src/features/home/HabitMomentumColumn.tsx`, `src/features/settings/SettingsPage.tsx`, `src/components/layout/QuickAddDialog.tsx`):** Connected LIVE → Habits CRUD & historical backfill/undo, HOME daily habits & 7-day consistency bars, Quick Add New Habit, and Settings persisted IANA timezone configuration.

---

## Phase 7 — LIVE Historical Visualizations (Monthly Calendar, Weekly Matrix & Activity Heatmap)
**Focus:** Connecting Monthly Habit Calendar, Weekly Habit Matrix, and Yearly Activity Heatmap to real PostgreSQL `habits`, `habit_schedules`, and `habit_logs` with consistent historical evaluation and bounded range caching.

### Deliverables Completed
1. **Schedule Timestamp Stability & DTO (`src/db/habits.ts`, `src/types/habit.ts`):** Updated `updateUserHabit` and `updateUserHabitSchedule` so `habit_schedules.updated_at` only updates when `frequencyType`, `weekdaysMask`, or `targetPerWeek` actually changes, and exposed `schedule.createdAt` / `schedule.updatedAt` in API responses.
2. **Shared Historical Evaluator & Range Chunking (`src/lib/habitVisualizations.ts`, `src/context/HabitsContext.tsx`, `src/hooks/useMarlyData.ts`):** Built `evaluateHabitDayStatus` plus pure view-model builders (`buildMonthlyCalendarViewData`, `buildWeeklyMatrixViewData`, `buildYearlyHeatmapViewData`) and an interval-cached `ensureLogRangeLoaded` loader that splits gaps into `<= 365`-day chunks under the `/api/habit-logs` 400-day limit while keeping `logsByKey` synchronized across log mutations, undo, delete, and timezone changes.
3. **Monthly Habit Calendar (`src/features/live/MonthlyHabitCalendar.tsx`):** Integrated Prev/Today/Next month navigation, single-habit vs. all-habits scope filter, schedule-aware day states (`completed`, `partial`, `pending`, `missed`, `unscheduled`, `unverified`, `future`), streak & monthly rate summary, and Selected Day inline boolean check-off/undo and measurable entry/completion/undo backfill (`<= todayLocalDate`).
4. **Weekly Habit Matrix (`src/features/live/WeeklyHabitMatrix.tsx`):** Integrated Prev/This Week/Next Week (Mon–Sun) navigation, active + historical-log archived habits, schedule-aware cells distinguishing rest days and flexible `times_per_week` targets, inline boolean toggle and measurable cell editor, and accurate row/column totals without counting partial progress or rest days dishonestly.
5. **Yearly Activity Heatmap (`src/features/live/ActivityHeatmap.tsx`, `src/features/live/LivePage.tsx`):** Integrated year navigation, true calendar-aligned Sun–Sat week grid with aligned month markers, explicit visual separation for unscheduled/unrecorded days, `0%` missed days, partial-only activity, and `1–100%` full completions, selected-day inspection breakdown, live 12-month & weekday frequency charts, and scoped the `PreviewNotice` banner solely to Phase 8 `Fitness & Routines`.

---

## Phase 8 — LIVE Fitness & Routines
**Focus:** Persistent workout session logging with weekly/30-day summaries, ordered step-based routines strictly decoupled from habit streaks, immutable historical step snapshots on routine execution logs, and archive-first deletion safeguards.

### Deliverables Completed
1. **Database Schema & Cloud SQL Verification (`src/db/schema.ts`, `src/db/workouts.ts`, `src/db/routines.ts`):** Added `workout_sessions`, `routines`, `routine_steps`, and `routine_logs` (with unique `(routine_id, local_date)` index and JSONB `steps_snapshot` / `completed_steps_snapshot` columns); pushed via Drizzle and verified against `information_schema.columns`.
2. **Validation & Express API (`src/validators/fitnessRoutinesValidator.ts`, `src/routes/workouts.ts`, `src/routes/routines.ts`, `server.ts`):** Implemented authenticated ownership-scoped endpoints under `/api/workouts` and `/api/routines` (including `/steps`, `/steps/reorder`, and `/logs`), rejecting future-date or archived-routine execution logs and guaranteeing step edits/reorders/deletions never mutate historical logs.
3. **Frontend Integration (`src/types/fitnessRoutines.ts`, `src/services/fitnessRoutinesApi.ts`, `src/context/FitnessRoutinesContext.tsx`, `src/hooks/useMarlyData.ts`, `src/features/live/LiveFitnessRoutinesView.tsx`, `src/features/live/WorkoutFormDialog.tsx`, `src/features/live/RoutineFormDialog.tsx`, `src/features/live/LivePage.tsx`, `src/components/layout/QuickAddDialog.tsx`, `src/components/layout/AppShell.tsx`, `src/App.tsx`):** Connected `LIVE → Fitness & Routines` and Quick Add (`Log Workout`, `New Routine`) to PostgreSQL with timezone synchronization via `HabitsContext`, activity-type filtering, inline step management, preserved snapshot execution history viewer, and explicit permanent-deletion warnings recommending Archive.

---

## Phase 9 — STATISTICS (Unified Cross-Pillar Progress & Analytics)
**Focus:** Real server-side cross-pillar analytics uniting PLAN and LIVE using persisted `users.timezone`, exact shared domain evaluators, honest denominator/comparison safeguards, Recharts 3.x visualizations, and authenticated `/statistics` UI.

### Deliverables Completed
1. **Validation, Contracts & Aggregation Engine (`src/types/statistics.ts`, `src/validators/statisticsValidator.ts`, `src/db/statistics.ts`, `src/db/statisticsHelpers.ts`, `src/routes/statistics.ts`, `server.ts`):** Implemented `GET /api/statistics` behind Firebase authentication (`requireAuth`), supporting `7d`, `week`, `30d`, `month`, `90d`, `ytd`, and bounded `custom` (`<= 366` days) periods evaluated in `users.timezone`. Reused `computeProjectProgress` and `computeGoalProgress` (`src/lib/progress.ts`), `evaluateHabitDayStatus` (`src/lib/habitVisualizations.ts`), `computeHabitStreakSummary` (`src/lib/habitSchedule.ts`), and immutable `routine_logs` snapshots while keeping `partial` habit progress separate from full completions, evaluating `times_per_week` habits strictly on closed weeks, distinguishing Task throughput (`completedAt`) from due-date cohort status and open overdue snapshots, and suppressing invalid prior-period deltas.
2. **Frontend Analytics Dashboard & Recharts 3.x (`src/services/statisticsApi.ts`, `src/hooks/useStatisticsData.ts`, `src/features/statistics/StatisticsPage.tsx`, `src/features/statistics/components/*`, `src/hooks/useMarlyData.ts`, `src/App.tsx`):** Installed `recharts@^3.0.0`, replaced the Phase 1 demo preview with an authenticated Google Sign-In dashboard (no demo fallback), added period preset & custom-date range controls synced with user timezone, concise 4-card Overview KPI grid, PLAN trend/backlog/portfolio charts & progress bars, and LIVE habit adherence, closed-week weekly-quota, fitness volume/mix, and snapshot-based routine consistency analytics.
