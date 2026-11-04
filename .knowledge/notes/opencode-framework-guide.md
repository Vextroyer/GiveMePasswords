---
title: "Working with the OpenCode Opinionated Framework: A Practical Guide"
slug: opencode-framework-guide
date: 2026-11-03
type: guide
status: active
tags: [opencode, framework, agents, workflow, guide]
---

# Working with the OpenCode Opinionated Framework

*A practical booklet for people who already know how to use AI agents, but are new to this framework.*

---

## 1. What this framework actually is

OpenCode is the agent runtime. This **Opinionated Framework** is a layer of configuration on top of it: a set of agent definitions, slash commands, permissions, a sandbox, and a convention for where knowledge lives. It is not a new model and it is not magic. It is a way of forcing discipline onto the agent loop.

The central bet is simple:

> **An agent that is allowed to do everything at once will do the wrong thing confidently.**

So the framework splits work into **modes** with distinct mindsets and, crucially, distinct *tool permissions*. Analyze literally cannot edit your source files. Design literally cannot run experiments. Create is the only mode with full write access. The boundaries are enforced by the runtime, not just suggested in a prompt.

Three more ideas shape everything:

1. **Context before action.** Understand the problem before proposing a solution.
2. **Knowledge is an artifact, not a chat log.** Findings, plans, and reports are written to `.knowledge/` with YAML frontmatter so they survive the conversation and can be handed to another mode.
3. **Intelligent decisions over hooks.** There are no pre-commit hooks forcing a workflow. The agent explains its reasoning and you can override it. The framework trusts judgment, but makes the *right* path the path of least resistance.

If you have used agents before, the mental shift is this: **you are not prompting one assistant, you are routing work through a small team with hand-offs.** Your job is to put the right work in front of the right mode, and to keep the hand-off artifacts clean.

---

## 2. The map: four locations that matter

Everything in the framework revolves around four directories.

| Path | What it is | Who writes there |
|---|---|---|
| `.opencode/` | The framework runtime: agent definitions, commands, plugins, sandbox, skills. Treat it as read-only. | Framework authors |
| `.knowledge/` | Durable project memory: notes, research, plans, reports, logs. | Analyze, Design, Create |
| `.playground/` | Scratch space for experiments. Gitignored. Disposable. | Analyze, Create, subagents |
| your project files | The actual code and docs. | Create only |

Inside `.knowledge/`, the convention is:

```
.knowledge/
├── notes/      research output, audits, investigations, this guide
├── plans/      implementation plans from Design mode
├── drafts/     work-in-progress prose
└── log/        dated YAML logs of commits and releases
```

The framework also defines `docs/` as the place for finished project documentation (written by Create), and several commands reference `.knowledge/insights/` or `.knowledge/reports/`. See §11 for these inconsistencies before you go looking for a file that "should" exist.

The important habit: **when an agent learns something worth keeping, it should become a file in `.knowledge/`, not a paragraph that scrolls away.**

---

## 3. The three primary modes

Modes are the heart of the framework. You switch explicitly with a command, or the runtime default (`analyze`) applies. Each mode has a thinking style, a permission set, and a list of subagents it may call.

### Analyze — *understand*

- **Mindset:** exploratory, open-minded, critical, evidence-based, lean.
- **Purpose:** build a deep understanding of the current state. It is explicitly *not* supposed to make decisions or bias you toward a solution.
- **Can do:** read anything, search the web, run shell commands in the sandbox, write to `.knowledge/` and `.playground/`.
- **Cannot do:** modify project files.
- **Subagents:** `scout`, `investigator`, `critic`.
- **Typical asks:** "How does X work?", "Why does this fail?", "What are the options?", "Audit this module."

Analyze is where you should start almost every non-trivial task. It is cheap to explore and expensive to build the wrong thing.

### Design — *decide*

- **Mindset:** decisive, time-boxed, action-oriented, structured. The prompt explicitly says: decide in five minutes; if it takes longer you are over-planning.
- **Purpose:** turn understanding into a plan with phases, deliverables, risks, and success criteria.
- **Can do:** read project files, read `.knowledge/`, write plans and design docs to `.knowledge/`.
- **Cannot do:** modify project files; no experiments (`.playground/` is read-only here).
- **Subagents:** `investigator` only.
- **Typical asks:** "Should we…?", "Design the architecture for…", "Plan this feature."

Design is deliberately narrow. It produces a document, usually in `.knowledge/plans/`, and then hands off to Create.

### Create — *build*

- **Mindset:** action-biased, iterative, pragmatic. Working solution beats perfect design.
- **Purpose:** implement, test, commit, ship.
- **Can do:** everything — full read/write on project files, `.playground/`, `.knowledge/`, and the sandbox.
- **Subagents:** `tester`, `drafter`, `general`.
- **Golden rule from the prompt:** *no extended analysis in Create mode.* If it needs deep understanding, switch back to Analyze.

Create has a decision tree for freestyle requests: check for a plan in `.knowledge/plans/`; if found, follow it and track progress; if not, and the task is short, just do it; if it is large, suggest planning first. After three failed fix attempts it is supposed to stop and ask you, rather than thrash.

### The permission matrix

| Capability | Analyze | Design | Create |
|---|---|---|---|
| Project files | read-only | read-only | read/write |
| `.playground/` | read/write | read-only | read/write |
| `.knowledge/` | read/write | read/write | read/write |
| Shell | sandboxed | sandboxed, minimal | sandboxed, full |
| Subagents | scout, investigator, critic | investigator | tester, drafter, general |

This table is the best one-page summary of the framework. When you are confused about why an agent will not do something, check the matrix first.

---

## 4. Subagents: context compression, not autonomy

Subagents are launched by a primary agent through the `task` tool. They run in a **child session with fresh context**, do one focused job, and return a distilled result. They are how the framework keeps the main conversation from drowning in search results and file dumps.

Rules that apply to all of them:

- **No nesting** — a subagent cannot spawn another subagent.
- **About 60 seconds** — they are tuned for fast feedback, not deep dives that run forever.
- **Return to parent** — most write nothing to the project. They report; the parent synthesizes and commits.
- **Scratch writes only** — where they write at all, it is to `.playground/` or a designated `.knowledge/notes/` file.

| Subagent | Used by | What it does | Writes |
|---|---|---|---|
| `scout` | Analyze | Targeted web research on one angle; authoritative sources; depth over breadth. | A notes file it is pointed at |
| `investigator` | Analyze, Design | Answers "what does X do?", "where is Y?", "how does A relate to B?" using grep/glob/read. | Nothing; structured report |
| `critic` | Analyze (and `/draft`, `/review`) | Reviews prose and lists every issue in an assigned category. Does not propose fixes. | Nothing; structured report |
| `tester` | Create | Writes a minimal test to validate a hypothesis or reproduce a bug; reports pass/fail. | `.playground/tests/` |
| `drafter` | Create | Writes one section of content to a brief, matching surrounding style. | `.playground/drafts/` |
| `general` | Create | Long-running coding task in the background. | Working tree (parent commits) |

Two practical consequences:

1. **Be specific when a subagent is dispatched.** "Research Postgres vs SQLite" is too broad for a 60-second scout. "Find the current recommended way to do row-level security in Postgres 17, official docs only" is right-sized.
2. **Do not expect subagents to remember the conversation.** They start fresh. The parent is responsible for passing topic, angle, context, and the path to any note they should read.

---

## 5. Commands: workflow macros

Commands are markdown files in `.opencode/commands/`. Each one pins an agent, sometimes a subagent list, and a multi-phase workflow. They are the "disciplined" path; freestyle natural language is the "conversational" path. Both work, but commands add constraints.

### Mode entry

| Command | Switches to | What it does |
|---|---|---|
| `/analyze` | Analyze | Restates the read-only rules and asks what needs understanding. |
| `/design` | Design | Restates the planning rules and asks for the problem, decisions, and phases. |
| `/create` | Create | Restates the write rules and asks what to build; checks for a plan. |

### Analyze-mode commands

| Command | Purpose |
|---|---|
| `/research [topic]` | Deep research. Builds a research plan with you, creates one note per question, launches parallel scouts, iterates, then synthesizes a report in `.knowledge/notes/`. |
| `/audit [scope]` | Architecture, code quality, standards, and technical-debt audit. Read-only. Writes a report. |
| `/investigate [problem]` | Scientific root-cause analysis: define the problem, gather context, form hypotheses, test them, write an RCA. Explicitly does **not** fix anything. |
| `/onboard` | Orients you to the project: purpose, structure, stack, how to run/test, current state, first steps. |
| `/note` | Turns the current conversation into a structured note with YAML frontmatter. Asks for approval before saving. |
| `/todo` | Lists and categorizes open GitHub issues (blocking / active / next / backlog). Read-only. |
| `/help` | Explains the framework. With an argument, reads the relevant `.opencode` definition and explains it in detail. |

### Design-mode commands

| Command | Purpose |
|---|---|
| `/plan [description]` | Produces a phased implementation plan (max five phases) in `.knowledge/plans/`, with goals, deliverables, done criteria, risks, and a seven-day expiry. |
| `/scaffold [template]` | Generates a project skeleton from an opinionated template and creates an initial setup plan. |

### Create-mode commands

| Command | Purpose |
|---|---|
| `/build [feature]` | Test-Commit-Revert implementation. **Refuses to run without a plan.** For each step: write a failing test, commit it, implement, verify, commit; if it fails once, quick fix; fail again, revert. |
| `/fix [bug]` | Regression-test-first bug fix: locate, reproduce, minimal fix, full suite, commit. |
| `/draft [brief]` | Parallel section drafting with `drafter`, then `critic` review, then refinement. |
| `/commit [message]` | Validate with `make test`, show staged files, commit in conventional format, update the knowledge log. |
| `/publish [version]` | Pre-flight checks, changelog, version bump, tag, deploy, push. |

### Utility and infrastructure

| Command | Purpose |
|---|---|
| `/review` | A **literate command**: interactively picks a file and a review kind (structure → content → style → general), loads the `editor` skill, launches parallel critics, and writes `<file>.review.<kind>.md` next to the file. |
| `/sandbox` | A **literate command**: detects the project's real toolchain, regenerates `.opencode/sandbox/<project>.dockerfile`, and builds the sandbox image. |

A useful distinction: a normal command is a prompt template with phases. A **literate command** (`literate: true`) is a small state machine: steps separated by `---`, YAML config blocks, `parse` to collect variables, `next` for conditional routing, `stop` to end, and fenced code with `{exec}` to run scripts. `/review` and `/sandbox` are the two examples in this repo. You can write your own by following `.opencode/skills/literate-commands/SKILL.md`.

---

## 6. The knowledge system

`.knowledge/` is the framework's long-term memory. Every file is supposed to carry YAML frontmatter:

```yaml
---
id: kebab-case-identifier
created: YYYY-MM-DD
modified: YYYY-MM-DD
type: research | audit | investigation | plan | design | log | guide
status: active | stale | archived
# optional
issue: 42
plan: plan-id
sources: [...]
tags: [...]
---
```

Why it matters in practice:

- **Hand-off.** Design reads Analyze's notes; Create reads Design's plan. The frontmatter is what makes those artifacts legible to the next agent.
- **Staleness.** Plans carry `expires` (typically seven days). An expired plan should be re-examined, not blindly executed.
- **Traceability.** Research notes cite sources; audits cite files; investigations cite evidence. The framework's first universal mandate is *evidence-based*.

A simple discipline that pays off: **read the relevant `.knowledge/` files before asking an agent to act.** If a plan exists, say "follow `.knowledge/plans/foo.md`" instead of re-describing the work. You will get more consistent behavior and waste fewer tokens.

---

## 7. The sandbox: what happens when an agent runs a shell command

The sandbox is a Docker container, and a plugin intercepts every `bash` call. Safe read-only commands (`ls`, `grep`, `find`, `cat`, `pwd`, `git status/log/diff/show`, etc.) run on the host for speed. Everything else — Python, Node, Cargo, `make`, installers, builds — is routed through `.opencode/sandbox/sandbox.sh`.

The mounts change by mode:

| Mode | Project | `.playground/` | `.knowledge/` |
|---|---|---|---|
| analyze | read-only | read/write | read/write |
| design | read-only | read-only | read/write |
| create | read/write | read/write | read/write |

The container runs with `--network host` and a 2 GB memory limit. If Docker is missing, or the project image has not been built, `sandbox.sh` prints a loud warning and **runs the command directly on the host without isolation**. That is convenient and dangerous. Run `/sandbox` early in a new project so you know which situation you are in.

Two practical rules:

- **Use relative paths.** Inside the container the project is at `/project` and the working directory is `/project`; absolute host paths are not mounted. The framework mandates relative paths rooted at the project base.
- **Remember the mount layout.** `.knowledge/` and `.playground/` are mounted at `/knowledge` and `/playground`, not under `/project`. Prefer the file tools for writing notes; use the sandbox for running code.

---

## 8. Four workflows to learn first

### A. Onboarding a codebase

```
/onboard
```

Then ask follow-ups in Analyze. When something is worth keeping:

```
/note
```

This gives you a project overview, a map of the architecture, and a durable note. Do this before any audit or feature work.

### B. Researching a decision

```
/research "self-hosted password manager architecture options"
```

Expect a research plan first — the command iterates with you until the questions are right. Then scouts run in parallel, and the parent synthesizes `.knowledge/notes/report-<slug>.md`. Read the report, not the raw scout notes, unless you need evidence.

### C. Feature: understand → plan → build

```
/analyze
> We need rate limiting on the login endpoint. What are the constraints?

/design
> /plan "rate limiting for login"

/create
> /build "rate limiting for login"
```

`/build` will look for the plan and refuse to proceed without one. That refusal is a feature, not a bug: it prevents the agent from improvising architecture while "implementing."

### D. Bug: investigate → fix

```
/investigate "login fails after password reset on mobile"
```

Analyze produces a root-cause report and stops. Then:

```
/create
> /fix "login fails after password reset on mobile"
```

`/fix` reproduces first, fixes minimally, and runs the full suite. The separation matters: the mode that understands the bug is not the mode that is allowed to change code.

### E. Writing: draft → review

```
/create
> /draft "architecture decision record for the password hashing choice"

/analyze
> /review
```

`/review` is interactive and literate: it asks for the file and the review kind, then dispatches parallel critics. Reviews are ordered structure → content → style, because line edits are wasted if the structure is wrong.

---

## 9. Prompting patterns that work well here

Because modes are enforced, the most useful thing you can do is **name the hand-off explicitly**.

Good patterns:

- **State the mode's job, not just the task.** "Analyze the auth flow and list the trust boundaries. Don't propose a fix yet." This plays to the mode's stated constraints.
- **Point at artifacts.** "Read `.knowledge/plans/rate-limiting.md` and implement phase 2." Agents are much more reliable when the plan is a file rather than a memory.
- **Ask for evidence.** "Cite the files and line ranges you relied on." The framework's first mandate expects this; asking for it makes it concrete.
- **Force a stop at the right boundary.** "Stop after the root cause. We'll switch to Create for the fix."
- **Right-size subagent work.** One question per scout; one hypothesis per tester; one section per drafter.
- **Use `/note` to consolidate.** If a conversation produced a decision, make it a file before moving on.

Anti-patterns:

- Asking Analyze to "just quickly fix" something. It will refuse to edit, or worse, you will fight the permissions.
- Asking Create to "figure out the architecture." It is biased to action and will start writing code.
- Skipping `/plan` and then wondering why `/build` refuses.
- Giving a subagent a vague brief and expecting it to infer the conversation.
- Letting a long research session end without a synthesized report.

---

## 10. A first-week learning path

| Day | Do this | What you should learn |
|---|---|---|
| 1 | `/onboard`, then ask three questions about the codebase, then `/note` | How Analyze reads and how knowledge artifacts are written |
| 2 | `/research` a real technical question | How the research plan, parallel scouts, and synthesis fit together |
| 3 | `/design` + `/plan` a small feature, read the plan file | What a good phased plan looks like and where it lives |
| 4 | `/create` + `/build` that plan | TCR discipline, and why `/build` demands a plan |
| 5 | `/investigate` a real or seeded bug, then `/fix` | The difference between understanding and changing |
| 6 | `/audit` a module; `/review` a document | How parallel critics and structured reports work |
| 7 | Write your own command or a literate command | How much of the framework is just markdown and YAML |

By the end of the week you will have used every primary mode, every subagent family, and the knowledge system. That is enough to operate the framework without thinking about it.

---

## 11. Rough edges worth knowing (honest notes)

No framework is perfectly self-consistent. These are the seams I found while reading the definitions; knowing them will save you confusion.

1. **Knowledge paths drift.** `AGENT.md` defines `.knowledge/notes/`, `plans/`, `design/`, `reports/`. But `/audit` writes to `.knowledge/notes/audits/`, `/investigate` writes to `.knowledge/insights/investigations/`, and `/onboard` writes to `.knowledge/insights/project-overview.md`. In this repo only `notes/`, `plans/`, `drafts/`, and `log/` exist. If a command's target directory does not exist, the agent may create it or improvise. Decide on a convention early and tell the agent.
2. **`/investigate` lists `tester`, but Analyze cannot call it.** The command frontmatter says `subagents: [investigator, tester]`, while Analyze's task permissions allow only `scout`, `investigator`, and `critic`. In practice, hypothesis testing via `tester` may be denied during `/investigate`. You can still reason and use the sandbox, or run the test yourself in Create.
3. **`make test` is assumed everywhere.** `/build`, `/fix`, `/commit`, and `/publish` all call `make test`. In a project without a Makefile, expect friction. Either add a `make test` target or tell the agent the real command.
4. **`/build` names a `general` subagent** that has no definition file in `.opencode/agents/`. It is likely a built-in OpenCode agent. If it is unavailable, `/build` falls back to doing the implementation itself.
5. **Version labels disagree.** `AGENT.md` says Framework Version 3.0; `CHANGELOG.md` tops out at v2.0.0. Do not rely on version numbers for behavior; read the definitions.
6. **The sandbox is best-effort.** Missing Docker or a missing image means commands silently run on the host after a warning. Verify with `/sandbox` before running anything destructive.
7. **`/help` without arguments is intentionally shallow.** It explains the framework from the prompt, without reading files. For detail, pass an argument, e.g. `/help investigator`.

None of these are blockers. They are the normal cost of a framework that is still evolving.

---

## 12. Cheat sheet

```
MODES
  Analyze  understand, research, audit, investigate   project: ro
  Design   plan, decide, architect                    project: ro, no experiments
  Create   implement, test, commit, ship              project: rw

SWITCH
  /analyze   /design   /create

KNOW
  .knowledge/notes/    research, audits, investigations, guides
  .knowledge/plans/    phased implementation plans
  .knowledge/drafts/   work-in-progress prose
  .knowledge/log/      commit and release logs
  .playground/         scratch, disposable

COMMANDS
  Analyze: /research  /audit  /investigate  /onboard  /note  /todo  /review  /help
  Design:  /plan  /scaffold
  Create:  /build  /fix  /draft  /commit  /publish  /sandbox

SUBAGENTS
  scout         web research (Analyze)
  investigator  codebase Q&A (Analyze, Design)
  critic        prose review (Analyze)
  tester        hypothesis tests (Create)
  drafter       section drafts (Create)
  general       long coding tasks (Create)

RULES OF THUMB
  Understand before deciding; decide before building.
  One mode, one mindset. Check the permission matrix when confused.
  If it matters later, write it to .knowledge/.
  Give subagents one question and fresh context.
  /build needs a plan. /fix needs a reproduction.
```

---

*Written 2026-11-03 against the framework definitions in `.opencode/` (AGENT.md, agents/, commands/, skills/, plugins/, sandbox/). When in doubt, read those files: the framework is, almost entirely, markdown and YAML.*
