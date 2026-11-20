# Marly — Project Blueprint (Living Specification)

**Brand:** Marly
**Tagline:** *Plan with purpose. Live with intention. Think with clarity.*

---

## 1. Product Philosophy

1. **One Unified Space:** Marly eliminates the fragmentation between to-do apps, habit trackers, calendars, and reflection tools without collapsing them into a cluttered single screen.
2. **Consistency Over Perfection:** Progress matters more than fragile perfection. Unscheduled days are never treated as missed habits.
3. **Function Before AI:** Every core workflow in **PLAN** and **LIVE** must be fast, complete, and valuable without AI.
4. **AI With Purpose:** **THINK** adds leverage on top of real historical data—proposing plans, breaking down goals, and surfacing patterns only when invoked.
5. **User Control:** AI proposes; the user explicitly approves any mutation to tasks, schedules, goals, or habits.
6. **Honest Visual Progress:** Streaks, monthly habit calendars, weekly matrices, and yearly activity heatmaps reflect real scheduled expectations rather than vanity metrics.

---

## 2. Core Pillars & Destinations

### HOME (`/`)
The daily command center connecting PLAN and LIVE:
- **Left Column (LIVE Momentum):** Daily intention / reflection summary, habit quick-check preview, 7-day habit success bar chart, and active streak indicator.
- **Center Column (PLAN Focus):** Category-filtered task workspace (`All`, `Work`, `Health`, `Family`), highlighted Today panel with completion progress, Tomorrow preview, and active Goal progress.
- **Right Column (Temporal Schedule):** Interactive 7-day week strip and Morning / Noon / Evening time-blocked schedule distinguishing focus blocks from meetings and routines.

### PLAN (`/plan`)
The organizational engine for commitments:
- **Tasks (`/plan/tasks`):** Title, description, status (`todo`, `in_progress`, `completed`), priority (`low`, `medium`, `high`, `urgent`), due date vs. scheduled time block, duration, category, subtasks, recurrence rules, and project/goal links.
- **Calendar (`/plan/calendar`):** Day, Week, Month, and Agenda views unifying scheduled time blocks, events, deadlines, and optional workout sessions.
- **Projects (`/plan/projects`):** Outcome-oriented containers with status (`planned`, `active`, `on_hold`, `completed`, `archived`), target dates, milestones, and aggregated progress.
- **Goals (`/plan/goals`):** Long-term objectives decomposed into ordered milestones, linked projects, tasks, and optional supporting habits.

### LIVE (`/live`)
The consistency engine and visual heart of Marly:
- **Habits (`/live/habits`):** Binary (*completed today?*) and measurable (*2L water, 30m reading*) habits with flexible schedules (daily, specific weekdays, N times/week).
- **Monthly Habit Calendar (`/live/calendar`):** Day-by-day monthly grid distinguishing `Completed`, `Partial`, `Missed`, `Pending`, and `Unscheduled` states alongside streak and monthly rate metrics.
- **Weekly Habit Matrix (`/live/matrix`):** Structured Mon–Sun table comparing habits side-by-side with per-day completion progress bars and per-habit weekly totals.
- **Activity Heatmap (`/live/heatmap`):** Year-long 52-week contribution-style grid using proportional scheduled completion intensity (`0%`, `1–25%`, `26–50%`, `51–75%`, `76–100%`), paired with 12-month trend and day-of-week frequency insights.
- **Fitness & Routines (`/live/fitness`):** Lightweight workout logging (duration, type, exercises, sets/reps) and ordered step-based routines (morning, evening, study).

### THINK (`/think`) — *Deferred to Phase 11*
The contextual AI intelligence layer:
- Grounded conversational interface with backend-validated tool proposals (`create_task`, `schedule_task`, `create_milestone`, `suggest_habits`, `get_weekly_statistics`).
- Strict confirmation loop: AI reads context -> proposes structured plan/action card -> user accepts, edits, or rejects -> backend executes.

### STATISTICS (`/statistics`) — *Unified Analytics in Phase 9*
Cross-pillar analytics answering concrete questions:
- *Am I finishing what I plan?* (Task completion trends, overdue rate, priority distribution)
- *Am I becoming more consistent?* (Habit adherence, longest vs. current streaks, heatmap intensity)
- *Am I moving toward my goals?* (Milestone velocity and linked project completion)

### SETTINGS (`/settings`)
User preferences, timezone configuration (critical for local habit date boundaries), account management (future Firebase Auth), and in Phase 1 an explicit **UI Kit & State Showcase** verifying loading, empty, and error states.

---

## 3. Phased Development Roadmap

| Phase | Milestone | Scope Highlights |
| :--- | :--- | :--- |
| **0** | Foundation | Environment check, living docs, Git checkpoint baseline |
| **1** | UI Shell & Design System | Tokens, UI primitives, Sidebar + TopBar + Mobile nav, URL routing, isolated-demo Home, rich Plan/Live/Think/Stats previews |
| **2** | Home Refinement | Dashboard widget polish, Quick Add interactive modal UX, responsive edge cases |
| **3** | PLAN — Tasks | Express API, Drizzle PostgreSQL schema, task CRUD, subtasks, filters |
| **4** | PLAN — Calendar | Events, time-block scheduling, deadline vs. block separation |
| **5** | PLAN — Projects & Goals | Milestones, project/goal linkage, progress aggregation |
| **6** | LIVE — Habits | Binary & measurable habit definitions, schedules, historical habit logs |
| **7** | LIVE — Visual Tracking | Server-authoritative streak engine, monthly calendar, weekly matrix, yearly heatmap |
| **8** | LIVE — Fitness & Routines | Workout sessions, exercise sets, ordered routine checklists |
| **9** | Unified Statistics | Recharts analytical views derived from real PLAN + LIVE queries |
| **10** | Testing & Polish | Vitest unit/integration suite, security audit, accessibility QA |
| **11** | THINK — AI | Gemini API integration, context retrieval, user-confirmed tool execution |
| **12** | Deployment | Production build, PostgreSQL migrations, monitoring, launch |
