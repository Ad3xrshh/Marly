# Marly — Database Architecture & Schema Blueprint

> **Phase Status:** Phase 9 active (`users` with `timezone`, `tasks`, `calendar_events`, `goals`, `goal_milestones`, `projects`, `project_milestones`, `habits`, `habit_schedules`, `habit_logs`, `workout_sessions`, `routines`, `routine_steps`, and `routine_logs` implemented in PostgreSQL via Drizzle ORM; Phase 9 Statistics aggregates dynamically over existing tables with no new statistics-cache tables; AI tables remain blueprint targets for Phase 11).

---

## 1. Selected Persistence Stack

- **Database Engine:** PostgreSQL
- **ORM & Migrations:** Drizzle ORM (`drizzle-orm` + `drizzle-kit`)

**Why PostgreSQL + Drizzle ORM:**
1. Marly's domain relies heavily on relational integrity—tasks linked to projects and goals, goal milestones, historical habit logs keyed by `(habit_id, local_date)`, and future AI action audit records.
2. Drizzle provides explicit TypeScript SQL schemas, predictable generated SQL queries for analytical aggregations (heatmaps, weekly matrices, completion trends), and lightweight runtime overhead.

---

## 2. Critical Data Invariants

1. **Strict Ownership:** Every personal entity (`tasks`, `projects`, `goals`, `habits`, `habit_logs`, `calendar_events`, `workout_sessions`, `routines`) carries a non-null `user_id` foreign key verified server-side on every read/write.
2. **Historical Integrity of Habit Logs:** Habit completions are stored as immutable/append-or-upsert rows in `habit_logs`, never as a boolean column on `habits`. If a user edits a habit's name, target, or weekly frequency later, past completion history remains accurate.
3. **User-Local Dates vs. UTC Timestamps:**
   - **Habit Logs** use an explicit ISO calendar date (`DATE` / `YYYY-MM-DD` in the user's configured timezone) so completing a habit at 11:30 PM local time never shifts onto tomorrow in UTC.
   - **Calendar Events:** Timed events use `TIMESTAMPTZ` (`start_at`, `end_at`), while all-day events (`all_day = true`) store date-only strings (`start_date`, `end_date` in `YYYY-MM-DD`) with null timestamps so all-day events never shift across timezones.
   - **Task Deadlines:** Distinguish between a date-only deadline (`due_date`) and scheduled `calendar_events` (`task_id` nullable FK reserved for future linking without duplicating tasks).
4. **Soft Archival vs. Deletion:** Habits and projects support `archived` status so historical statistics and heatmaps are not silently corrupted when a user stops tracking an old habit.
5. **No Duplicate Daily Habit Logs:** Enforce a unique composite constraint on `(habit_id, local_date)` so upserting measurable progress (e.g., `1.5L -> 2.0L`) updates the day's record cleanly.

---

## 3. Conceptual Entity Relationship Overview

```
users
 ├──< tasks (optional project_id, goal_id, parent recurrence_id)
 │     └──< task_subtasks
 ├──< projects (optional goal_id)
 │     └──< project_milestones
 ├──< goals
 │     └──< goal_milestones
 ├──< calendar_events (optional task_id)
 ├──< habits (optional goal_id, tracking_type: boolean | measurable)
 │     ├──< habit_schedules (frequency_type, weekdays_mask, target_per_week)
 │     └──< habit_logs (local_date, completed_value, status_snapshot)
 ├──< workout_sessions (title, activity_type, local_date, start_time, duration_minutes, notes)
 ├──< routines (time_of_day, preferred_time, schedule_type, weekdays_mask, status)
 │     ├──< routine_steps (title, duration_minutes, sort_order)
 │     └──< routine_logs (local_date, completed_step_ids, steps_snapshot, completed_steps_snapshot, status)
 └──< ai_conversations (Phase 11)
       ├──< ai_messages
       └──< ai_action_records (proposed -> approved | rejected -> executed)
```

---

## 4. Planned Drizzle Rollout Schedule

- **Phase 3 (Implemented):** `users`, `tasks` (with nullable placeholder columns for future Phases 4–5)
- **Phase 4 (Implemented):** `calendar_events` (all-day `start_date`/`end_date` + timed `start_at`/`end_at` + optional nullable `task_id` FK)
- **Phase 5 (Implemented):** `goals`, `goal_milestones`, `projects`, `project_milestones`, plus `ON DELETE SET NULL` foreign keys and indexes on `tasks.project_id` and `tasks.goal_id`
- **Phase 6 (Implemented):** `users.timezone`, `habits`, `habit_schedules`, `habit_logs` (with unique `(habit_id, local_date)` index and `(user_id, local_date)` lookup index)
- **Phase 7 (Implemented):** Monthly Habit Calendar, Weekly Habit Matrix, and Yearly Activity Heatmap views backed by bounded range queries over `habit_logs`, preserving `habit_schedules.updated_at` on non-schedule habit updates and distinguishing partial measurable logs, unscheduled rest days, and unrecorded pre-edit periods.
- **Phase 8 (Implemented):** `workout_sessions`, `routines`, `routine_steps`, `routine_logs` (with unique `(routine_id, local_date)` index and JSONB step snapshots preserving execution history across later step edits)
- **Phase 9 (Implemented — No Schema Changes):** Server-side cross-pillar analytics (`src/db/statistics.ts`) computed directly over existing PostgreSQL tables using persisted `users.timezone`, shared `src/lib/progress.ts`, `src/lib/habitVisualizations.ts`, and immutable `routine_logs` snapshots
- **Phase 11:** `ai_conversations`, `ai_messages`, `ai_action_records`

---

## 5. Phase 5 Relational Integrity & Progress Calculation Rules

1. **Non-Destructive Task & Project Associations (`ON DELETE SET NULL`):**
   - `tasks.project_id` references `projects.id` (`ON DELETE SET NULL`) and `tasks.goal_id` references `goals.id` (`ON DELETE SET NULL`). Deleting a project or goal preserves all linked tasks with nulled foreign keys.
   - `projects.goal_id` references `goals.id` (`ON DELETE SET NULL`). Deleting a goal unlinks rather than destroys its projects.
   - Deleting a project cascades only to `project_milestones`; deleting a goal cascades only to `goal_milestones`.
2. **Project Progress (`src/lib/progress.ts`):**
   - Calculated from distinct work units: `project_milestones` + directly linked `tasks` (`tasks.project_id = project.id`). If total units > 0, `round(completedUnits / totalUnits * 100)`; otherwise `100%` if `status === 'completed'` else `0%`.
3. **Goal Progress (Double-Counting-Free Priority Order in `src/lib/progress.ts`):**
   - **Milestones Mode:** If `goal_milestones` exist, progress is `round(completedGoalMilestones / totalGoalMilestones * 100)`.
   - **Measurable Target Mode:** Else if `target_value > 0`, progress is clamped `round((current_value ?? 0) / target_value * 100)`.
   - **Linked Work Mode:** Else aggregates unique units across linked projects plus standalone tasks (`tasks.goal_id = goal.id` whose `project_id` is not already in the goal's linked projects—preventing double-counting when a task references both a project and its parent goal).
   - **Status Fallback:** Otherwise `100%` if `status === 'completed'`, else `0%`.

---

## 6. Phase 6 Habits, Timezone Integrity & Deterministic Streak Rules (`src/lib/habitSchedule.ts`)

1. **Authoritative User Timezone (`users.timezone`):**
   - `users.timezone` stores a validated IANA timezone identifier (initialized explicitly by the client via `GET/PATCH /api/me` when null, and editable in Settings). Untrusted request headers never override the persisted user timezone.
   - Server local-date resolution (`getTodayLocalDateForTimeZone`) formats the current instant in `users.timezone` (`UTC` deterministic fallback only prior to initialization) rather than using UTC midnight `toISOString().slice(0, 10)`.
2. **Schedule Evaluation (`habit_schedules`):**
   - `daily`: all 7 days scheduled (`weekdays_mask = 127`, `target_per_week = null`).
   - `weekdays`: only selected weekdays (`weekdays_mask > 0`, `target_per_week = null`) are scheduled.
   - `times_per_week`: flexible target of `1..7` completions per Monday–Sunday week; `weekdays_mask` never influences schedule eligibility or weekly streak calculation.
3. **Measurable Log Integrity (`habit_logs`):**
   - Boolean habits remain strictly binary (`completed_value = 1`, `target_snapshot = 1`, `status_snapshot = 'completed'`).
   - Measurable habits accept non-negative `completed_value` values (`>= 0`), preserve uncapped logged values, and preserve the `target_snapshot` recorded for that `(habit_id, local_date)` even if `habits.target_value` changes later. Visual progress bars cap display at `100%`.
   - `status_snapshot` (`'completed' | 'partial'`) is derived strictly server-side from `completed_value >= target_snapshot`. Partial logs are preserved and displayed, but never advance completion streaks.
   - Editing a habit's schedule or target never mutates or deletes existing `habit_logs`.
4. **Deterministic Streak Computation (`computeHabitStreakSummary`):**
   - **`daily` & `weekdays` (`streakUnit: 'days'`):** Counts consecutive scheduled completed days (`status_snapshot = 'completed'`). Unscheduled rest days neither break nor increment streaks, and an unfinished current scheduled day does not break an ongoing streak from yesterday.
   - **`times_per_week` (`streakUnit: 'weeks'`):** Counts consecutive qualifying Monday–Sunday weeks (`completedDaysInWeek >= target_per_week`). Exposed explicitly as weekly streaks (`weeks`) rather than daily streaks, and an in-progress current week is never prematurely penalized.

---

## 7. Phase 7 Historical Visualization Guarantees (`src/lib/habitVisualizations.ts`)

1. **Non-Destructive Schedule Metadata (`src/db/habits.ts`):**
   - Updating a habit's name, description, category, target, or status no longer updates `habit_schedules.updated_at` unless `frequencyType`, `weekdaysMask`, or `targetPerWeek` actually changed, preventing non-schedule edits from invalidating historical adherence evaluations.
   - Serialized `HabitSchedule` DTOs expose `createdAt` and `updatedAt` timestamps so client visualizations can detect when a schedule was modified after habit creation.
2. **Honest Unversioned-Schedule Handling:**
   - Persisted `habit_logs` always take precedence regardless of later schedule edits or archival.
   - For unlogged dates prior to `habit_schedules.updated_at` when a schedule was genuinely modified after creation (`scheduleUpdatedLocalDate > createdLocalDate`), the shared `evaluateHabitDayStatus` evaluator classifies those days as `unverified_prior_schedule` and renders them neutrally rather than fabricating `missed` statuses.
3. **Bounded Range Queries:**
   - `GET /api/habit-logs` rejects requests spanning more than 400 days. `HabitsContext.ensureLogRangeLoaded` tracks merged covered date intervals and splits any missing range (e.g., 366-day leap years or arbitrary history) into `<= 365`-day chunks via `splitDateRangeChunks`.

---

## 8. Phase 8 Fitness & Routines Guarantees (`src/db/workouts.ts`, `src/db/routines.ts`)

1. **Lightweight Workout Tracking (`workout_sessions`):**
   - Stores practical session logs (`title`, `activity_type`, `local_date`, optional `start_time`, `duration_minutes`, optional `notes`) without overengineered nested exercise/set tables, calorie calculations, or habit-log duplication.
   - Weekly (`Mon–Sun`) and 30-day workout totals and activity-type breakdowns are computed in the user's persisted `users.timezone`.
2. **Routine Separation from Habits:**
   - `routines`, `routine_steps`, and `routine_logs` manage ordered step sequences (`sort_order`) and daily execution states (`in_progress` / `completed`) independently of `habits`, `habit_schedules`, and `habit_logs` so routine runs never mutate habit streaks or heatmaps.
3. **Routine History Snapshot Integrity (`routine_logs`):**
   - Upserting a routine execution log captures JSONB snapshots (`steps_snapshot`, `completed_steps_snapshot`), `completed_steps_count`, and `total_steps_snapshot` alongside `completed_step_ids`.
   - Later step renames, additions, reorders, or deletions never retroactively rewrite or delete existing historical `routine_logs` rows.
4. **Archival vs. Permanent Deletion:**
   - Archiving sets `routines.status = 'archived'` and `archived_at`, blocking new execution logs while keeping historical records intact. Permanent deletion cascades to `routine_steps` and `routine_logs` only after an explicit destructive confirmation warning recommending Archive instead.
