# Agent Workflow YAML Reference

## Contents
- When to use `workflowType: Agent`
- Agent top-level structure and the full `agent:` property table
- Inputs: how they become the first message, and the tool schema seen by callers
- The built-in `set_result` tool and `agent.result`
- The `__session` override input
- Outputs: `result`, `transcript`, `sessionId`
- Sessions: how an agent is invoked — a workflow task vs. the Responses API chat
- Tool approval (`tools[].mode`)
- History compression
- Session ownership and live events
- Triggers: synchronous execution and lock behavior for trigger-bound agents
- The `ai.default` organization config shape
- Tool name derivation (workflow name → tool name)
- Best practices
- AGT_001–AGT_010 validation codes and one-line fixes

Agent workflows wrap an LLM agent that reasons over a system prompt, calls other workflows as tools, and returns a structured result. Use `workflowType: Agent` in the workflow section. Scaffold with `npx cxtms create workflow <name> --template agent`.

## When to Use `workflowType: Agent`

Use Agent when the task needs judgment calls over unstructured or ambiguous input — triage, summarization, exception handling, freeform Q&A — rather than a fixed sequence of steps. If the logic is deterministic (same inputs always produce the same steps), use a standard workflow (`activities`) instead. Agent workflows cannot have `activities`; all behavior comes from `instructions`, `tools`, `agents`, `mcp`, and the model's own reasoning.

## Top-Level Structure

```yaml
workflow:
  workflowId: "<uuid>"
  name: "Agent Workflow Name"
  workflowType: Agent                       # Required - identifies this as an Agent workflow
  executionMode: Sync                       # Required - Agent workflows must be Sync
  isActive: true

agent:                                      # Required (replaces activities)
  instructions: "..."                       # Required
  model: { ... }
  session: { ... }
  result: { ... }
  skills: [...]
  tools: [...]
  mcp: [...]
  agents: [...]

inputs: [...]                               # Becomes the agent's first message
# outputs: not needed — result/transcript/sessionId are fixed and always produced
```

## Agent Section — Property Reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `description` | string | — | What this agent does. Shown to callers and to other agents that may invoke it (e.g. as the tool description when this workflow is listed in another agent's `tools[]`). |
| `instructions` | string (required, `minLength: 1`) | — | System instructions. A Handlebars template evaluated over workflow variables and inputs, same as other template expressions in this schema. |
| `model` | object | — | Model selection. `additionalProperties: false`. |
| `model.fromConfig` | string | `ai.default` | Organization config name holding `provider`, `model`, `apiKey`, `endpoint`. |
| `model.name` | string | — | Overrides the config's model name for this workflow only. |
| `model.temperature` | number (`0`–`2`) | — | Sampling temperature. |
| `model.contextWindow` | integer (`>= 1`) | `256000` when unset | The model's context window in tokens, used to decide when history is compressed (see [History compression](#history-compression)). Set it when `model.name` overrides the config's model — the organization config's own `contextWindow` (if any) describes *its* model, not the override. Falls back to the resolved model config's window, then to the runtime default of 256,000 tokens. |
| `session` | object | — | Session behavior. `additionalProperties: false`. |
| `session.type` | string, enum `task` \| `chat` | `task` | Documentation only — **this field has no runtime effect.** The caller decides the actual session type: a workflow run (direct invocation, a trigger, another workflow calling this one as a tool) always runs a `task` session; a conversation held over the Responses API (`POST .../ai/responses`) always runs a `chat` session. See [Sessions](#sessions-how-an-agent-is-invoked). |
| `session.maxTurns` | integer (`1`–`100`) | `20` | Maximum agent turns before the session is forced to end. |
| `session.timeout` | integer (`>= 1`) | `300` | Session timeout in seconds. |
| `result` | object (JSON Schema, `type` required and must be `object`) | — | The JSON Schema the `set_result` tool's argument must satisfy. Defines the shape of the `result` output. |
| `skills` | array of strings | — | Installed skill names to enable. Runtime support ships in a later release; safe to declare now. |
| `tools` | array of objects | — | Other workflows exposed to the agent as callable tools. |
| `tools[].workflow` | string (required, `minLength: 1`) | — | Workflow name or `workflowId` to expose as a tool. |
| `tools[].instructions` | string | — | When and how the agent should use this tool — folded into the tool's description for the model. |
| `tools[].mode` | string, enum `auto` \| `approval` | `auto` | `auto` runs the tool as soon as the model calls it. `approval` pauses the call for a person to approve or decline — see [Tool approval](#tool-approval-toolsmode). |
| `mcp` | array of objects | — | Outbound MCP server connections. Runtime support ships in a later release. |
| `mcp[].fromConfig` | string (required) | — | Organization config name for the MCP connection. |
| `agents` | array of objects | — | Allow list of other agents this agent may invoke. Runtime support ships in a later release. |
| `agents[].agent` | string | — | Name of another Agent workflow in this organization. Exactly one of `agent`/`url` is required per entry. |
| `agents[].url` | string (`format: uri`) | — | Remote A2A agent card URL. Exactly one of `agent`/`url` is required per entry. |
| `agents[].modes` | array of strings, enum `task` \| `chat` | — | Which session modes this agent may be invoked in. |

## Inputs: First Message and Tool Schema

`inputs:` serves two roles for an Agent workflow:

1. **Direct invocation** — when the workflow is run directly (API, scheduler, another workflow via `Workflow/Execute@1`), the input values are rendered into the agent's first user-turn message, alongside anything referenced by `instructions`.
2. **Invocation as a tool** — when this workflow appears in another Agent workflow's `tools[]` (or `agents[]`), `inputs` (name, `type`, `props.required`, `props.description`) is converted into the JSON Schema tool-call signature the calling agent sees. Keep input `props.description` populated — it becomes the parameter description the calling model reads to decide how to fill the tool call.

## `set_result` and `agent.result`

A **task** session (a workflow run) gets a built-in `set_result` tool at runtime — you don't declare it under `tools`. Its argument schema is exactly `agent.result` (must be `type: object`). Calling `set_result` ends the session and populates the `result` output with the call's argument — this is how an agent invoked as a workflow (directly, by a trigger, or as another agent's tool) reports back. A **chat** session (a conversation held over the Responses API) is never given the `set_result` tool at all — write `agent.instructions`/`agent.result` for the task-session case; a chat-only agent doesn't need `agent.result` to be meaningful.

**Validation note:** at runtime, `set_result`'s argument is checked against `agent.result` by verifying only the top-level `required` array is satisfied — nested property types, formats, and other JSON Schema keywords in `agent.result` are not enforced when the tool is called. (`cxtms` still validates that `agent.result` itself is a well-formed JSON Schema with `type: object` at author time via `AGT_008`.)

## `__session` Override Input

Pass `__session` as an input (it does not need to be declared in `inputs:`) to override the agent's session limits for this one run. It is an optional object: `{ maxTurns, timeout }` (a `type` field is also accepted but not yet used by the runtime). `__session` is **not** a session id and does **not** resume or attach to a prior session — every run of an Agent workflow creates a brand-new session, whether or not `__session` is passed. Use it to tighten or relax `session.maxTurns`/`session.timeout` for a specific call site (e.g. a trigger-bound agent that needs a shorter timeout than the workflow's own `agent.session` default) without editing the workflow itself.

## Outputs

Outputs are **fixed** for Agent workflows — when the session completes via `set_result`, the engine always produces exactly these three, regardless of what (if anything) you declare under `outputs:`:

| Output | Description |
|--------|-------------|
| `result` | The argument the agent passed to `set_result`, matching `agent.result`'s schema. |
| `transcript` | The full turn-by-turn conversation log for the session (prompts, tool calls, tool results, model responses). |
| `sessionId` | The session identifier. |

If a `task` session ends **without** calling `set_result` — it hits `session.maxTurns`, `session.timeout`, or stops responding with tool calls after two nudges — the workflow **fails**: the engine raises an error naming the session id (e.g. `Agent session <sessionId> ended without a result: exhausted its turn budget (20)`), and there are **no** `result`/`transcript`/`sessionId` outputs in that case. Look up the `AgentSession` row by the session id in the error message to inspect the transcript of a failed run.

An `outputs:` section is **not required** for an Agent workflow — the scaffolded template omits it entirely, and `result`/`transcript`/`sessionId` are still produced when the session completes. The engine ignores `outputs:` for this workflow type: it does not consult it to decide what to produce. If you add an `outputs:` section anyway (e.g. to rename an output for a caller, or because a shared tool expects one), the normal `output.json` rule still applies — each entry still needs a `mapping` — but it has no effect on which outputs the Agent runtime actually populates.

## Sessions: How an Agent Is Invoked

The same `agent:` YAML backs two different ways of running an agent, and the caller — not `agent.session.type` — decides which one you get:

| | **Task session** | **Chat session** |
|---|---|---|
| Started by | A workflow run: direct invocation, a trigger, `Workflow/Execute@1`, or another agent's `tools[]`/`agents[]` | A conversation held over the OpenAI-Responses-compatible API (`POST /api/organizations/{id}/ai/responses`, or the public-api equivalent) |
| `set_result` tool | Registered; calling it ends the session and produces `result`/`transcript`/`sessionId` (see [Outputs](#outputs)) | Not registered at all |
| Ends when | `set_result` is called, or `session.maxTurns`/`session.timeout` is hit | The client stops sending turns, or `session.maxTurns`/`session.timeout` is hit — there is no `set_result` to end it early |
| Approval tools | Refused outright — see [Tool approval](#tool-approval-toolsmode) | Pause the conversation for a person to decide |
| Owner default | `Organization` (no person is present to default to) | `User` — the session's starter |

One agent workflow can be used both ways — e.g. an internal trigger runs it as a `task` to make an automated decision, while a support UI holds a `chat` conversation with the same agent. Design `instructions`/`tools`/`result` with whichever mode(s) you intend to use it in.

The Responses API, streaming, conversation resume (`previous_response_id`), and GraphQL session/transcript queries are documented in `docs/agent-api.md` in `tms-backend-api` (client/UI-facing) and `docs/agent-testing.md` (testing recipes, including a curl walkthrough of both session types) — this skill only covers the workflow YAML.

## Tool Approval (`tools[].mode`)

Mark a tool `mode: approval` when the model calling it unattended is a risk you don't want to take — cancelling a shipment, sending an external message, charging a card, anything destructive or hard to undo. `mode: auto` (the default) runs the tool the instant the model calls it; `mode: approval` never does, without a person's decision:

```yaml
tools:
  - workflow: "Orders / Get Status"        # auto (default): runs immediately
  - workflow: "Orders / Cancel Shipment"
    mode: approval                          # waits for a person
```

**In a chat session:** the model calls the tool, the conversation pauses with an `mcp_approval_request` output item, and the session status becomes `AwaitingApproval`. A person (anyone who can see the session, per its ownership scope) approves or declines by continuing the conversation with a decision instead of new text. On approval, the tool runs and the agent continues; on decline, the model is told the user declined (and why) and carries on without running it. Sending an ordinary chat message instead of a decision declines every pending request automatically. Full request/response shapes are in `docs/agent-api.md` §8 in `tms-backend-api`.

**In a task session** (no person is present to ask): an approval tool is **refused** the moment the model calls it — the agent is told it needs human approval for that call and continues reasoning from there (typically escalating via `set_result` rather than completing the original action). Don't rely on `mode: approval` to gate a tool inside a task-only agent; a task session can never satisfy it. If an agent needs to run in both modes, write its `instructions` to handle the "this needs a person" outcome explicitly (see `AGT_010` below for the schema-level check on `mode`'s value; there is no schema check for whether an agent using `mode: approval` will ever run as a chat).

## History Compression

Each chat turn adds to a growing conversation history, bounded by the model's context window. When the previous call's reported input-plus-output tokens reach **80% of `model.contextWindow`** (or the 256,000-token default — see the `model.contextWindow` row above), the runtime summarizes the older messages into a single `summary` transcript entry before the next turn, and the turn proceeds on the shorter history. This is automatic — nothing in `agent:` YAML opts in or out of it.

- The summary call is given at most half of the session's remaining time budget; if it fails or runs out, the turn just proceeds on the full, uncompressed history instead of failing the turn.
- A provider that reports no token usage never triggers compression (there's nothing to measure against the window).
- On the client side, the internal Responses route announces a compression with a `response.tms.history_compressed` stream event; the transcript (GraphQL) always shows the `summary` message and a `usage` entry with `kind: "summary"`, on both routes.
- If an agent frequently needs long conversations against a small model, either raise `model.contextWindow` to match the model actually in use (see the property table above) or keep `agent.instructions` terse so more of the window is available for turns.

## Session Ownership and Live Events

Every agent session (task or chat) has an owner scope — `User`, `Division`, or `Organization` — that governs who may see it, continue it, decide its approvals, and watch it live. A chat session defaults to `User` (its starter); a task session defaults to `Organization` (it has no starter). Ownership can be changed afterward (e.g. shared with a division) via a GraphQL mutation, and every session change publishes a live event.

A GraphQL subscription, `onAgentSessionEvent(organizationId, agentSessionId?, workflowId?)`, delivers coarse events (`StatusChanged`, `ApprovalRequested`, `ToolCallCompleted`, `HistoryCompressed`, `OwnerChanged`) for every session the caller may see — useful for an approvals inbox or a monitoring view that shouldn't poll. None of this is configured in `agent:` YAML; it's a property of every session the runtime creates. Full details, the subscription shape, and delivery guarantees are in `docs/agent-api.md` §§11–12 in `tms-backend-api`.

## Triggers

An Agent workflow can carry a `triggers:` entry (e.g. `type: Entity`) just like a standard workflow. When it fires, the agent session runs **synchronously inside the saving request** — the request that added/modified/deleted the triggering entity waits for the full agent session (potentially several model round-trips) before it can complete, for up to `session.timeout` (default 300s) — and it holds the workflow lock for that entity/organization for the whole duration.

For a trigger-bound agent, either:

- keep `session.timeout` short and `session.maxTurns` low, so a slow or looping agent can't stall the triggering request for long, or
- keep the trigger workflow itself lightweight (no `agent:` section) and have it invoke the Agent workflow asynchronously via `Workflow/Execute@1` with `executionMode: Async`, so the triggering request returns immediately and the agent runs out-of-band.

## The `ai.default` Organization Config

`model.fromConfig` (default `ai.default`) points at an organization config record shaped:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-5",
  "apiKey": "...",
  "endpoint": "https://api.anthropic.com",
  "contextWindow": 200000
}
```

Set up this config once per organization (or per named config for `model.fromConfig` overrides); every Agent workflow that doesn't override `model.name`/`model.temperature` shares it. The config's own `contextWindow` (if set) is the fallback used when the agent's YAML doesn't declare `model.contextWindow` — but only while the agent doesn't also override `model.name`; overriding the model name without also setting `agent.model.contextWindow` falls straight through to the runtime default of 256,000 tokens, since the config's window describes the config's model, not the override.

## Tool Name Derivation (Workflow Name → Tool Name)

When a workflow is exposed as a tool (via another agent's `tools[].workflow`, or via `workflowType: McpTool`), its display name is converted into a tool name matching `^[a-zA-Z0-9_-]{1,64}$`:

- Runs of one or more characters outside `[a-zA-Z0-9_-]` (spaces, `/`, punctuation) collapse to a single `_`. E.g. `"MCP / Get Order Status"` → `MCP_Get_Order_Status`.
- If two workflows collapse to the same tool name, later collisions get a numeric suffix: the second occurrence becomes `_2`, the third `_3`, and so on.
- Keep workflow names short and distinguishable after this substitution if you're exposing several as tools to the same agent — two names that only differ by punctuation will collide and get suffixed, which is harder for the model to reason about than a small rename up front.

## Best Practices

- **Put side-effecting tools under `mode: approval` in chat agents.** Anything destructive, external-facing, or hard to undo (cancel, charge, send, delete) should pause for a person rather than run the instant the model decides to call it. Read-only or easily-reversible tools (status lookups, previews) can stay `auto`. See [Tool approval](#tool-approval-toolsmode).
- **Set `model.contextWindow` whenever you set `model.name`.** Otherwise a smaller model than the org default silently gets the 256K default window, and history compression won't kick in until it's already over budget (or a larger model gets compressed too eagerly). See the `model.contextWindow` row above.
- **Design `agent.result`/`agent.instructions` around whichever session type(s) the agent is actually used in.** A chat-only agent doesn't need `agent.result` (it has no `set_result` tool); a task-only agent should tell the model explicitly to call `set_result` exactly once (the scaffolded template's instructions already do this).
- **Keep trigger-bound agents fast**, or move them off the triggering request entirely (see [Triggers](#triggers)) — a slow agent session holds the entity's workflow lock for its whole duration.

## Validation Codes (AGT_001–AGT_010)

These are backend validation codes; `cxtms` validates the same constraints client-side via `agent/agent.json` and `workflow.json` so you catch them before deploying.

| Code | Meaning | One-line fix |
|------|---------|---------------|
| `AGT_001` | `agent` section required | Add a top-level `agent:` section to the workflow. |
| `AGT_002` | `instructions` required | Add a non-empty `agent.instructions` string. |
| `AGT_003` | `executionMode` must be `Sync` | Set `workflow.executionMode: Sync`. |
| `AGT_004` | `activities` not allowed | Remove the `activities` property — Agent workflows can't have activities. |
| `AGT_005` | `session.type` must be `task` or `chat` | Set `agent.session.type` to `task` or `chat`. |
| `AGT_006` | `maxTurns` must be 1–100, `timeout` must be positive, `model.contextWindow` must be positive | Set `agent.session.maxTurns` to a value between 1 and 100, `agent.session.timeout` to a positive number of seconds, and `agent.model.contextWindow` (if set) to a positive number of tokens. |
| `AGT_007` | `tools[].workflow` required | Add `workflow` (name or `workflowId`) to every entry in `agent.tools[]`. |
| `AGT_008` | `result` must be a JSON Schema with `type: object` | Set `agent.result.type` to `object`. |
| `AGT_009` | `agents[]` needs exactly one of `agent`/`url`, and `modes` from `task`/`chat` | Give each `agent.agents[]` entry exactly one of `agent` or `url`, and only `task`/`chat` values in `modes`. |
| `AGT_010` | `tools[].mode` must be `auto` or `approval` | Set `agent.tools[].mode` to `auto` or `approval` (or omit it — `auto` is the default). |
