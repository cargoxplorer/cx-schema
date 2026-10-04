# Agent Workflow YAML Reference

## Contents
- When to use `workflowType: Agent`
- Agent top-level structure and the full `agent:` property table
- Chat display metadata (`agent.ui`)
- Inputs: how they become the first message, and the tool schema seen by callers
- The built-in `set_result` tool and `agent.result`
- The `__session` override input
- Outputs: `result`, `transcript`, `sessionId`, `files`
- Sessions: how an agent is invoked — a workflow task vs. the Responses API chat
- Tool approval (`tools[].mode`) and the chat's Ask/Auto approval mode
- Built-in tools (`tools[].builtin`): `data.query`, `data.schema`, `data.type`, `file.create`
- Producing files: `file.create`, captured workflow-tool files, where they appear
- History compression
- Files in chat: what the model receives, and the model config's `supportsFiles` flag
- Session ownership and live events
- Triggers: synchronous execution and lock behavior for trigger-bound agents
- The `ai.default` organization config shape
- Tool name derivation (workflow name → tool name)
- Best practices
- AGT_001–AGT_015 validation codes and one-line fixes

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
  ui: { ... }                               # Optional - how the AI Assistant chat shows the agent
  model: { ... }
  session: { ... }
  result: { ... }
  skills: [...]
  tools: [...]
  mcp: [...]
  agents: [...]

inputs: [...]                               # Becomes the agent's first message
# outputs: not needed — result/transcript/sessionId/files are fixed and always produced
```

## Agent Section — Property Reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `description` | string | — | What this agent does. Shown to callers and to other agents that may invoke it (e.g. as the tool description when this workflow is listed in another agent's `tools[]`). |
| `instructions` | string (required, `minLength: 1`) | — | System instructions. A Handlebars template evaluated over workflow variables and inputs, same as other template expressions in this schema. |
| `ui` | object | — | Display metadata for the AI Assistant chat; no runtime effect. `additionalProperties: false`. See [Chat display metadata](#chat-display-metadata-agentui). |
| `ui.name` | string | workflow name | Display name. |
| `ui.shortDescription` | string | — | One line under the name. |
| `ui.icon` | string | `robot` | Tabler icon name without the `tabler-` prefix (e.g. `map-pin`). |
| `ui.color` | string, enum `primary` \| `secondary` \| `info` \| `success` \| `warning` \| `error` | `primary` | Theme palette color of the agent's icon. Case-sensitive. |
| `ui.prompts` | array of strings (`maxItems: 5`) | — | Suggested prompts on an empty chat. |
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
| `tools` | array of objects | — | Tools the agent may call: other workflows (`workflow`) or built-in data tools (`builtin`). Each entry has exactly one of the two. |
| `tools[].workflow` | string (`minLength: 1`) | — | Workflow name or `workflowId` to expose as a tool. Exactly one of `workflow`/`builtin` per entry. |
| `tools[].builtin` | string, enum `data.query` \| `data.schema` \| `data.type` \| `file.create` | — | A built-in tool: the three read-only data tools, or `file.create`, which creates a PDF, Word, Excel or CSV file the user can download — see [Built-in tools](#built-in-tools-toolsbuiltin). Exactly one of `workflow`/`builtin` per entry. |
| `tools[].instructions` | string | — | When and how the agent should use this tool — folded into the tool's description for the model. |
| `tools[].mode` | string, enum `auto` \| `approval` \| `always` | `auto` | `auto` runs the tool as soon as the model calls it. `approval` pauses the call for a person unless the chat is in Auto mode. `always` pauses for a person in every chat — see [Tool approval](#tool-approval-toolsmode). |
| `mcp` | array of objects | — | Outbound MCP server connections. Runtime support ships in a later release. |
| `mcp[].fromConfig` | string (required) | — | Organization config name for the MCP connection. |
| `agents` | array of objects | — | Allow list of other agents this agent may invoke. Runtime support ships in a later release. |
| `agents[].agent` | string | — | Name of another Agent workflow in this organization. Exactly one of `agent`/`url` is required per entry. |
| `agents[].url` | string (`format: uri`) | — | Remote A2A agent card URL. Exactly one of `agent`/`url` is required per entry. |
| `agents[].modes` | array of strings, enum `task` \| `chat` | — | Which session modes this agent may be invoked in. |

## Chat Display Metadata (`agent.ui`)

The AI Assistant lists an organization's agents from `GET .../ai/models`, which includes each agent's
`agent.description` and `agent.ui`. Set `ui` on any agent people will chat with:

```yaml
agent:
  description: Looks up shipment status, ETAs and exceptions across carriers.
  ui:
    name: Tracking Agent                  # optional; defaults to the workflow name
    shortDescription: Status, ETAs, exceptions, POD
    icon: map-pin                         # Tabler icon name without prefix
    color: info                           # primary | secondary | info | success | warning | error
    prompts:                              # at most 5
      - Which shipments are delayed today?
      - What is the ETA for order ORD-1?
```

Keep `shortDescription` to a few words and write `prompts` as questions a user would actually type —
each is sent as-is when clicked.

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

Outputs are **fixed** for Agent workflows — when the session completes via `set_result`, the engine always produces exactly these four, regardless of what (if anything) you declare under `outputs:`:

| Output | Description |
|--------|-------------|
| `result` | The argument the agent passed to `set_result`, matching `agent.result`'s schema. |
| `transcript` | The full turn-by-turn conversation log for the session (prompts, tool calls, tool results, model responses). |
| `sessionId` | The session identifier. |
| `files` | Every file the session produced (`file.create`, or a captured workflow-tool file — see [Producing files](#producing-files)), each `{ attachmentId, fileName, contentType, size, url }`. `url` is presigned for 24 hours, or `null` if signing it failed (logged; the task still completes). `[]`, not omitted, when nothing was produced. |

If a `task` session ends **without** calling `set_result` — it hits `session.maxTurns`, `session.timeout`, or stops responding with tool calls after two nudges — the workflow **fails**: the engine raises an error naming the session id (e.g. `Agent session <sessionId> ended without a result: exhausted its turn budget (20)`), and there are **no** `result`/`transcript`/`sessionId`/`files` outputs in that case. Look up the `AgentSession` row by the session id in the error message to inspect the transcript of a failed run.

An `outputs:` section is **not required** for an Agent workflow — the scaffolded template omits it entirely, and `result`/`transcript`/`sessionId`/`files` are still produced when the session completes. The engine ignores `outputs:` for this workflow type: it does not consult it to decide what to produce. If you add an `outputs:` section anyway (e.g. to rename an output for a caller, or because a shared tool expects one), the normal `output.json` rule still applies — each entry still needs a `mapping` — but it has no effect on which outputs the Agent runtime actually populates.

## Sessions: How an Agent Is Invoked

The same `agent:` YAML backs two different ways of running an agent, and the caller — not `agent.session.type` — decides which one you get:

| | **Task session** | **Chat session** |
|---|---|---|
| Started by | A workflow run: direct invocation, a trigger, `Workflow/Execute@1`, or another agent's `tools[]`/`agents[]` | A conversation held over the OpenAI-Responses-compatible API (`POST /api/organizations/{id}/ai/responses`, or the public-api equivalent) |
| `set_result` tool | Registered; calling it ends the session and produces `result`/`transcript`/`sessionId`/`files` (see [Outputs](#outputs)) | Not registered at all |
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
    mode: approval                          # waits for a person, unless the chat is in Auto mode
  - workflow: "Invoices / Void"
    mode: always                            # waits for a person in every chat
```

**In a chat session:** the model calls the tool, the conversation pauses with an `mcp_approval_request` output item, and the session status becomes `AwaitingApproval`. A person (anyone who can see the session, per its ownership scope) approves or declines by continuing the conversation with a decision instead of new text. On approval, the tool runs and the agent continues; on decline, the model is told the user declined (and why) and carries on without running it. Sending an ordinary chat message instead of a decision declines every pending request automatically. Full request/response shapes are in `docs/agent-api.md` §8 in `tms-backend-api`.

**Approval mode (Ask / Auto):** each chat has an approval mode the user picks in the chat UI (sent as
`metadata.approval_mode`). In `Ask` (the default) every `approval` and `always` call pauses. In `Auto`,
`approval` calls run without pausing and are recorded on the transcript as approved by
`auto:<userId>`; `always` calls still pause. Use `always` for the few actions that must never run
without an explicit click, whatever the user's mode — voiding an invoice, charging a card.

**In a task session** (no person is present to ask): an approval tool is **refused** the moment the model calls it — the agent is told it needs human approval for that call and continues reasoning from there (typically escalating via `set_result` rather than completing the original action). Don't rely on `mode: approval` to gate a tool inside a task-only agent; a task session can never satisfy it. If an agent needs to run in both modes, write its `instructions` to handle the "this needs a person" outcome explicitly (see `AGT_010` below for the schema-level check on `mode`'s value; there is no schema check for whether an agent using `mode: approval` will ever run as a chat).

## Built-in Tools (`tools[].builtin`)

Four built-in tools cover reading the organization's data and handing the user a file, without a workflow per
use case: three read-only data tools over GraphQL, and `file.create`, which writes a PDF, Word, Excel or CSV
file to the session.

```yaml
agent:
  instructions: |
    Answer questions about this organization's orders and shipments.
  tools:
    - builtin: data.schema
    - builtin: data.type
      instructions: "Look up field types before writing a query."
    - builtin: data.query
    - builtin: file.create
      instructions: "Use this to export results the user asks to download."
    - workflow: "Assistant / Cancel Shipment"   # changing data still goes through a workflow tool
      mode: approval
```

| `builtin` | Tool name the model sees | What it does |
|---|---|---|
| `data.query` | `data_query` | Runs one GraphQL **query** (`query`, optional `variables`, `operationName`) in the agent's organization and returns `{ data, errors? }`. |
| `data.schema` | `data_schema` | Lists query fields (`category: queries`, the default), types (`types`) or both (`all`), with an optional case-insensitive `filter`. Mutations are not listed. |
| `data.type` | `data_type` | Describes one type (`typeName`): fields, types, arguments, descriptions, enum values; an unknown name returns up to 5 suggestions. |
| `file.create` | `file_create` | Writes a file to the session: `markdown` renders to `pdf`/`docx`; `rows` or `query` renders to `xlsx`/`csv`. Returns `{ fileName, attachmentId, format, size, rows?, truncated? }` — never the file's content. See [`file.create`](#filecreate-toolsbuiltin-filecreate) below. |

Guards, enforced by the backend, on `data.query` (and on `file.create`'s `query` mode, which runs through the
same gateway): query operations only (mutations and subscriptions return `read_only` — change data with a
workflow tool, ideally `mode: approval`); every root Query field must declare `organizationId` and pass the
session's organization, except `currentUser`, `personalAccessToken`/`personalAccessTokens`, `hasUserSecret`
and introspection (`__schema`/`__type`/`__typename`) — anything else is refused as `organization_scope`
("Field {name} is not scoped to an organization and cannot be queried."), which fails closed for new
resolvers; `organizations` is refused too, even though it takes `organizationId` — its resolver ignores the
argument; `exportRates` (uploads an export file) and `uploadUrl` (issues a presigned upload URL) take
`organizationId` but have side effects, so they are refused as `read_only`, even in the session's organization
— use a workflow tool for them; `organizationConfig`, `organizationConfigs`, `contactPaymentMethod`,
`contactPaymentMethods`, `outboxMessages`, `deadLetterMessages` and `outboxStatus` hold secrets, payment data
or internal infrastructure data and are refused as `restricted` ("Field {name} holds sensitive data and cannot
be queried by agents."), whatever alias or fragment is used; inside `where:` filters, `organizationId` accepts
only `{ eq: <org> }` or `{ in: [<org>] }`; selection depth at most 12 (`depth_exceeded`; `__schema`/`__type`-only
queries are exempt); duplicate keys in `variables` are rejected as `syntax`; `data.query` results over 64 KB
are cut and marked `truncated` with a hint to page with `take`/`skip` (`file.create`'s `query` mode pages
itself instead — see below). The runner also tells the model which organization it is in whenever a data tool
is enabled.

`mode` and `instructions` work as for workflow tools. Built-ins run as the session user, so row-level security
applies. A workflow tool whose derived name would collide with `data_query`/`data_schema`/`data_type`/
`file_create` is suffixed (`data_query_2`).

### `file.create` (`tools[].builtin: file.create`)

Pass exactly one of `markdown` (renders to `pdf`/`docx`) or `rows`/`query` (renders to `xlsx`/`csv`):

```yaml
agent:
  tools:
    - builtin: file.create
      instructions: "Export query results to Excel when the user asks to download them."
```

| Argument | Type | Meaning |
|---|---|---|
| `format` | string, enum `pdf` \| `docx` \| `xlsx` \| `csv` | Required. |
| `fileName` | string | Required. The name without an extension — it is sanitized, and the extension comes from `format`. |
| `markdown` | string | For `pdf`/`docx`: the document body — a Markdown subset (pipe tables, autolinks, strikethrough/emphasis extras). |
| `title` | string | Optional, `pdf`/`docx`: the header title, at most 200 characters. Defaults to `fileName`. |
| `rows` | array of objects | For `xlsx`/`csv`: one object per row; its keys are the columns. |
| `query` | string | For `xlsx`/`csv`, instead of `rows`: a GraphQL query the server runs and pages through — same guards as `data.query` (read-only, organization-scoped, depth-limited). |
| `variables` | object | Optional, with `query`. May also arrive as a JSON string holding an object; blank or absent means no variables. |
| `itemsPath` | string | Required with `query`: the path to the list in the result, e.g. `orders.items`. |
| `columns` | array of `{ field, label? }` | Optional, `rows`/`query`: the column order and headings. `field` may be a dot path into a nested object (`orderStatus.orderStatusName`). Omit it to use every property found on the rows, in encounter order. |

**Rules:**

- Exactly one of `markdown`, `rows` or `query`, matching the format (`markdown` for `pdf`/`docx`; `rows` or
  `query` for `xlsx`/`csv`) — a mismatch is `invalid_arguments`.
- In `query` mode the query **must declare `$skip: Int` and `$take: Int`** and pass them to the list field —
  the server pages through the results itself (500 rows a page); a query missing either variable is
  `invalid_arguments`.
- Raw HTML in `markdown` is disabled and stays literal text (never executed or templated); images are
  replaced by their alt text, so rendering never fetches a remote URL.
- In `csv`, every string cell and column label starting with `=`, `+`, `-`, `@`, a tab or a carriage return is
  prefixed with `'`, so spreadsheet apps open it as text instead of running it as a formula. `xlsx` stores
  strings as text values, which never run as formulas, so they're written unchanged.

**Limits:**

| Limit | Value |
|---|---|
| `markdown` length | 200,000 characters (`too_large` past that) |
| `rows` entries | 50,000 (`too_large` past that; use `query` for a bigger export) |
| `query` row cap | 50,000 rows, or 64 MB of JSON read, whichever comes first — paging stops and the result's `truncated` is `true` rather than the call failing |
| `title` length | 200 characters |
| Rendered file size | 25 MB |

**Errors**, on top of the `data.query` guards when `query` is used:

| Case | Result |
|---|---|
| Unknown `format`, missing `fileName`, `title` over 200 characters, none or more than one of `markdown`/`rows`/`query`, `rows` not an array, `query` missing `itemsPath` or `$skip`/`$take`, `itemsPath` not pointing at a list | `{ "error": { "code": "invalid_arguments", "message": "…" } }` |
| `markdown` over 200,000 characters, `rows` over 50,000 entries, a `query` page over 8 MB even at 50 rows, or the rendered file over 25 MB | `{ "error": { "code": "too_large", "message": "…" } }` |
| Rendering the PDF/Word/spreadsheet threw | `{ "error": { "code": "render_failed", "message": "Could not create {fileName}." } }` |
| Saving the file threw, or the `query` itself failed | `{ "error": { "code": "failed", "message": "…" } }` |

A successful call returns `{ fileName, attachmentId, format, size, rows?, truncated? }` (`rows`/`truncated`
only for `xlsx`/`csv`). The file itself is never sent back to the model — tell the user it's attached rather
than repeating its contents as text. See [Producing files](#producing-files) for where the file ends up.

#### Barcodes

In `pdf` and `docx` documents, a Markdown image whose URL starts with `barcode:` is drawn as a barcode on the
server (nothing is fetched). It works in paragraphs, list items and table cells. Barcodes are not supported in
`xlsx`/`csv`.

```markdown
![ORD-1001](barcode:code128/ORD-1001)
![P-01](barcode:qr/P-01?width=1in)
![PLT-77](barcode:pdf417/PLT-77?width=3in&height=1in)
| Order | Label |
|---|---|
| ORD-1001 | ![ORD-1001](barcode:code128/ORD-1001?width=50mm&text=false) |
```

- **Address:** `barcode:<format>/<value>`, with the value URL-encoded. The alt text becomes the image's
  alternative text.
- **Formats** (case-insensitive; ZXing enum names such as `CODE_128` also work):
  - linear: `code128`, `code39`, `code93`, `codabar`, `itf`, `msi`, `plessey`, `ean13`, `ean8`, `upca`, `upce`;
  - 2D: `qr`, `datamatrix`, `aztec`, `pdf417`.
- **Options** (all optional):
  - `width` and `height`, as a number plus `in`, `mm` or `cm`, each 5–200 mm;
  - `text=false` hides the value printed under linear codes (2D codes never print it).

**Sizes:**

| Kind | Default | Only one dimension given | Both given |
|---|---|---|---|
| Linear | 2.5 in × 0.6 in | the other keeps the ratio (height = width × 0.24) | used as given |
| QR, Data Matrix, Aztec | 1.2 in square | stays square | square, using the smaller |
| PDF417 | 2.5 in × 1 in | the other keeps the ratio (height = width × 0.4) | used as given |

- Every module (bar or cell) is at least 0.17 mm, so the code prints and scans.
- When no `width` is given, a code too dense for the default width grows just wide enough, up to 200 mm.
- An explicit size that is too small, or content needing more than 200 mm, is an error naming the minimum width.
- In a PDF, a barcode wider than its table cell shrinks proportionally to fit.
- QR, Data Matrix, Aztec and PDF417 encode UTF-8.
- EAN-13, UPC-A and EAN-8 values given without their check digit print it.

**Limits:** a value can be at most 1,000 characters, and a document can hold at most 200 barcodes.

**Errors:** a bad barcode fails the call with `invalid_arguments` naming the problem, and no file is saved, so the
model can fix it and retry. Examples:
- `unknown barcode format 'code11'`
- `width '500mm' is larger than 200mm`
- `ean13 cannot encode 'ABC'`
- `code128 value '…' needs a width of at least 23mm`

## Producing Files

A file an agent hands the user — from `file.create` or from a workflow tool — is captured automatically as a
produced file on the session; you don't wire up storage or the transcript yourself.

**Where files come from:**

- `builtin: file.create` (above).
- A workflow tool's own output, captured the same way: a Document workflow's `file`/`fileName` output, or
  `Utilities/Export`'s `fileStream`/`fileUrl`. The runner reads the file, saves it, and replaces it in what the
  model sees with `{ fileName, attachmentId }` — or `{ fileName, skipped: "<reason>" }` if it couldn't be kept
  (over 25 MB, unreadable, or couldn't be saved). The rest of the tool's result is untouched either way. When
  the tool returns a `response` output, the model sees `{ response, files: [<entries>] }`.

**Where files appear:**

- As cards on the agent's reply in chat.
- In the AI Assistant's Library, listed as "Produced in *chat*".
- In the transcript, as `attachment` blocks (`attachmentId`, `fileName`, `contentType`, `size`) on the tool's
  message, carrying `"origin": "produced"` — unlike a user-uploaded file, which has no `origin` key.

Produced files are **never re-sent to the model** on later turns — the block is dropped when history is
rebuilt for a fresh model context, so render a produced file from the transcript, not from anything the model
says about it. See [Outputs](#outputs) for the `files` a task run returns, and `docs/agent-api.md` §14 "Built-in
tools" and §10 (transcript `attachment` blocks) in `tms-backend-api` for the full shapes.

## History Compression

Each chat turn adds to a growing conversation history, bounded by the model's context window. When the previous call's reported input-plus-output tokens reach **80% of `model.contextWindow`** (or the 256,000-token default — see the `model.contextWindow` row above), the runtime summarizes the older messages into a single `summary` transcript entry before the next turn, and the turn proceeds on the shorter history. This is automatic — nothing in `agent:` YAML opts in or out of it.

- The summary call is given at most half of the session's remaining time budget; if it fails or runs out, the turn just proceeds on the full, uncompressed history instead of failing the turn.
- A provider that reports no token usage never triggers compression (there's nothing to measure against the window).
- On the client side, the internal Responses route announces a compression with a `response.tms.history_compressed` stream event; the transcript (GraphQL) always shows the `summary` message and a `usage` entry with `kind: "summary"`, on both routes.
- If an agent frequently needs long conversations against a small model, either raise `model.contextWindow` to match the model actually in use (see the property table above) or keep `agent.instructions` terse so more of the window is available for turns.

## Files in Chat

People can attach files to a chat message in the AI Assistant: up to 5 per message, 25 MB each, of these types:

| Kind | Types | What the model receives |
|---|---|---|
| Documents | PDF | The file itself: inline bytes up to 4 MB, above that a presigned URL (PDF URLs only for the `anthropic` provider — other providers refuse a PDF over 4 MB) |
| Images | PNG, JPG/JPEG | The image: inline bytes up to 4 MB, above that a presigned URL |
| Text | TXT, CSV, JSON, MD | The text, decoded as UTF-8 and cut at 200,000 characters with a truncation note |

Nothing in `agent:` YAML opts in or out — every chat agent accepts files, and there is no YAML schema change. What
the agent sees:

- Each file arrives in the user's turn after a label such as `[Attached file: bol.pdf (PDF, 1.2 MB)]`, so the model
  can refer to it by name. Text content is fenced as data, not instructions — like a tool result — so a file that
  says "ignore your instructions" is just text in a file.
- Files stay in the conversation: every later turn can still read them (they are re-sent on each model call, within a
  16 MB inline budget per call; older files beyond it go by URL or as a note asking the user to attach them again).
  When history is compressed, the summary names the files but their content leaves the history.
- A file that can't be read when a turn runs reaches the model as `[File <name> could not be read.]` instead of
  failing the turn.
- Every chat upload becomes an Attachment linked to the session (parent type `AgentSession`, category
  `AgentSession`), visible only to people who can see the chat, and listed in the AI Assistant's Library. Task
  sessions (workflow runs) never receive files.

**Which models read PDFs and images** is decided by the model config's `supportsFiles` flag (see
[The `ai.default` Organization Config](#the-aidefault-organization-config)). When it is `false`, the chat refuses PDFs
and images when they are attached — before the message is sent — and text files still work. `GET .../ai/models`
reports it per agent as `supports_files`, which the chat uses to validate a file before uploading it.

Write `agent.instructions` for chat agents that will receive documents to say what to do with them (e.g. "When the
user attaches a bill of lading, read the shipper, consignee and pallet count from it"), and to answer only from
what the file shows. Full request shapes and error messages are in `docs/agent-api.md` §4 "Attaching files" in
`tms-backend-api`.

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
  "contextWindow": 200000,
  "supportsFiles": true
}
```

`supportsFiles` (optional) says whether the model reads PDFs and images attached in chat (see
[Files in chat](#files-in-chat)). When it is absent, it defaults to `true` for the `anthropic` and `openai`
providers and to `false` for any other provider. Set it to `false` for a model without vision or PDF support, and
to `true` for a file-capable model behind another provider. Text attachments work either way.

Set up this config once per organization (or per named config for `model.fromConfig` overrides); every Agent workflow that doesn't override `model.name`/`model.temperature` shares it. The config's own `contextWindow` (if set) is the fallback used when the agent's YAML doesn't declare `model.contextWindow` — but only while the agent doesn't also override `model.name`; overriding the model name without also setting `agent.model.contextWindow` falls straight through to the runtime default of 256,000 tokens, since the config's window describes the config's model, not the override.

## Tool Name Derivation (Workflow Name → Tool Name)

When a workflow is exposed as a tool (via another agent's `tools[].workflow`, or via `workflowType: McpTool`), its display name is converted into a tool name matching `^[a-zA-Z0-9_-]{1,64}$`:

- Runs of one or more characters outside `[a-zA-Z0-9_-]` (spaces, `/`, punctuation) collapse to a single `_`. E.g. `"MCP / Get Order Status"` → `MCP_Get_Order_Status`.
- If two workflows collapse to the same tool name, later collisions get a numeric suffix: the second occurrence becomes `_2`, the third `_3`, and so on.
- Keep workflow names short and distinguishable after this substitution if you're exposing several as tools to the same agent — two names that only differ by punctuation will collide and get suffixed, which is harder for the model to reason about than a small rename up front.

## Best Practices

- **Put side-effecting tools under `mode: approval` in chat agents.** Anything destructive, external-facing, or hard to undo (cancel, charge, send, delete) should pause for a person rather than run the instant the model decides to call it. Read-only or easily-reversible tools (status lookups, previews) can stay `auto`. See [Tool approval](#tool-approval-toolsmode).
- **Use `mode: always` for actions a person must confirm every time.** `approval` tools run unattended once a user switches the chat to Auto; `always` tools never do.
- **Give chat agents `agent.ui`.** A `shortDescription`, an `icon`, a `color` and a few `prompts` make the agent recognizable in the AI Assistant's agent menu and empty state.
- **Set `model.contextWindow` whenever you set `model.name`.** Otherwise a smaller model than the org default silently gets the 256K default window, and history compression won't kick in until it's already over budget (or a larger model gets compressed too eagerly). See the `model.contextWindow` row above.
- **Set `supportsFiles` on the model config to match the model.** A model that can't read PDFs or images should say so (`"supportsFiles": false`), so the chat refuses those files up front instead of the provider failing the turn. See [Files in chat](#files-in-chat).
- **Design `agent.result`/`agent.instructions` around whichever session type(s) the agent is actually used in.** A chat-only agent doesn't need `agent.result` (it has no `set_result` tool); a task-only agent should tell the model explicitly to call `set_result` exactly once (the scaffolded template's instructions already do this).
- **Keep trigger-bound agents fast**, or move them off the triggering request entirely (see [Triggers](#triggers)) — a slow agent session holds the entity's workflow lock for its whole duration.

## Validation Codes (AGT_001–AGT_015)

These are backend validation codes; `cxtms` validates the same constraints client-side via `agent/agent.json` and `workflow.json` so you catch them before deploying.

| Code | Meaning | One-line fix |
|------|---------|---------------|
| `AGT_001` | `agent` section required | Add a top-level `agent:` section to the workflow. |
| `AGT_002` | `instructions` required | Add a non-empty `agent.instructions` string. |
| `AGT_003` | `executionMode` must be `Sync` | Set `workflow.executionMode: Sync`. |
| `AGT_004` | `activities` not allowed | Remove the `activities` property — Agent workflows can't have activities. |
| `AGT_005` | `session.type` must be `task` or `chat` | Set `agent.session.type` to `task` or `chat`. |
| `AGT_006` | `maxTurns` must be 1–100, `timeout` must be positive, `model.contextWindow` must be positive | Set `agent.session.maxTurns` to a value between 1 and 100, `agent.session.timeout` to a positive number of seconds, and `agent.model.contextWindow` (if set) to a positive number of tokens. |
| `AGT_007` | Retired — replaced by `AGT_013` | — |
| `AGT_008` | `result` must be a JSON Schema with `type: object` | Set `agent.result.type` to `object`. |
| `AGT_009` | `agents[]` needs exactly one of `agent`/`url`, and `modes` from `task`/`chat` | Give each `agent.agents[]` entry exactly one of `agent` or `url`, and only `task`/`chat` values in `modes`. |
| `AGT_010` | `tools[].mode` must be `auto`, `approval` or `always` | Set `agent.tools[].mode` to `auto`, `approval` or `always` (or omit it — `auto` is the default). |
| `AGT_011` | `ui.color` must be one of `primary`, `secondary`, `info`, `success`, `warning`, `error` | Set `agent.ui.color` to one of the six palette names, lowercase, or omit it. |
| `AGT_012` | `ui.prompts` has more than 5 entries | Keep at most 5 `agent.ui.prompts`. |
| `AGT_013` | a `tools[]` entry needs exactly one of `workflow`/`builtin` | Give each `agent.tools[]` entry either `workflow` (name or `workflowId`) or `builtin`, not both and not neither. |
| `AGT_014` | unknown `tools[].builtin` | Use `data.query`, `data.schema`, `data.type` or `file.create` (case-sensitive). |
| `AGT_015` | the same `builtin` listed twice | List each built-in tool once. |
