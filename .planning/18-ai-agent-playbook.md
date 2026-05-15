# 18 — AI Agent Playbook

**Goal:** A reusable pattern for delegating engineering work to any of your AI coding agents (Cursor, Claude Code, Verdent, Codex). The playbook is agent-agnostic — the same brief works in all four.

---

## Mental model

You are the **architect/PM**. AI agents are **competent engineers** who:
- Have read no documentation other than what you put in front of them
- Have no memory of past conversations (unless the agent supports persistent memory and you've set it up)
- Will make assumptions when context is missing — sometimes good, sometimes wrong
- Are faster than you at typing, slower than you at judging tradeoffs
- Are best when given crisp deliverables, not vague tasks

Your job: turn each `.planning/` guide into a focused brief, hand it to the right agent, and verify the output.

---

## The standard task brief

Every task you hand to an agent has this structure:

```
ROLE
   You are a senior engineer building <service / feature> for AURA.

CONTEXT (in priority order)
   - .planning/<guide-file>.md  (the most relevant guide)
   - DOSC/AURA_PRD.md §<section>
   - DOSC/AURA_Architecture_CodeStructure.md §<section>
   - .planning/<related-guides>

GOAL
   <one or two sentences>

DELIVERABLES (numbered, in order)
   1. <thing 1>
   2. <thing 2>
   ...

CONSTRAINTS
   - <what NOT to do>
   - <coding standards>
   - <performance/security bars>

EXIT CRITERIA
   - <test passes>
   - <PR opened with title "<convention>: <summary>">

ASK BEFORE STARTING
   <questions the agent should answer back to you>

STOP IF
   - <conditions where the agent should pause and check>
```

Every service spec in `09-service-specs/` ends with this exact template, ready to paste.

---

## Phase-gate discipline

Each phase has a Definition of Done in `19-phase-gate-checklists.md`. **Never start phase N+1 until phase N is fully checked.**

Why this matters: 12 services × 6 events. Drift between services compounds. A skipped phase gate at week 2 becomes a 3-day debug session at week 6.

---

## Context-handoff pattern

When handing a task to an agent for the first time, give it the minimum context to be correct:

1. **One guide** (the most specific one)
2. **One PRD section** (the feature the work implements)
3. **One architecture section** (the canonical structure)
4. **Cross-references** as bullet points — let the agent fetch if needed

Avoid dumping the entire `.planning/` folder into the chat. Agents have context windows. Most are best with 5–15k tokens of context, not 80k.

---

## Agent-specific tips

These notes are based on each agent's strengths today; they will change. Treat as starting points.

### Cursor (composer mode)
- Excellent for in-editor IDE work, refactors, multi-file edits
- Use the rules feature: drop a `.cursorrules` at the repo root that summarizes coding standards
- Strong at fixing TypeScript errors and writing tests with full IDE context
- Reliable for: frontend components, refactors, test additions

### Claude Code (CLI)
- Strong reasoning across many files
- Best for: architecture work, multi-service coordination, anything requiring reading many files before writing
- Use `/init` if you want a CLAUDE.md auto-generated
- Reliable for: complex backend logic, scoring algorithms, migration planning

### Verdent
- Good at: focused implementation, agent-driven test loops
- Best for: well-scoped service-internal work with clear acceptance criteria
- Reliable for: implementing a single service spec to spec

### Codex
- Good at: simple, well-defined coding tasks
- Best for: utility functions, boilerplate, repetitive component scaffolds
- Reliable for: adapter modules, fixture files, OpenAPI codegen scripts

### Round-robin guidance
Since you chose round-robin, here's a heuristic for which agent to grab when:
- Complex multi-file architecture work → Claude Code
- Frontend / IDE-heavy work → Cursor
- Single service following a tight spec → Verdent
- Repetitive scaffolding, fixtures, codegen → Codex

But you can use any for any task. The guides are written to work with all of them.

---

## How to verify agent output

Before merging anything:

1. **Read the diff.** Not the agent's summary — the actual diff.
2. **Run the tests locally.** Even if CI is green. Sometimes tests pass for the wrong reason.
3. **Run the feature in the browser** if it's frontend or has a UI surface.
4. **Spot-check security:** is there logging of secrets? hard-coded credentials? overly broad IAM?
5. **Check for over-engineering:** did the agent add a config system when a constant would do? did it introduce a new pattern when an existing one fits?

If anything is off, **don't fix it yourself first.** Ask the agent to fix it with specific feedback. This is how agents learn the codebase's conventions through the dialogue.

---

## Anti-patterns to avoid

### Don't:
- Ask "implement the whole MVP"
- Paste an entire guide and say "build this"
- Skip phase gates because something is urgent
- Trust the agent's "it works" — verify with tests + browser
- Let an agent invent new files outside the architecture's folder structure
- Accept tests that only mock — require at least one component test with real DB
- Approve PRs without reading the diff
- Merge agent-generated migrations without reading the SQL

### Do:
- Break each phase into individual service specs (already done — `09-service-specs/`)
- Hand the agent one service at a time
- Ask the agent to draft a plan first, then implement
- Require the agent to ASK questions back before starting
- Run local smoke tests after each PR
- Update the relevant `.planning/` guide if you learn something new
- Keep `MEMORY.md` (or equivalent agent memory) up to date with conventions you've established

---

## The "pause and check" rule

Tell every agent, in every brief:

> If you encounter any of these, STOP and ping me before continuing:
> - You'd need to modify shared packages (`packages/*`)
> - You'd need to add a dependency > 50 MB
> - You'd need to change a Pub/Sub event payload's shape
> - You'd need to drop a column or rename a table
> - You'd need to disable a security check or skip a test
> - You discover the spec is internally inconsistent

This is the single most valuable instruction. It catches mistakes early.

---

## When to start a fresh agent session

- After a major phase completes
- When the context is getting noisy with unrelated work
- When the agent has made the same mistake twice (start fresh, change the prompt)
- When switching from backend → frontend or vice versa
- After a long break (≥1 day) — context is stale

---

## When NOT to use an agent

Some things are better done by you directly:

- Cloud console clicks that aren't yet Terraformed (rare, but happens during bootstrap)
- Stripe dashboard configuration
- DNS provider configuration if not on Cloud DNS
- Meta App review submission text (it's policy compliance — write yourself)
- Privacy policy + ToS (lawyer or template, not an agent)
- Customer support replies (your brand voice, not an agent's)

---

## A daily rhythm that works

```
Morning (30 min)
  - Read overnight Sentry alerts
  - Check phase-gate checklist progress
  - Decide today's 2-3 tasks
  - Brief agents in parallel on each task

Mid-day (review #1)
  - Check agent outputs
  - Run tests + browser checks
  - Approve / send back with feedback
  - Brief next round of tasks

End of day (review #2)
  - Final reviews + merges
  - Update phase-gate checklist
  - Note any new questions for tomorrow
  - Update .planning/ guides if needed
```

Sustainable for 8 weeks. Crank up only when a phase gate is close.

---

## Skills the playbook doesn't cover

- Customer interviews — talk to 5 real SMB owners in week 1
- Pricing iteration — watch first customer behavior, adjust prices in week 4-6
- Demo videos — record a 90-second product walkthrough by week 6 for marketing
- Investor materials — separate stream, don't let it bleed into the build

---

## Definition of done

- [ ] Every agent session you start uses the standard task brief template
- [ ] Every PR you merge has been read, tested, and run by you
- [ ] Every phase gate is signed off before next phase starts
- [ ] You have a daily rhythm that doesn't burn you out
