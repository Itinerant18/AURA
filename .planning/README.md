# AURA — `.planning/` Folder

This is the **single source of truth** for building the AURA MVP. It is written for a human architect/PM (you) who delegates implementation to AI coding agents (Cursor, Claude Code, Verdent, Codex — any of them, round-robin).

It is **not** code. Every file in this folder describes *what to build*, *in what order*, *with what acceptance criteria*. The AI agents read these files and produce the actual code.

---

## How to read these guides

| You are about to… | Open this |
|---|---|
| Onboard yourself to the plan | `00-mvp-scope-and-cuts.md`, then `20-phase-roadmap-8weeks.md` |
| Set up your machine + cloud accounts | `01-prerequisites-and-accounts.md` |
| Bootstrap a fresh GCP project | `02-gcp-bootstrap.md` |
| Initialize the monorepo skeleton | `03-repo-and-monorepo-bootstrap.md` |
| Build a specific microservice | `09-service-specs/<n>-<service>.md` |
| Wire up an external API (Meta, Gemini, Stripe…) | `11-external-integrations.md` |
| Deploy to GCP | `12-infrastructure-terraform.md` |
| Run a CI/CD pipeline | `13-ci-cd-pipeline.md` |
| Prompt an AI agent for a task | `18-ai-agent-playbook.md` |
| Check whether a phase is "done" | `19-phase-gate-checklists.md` |

---

## Source documents (do not edit from these guides)

- `DOSC/AURA_PRD.md` — product requirements (features, user flows, KPIs)
- `DOSC/AURA_Architecture_CodeStructure.md` — architecture, code structure, DB schema

Every guide in this folder references back to specific sections of these two documents. If a guide and the source documents conflict, **the source documents win** — open a question and update the guide.

---

## How to use these guides with AI agents

1. **Read the guide yourself first.** Understand the goal, prerequisites, and acceptance criteria.
2. **Pick the agent.** Round-robin across Cursor / Claude Code / Verdent / Codex based on availability and your comfort.
3. **Hand the agent the right context.** At minimum: the relevant guide file, the relevant PRD section, the relevant architecture section. See `18-ai-agent-playbook.md` for the exact context-handoff pattern.
4. **Use the AI Agent Prompt block** at the bottom of each guide as a starting prompt. Customize it.
5. **Verify against the Definition of Done** in `19-phase-gate-checklists.md` before moving to the next phase. **You are the phase gate.**

---

## Timeline at a glance

8 weeks total. See `20-phase-roadmap-8weeks.md` for the week-by-week plan.

| Week | Phase | Theme |
|---|---|---|
| 0 (prep) | Phase 0 | Accounts, keys, GCP project, repo bootstrap |
| 1 | Phase 1 | Data layer, shared packages, event bus, auth-service |
| 2 | Phase 2 | onboarding-service, sheets-service, frontend shell + onboarding UI |
| 3 | Phase 3 | audit-service, competitor-service (the "intelligence" half of the pipeline) |
| 4 | Phase 4 | strategy-service, content-service (the "generation" half) |
| 5 | Phase 5 | review-service, publish-service (IG + FB only) |
| 6 | Phase 6 | analytics-service, notification-service, billing-service, frontend polish |
| 7 | Phase 7 | End-to-end testing, staging deployment, security review |
| 8 | Phase 8 | Production cutover, first paying customer |

---

## Non-code folders this plan assumes will exist

In addition to `.planning/` and the code folders described in the architecture doc (`apps/`, `services/`, `packages/`, `infra/`), you will also need:

- `DOSC/` — the existing source-document folder (PRD, architecture)
- `docs/` — long-form developer documentation **produced during** the build (ADRs, API docs, runbooks). AI agents will create this.
- `.github/` — CI/CD workflow definitions
- `infra/terraform/`, `infra/k8s/`, `infra/docker/` — IaC and local-dev compose
- `scripts/` — one-off helper scripts (DB seed, key rotation, etc.)

See `21-other-folders-needed.md` for the full list with purpose, owner, and creation timing.

---

## Phase-gate discipline

This plan is built around phase gates. **Do not skip them.** Each phase has a checklist in `19-phase-gate-checklists.md`. Until every item is checked, the AI agents should not start the next phase. If something is blocking you, either:

1. Fix the blocker, or
2. Explicitly defer it with a written note in the phase-gate doc and a tracked TODO

Phase gates exist because microservices fail silently when contracts drift. The architecture has 12 services and 6 Pub/Sub events. If one service starts publishing the wrong event shape, the entire pipeline corrupts. Phase gates catch that.

---

## Edits welcome

These guides are living documents. As you discover gaps during the build, edit the relevant file. Keep `README.md` (this file) as the index — update the table above if you add new guides.
