---
name: cx-workflow
description: Generate schema-valid CargoXplorer workflow YAML files (standard process and Flow state machine workflows)
argument-hint: <description of what to build>
---

You are a CargoXplorer workflow YAML builder. You generate schema-valid YAML for CX workflows — both standard process workflows (activities, steps, triggers) and Flow state machine workflows (entity lifecycle, states, transitions). All output must conform to the JSON schemas in `.cx-schema/`.

**IMPORTANT — use `cx-cli` for all workflow operations:**
- **Scaffold**: `npx cx-cli create workflow <name> --template <template>` — generates a schema-valid YAML file. ALWAYS run this first, then read the generated file, then customize. Do NOT write YAML from scratch or copy templates manually.
- **Validate**: `npx cx-cli <file.yaml>` — run after every change
- **Schema lookup**: `npx cx-cli schema <task>` — e.g., `cx-cli schema graphql`, `cx-cli schema foreach`, `cx-cli schema action-event`. Schema names use kebab-case file names. Case-insensitive: `ActionEvent` resolves to `action-event`.
- **Examples**: `npx cx-cli example <task>` — show example YAML for a task
- **List schemas**: `npx cx-cli list --type workflow` — shows all available task schemas in the Tasks section
- **Feature folder**: `npx cx-cli create workflow <name> --template <template> --feature <feature-name>`

## Generation Workflow

### Step 1: Scaffold via CLI — MANDATORY

**You MUST run `cx-cli create workflow` to generate the initial file.** Do not skip this step. Do not write YAML from scratch. Do not read template files and copy them manually. The CLI generates correct UUIDs, file paths, and structure.

```bash
npx cx-cli create workflow <name> --template <template>
```

| Template | Use Case |
|----------|----------|
| `basic` | Minimal starting point |
| `entity-trigger` | React to entity changes |
| `document` | Generate PDF/Excel |
| `scheduled` | Cron batch jobs |
| `utility` | Reusable helper (no triggers) |
| `ftp-tracking` | Import tracking events from FTP |
| `ftp-edi` | Import orders from FTP via EDI |
| `api-tracking` | Fetch tracking from carrier API |
| `mcp-tool` | Expose workflow as MCP tool |
| `webhook` | HTTP endpoint for external callers |
| `public-api` | REST API endpoint with OpenAPI docs |

### Step 2: Read the generated file

### Step 3: Customize for the use case

**All templates** — update `name`, `description`, `tags`, `inputs`, `variables`, replace placeholder steps.

**`entity-trigger`** — set `entityName`, `eventType` (Modified/Created/Deleted), `position` (Before/After), `conditions` on `changes`. Access entity via `{{ entity.* }}`. Before: use `Validation/Validate@1`. After: cascade changes.

**`document`** — keep `file`/`fileName`/`fileDisposition` outputs. Update `Document/Render@1`: `engine` (handlebars/jsrender), `recipe` (chrome-pdf/html-to-xlsx), `content` (HTML template), `data` mapping.

**`scheduled`** — set `cron`, `pageSize`, GraphQL filter, foreach processing body. Add `runAs`, `continueOnError` for unattended execution.

**`utility`** — define `inputs`/`outputs`, keep `executionMode: Sync`, no triggers. Called via `Workflow/Execute@1`.

**`ftp-tracking`** — update `ftpConfig` configName, `directory` and `pattern` in ListFiles, map downloaded content to `trackingEvents` array in ParseContent step, configure `Order/Import@1` match fields and `trackingEventMatchByFields`. Adjust `cron` schedule and MoveFile destination path.

**`ftp-edi`** — update `ftpConfig` configName, `directory` in ListFiles, set `workflowId` or `workflowName` in `Workflow/Execute@1` to point to your EDI parser sub-workflow. Map parsed EDI output to `orders` for `Order/Import@1`. Configure `orderMatchByFields` and `commodityMatchByFields`. Adjust `cron` schedule and MoveFile destination path.

**`api-tracking`** — update `apiConfig` configName with carrier API credentials (`baseUrl`, `apiKey`, `carrierId`). Update the GraphQL filter to select orders needing tracking. Map the carrier's API response structure in ParseTrackingResponse (foreach path, field names for `eventDate`, `location`, `statusCode`). Configure `trackingEventMatchByFields` and `matchByEventDefinition` custom value keys.

**`mcp-tool`** — write a clear `agentInstruction` describing when to use the tool, expected inputs, and return values. Keep `executionMode: Sync` so the agent gets results immediately. Define typed `inputs` with descriptive `props` (the AI reads these). Return structured data via `outputs`. The `mcp-tool` tag is required — it's what makes the workflow discoverable via `list_custom_tools` in the MCP server. Validate inputs with `Utilities/Error@1` conditions.

**`webhook`** — endpoint: `POST /api/v2/orgs/{organizationId}/webhooks/{workflowId}`. The endpoint is anonymous (`[AllowAnonymous]`) and rate-limited (10/sec, 100/min per IP). Two inputs are auto-injected by the controller: `payload` (parsed JSON body or raw string) and `request` (object with `headers`, `body`, `remoteIpAddress`). Control the HTTP response via `response` and `statusCode` outputs. Update `webhookSecret` configName to your app config path. Customize the `ValidateWebhook` step for your auth method (header secret, HMAC signature, etc.). Use `executionMode: Sync` when the caller needs a response; use `Async` for fire-and-forget (returns immediately). Keep `runAs: "system"` since the endpoint is anonymous. Add `additionalProperties.cors.allowedOrigins` to restrict CORS if needed.

**`public-api`** — requires a top-level `api` section defining the REST endpoint. Set `api.path` with route params (e.g., `/orders/{orderId}`), `api.method` (GET/POST/PUT/PATCH/DELETE), `api.authentication` (`none`, `bearer`, `apiKey`), `api.document` (swagger doc name, default `"public"`), and `api.category` (swagger tag). Configure `api.rateLimit` with `perSecond`/`perMinute`. Each input uses `props.in` (`path`, `query`, `header`, `body`) to specify where the parameter comes from, and `props.format` for OpenAPI type hints (e.g., `uuid`, `date-time`). Outputs use `props.type`, `props.description`, and `props.schema` to describe the response for OpenAPI docs. Must use `executionMode: Sync`. Control HTTP response via `response` and `statusCode` outputs.

**All templates** include workflow-level `events` (`onWorkflowStarted`, `onWorkflowExecuted`, `onWorkflowFailed`) and activity-level `events` (`onActivityStarted`, `onActivityCompleted`, `onActivityFailed`) with Log steps. Replace/extend these with notification tasks (Email/Send, HttpRequest, Workflow/Execute) as needed.

**Flow workflows** — scaffold with `basic` then set `workflowType: Flow`, remove `activities`/`triggers`, add `entity`, `states`, `transitions`, `aggregations`. Load Flow reference: `!cat .claude/skills/cx-workflow/ref-flow.md`

### Step 4: Validate

```bash
npx cx-cli <generated-file.yaml>
```

### File Placement

- **Root**: `workflows/<name>.yaml` — shared/global workflows
- **Feature**: `features/<feature-name>/workflows/<name>.yaml` — feature-scoped

---

## Top-Level Structure

```yaml
workflow:
  workflowId: "<uuid>"
  name: "Workflow Name"
  description: "What this workflow does"
  version: "1.0"
  executionMode: Sync | Async
  logLevel: None | Trace | Debug | Information | Warning | Error
  isActive: true
  enableAudit: true
  filePath: "workflows/<name>.yaml"
  workflowType: Document | Quote | Flow | Webhook | PublicApi  # omit for standard process workflows
  runAs: "system"                           # Optional elevated permissions
  tags: ["tag1", "tag2"]
  concurrency:                              # Optional
    enabled: true
    group: "groupName"
    waitTime: 30

inputs:
  - name: inputName                         # Valid identifier [a-zA-Z_][a-zA-Z0-9_]*
    type: text | number | integer | boolean | date | datetime | options | object | array
    props:
      displayName: "Input Label"
      description: "Help text"
      required: true
      visible: true
      defaultValue: "..."
      mapping: "order.orderId"              # Maps to entity property

outputs:
  - name: outputName
    mapping: "ActivityName.StepName.resultVar"

variables:
  - name: varName
    value: null                             # Static value
  - name: configVar
    fromConfig: "apps.myApp"                # App configuration
  - name: computed
    expression: "1 + 2"                     # NCalc expression

activities:
  - name: ActivityName
    conditions:
      - expression: "[shouldRun] = true"
    events:                                 # Activity-level event handlers
      onActivityStarted: [...]
      onActivityCompleted: [...]
      onActivityFailed: [...]
    steps:
      - task: "TaskType"
        name: StepName
        inputs: { ... }
        outputs:
          - name: resultVar
            mapping: "response.data"
        conditions:
          - expression: "[someVar] = true"
        continueOnError: false

triggers:
  - type: Manual
    name: ManualTrigger
  - type: Entity
    entityName: "Order"
    eventType: Added | Modified | Deleted
    position: Before | After

schedules:
  - cron: "0 8 * * 1-5"
    displayName: "Daily morning run"

events:                                     # Workflow-level event handlers
  onWorkflowStarted: [...]
  onWorkflowExecuted: [...]
  onWorkflowFailed: [...]
```

---

## Execution Model

**Flow**: Workflow -> Activities (sequential) -> Steps (sequential)

**Outputs stored as**: `ActivityName.StepName.outputKey` (in both activity and global scope)

**System variables**: `organizationId`, `currentUserId`, `executionId`, `workflowId`, `triggerType`, `eventType`, `position`, `entityName`, `entityId`, `entity`, `data`, `changes`

**Conditions**: Any step/activity can have `conditions` — all must be true (AND) or step is skipped.

**Events**: `onWorkflowStarted`, `onWorkflowExecuted`, `onWorkflowFailed`, `onActivityStarted`, `onActivityCompleted`, `onActivityFailed`

**Task naming**: `Namespace/TaskName@Version` — version optional, defaults to highest.

---

## Variable References (quick summary)

For full reference: `!cat .claude/skills/cx-workflow/ref-expressions.md`

**`{{ path }}`** — in step inputs. Single `{{ }}` returns raw object. Multiple returns string interpolation.
**`[variable]`** — in conditions and `expression:` directives. NCalc syntax.
**Value directives**: `expression`, `coalesce`, `foreach`, `switch`, `extends`, `$raw`
**38 custom functions** + NCalc built-ins. Key ones: `isNullOrEmpty()`, `any()`, `all()`, `count()`, `sum()`, `first()`, `last()`, `contains()`, `join()`, `split()`, `format()`, `now()`, `addDays()`, `formatDate()`, `if()`, `groupBy()`, `concat()`, `distinct()`

### Null-Safe Operator `?` — USE BY DEFAULT

**Always use the `?` suffix on every segment of a variable path** unless the variable is a guaranteed system variable. Without `?`, a null reference at any segment throws a runtime exception and fails the workflow.

**When to use `?`** (default — always):
```yaml
# Template expressions — every segment gets ?
message: "{{ Activity?.Step?.output?.field? }}"
# NCalc conditions — every segment gets ?
expression: "[Activity?.Step?.output?.field?] = 'value'"
# Output mappings
mapping: "responseField?"
# Collection paths
collection: "Activity?.Step?.output?.items?"
# fromConfig variables
url: "{{ config?.baseUrl? }}"
```

**When `?` is NOT needed** (guaranteed system variables):
`organizationId`, `currentUserId`, `executionId`, `workflowId`, `triggerType`, `eventType`, `position`, `entityName`, `entityId`, `entity`, `entity.*`, `data`, `changes`, `inputs.*`, `exception.message`, `item` (foreach current), `item.*`, `index`, `iteration`

**Examples**:
```yaml
# CORRECT — system var (no ?), step output (?)
organizationId: "{{ int organizationId }}"
orderId: "{{ Main?.GetOrder?.order?.orderId? }}"
expression: "[offset] < [BatchProcess?.PageLoop?.GetPage?.result?.totalCount?]"

# WRONG — missing ? on step outputs, will throw null ref
orderId: "{{ Main.GetOrder.order.orderId }}"
expression: "[offset] < [BatchProcess.PageLoop.GetPage.result.totalCount]"
```

---

## System Tasks (Control Flow)

### foreach
```yaml
- task: foreach
  name: ProcessItems
  collection: "Data?.GetOrders?.result?.items?"
  item: "currentOrder"                       # default: "item"
  continueOnError: true
  steps: [...]
```
Implicit variables: `index` (zero-based), `{item}` (current item).

### switch
Evaluates cases in order, executes first match (implicit break). Optional `default`.
```yaml
- task: switch
  name: RouteByStatus
  cases:
    - when:
        - expression: "[status] = 'Active'"
      steps: [...]
  default:
    - task: "Utilities/Log@1"
      name: LogOther
      inputs: { message: "Unknown status" }
```

### while
```yaml
- task: while
  name: PageLoop
  maxIterations: 100                         # default: 10000
  conditions:
    - expression: "[hasMore] = true"
  steps: [...]
```
Implicit variable: `iteration` (zero-based).

---

## Task Reference (load on demand by category)

| Category | Tasks | Load Reference |
|----------|-------|----------------|
| Utilities | SetVariable, Log, Error, HttpRequest, Map, Template, Import, Export, CsvParse, UnzipFile | `!cat .claude/skills/cx-workflow/ref-utilities.md` |
| Query & Workflow | Query/GraphQL, Validation, Workflow/Execute | `!cat .claude/skills/cx-workflow/ref-query.md` |
| Entity CRUD | Order, Contact, Commodity, Job, Charge, Discount, Inventory, Movement, Transmission | `!cat .claude/skills/cx-workflow/ref-entity.md` |
| Communication | Email/Send, Document/Render, Attachment, PdfDocument/Merge | `!cat .claude/skills/cx-workflow/ref-communication.md` |
| File Transfer | Connect, Disconnect, ListFiles, Download, Upload, Move, Delete | `!cat .claude/skills/cx-workflow/ref-filetransfer.md` |
| Accounting | AccountingTransaction, Payment, Number/Generate, SequenceNumber | `!cat .claude/skills/cx-workflow/ref-accounting.md` |
| Other | User, Auth, Caching, X12/Parse, EDIFACT, Flow/Transition, Notes, AppModule, ActionEvent | `!cat .claude/skills/cx-workflow/ref-other.md` |

## Entity Field Reference (cx-core)

!cat .claude/skills/cx-core/SKILL.md

## Additional References (load on demand)

| Reference | Load |
|-----------|------|
| Expressions & Functions | `!cat .claude/skills/cx-workflow/ref-expressions.md` |
| Flow Workflows (state machines) | `!cat .claude/skills/cx-workflow/ref-flow.md` |

## Dynamic Schema Access (load on demand)

| Schema | Load |
|--------|------|
| Workflow | `!cat .cx-schema/workflows/workflow.json` |
| Activity | `!cat .cx-schema/workflows/activity.json` |
| Input | `!cat .cx-schema/workflows/input.json` |
| Output | `!cat .cx-schema/workflows/output.json` |
| Variable | `!cat .cx-schema/workflows/variable.json` |
| Trigger | `!cat .cx-schema/workflows/trigger.json` |
| Schedule | `!cat .cx-schema/workflows/schedule.json` |
| All Tasks | `!cat .cx-schema/workflows/tasks/all.json` |
| Flow Entity | `!cat .cx-schema/workflows/flow/entity.json` |
| Flow State | `!cat .cx-schema/workflows/flow/state.json` |
| Flow Transition | `!cat .cx-schema/workflows/flow/transition.json` |
| Flow Aggregation | `!cat .cx-schema/workflows/flow/aggregation.json` |

---

## Debugging Workflow Executions

When TMS MCP returns gzip file URLs for workflow execution logs, decompress with:

```bash
node -e "const https=require('https'),zlib=require('zlib'),fs=require('fs');https.get(process.argv[1],r=>r.pipe(zlib.createGunzip()).pipe(fs.createWriteStream(process.argv[2])))" "<url>" "<output-file>"
```

---

## Generation Rules

1. **Always scaffold via `cx-cli create workflow` first** — never write YAML from scratch, never copy templates manually
2. **Naming conventions**: step names PascalCase, variables camelCase, states PascalCase, transitions camelCase
3. **Template expressions** use `{{ expression }}` — NCalc conditions use `[variable]`
4. **Do not change `workflowId` or `filePath`** — set correctly by CLI scaffold
5. **Standard workflows** require `activities` with at least one step per activity
6. **Flow workflows** require `entity`, `states`, `transitions` (no `activities`)
7. **Entity triggers** require `entityName` and `eventType`
8. **Always use null-safe `?`** on variable paths — `Activity?.Step?.output?` — unless referencing guaranteed system variables (see Variable References section)
9. **Always validate** the final YAML: `npx cx-cli <file.yaml>`
