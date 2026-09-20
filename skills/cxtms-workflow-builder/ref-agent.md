# Agent Workflow YAML Reference

## Contents
- When to use `workflowType: Agent`
- Agent top-level structure and the full `agent:` property table
- Inputs: how they become the first message, and the tool schema seen by callers
- The built-in `set_result` tool and `agent.result`
- The `__session` override input
- Outputs: `result`, `transcript`, `sessionId`
- Triggers: synchronous execution and lock behavior for trigger-bound agents
- The `ai.default` organization config shape
- Tool name derivation (workflow name → tool name)
- AGT_001–AGT_009 validation codes and one-line fixes

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
| `session` | object | — | Session behavior. `additionalProperties: false`. |
| `session.type` | string, enum `task` \| `chat` | `task` | `task` ends when the agent calls `set_result`; `chat` is intended to be open-ended (no automatic end — keeps responding until the caller stops sending turns). **Current release:** `chat` still runs as a `task` session under the hood — it ends the same way `task` does (`set_result`, `maxTurns`, or `timeout`). Multi-turn chat semantics ship in a later release. |
| `session.maxTurns` | integer (`1`–`100`) | `20` | Maximum agent turns before the session is forced to end. |
| `session.timeout` | integer (`>= 1`) | `300` | Session timeout in seconds. |
| `result` | object (JSON Schema, `type` required and must be `object`) | — | The JSON Schema the `set_result` tool's argument must satisfy. Defines the shape of the `result` output. |
| `skills` | array of strings | — | Installed skill names to enable. Runtime support ships in a later release; safe to declare now. |
| `tools` | array of objects | — | Other workflows exposed to the agent as callable tools. |
| `tools[].workflow` | string (required, `minLength: 1`) | — | Workflow name or `workflowId` to expose as a tool. |
| `tools[].instructions` | string | — | When and how the agent should use this tool — folded into the tool's description for the model. |
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

Every Agent workflow gets a built-in `set_result` tool at runtime — you don't declare it under `tools`. Its argument schema is exactly `agent.result` (must be `type: object`). For a `task` session, calling `set_result` ends the session and populates the `result` output with the call's argument. `chat` sessions are intended to make `set_result` optional per turn and keep going until `session.maxTurns`/`session.timeout` or the caller stops — but see the current-release note on `session.type` above: every session today runs as a `task` session, so `set_result` ends it immediately regardless of `session.type`.

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
  "endpoint": "https://api.anthropic.com"
}
```

Set up this config once per organization (or per named config for `model.fromConfig` overrides); every Agent workflow that doesn't override `model.name`/`model.temperature` shares it.

## Tool Name Derivation (Workflow Name → Tool Name)

When a workflow is exposed as a tool (via another agent's `tools[].workflow`, or via `workflowType: McpTool`), its display name is converted into a tool name matching `^[a-zA-Z0-9_-]{1,64}$`:

- Runs of one or more characters outside `[a-zA-Z0-9_-]` (spaces, `/`, punctuation) collapse to a single `_`. E.g. `"MCP / Get Order Status"` → `MCP_Get_Order_Status`.
- If two workflows collapse to the same tool name, later collisions get a numeric suffix: the second occurrence becomes `_2`, the third `_3`, and so on.
- Keep workflow names short and distinguishable after this substitution if you're exposing several as tools to the same agent — two names that only differ by punctuation will collide and get suffixed, which is harder for the model to reason about than a small rename up front.

## Validation Codes (AGT_001–AGT_009)

These are backend validation codes; `cxtms` validates the same constraints client-side via `agent/agent.json` and `workflow.json` so you catch them before deploying.

| Code | Meaning | One-line fix |
|------|---------|---------------|
| `AGT_001` | `agent` section required | Add a top-level `agent:` section to the workflow. |
| `AGT_002` | `instructions` required | Add a non-empty `agent.instructions` string. |
| `AGT_003` | `executionMode` must be `Sync` | Set `workflow.executionMode: Sync`. |
| `AGT_004` | `activities` not allowed | Remove the `activities` property — Agent workflows can't have activities. |
| `AGT_005` | `session.type` must be `task` or `chat` | Set `agent.session.type` to `task` or `chat`. |
| `AGT_006` | `maxTurns` must be 1–100, `timeout` must be positive | Set `agent.session.maxTurns` to a value between 1 and 100, and `agent.session.timeout` to a positive number of seconds. |
| `AGT_007` | `tools[].workflow` required | Add `workflow` (name or `workflowId`) to every entry in `agent.tools[]`. |
| `AGT_008` | `result` must be a JSON Schema with `type: object` | Set `agent.result.type` to `object`. |
| `AGT_009` | `agents[]` needs exactly one of `agent`/`url`, and `modes` from `task`/`chat` | Give each `agent.agents[]` entry exactly one of `agent` or `url`, and only `task`/`chat` values in `modes`. |
