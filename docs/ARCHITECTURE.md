# Marly — System Architecture

## 1. Architectural Principles

1. **Frontend Is Not Business-Logic Authority:** In production phases (Phase 3+), the client handles presentation, local optimistic UI, input validation feedback, and routing. The Node.js/Express backend owns authentication verification, authorization, recurrence expansion, streak calculations, heatmap intensity math, goal progress aggregation, Gemini API orchestration, and usage quotas.
2. **Controlled AI Tooling (Phases 10A–10C.2):** Gemini never receives direct SQL access, API keys in browser code, or unrestricted mutation powers. Phase 10A establishes server-only structured JSON conversation turns and PostgreSQL persistence; Phase 10B adds approval-gated PLAN/LIVE action proposals; Phase 10C.1 adds the modular, user-scoped `src/lib/thinkContext/` context assembly and token-budgeting engine; Phase 10C.2 wires freshly assembled context packets into Gemini behind an untrusted-data boundary with server-side reference/evidence verification and canonical route rewriting.
3. **Incremental Module Separation:** Each pillar (`home`, `plan`, `live`, `think`, `statistics`, `settings`) lives in its own feature directory consuming shared UI primitives (`src/components/ui`) and layout chrome (`src/components/layout`), keeping files small, readable, and easy to migrate from isolated demo state to real API queries.

---

## 2. Current Environment & Runtime Baseline (Phase 0/1)

Verified during Phase 0 inspection:
- **Node.js**: `v22.23.2`
- **npm**: `10.9.8`
- **Git**: `2.34.1`
- **Frontend Runtime**: Vite `8.3.0` + React `19.0.1` + TypeScript `7.0.2` + Tailwind CSS `4.3.3`
- **Installed Full-Stack Dependencies Ready for Later Phases**: `express`, `dotenv`, `tsx`, `@google/genai`, `lucide-react`, `motion`
- **Preview Port**: `3000` (required by AI Studio runtime)

---

## 3. Phase 1 Frontend Architecture

```
src/
├── types/                  # Domain interfaces (navigation, demo tasks, habits, events, stats)
├── lib/                    # Zero-dependency History API URL router & utility helpers
├── data/                   # Isolated demonstration datasets (strictly non-persistent)
├── hooks/                  # Feature data-access boundary (useMarlyData.ts)
├── context/                # DemoStateContext (local toggle/reset) & ToastContext
├── components/
│   ├── ui/                 # Reusable Design System primitives (Button, Card, Input, Checkbox, etc.)
│   └── layout/             # AppShell, Sidebar, TopBar, MobileBottomNav, BrandMark, QuickAddDialog
└── features/
    ├── home/               # 3-column daily overview dashboard
    ├── plan/               # Tasks, Calendar, Projects & Goals visual previews
    ├── live/               # Streak Banner, Monthly Calendar, Weekly Matrix, Activity Heatmap, Fitness
    ├── think/              # Phase 10A authenticated THINK chat workspace & thread sidebar
    ├── statistics/         # Phase 9 cross-pillar analytics dashboard
    └── settings/           # Preferences & UI Kit state showcase
```

### URL-Aware Routing (`src/lib/router.ts`)
Rather than adding a heavy router dependency in Phase 1 or locking the app behind local `useState` tabs, Marly uses a lightweight History API router supporting clean paths:
- `/` — HOME
- `/plan`, `/plan/tasks`, `/plan/calendar`, `/plan/projects`, `/plan/goals` — PLAN (`/plan` normalizes to `/plan/tasks`)
- `/live`, `/live/habits`, `/live/calendar`, `/live/matrix`, `/live/heatmap`, `/live/fitness` — LIVE (`/live` normalizes to `/live/calendar`)
- `/think` — THINK
- `/statistics` — STATISTICS
- `/settings` — SETTINGS

Unknown routes display a recoverable route-not-found state, primary links use semantic `<a href>` navigation preserving modified-click new-tab behavior, and browser Back/Forward navigation works natively via `popstate`.

---

## 4. Target Full-Stack Architecture (Phases 3–12)

```
┌───────────────────────────┐       HTTPS / JSON        ┌────────────────────────────────┐
│   React + Vite Client     │ ─────────────────────────► │   Express API (server.ts)      │
│                           │                            │                                │
│ • Feature UI Modules      │                            │ • Auth Middleware (Firebase)   │
│ • Data Boundary Hooks     │                            │ • Zod Request Validators       │
│ • API Client Services     │                            │ • Controllers & Domain Svcs    │
└───────────────────────────┘                            │   ├── PlanService (Tasks/Cal)  │
                                                         │   ├── LiveService (Habits/Strk)│
                                                         │   ├── StatsService             │
                                                         │   └── ThinkService (Phase 10A) │
                                                         └───────────────┬────────────────┘
                                                                         │ Drizzle ORM
                                                                         ▼
                                                         ┌────────────────────────────────┐
                                                         │      PostgreSQL Database       │
                                                         │ • Strict user_id ownership     │
                                                         │ • Historical habit_logs        │
                                                         │ • Local-date vs UTC separation │
                                                         └────────────────────────────────┘
```

### Server Entry & Active Backend Structure (`server.ts`, Phases 3–10C.2)
`server.ts` boots Express on port `3000`, mounts `/api/health`, `/api/me` (persisted IANA timezone profile), `/api/tasks`, `/api/calendar-events`, `/api/projects`, `/api/goals`, `/api/habits` (including schedules and `/logs`), `/api/habit-logs`, `/api/workouts`, `/api/routines` (including ordered `/steps` and `/logs`), `/api/statistics` (`src/routes/statistics.ts` + `src/db/statistics.ts` + `src/validators/statisticsValidator.ts`), and `/api/think` (`src/routes/think.ts` + `src/db/think.ts` + `src/db/thinkActions.ts` + `src/lib/gemini.ts` + `src/lib/thinkRateLimit.ts` + `src/validators/thinkValidator.ts`) with Firebase ID token verification (`src/middleware/auth.ts`), Zod v4 validation (`src/validators/*`), Drizzle PostgreSQL repositories (`src/db/*`), shared deterministic progress (`src/lib/progress.ts`), shared timezone/DST-midnight utilities (`src/lib/timezone.ts`), shared habit schedule/streak utilities (`src/lib/habitSchedule.ts`), and the modular THINK context & grounding system (`src/lib/thinkContext/*`). It attaches `vite.middlewares` in development (`"dev": "tsx server.ts"`) and serves `dist/` with a catch-all SPA fallback in production (`"start": "node server.ts"`).

#### THINK Foundation, Action Engine & Grounded Context Intelligence (Subphases 10A–10C.2)
- **Server-Only Grounded Gemini Client (`src/lib/gemini.ts`):** Initializes a singleton `@google/genai` client strictly on the backend from `process.env.GEMINI_API_KEY` (with `User-Agent: aistudio-build`), uses configurable model selection via `GEMINI_THINK_MODEL` (defaulting to `gemini-4-hydrogen`), keeps `systemInstruction` strictly static and trusted (zero interpolated workspace strings or chat text), passes serialized `contextAssembly.packet` plus sanitized omitted `actionTargetSupplement` inside a passive `<workspace_context_json>` block in the user turn (neutralizing delimiter tags in both workspace strings and user prompt wrappers), requests structured JSON output (`responseMimeType: "application/json"` + `responseSchema` with `references`, `evidence`, `insufficientContext`, `uncertaintyNote`, and `proposedActions`), and classifies missing-key / auth / quota / upstream failures honestly without fabricating responses.
- **Approval-Gated Action Engine (`src/db/thinkActions.ts`, `src/validators/thinkValidator.ts`):** Enforces an explicit 8-action whitelist (`create_task`, `update_task`, `create_calendar_event`, `create_project_milestone`, `create_goal_milestone`, `create_habit`, `create_routine`, `create_workout`) with zero deletions or historical log mutations. Candidate proposals are individually validated against domain Zod schemas and full uncapped owned ID sets (`listFullOwnedActionRefSets`) before saving (`proposed` status in `ai_action_records`), discarding malformed proposals without failing the chat reply. Approvals (`POST /api/think/actions/:actionId/approve`) validate user edits (`editedPayload`) against authoritative domain schemas, atomically claim `proposed`/`failed` -> `approved` to block concurrent double-execution (`409 Conflict`), and execute strictly through existing `src/db/*` domain services (`createUserTask`, `updateUserTask`, `createUserCalendarEvent`, `createUserProjectMilestone`, `createUserGoalMilestone`, `createUserHabit`, `createUserRoutine`, `createUserWorkout`). Rejections (`POST /api/think/actions/:actionId/reject`) transition atomically to `rejected` with zero domain mutations.
- **Modular Cross-Pillar Context Assembly & Server Grounding Verification (`src/lib/thinkContext/`, Subphases 10C.1–10C.2):**
  - `src/lib/timezone.ts`: Dedicated neutral IANA timezone & DST-safe 2-pass local midnight helper shared by `habitSchedule.ts`, `statistics.ts`, and `thinkContext`.
  - `intentClassifier.ts` + `getLatestAssistantPreviousTurnMeta` (`src/db/think.ts`): Deterministic keyword + `contextSource` + prior-turn `responseMeta.context` follow-up classifier selecting from 6 intents (`scheduling_workload`, `tasks_projects_goals`, `habits_consistency`, `fitness_routines`, `broad_review`, `follow_up_continuity`), time-horizon statistics presets, and calendar windows.
  - `slices/{planSlice,liveSlice,statsSlice}.ts`: Strictly `userId`-scoped parallel loaders reusing `computeProjectProgress`, `computeGoalProgress`, `computeHabitStreakSummary`, `evaluateHabitDayStatus`, `getHabitLifecycleBounds`, `computeWorkoutSummary`, `isRoutineScheduledOnDate`, and `getUserStatisticsOverview` (stripping verbose Recharts trend arrays).
  - `sanitize.ts` & `assembleContext.ts`: Strips control characters, bidi overrides, and reserved prompt delimiter tags from user-authored fields; enforces bounded retrieval caps, priority-preserving multi-pass token budgeting (`DEFAULT_TOKEN_BUDGET = 4500`, `utf8_byte_and_lexical_json_conservative_v1`), `Promise.allSettled` partial-slice degradation tolerance (continuing with surviving slices while aborting before Gemini calls if all attempted slices fail), explicit truncation/degradation metadata, and a grounded entity catalog (`entityCatalog`).
  - `verifyGrounding.ts`: Independently verifies every Gemini `references` (max 8, deduplicated) and `evidence` (max 4) entry against entities present in `packet` and `ownedRefs`, strips foreign/nonexistent/domain-mismatched/degraded citations, overwrites `label`, `detail`, and `targetRoute` (`buildCanonicalEntityRoute` blocking arbitrary or `javascript:` URLs), and constructs authoritative `context` metadata (`mode: 'context_grounded'`, `windowLabel`, `domainsConsulted`, `truncatedDomains`, `degradedDomains`, `retrievedAt`) and bounded `uncertaintyNote`.
- **Bounded Conversation History & Persistence (`src/db/think.ts`, `src/routes/think.ts`):** All `/api/think/*` endpoints enforce `requireAuth` and `userId` ownership scoping. Requests send at most the latest 12 persisted messages (`MAX_GEMINI_HISTORY_MESSAGES`) to Gemini, and `PATCH /api/think/conversations/:id` allows per-thread `contextSource` focus updates (`general`, `home`, `plan`, `live`, `statistics`) without schema changes.
- **Rate Limiting & Usage Quotas (`src/lib/thinkRateLimit.ts`):** Combines a lightweight per-process in-memory burst/single-flight guard (resets on restart and is not shared across horizontal instances) with an authoritative rolling 24-hour quota (`THINK_DAILY_MESSAGE_LIMIT`, default `40`) enforced persistently against PostgreSQL `ai_messages` using `pg_advisory_xact_lock` per user during turn commit. Failed context assembly or failed Gemini calls never insert assistant rows or consume daily quota.
- **THINK Grounding UX & Reference Navigation (`src/features/think/utils/groundingUi.ts`, `src/lib/router.ts`, `src/lib/useHighlightTarget.ts`, Subphase 10C.3):** `ThinkPage` exposes per-thread `contextSource` selection and context-tailored empty states; `MessageList` sanitizes `references` against an explicit `/plan/*` + `/live/*` allowlist (`isSafeMarlyTargetRoute`), renders clickable entity links alongside collapsible `Context & Evidence` transparency and calm `insufficientContext` / `degraded` notices, and gracefully tolerates legacy 10A/10B messages without grounding metadata. `RouteState.search` + `useTemporaryEntityHighlight` resolve canonical entity query params (`?highlight=`, `?eventId=`, `?projectId=`, `?goalId=`, `?habitId=`, `?routineId=`, `?workoutId=`), auto-reveal filtered/archived items where applicable, smoothly scroll into view with a temporary highlight ring, and strip consumed query parameters cleanly.
- **Deferred Subphases (10D–10E):** Voice interaction (`10D`) and final hardening/polish (`10E`) remain deferred.

On the frontend, `HabitsContext` maintains an interval-cached range store over `/api/habit-logs` (`ensureLogRangeLoaded`, automatically chunking ranges into `<= 365`-day segments within the API's 400-day limit), `src/lib/habitVisualizations.ts` supplies the single shared `evaluateHabitDayStatus` evaluator consumed by `MonthlyHabitCalendar`, `WeeklyHabitMatrix`, `ActivityHeatmap`, and server-side Statistics (`src/db/statisticsHelpers.ts`), and `FitnessRoutinesContext` synchronizes persistent workout sessions, weekly/30-day summaries, and step-based routines with `LiveFitnessRoutinesView`. `StatisticsPage` (`src/features/statistics/`) consumes `useStatisticsData` -> `GET /api/statistics` and renders Recharts 3.x analytics strictly behind Google Sign-In. `ThinkPage` (`src/features/think/`) renders an authenticated, dark-first multi-thread workspace consuming `src/services/thinkApi.ts` with context-focus selection, grounded reference links, context/evidence disclosures, and inline editable `ActionProposalCard` workflows (`PlanActionEditor`, `LiveActionEditor`) that refresh affected PLAN/LIVE React contexts upon execution. Only the Home schedule timeline preview remains isolated on `DemoStateContext`.
