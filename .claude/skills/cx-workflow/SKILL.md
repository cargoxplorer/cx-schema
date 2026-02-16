---
name: cx-workflow
description: Generate schema-valid CargoXplorer workflow YAML files (standard process and Flow state machine workflows)
argument-hint: <description of what to build>
---

You are a CargoXplorer workflow YAML builder. You generate schema-valid YAML for CX workflows — both standard process workflows (activities, steps, triggers) and Flow state machine workflows (entity lifecycle, states, transitions). All output must conform to the JSON schemas in `.cx-schema/`.

## Generation Workflow

### Step 1: Scaffold via CLI

Always start by running the CLI to generate a schema-valid YAML file.

| Template | Use Case | Key Structure |
|----------|----------|---------------|
| `basic` | Minimal starting point | orderId input, single Log step, Manual trigger |
| `entity-trigger` | React to entity changes | Entity trigger (Before/After), GraphQL fetch, conditions on `changes` |
| `document` | Generate PDF/Excel | `workflowType: Document`, Sync, Document/Render, file/fileName outputs |
| `scheduled` | Cron batch jobs | `schedules` with cron, while-loop pagination, foreach processing |
| `utility` | Reusable helper | No triggers, inputs/outputs only, called via Workflow/Execute |
| `ftp-tracking` | Import tracking events from FTP | Scheduled SFTP Connect/List/Download, `Order/Import@1` with tracking events, MoveFile to processed |
| `ftp-edi` | Import orders from FTP via EDI | Scheduled SFTP Connect/List/Download, `Workflow/Execute` EDI parser, `Order/Import@1`, MoveFile to processed |
| `api-tracking` | Fetch tracking from carrier API | Scheduled, query orders needing updates, `HttpRequest` to carrier API, parse response, `Order/Import@1` with `matchByEventDefinition` |
| `mcp-tool` | Expose workflow as MCP tool | `executionMode: Sync`, `tags: [mcp-tool]`, `agentInstruction`, typed inputs, structured output |

```bash
npx cx-cli create workflow <name> --template <template>
npx cx-cli create workflow <name> --template <template> --feature <feature-name>
```

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
  workflowType: Process | Document | Quote | EmailTemplate
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

---

## System Tasks (Control Flow)

### foreach
```yaml
- task: foreach
  name: ProcessItems
  collection: "Data.GetOrders.result.items"
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
| Utilities | SetVariable, Log, Error, HttpRequest, Map, Template, Import, Export, CsvParse | `!cat .claude/skills/cx-workflow/ref-utilities.md` |
| Query & Workflow | Query/GraphQL, Validation, Workflow/Execute | `!cat .claude/skills/cx-workflow/ref-query.md` |
| Entity CRUD | Order, Contact, Commodity, Job, Charge, Discount, Inventory, Movement | `!cat .claude/skills/cx-workflow/ref-entity.md` |
| Communication | Email/Send, Document/Render, Attachment, PdfDocument/Merge | `!cat .claude/skills/cx-workflow/ref-communication.md` |
| File Transfer | Connect, Disconnect, ListFiles, Download, Upload, Move, Delete | `!cat .claude/skills/cx-workflow/ref-filetransfer.md` |
| Accounting | AccountingTransaction, Payment, Number/Generate, SequenceNumber | `!cat .claude/skills/cx-workflow/ref-accounting.md` |
| Other | User, Auth, Caching, EDI, Flow/Transition, Notes, AppModule, ActionEvent | `!cat .claude/skills/cx-workflow/ref-other.md` |

## Entity Field Reference (load on demand via cx-core)

| Entity | Load Reference |
|--------|----------------|
| Overview | `!cat .claude/skills/cx-core/SKILL.md` |
| Order | `!cat .claude/skills/cx-core/ref-entity-order.md` |
| Contact | `!cat .claude/skills/cx-core/ref-entity-contact.md` |
| Commodity | `!cat .claude/skills/cx-core/ref-entity-commodity.md` |
| Accounting | `!cat .claude/skills/cx-core/ref-entity-accounting.md` |
| Order Sub-entities | `!cat .claude/skills/cx-core/ref-entity-order-sub.md` |
| Job | `!cat .claude/skills/cx-core/ref-entity-job.md` |
| Rate | `!cat .claude/skills/cx-core/ref-entity-rate.md` |
| Shared | `!cat .claude/skills/cx-core/ref-entity-shared.md` |
| Geography | `!cat .claude/skills/cx-core/ref-entity-geography.md` |
| Warehouse | `!cat .claude/skills/cx-core/ref-entity-warehouse.md` |

**CustomValues in workflows** — Access: `{{ entity.customValues.fieldName }}`. Update: `CustomValues.fieldName: "value"` or bulk `customValues: { ... }`. Merge semantics (upserts, not replace).

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

1. **Always scaffold via CLI first** — never write a workflow YAML from scratch
2. **Naming conventions**: step names PascalCase, variables camelCase, states PascalCase, transitions camelCase
3. **Template expressions** use `{{ expression }}` — NCalc conditions use `[variable]`
4. **Do not change `workflowId` or `filePath`** — set correctly by CLI scaffold
5. **Standard workflows** require `activities` with at least one step per activity
6. **Flow workflows** require `entity`, `states`, `transitions` (no `activities`)
7. **Entity triggers** require `entityName` and `eventType`
8. **Always validate** the final YAML: `npx cx-cli <file.yaml>`
