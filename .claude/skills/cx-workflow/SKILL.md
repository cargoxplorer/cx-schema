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

**Flow workflows** — scaffold with `basic` then set `workflowType: Flow`, remove `activities`/`triggers`, add `entity`, `states`, `transitions`, `aggregations`. See: `!cat .claude/skills/cx-workflow/ref-flow.md`

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
      options:                              # For type: options
        - name: "Option A"
          value: "a"

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
    conditions:
      - expression: "any([changes], [each.key] = 'Status') = true"

schedules:
  - cron: "0 8 * * 1-5"
    displayName: "Daily morning run"

events:
  - type: onWorkflowFailed
    steps: [...]
```

---

## Execution Model

**Flow**: Workflow -> Activities (sequential) -> Steps (sequential)

**Outputs stored as**: `ActivityName.StepName.outputKey` (in both activity and global scope)

**System variables**: `organizationId`, `currentUserId`, `executionId`, `workflowId`, `triggerType`, `eventType`, `position`, `entityName`, `entityId`, `entity`, `data`, `changes`

**Conditions**: Any step/activity can have `conditions` — all must be true (AND) or step is skipped.

**Events**: `onWorkflowStarted`, `onWorkflowExecuted`, `onWorkflowFailed`, `onActivityStarted`, `onActivityExecuted`, `onActivityFailed`

**Task naming**: `Namespace/TaskName@Version` — version optional, defaults to highest.

---

## Variable References (quick summary)

Two syntaxes — for full reference: `!cat .claude/skills/cx-workflow/ref-expressions.md`

**`{{ path }}`** — in step inputs. Single `{{ }}` returns raw object. Multiple returns string interpolation.
```yaml
orderId: "{{ inputs.orderId }}"
amount: "{{ decimal totalAmount }}"          # Type converter prefix
```

**`[variable]`** — in conditions and `expression:` directives. NCalc syntax.
```yaml
conditions:
  - expression: "[status] = 'Active' AND isNullOrEmpty([order?]) = false"
```

**Value directives**: `expression`, `coalesce`, `foreach`, `switch`, `extends`, `$raw`

**38 custom functions** + NCalc built-ins. Key ones: `isNullOrEmpty()`, `any([items], [each.x])`, `all()`, `count()`, `sum()`, `first()`, `last()`, `contains()`, `join()`, `split()`, `format()`, `now()`, `addDays()`, `formatDate()`, `if()`, `Round()`, `bool()`, `length()`, `replace()`, `groupBy()`, `concat()`, `distinct()`

**Iterator variables**: `[each.*]` in any/all/sum/join, `[item.*]` in first/last/groupBy

---

## System Tasks (Control Flow)

### foreach

```yaml
- task: foreach
  name: ProcessItems
  collection: "Data.GetOrders.result.items"
  item: "currentOrder"                       # default: "item"
  continueOnError: false
  conditions:
    - expression: "isNullOrEmpty([Data.GetOrders.result.items]) = false"
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
        - expression: "[Data.GetOrder.order.status] = 'Active'"
      steps: [...]
    - when:
        - expression: "[Data.GetOrder.order.status] = 'Draft'"
      steps: [...]
  default:
    - task: "Utilities/Log@1"
      name: LogOther
      inputs:
        message: "Unknown status"
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

## Task Reference (load by category)

!cat .claude/skills/cx-workflow/ref-utilities.md
!cat .claude/skills/cx-workflow/ref-query.md
!cat .claude/skills/cx-workflow/ref-entity.md
!cat .claude/skills/cx-workflow/ref-communication.md
!cat .claude/skills/cx-workflow/ref-filetransfer.md
!cat .claude/skills/cx-workflow/ref-accounting.md
!cat .claude/skills/cx-workflow/ref-other.md

| Category | Tasks | Reference |
|----------|-------|-----------|
| Utilities | SetVariable, Log, Error, HttpRequest, Map, Template, Import, Export, CsvParse | ref-utilities.md |
| Query & Workflow | Query/GraphQL, Validation, Workflow/Execute | ref-query.md |
| Entity CRUD | Order, Contact, Commodity, Job, Charge, Discount, Inventory, Movement | ref-entity.md |
| Communication | Email/Send, Document/Render, Attachment, PdfDocument/Merge | ref-communication.md |
| File Transfer | Connect, Disconnect, ListFiles, Download, Upload, Move, Delete | ref-filetransfer.md |
| Accounting | AccountingTransaction, Payment, Number/Generate, SequenceNumber | ref-accounting.md |
| Other | User, Auth, Caching, EDI, Flow/Transition, Notes, AppModule, ActionEvent | ref-other.md |

## Additional References

!cat .claude/skills/cx-workflow/ref-expressions.md
!cat .claude/skills/cx-workflow/ref-flow.md

## Dynamic Schema Access

!cat .cx-schema/workflows/workflow.json
!cat .cx-schema/workflows/activity.json
!cat .cx-schema/workflows/input.json
!cat .cx-schema/workflows/output.json
!cat .cx-schema/workflows/variable.json
!cat .cx-schema/workflows/trigger.json
!cat .cx-schema/workflows/schedule.json
!cat .cx-schema/workflows/tasks/all.json
!cat .cx-schema/workflows/flow/entity.json
!cat .cx-schema/workflows/flow/state.json
!cat .cx-schema/workflows/flow/transition.json
!cat .cx-schema/workflows/flow/aggregation.json

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
