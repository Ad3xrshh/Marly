# Marly — Database Architecture & Schema Blueprint

> **Phase Status:** Documentation blueprint only. No database instance, ORM package, or migration is provisioned in Phase 0/1.

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
   - **Calendar Events & Scheduled Time Blocks** use `TIMESTAMPTZ` (timezone-aware timestamps).
   - **Task Deadlines** distinguish between a date-only deadline (`due_date`) and an actual calendar time block (`scheduled_start`, `scheduled_end`).
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
 ├──< workout_sessions
 │     └──< session_exercises ──< exercise_sets
 ├──< routines
 │     ├──< routine_steps
 │     └──< routine_logs
 └──< ai_conversations (Phase 11)
       ├──< ai_messages
       └──< ai_action_records (proposed -> approved | rejected -> executed)
```

---

## 4. Planned Drizzle Rollout Schedule

- **Phase 3:** `users`, `tasks`, `task_subtasks`, `task_recurrences`
- **Phase 4:** `calendar_events` + task time-block indexing
- **Phase 5:** `projects`, `project_milestones`, `goals`, `goal_milestones`
- **Phase 6–7:** `habits`, `habit_schedules`, `habit_logs` (with unique `(habit_id, local_date)` index)
- **Phase 8:** `workout_sessions`, `session_exercises`, `exercise_sets`, `routines`, `routine_steps`, `routine_logs`
- **Phase 11:** `ai_conversations`, `ai_messages`, `ai_action_records`
