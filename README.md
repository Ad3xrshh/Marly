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
| **Phase 7–8** | LIVE Monthly Calendar, Weekly Matrix, Activity Heatmap aggregations, Fitness & Routines | Upcoming |
| **Phase 9–10** | Unified Statistics, full integration testing & polish | Upcoming |
| **Phase 11–12** | THINK (Gemini tool-calling intelligence layer) & production deployment | Upcoming |

> **Current Persistence Boundary:**
> **Tasks** (HOME and PLAN → Tasks), **Calendar Events** (PLAN → Calendar), **Projects, Goals & Milestones** (PLAN → Projects, PLAN → Goals, and HOME Goal Progress), **Habits, Schedules & Completion Logs** (HOME Daily Habits and LIVE → Habits), and **User Timezone Preferences** (Settings) are backed by PostgreSQL + Drizzle ORM and scoped to your authenticated Google account. LIVE Calendar/Matrix/Heatmap/Fitness previews, Home schedule timeline preview, Statistics, and THINK previews continue using **isolated client-side demonstration data**.

---

## Technology Stack

### Active in Phases 3–6
- **Frontend**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) with custom semantic design tokens
- **Typography**: `Manrope` (UI & display) + `JetBrains Mono` (tabular metrics & time readouts)
- **Icons & Motion**: `lucide-react`, `motion` (restrained compositor transitions)
- **Routing**: Zero-dependency History API URL-aware router (`src/lib/router.ts`)
- **Backend API**: Node.js + Express (`server.ts` integrated with Vite middleware)
- **Database & ORM**: PostgreSQL (Cloud SQL) + Drizzle ORM (`drizzle-orm` + `pg`)
- **Validation**: Zod v4
- **Authentication**: Firebase Authentication (Google Sign-In + `firebase-admin` verification)

### Planned for Upcoming Phases
- **Charts**: Recharts (for unified Statistics)
- **AI Layer (Phase 11)**: `@google/genai` (Gemini API via backend-controlled tool execution)
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
