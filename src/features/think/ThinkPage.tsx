import React from 'react';
import { ArrowRight, BrainCircuit, Check, Lock, ShieldCheck, X } from 'lucide-react';
import { Badge, Card, PreviewNotice } from '../../components/ui';

const EXAMPLE_PROMPTS = [
  'Plan my day around three pending tasks and a 45-minute workout.',
  'Break my backend proficiency goal into four monthly milestones.',
  'Why did my Wednesday schedule slip over the last two weeks?',
];

const AI_MAY = [
  'Retrieve grounded context from PLAN tasks and LIVE habit logs',
  'Propose time-blocked daily schedules for your explicit approval',
  'Draft milestone roadmaps from a long-term goal you define',
  'Surface factual completion patterns across weeks and categories',
];

const AI_MUST_NOT = [
  'Invent or fabricate historical activity or streak numbers',
  'Silently overwrite your calendar without explicit confirmation',
  'Force unrequested habits into your tracker',
  'Alter historical habit logs without your direct action',
];

export function ThinkPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
              THINK · Personal Intelligence Layer
            </h2>
            <Badge tone="purple" icon={<Lock className="h-3 w-3" />}>
              Phase 11
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[#A3A3A8]">
            Context-grounded planning proposals and reflections, activated only after PLAN and LIVE are real.
          </p>
        </div>
      </div>

      <PreviewNotice
        accent="purple"
        title="AI Is Intentionally Disabled in Phase 1"
        phaseLabel="Phase 11 · Not Implemented"
        description="Per Marly's architecture principles, no Gemini API calls, chat stubs, or simulated AI responses exist in Phase 1. PLAN and LIVE work independently first; THINK arrives in Phase 11."
      />

      {/* Architecture Flow Preview */}
      <Card tone="think" padding="lg">
        <div className="flex items-center gap-2.5 pb-4">
          <BrainCircuit className="h-5 w-5 text-[#8C82E8]" />
          <h3 className="text-base font-semibold text-[#F2F2F2]">
            Controlled Tool-Execution Architecture
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            {
              step: '01',
              title: 'User Prompt',
              body: 'Ask for daily planning, goal breakdown, or weekly reflection.',
            },
            {
              step: '02',
              title: 'Grounded Context',
              body: 'Backend services read real tasks, calendar slots, goals, and habit schedules.',
            },
            {
              step: '03',
              title: 'Proposed Action Card',
              body: 'THINK returns a transparent diff or schedule proposal—nothing mutates yet.',
            },
            {
              step: '04',
              title: 'User Authorization',
              body: 'You approve, adjust, or reject before validated backend tools run.',
            },
          ].map((stage, idx) => (
            <div
              key={stage.step}
              className="relative rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-[#8C82E8]">
                  {stage.step}
                </span>
                {idx < 3 && <ArrowRight className="hidden h-3.5 w-3.5 text-[#737378] md:block" />}
              </div>
              <h4 className="mt-2 text-sm font-semibold text-[#F2F2F2]">{stage.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#A3A3A8]">{stage.body}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Boundaries & Example Workflows */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card tone="surface" padding="lg">
          <h3 className="text-sm font-semibold text-[#F2F2F2]">Future Prompt Examples</h3>
          <div className="mt-4 space-y-2.5">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <div
                key={prompt}
                className="rounded-xl border border-white/[0.06] bg-[#262626] p-3 text-xs leading-relaxed text-[#A3A3A8]"
              >
                "{prompt}"
              </div>
            ))}
          </div>
        </Card>

        <Card tone="surface" padding="lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#96D2C5]">
            <ShieldCheck className="h-4 w-4" />
            <span>What THINK May Do</span>
          </div>
          <ul className="mt-4 space-y-2.5 text-xs text-[#A3A3A8]">
            {AI_MAY.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#96D2C5]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card tone="surface" padding="lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#E06C75]">
            <X className="h-4 w-4" />
            <span>Strict Guardrails</span>
          </div>
          <ul className="mt-4 space-y-2.5 text-xs text-[#A3A3A8]">
            {AI_MUST_NOT.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E06C75]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
