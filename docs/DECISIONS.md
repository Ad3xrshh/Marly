# Marly — Architectural Decisions Log (ADRs)

---

## ADR-001: Persistent Sidebar + Compact Top Utility Bar on Desktop
- **Date:** Phase 0 / Phase 1
- **Status:** Confirmed
- **Decision:** Use a persistent `240px` left sidebar for primary pillar navigation (`Home`, `Plan`, `Live`, `Think`, `Statistics`, `Settings`) combined with a `64px` top utility bar (`Page Title`, `Search`, `Quick Add`, `Demo Indicator`), collapsing to a drawer/rail on tablet and a fixed bottom bar on mobile.
- **Rationale:** Scales cleanly as **PLAN** and **LIVE** gain deep sub-views (Tasks, Calendar, Projects, Goals, Habit Calendar, Matrix, Heatmap, Fitness) without crowding a single horizontal top bar.

## ADR-002: Typography Pairing — Manrope + JetBrains Mono
- **Date:** Phase 0 / Phase 1
- **Status:** Confirmed
- **Decision:** Use `Manrope` for headings, navigation, and body text, paired with `JetBrains Mono` (`tabular-nums`) for all numeric counters, streaks, percentages, and timestamps.
- **Rationale:** `Manrope` gives Marly a warm, modern geometric tone that reads crisply on `#151515`/`#202020` dark surfaces, while `JetBrains Mono` guarantees vertical alignment in matrices, calendars, and progress ratios.

## ADR-003: Target Persistence Stack — PostgreSQL + Drizzle ORM
- **Date:** Phase 0 / Implemented Phases 3–8
- **Status:** Implemented (`users`, `tasks`, `calendar_events`, `goals`, `goal_milestones`, `projects`, `project_milestones`, `habits`, `habit_schedules`, `habit_logs`, `workout_sessions`, `routines`, `routine_steps`, and `routine_logs` active on Cloud SQL PostgreSQL)
- **Decision:** Use PostgreSQL (Cloud SQL) with Drizzle ORM (`drizzle-orm` + `pg` object-method pooling) for backend persistence across PLAN (Phases 3–5) and LIVE Habits, Visualizations, Fitness & Routines (Phases 6–8).
- **Rationale:** Marly's interconnected entities (tasks, calendar events, projects, goals, milestones, historical habit logs keyed by `(habit_id, local_date)`, workouts) benefit from strict relational constraints, `ON DELETE SET NULL` task preservation, and explicit SQL aggregations.

## ADR-004: Zero-Dependency URL-Aware Routing in Phase 1
- **Date:** Phase 1
- **Status:** Confirmed
- **Decision:** Implement a lightweight TypeScript History API router (`src/lib/router.ts`) supporting nested paths (`/plan/*`, `/live/*`, `/think`, `/statistics`, `/settings`) instead of introducing `react-router` immediately or using non-URL local tab state.
- **Rationale:** Gives users real browser Back/Forward navigation and shareable route paths without adding external routing overhead in Phase 1.

## ADR-005: Honest Demonstration Isolation
- **Date:** Phase 1 / Updated Phases 3–9
- **Status:** Confirmed
- **Decision:** Store unimplemented preview datasets in `src/data/` and wrap local preview toggles in `DemoStateContext` with visible `Demo Preview` indicators and a one-click reset action. Real Task CRUD (Phase 3), Calendar Event CRUD (Phase 4), Projects/Goals/Milestones CRUD (Phase 5), Habits, Schedules, Historical Logs, Monthly Calendar, Weekly Matrix, Yearly Heatmap & Authoritative Timezone Settings (Phases 6–7), LIVE Fitness & Routines (Phase 8), Unified Statistics (Phase 9), and THINK Conversations (Phase 10A) require Google Sign-In and never fall back to fake persistence when signed out.
- **Rationale:** Maintains developer and user trust while allowing tactile verification of remaining upcoming modules alongside real persisted PLAN, LIVE, STATISTICS, and THINK entities.

## ADR-006: Deferred Decisions (Intentionally Open)
- **Authentication Provider Configuration (Resolved in Phase 3):** Google Sign-In via Firebase Authentication (`signInWithPopup` + `firebase-admin` Bearer verification) is active for personal Task ownership.
- **Charting Library Adoption (Resolved in Phase 9):** Adopted `recharts@^3.0.0` (React 19 compatible) for Statistics trend visualizations (`PlanAnalyticsSection`, `LiveAnalyticsSection`) alongside Marly's minimal SVG `ProgressRing` and `ProgressBar` primitives.
- **Notification Delivery Mechanism:** Push/email/local notification strategy deferred until task and habit schedules exist in backend services.
- **THINK AI Action Execution & Context Grounding (In Progress across Phase 10A–10E):** 10A adopts server-side Gemini structured JSON outputs (`@google/genai`); 10B adds the 8-action PLAN/LIVE approval engine (`ADR-011`); 10C.1 implements backend cross-pillar context slices, intent selection, and token budgeting (`ADR-012`); 10C.2 integrates workspace context into Gemini with untrusted data boundaries and server-side grounding verification (`ADR-013`); frontend citation/context UI (`10C.3`), voice interaction (`10D`), and final polish (`10E`) remain scoped to subsequent subphases.

## ADR-007: Bounded Range Chunking & Shared Historical Habit Evaluator (Phase 7)
- **Date:** Phase 7
- **Status:** Implemented
- **Decision:** Centralize all historical habit-day status interpretation (`completed`, `partial`, `missed`, `pending`, `unscheduled`, `flexible_rest`, `unverified_prior_schedule`, `inactive`, `future`) in `src/lib/habitVisualizations.ts` (`evaluateHabitDayStatus`), back it with an interval-tracked `HabitsContext.ensureLogRangeLoaded` cache chunked to `<= 365` days per query, and preserve `habit_schedules.updatedAt` on non-schedule habit updates.
- **Rationale:** Ensures Monthly Habit Calendar, Weekly Habit Matrix, and Yearly Activity Heatmap cannot diverge in adherence math, respects the 400-day backend `/api/habit-logs` cap even on leap years or multi-year navigation, keeps `partial` measurable progress visually distinct from full completions, and avoids fabricating `missed` statuses for unlogged dates prior to an unversioned schedule modification.

## ADR-008: Lightweight Workouts, Independent Routines & Immutable Log Snapshots (Phase 8)
- **Date:** Phase 8
- **Status:** Implemented
- **Decision:** Model workouts as focused `workout_sessions` rows with server-computed weekly/30-day summaries (omitting nested exercise/set tables and calorie tracking), keep `routines`/`routine_steps`/`routine_logs` strictly decoupled from `habits`/`habit_logs`, store lightweight JSONB step snapshots (`steps_snapshot`, `completed_steps_snapshot`) on `routine_logs`, and require an explicit warning recommending Archive before permanent routine deletion.
- **Rationale:** Matches Marly's practical personal tracking focus without turning LIVE into a complex gym tracker, prevents routine executions from distorting habit streaks or heatmaps, ensures later step renames/reorders/deletions never rewrite past execution meaning, and protects users against accidental history loss.

## ADR-009: Server-Side Cross-Pillar Statistics, Denominator Integrity & Recharts 3.x (Phase 9)
- **Date:** Phase 9
- **Status:** Implemented
- **Decision:** Compute all cross-pillar analytics server-side via a single authenticated `GET /api/statistics` endpoint (`src/db/statistics.ts`) without creating dedicated statistics cache tables; adopt `recharts@^3.0.0` for React 19 compatible trend visualizations; gate `/statistics` behind Google Sign-In without demo fallbacks; track Task throughput (`completedAt` in window), Scheduled Follow-Through (current completion ratio of `dueDate` cohort, explicitly distinct from on-time completion), and Open Overdue snapshot separately; suppress period comparison deltas on partial calendar windows (`week`, `month`, `ytd`, future custom bounds) or zero prior denominators; evaluate `times_per_week` habits strictly on closed eligible weeks; keep `partial` habit progress distinct from full completions; reuse `computeProjectProgress` and `computeGoalProgress`; and evaluate routine step rates exclusively from `routine_logs` historical snapshots.
- **Rationale:** Guarantees deterministic metric parity across HOME, PLAN, LIVE, and STATISTICS, avoids sending raw multi-year logs to the browser, and prevents every common analytics distortion (partial-week penalties, zero-denominator deltas, unscheduled rest days counted as missed, or current routine edits rewriting past rates).

## ADR-010: Server-Side Structured Gemini Integration, DB-Backed Daily Quota & 10A Scope Boundary (Phase 10A)
- **Date:** Phase 10A
- **Status:** Implemented
- **Decision:** Upgrade `@google/genai` to `^3.6.1` and isolate all Gemini SDK usage on the Express server (`src/lib/gemini.ts`) using `process.env.GEMINI_API_KEY`, configurable `GEMINI_THINK_MODEL` (defaulting to `gemini-4-hydrogen`), and structured JSON outputs (`responseSchema` + `ThinkingLevel.MEDIUM`) validated via Zod rather than autonomous native function calling. Enforce rolling 24-hour message caps (`THINK_DAILY_MESSAGE_LIMIT`, default `40`) against PostgreSQL `ai_messages` (`role = 'assistant'`) with `pg_advisory_xact_lock`, paired with a lightweight per-process burst/single-flight guard (`src/lib/thinkRateLimit.ts`). Never fabricate simulated responses if Gemini fails, and defer PLAN/LIVE action execution, cross-pillar context assembly, and voice interaction to Subphases 10B–10D.
- **Rationale:** Keeps API keys and model selection strictly server-side, guarantees zero silent token consumption on failed upstream calls, preserves quota consistency across restarts and multi-instance deployments (while documenting that the lightweight in-memory burst guard is per-process), and keeps Subphase 10A independently verifiable before introducing action mutations in 10B.

## ADR-011: Whitelisted Approval-Gated Action Engine & Domain Logic Reuse (Phase 10B)
- **Date:** Phase 10B
- **Status:** Implemented
- **Decision:** Extend THINK structured outputs (`proposedActions`) across a strict 8-action whitelist (`create_task`, `update_task`, `create_calendar_event`, `create_project_milestone`, `create_goal_milestone`, `create_habit`, `create_routine`, `create_workout`) backed by `ai_action_records` (`payload` + `edited_payload` + `execution_result` + `error_message` + `executed_at`). Validate every candidate and user edit against the existing `src/validators/*` domain Zod schemas, claim `proposed`/`failed` -> `approved` atomically before invoking existing `src/db/*` domain services, discard invalid candidate proposals individually without failing the conversation reply, and strictly disallow deletions, historical log mutations, or unapproved writes.
- **Rationale:** Ensures AI proposals obey identical validation, timezone, and ownership invariants as manual UI forms without duplicating business logic, protects users against hallucinated entity IDs or accidental duplicate submissions, and preserves clear separation between AI suggestions (`payload`) and user revisions (`edited_payload`).

## ADR-012: Neutral Timezone Utility, Selective Context Slices & Conservative Token Budgeting (Phase 10C.1)
- **Date:** Phase 10C.1
- **Status:** Implemented (Backend Context Infrastructure Only; Gemini Integration Deferred to 10C.2)
- **Decision:** Extract general IANA timezone and DST-safe local-midnight helpers into `src/lib/timezone.ts` (re-exported by `src/lib/habitSchedule.ts` and shared by `src/db/statistics.ts` and `src/lib/thinkContext/`); organize THINK context assembly under `src/lib/thinkContext/` with deterministic keyword/`contextSource`/follow-up intent classification (`intentClassifier.ts`), parallel user-scoped domain loaders reusing existing progress/habit/workout/routine/statistics helpers (`slices/*`), control-char/bidi/tag sanitization and conservative JSON token estimation (`sanitize.ts`), priority-ordered multi-pass trimming (`DEFAULT_TOKEN_BUDGET = 4500`) with explicit truncation metadata (`assembleContext.ts`), and uncapped `listFullOwnedActionRefSets` (`src/db/thinkActions.ts`) so bounded context windows never reject valid owned 10B action targets.
- **Rationale:** Keeps timezone semantics consistent across PLAN, LIVE, STATISTICS, and THINK without cluttering `habitSchedule.ts`, avoids dumping entire multi-year tables or raw Recharts series into Gemini prompts, preserves honest domain behavior (`unverified_prior_schedule`, `times_per_week` non-daily percentages, exact calendar overlaps without invented free-slot claims, immutable `routine_logs` snapshots), and keeps `10C.1` independently testable before wiring into Gemini in `10C.2`.

## ADR-013: Untrusted Data Boundary, Slice Degradation & Server-Side Grounding Verification (Phase 10C.2)
- **Date:** Phase 10C.2
- **Status:** Implemented (Backend Grounding & Gemini Integration Complete; Frontend Citation UI Deferred to 10C.3)
- **Decision:** Keep Gemini's `systemInstruction` strictly static and free of user-authored text; serialize the bounded `packet` (and sanitized omitted `actionTargetSupplement`) inside a passive `<workspace_context_json>` block in the user turn with reserved delimiter tag neutralization (`src/lib/gemini.ts`); switch `assembleThinkContext` slice loading to `Promise.allSettled` so single-slice failures degrade transparently with `degradedDomains` while total slice failure aborts before calling Gemini or consuming quota; verify every Gemini `references` (max 8) and `evidence` (max 4) entry in `src/lib/thinkContext/verifyGrounding.ts` against packet/owned entities while overwriting labels and routes with server-canonical Marly paths (`buildCanonicalEntityRoute`); and persist grounded metadata inside `ai_messages.response_meta` JSONB without DDL changes (`10C.3` UI untouched).
- **Rationale:** Prevents indirect prompt injection from user task/habit/event titles into `systemInstruction`, guarantees Gemini can never fabricate foreign IDs, spoofed labels, or unsafe `javascript:`/`http:` navigation links, preserves turn availability during partial domain errors without hiding missing context, and decouples backend grounding verification from the upcoming 10C.3 frontend display enhancements.

