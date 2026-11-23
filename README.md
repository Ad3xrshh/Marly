# Marly

**Plan with purpose. Live with intention. Think with clarity.**

Marly is a unified personal productivity and life-tracking application designed around three interconnected pillars:

- **PLAN** — Organize tasks, schedules, projects, goals, and milestones.
- **LIVE** — Track daily and scheduled habits, streaks, monthly habit calendars, weekly habit matrices, yearly activity heatmaps, workouts, and routines.
- **THINK** — A future AI intelligence layer grounded in validated PLAN and LIVE data, providing planning proposals and personal insights under explicit user authorization.
- **HOME** — The unified daily dashboard connecting what you intend to do with what you consistently practice.

---

## Current Project Status

| Phase | Scope | Status |
| :--- | :--- | :--- |
| **Phase 0** | Environment inspection, living documentation suite, Git checkpoint strategy | **Complete** |
| **Phase 1** | Brand identity, design tokens, reusable UI kit, responsive shell, URL-aware routing, isolated-demo Home dashboard, and visual previews for Plan, Live, Think, Statistics, and Settings | **Complete** |
| **Phase 3 (Task CRUD)** | Node.js + Express (`server.ts`), Cloud SQL PostgreSQL + Drizzle ORM, Zod validation, Firebase Auth, and real Task CRUD in HOME & PLAN → Tasks | **Complete** |
| **Phase 4 (PLAN Calendar)** | PostgreSQL `calendar_events`, `/api/calendar-events` CRUD, Month/Week/Day views, and task due-date calendar integration | **Complete** |
| **Phase 5 (Projects & Goals)** | PostgreSQL `projects`, `project_milestones`, `goals`, `goal_milestones`, task associations, and deterministic progress calculations | **Complete** |
| **Phase 6 (Habits & Logs)** | PostgreSQL `habits`, `habit_schedules`, `habit_logs`, authoritative `users.timezone`, deterministic daily/weekly streaks, and HOME / LIVE → Habits integration | **Complete** |
| **Phase 7 (LIVE Visualizations)** | PostgreSQL-backed Monthly Habit Calendar, Weekly Habit Matrix, Yearly Activity Heatmap, shared historical schedule evaluator, and bounded range-log caching | **Complete** |
| **Phase 8 (Fitness & Routines)** | PostgreSQL `workout_sessions`, `routines`, `routine_steps`, `routine_logs`, weekly/30-day activity summaries, step execution & immutable snapshot history | **Complete** |
| **Phase 9 (STATISTICS)** | Server-side cross-pillar aggregation (`GET /api/statistics`), schedule-aware habit & closed-week weekly-quota metrics, dual task throughput vs. due-cohort tracking, Recharts 3.x visualizations | **Complete** |
| **Phase 10A (THINK Foundation)** | Server-side `@google/genai` integration, PostgreSQL `ai_conversations` / `ai_messages` persistence, DB-backed daily quota, and authenticated multi-thread `/think` UI | **Complete** |
| **Phase 10B (THINK Action Engine)** | Whitelisted 8-action PLAN/LIVE proposals (`create_task`, `update_task`, `create_calendar_event`, `create_project_milestone`, `create_goal_milestone`, `create_habit`, `create_routine`, `create_workout`), inline editable approval cards, atomic status lifecycle, and domain service reuse | **Complete** |
| **Phase 10C.1 (THINK Context Slices)** | Modular `userId`-scoped cross-pillar context assembly (`src/lib/thinkContext/`), 6-category intent classifier, sanitization, and multi-pass `4500`-token budgeting | **Complete** |
| **Phase 10C.2 (THINK Grounded Gemini)** | Integrated workspace context packet, untrusted `<workspace_context_json>` boundary, multi-turn `previousTurnMeta` continuity, partial/total slice degradation, and server-side reference/evidence verification | **Complete** |
| **Phase 10C.3 (THINK Grounded UX & Navigation)** | Per-thread `contextSource` focus selector (`PATCH /api/think/conversations/:id`), verified reference navigation with destination query-param highlighting across PLAN & LIVE, Context & Evidence disclosure, and degraded/uncertainty messaging | **Complete** |
| **Phase 10D–10E** | THINK voice interaction (`10D`) and final polish (`10E`) | Upcoming |

> **Current Persistence Boundary:**
> **Tasks** (HOME and PLAN → Tasks), **Calendar Events** (PLAN → Calendar), **Projects, Goals & Milestones** (PLAN → Projects, PLAN → Goals, and HOME Goal Progress), **Habits, Schedules & Completion Logs** (HOME Daily Habits, LIVE → Habits, Habit Calendar, Weekly Matrix, and Activity Heatmap), **Workouts, Routines, Routine Steps & Execution Logs** (LIVE → Fitness & Routines), **Unified Statistics** (STATISTICS), **THINK Conversations, Grounded Metadata & Action Proposals** (THINK), and **User Timezone Preferences** (Settings) are backed by PostgreSQL + Drizzle ORM and scoped to your authenticated Google account. Only the Home schedule timeline preview continues using **isolated client-side demonstration data**.

---

## Technology Stack

### Active in Phases 3–10C.3
- **Frontend**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) with custom semantic design tokens
- **Typography**: `Manrope` (UI & display) + `JetBrains Mono` (tabular metrics & time readouts)
- **Charts**: Recharts 3.x (responsive, minimal dark-surface analytics visualizations)
- **Icons & Motion**: `lucide-react`, `motion` (restrained compositor transitions)
- **Routing**: Zero-dependency History API URL-aware router (`src/lib/router.ts`) with reactive query-param highlighting
- **Backend API**: Node.js + Express (`server.ts` integrated with Vite middleware)
- **Database & ORM**: PostgreSQL (Cloud SQL) + Drizzle ORM (`drizzle-orm` + `pg`)
- **AI SDK**: `@google/genai` (server-side context-grounded structured JSON Gemini orchestration & approval-gated actions in Phases 10A–10C.3)
- **Validation**: Zod v4
- **Authentication**: Firebase Authentication (Google Sign-In + `firebase-admin` verification)

### Planned for Upcoming Subphases
- **THINK Phases 10D–10E**: Voice interaction (`10D`) and final polish (`10E`)
- **Testing**: Vitest + API/integration tests

---

## Local Development

```bash
# Install dependencies
npm install

# Start the development server on port 3000
npm run dev

# Typecheck
npm run lint

# Production bundle build
npm run build
```

---

## Documentation Index

All living engineering documents live in `docs/`:

- [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md) — Product vision, pillar specifications, MVP boundaries, and 12-phase roadmap
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Frontend/backend boundaries, module structure, URL routing, and target Express/Drizzle architecture
- [`docs/DATABASE.md`](docs/DATABASE.md) — Conceptual entity model, PostgreSQL + Drizzle ORM schema direction, timezone rules, and historical integrity invariants
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — Color tokens, typography scale, spacing rules, zero-pill metadata discipline, and reusable UI kit catalog
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Architecture Decision Records (ADRs) for locked vs. deferred technical choices
- [`docs/DEVELOPMENT_LOG.md`](docs/DEVELOPMENT_LOG.md) — Phase-by-phase build log, verification notes, and Git checkpoint workflow
