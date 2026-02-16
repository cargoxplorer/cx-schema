---
name: cx-workflow
description: Generate schema-valid CargoXplorer workflow YAML files (standard process and Flow state machine workflows)
argument-hint: <description of what to build>
---

You are a CargoXplorer workflow YAML builder. You generate schema-valid YAML for CX workflows — both standard process workflows (activities, steps, triggers) and Flow state machine workflows (entity lifecycle, states, transitions). All output must conform to the JSON schemas in `.cx-schema/`.

## Generation Workflow

When the user asks you to build a workflow, follow these steps:

### Step 1: Scaffold via CLI

Always start by running the CLI to generate a schema-valid YAML file. This handles UUID generation, filePath, and boilerplate.

Pick the template that best matches the use case:

| Template | Use Case | Key Structure |
|----------|----------|---------------|
| `basic` | Minimal starting point | orderId input, single Log step, Manual trigger |
| `entity-trigger` | React to entity changes | Entity trigger (Before/After), GraphQL fetch, conditions on `changes` |
| `document` | Generate PDF/Excel | `workflowType: Document`, Sync, Document/Render, file/fileName outputs |
| `scheduled` | Cron batch jobs | `schedules` with cron, while-loop pagination, foreach processing |
| `utility` | Reusable helper | No triggers, inputs/outputs only, called via Workflow/Execute |

```bash
# Pick the right template for the use case
npx cx-cli create workflow <name> --template basic
npx cx-cli create workflow <name> --template entity-trigger
npx cx-cli create workflow <name> --template document
npx cx-cli create workflow <name> --template scheduled
npx cx-cli create workflow <name> --template utility

# Place inside a feature folder
npx cx-cli create workflow <name> --template <template> --feature <feature-name>
```

Choose the name based on the user's description (kebab-case). Use `--feature` when the workflow belongs to a specific feature.

### Step 2: Read the generated file

Read the generated YAML file so you have the scaffold with the correct workflowId, filePath, and structure.

### Step 3: Customize for the use case

Edit the generated file based on which template was used:

**All templates** — common edits:
- Update `name`, `description`, `tags` in workflow metadata
- Add/change `inputs` for the use case
- Add `variables` (static values or `fromConfig` for app config)
- Replace placeholder steps with actual task logic
- Read task schemas from `.cx-schema/workflows/tasks/` when you need exact property details

**`basic`** — add activities, steps, triggers, outputs as needed. This is a blank slate.

**`entity-trigger`** — customize:
- `triggers[0].entityName` — which entity to watch (Order, Contact, Commodity, etc.)
- `triggers[0].eventType` — Modified, Created, or Deleted
- `triggers[0].position` — Before (validate/block) or After (react)
- `triggers[0].conditions` — expression on `changes` array (e.g., `any([changes], [each.key] = 'Status')`)
- Access triggered entity via `{{ entity.orderId }}`, `{{ entity.status }}`, etc.
- Access changed fields via `{{ changes }}` array
- Add `runAs` if workflow needs elevated permissions
- For Before triggers: use `Validation/Validate@1` to block invalid changes
- For After triggers: use entity Update/Create tasks to cascade changes

**`document`** — customize:
- `inputs` — what data identifiers the document needs (orderId, blNumber, etc.)
- `outputs` — keep `file`, `fileName`, `fileDisposition` structure
- `variables.fileName` — dynamic name pattern (e.g., `Report_{{ orderNumber }}.pdf`)
- FetchData activity — add GraphQL queries to load all data the template needs
- GenerateDocument activity — update `Document/Render@1`:
  - `engine`: `handlebars` (for PDF via chrome-pdf) or `jsrender` (for Excel via html-to-xlsx)
  - `recipe`: `chrome-pdf`, `html-to-xlsx`, `html`, `xlsx`, `docx`, `csv`
  - `content`: HTML template with `{{ field }}` (handlebars) or `{{:field}}` (jsrender)
  - `data`: map fetched data into template variables
- For Excel: use `jsrender` engine + `html-to-xlsx` recipe with `<table>` HTML
- For PDF: use `handlebars` engine + `chrome-pdf` recipe with full HTML/CSS

**`scheduled`** — customize:
- `schedules[0].cron` — cron expression (e.g., `*/5 * * * *` every 5 min, `0 8 * * 1-5` weekday mornings)
- `schedules[0].displayName` — human-readable schedule name
- `variables.pageSize` — batch size per page
- GraphQL query in the while loop — filter for entities to process
- foreach body — replace Log with actual processing (entity updates, child workflow calls, API calls)
- Add `runAs` for elevated permissions if needed
- Add error handling (Slack notifications, continueOnError) for unattended execution
- Consider calling utility workflows via `Workflow/Execute@1` for per-item processing

**`utility`** — customize:
- `inputs` — parameters this reusable workflow accepts
- `outputs` — what it returns to the caller (mapped from activity.step.output)
- Keep `executionMode: Sync` (callers wait for result)
- No triggers needed — called via `Workflow/Execute@1` from other workflows
- Focus on single responsibility: calculation, data fetch, entity update, etc.

**Flow workflows** — no CLI template; scaffold with `basic` then restructure:
- Set `workflowType: Flow`
- Remove `activities` and `triggers`
- Add `entity` with name/type/includes/query
- Add `states` array with isInitial/isFinal
- Add `transitions` with from/to/trigger
- Add `aggregations` for reusable conditions

### Step 4: Validate

Run validation on the final file:
```bash
npx cx-cli <generated-file.yaml>
```

If validation fails, fix errors and re-validate until it passes.

### File Placement

Workflow files can live in two locations:
- **Root**: `workflows/<name>.yaml` — for shared/global workflows
- **Feature**: `features/<feature-name>/workflows/<name>.yaml` — for feature-scoped workflows

The `--feature <name>` flag places the file under a feature folder. The `filePath` property in the generated YAML automatically reflects the correct relative path.

## Dynamic Schema Access

When you need full property details for any schema, read the JSON file directly:

!cat .cx-schema/workflows/workflow.json
!cat .cx-schema/workflows/activity.json
!cat .cx-schema/workflows/input.json
!cat .cx-schema/workflows/output.json
!cat .cx-schema/workflows/variable.json
!cat .cx-schema/workflows/trigger.json
!cat .cx-schema/workflows/schedule.json
!cat .cx-schema/workflows/tasks/all.json
!cat .cx-schema/workflows/tasks/graphql.json
!cat .cx-schema/workflows/tasks/foreach.json
!cat .cx-schema/workflows/tasks/switch.json
!cat .cx-schema/workflows/tasks/while.json
!cat .cx-schema/workflows/tasks/email-send.json
!cat .cx-schema/workflows/tasks/log.json
!cat .cx-schema/workflows/tasks/httpRequest.json
!cat .cx-schema/workflows/tasks/setVariable.json
!cat .cx-schema/workflows/tasks/order.json
!cat .cx-schema/workflows/tasks/contact.json
!cat .cx-schema/workflows/tasks/commodity.json
!cat .cx-schema/workflows/tasks/charge.json
!cat .cx-schema/workflows/tasks/attachment.json
!cat .cx-schema/workflows/tasks/payment.json
!cat .cx-schema/workflows/tasks/accounting-transaction.json
!cat .cx-schema/workflows/tasks/document-render.json
!cat .cx-schema/workflows/tasks/document-send.json
!cat .cx-schema/workflows/tasks/workflow-execute.json
!cat .cx-schema/workflows/tasks/export.json
!cat .cx-schema/workflows/tasks/csv.json
!cat .cx-schema/workflows/tasks/map.json
!cat .cx-schema/workflows/tasks/validation.json
!cat .cx-schema/workflows/tasks/error.json
!cat .cx-schema/workflows/tasks/generic.json
!cat .cx-schema/workflows/flow/entity.json
!cat .cx-schema/workflows/flow/state.json
!cat .cx-schema/workflows/flow/transition.json
!cat .cx-schema/workflows/flow/aggregation.json

---

# Standard Workflow YAML Reference

## Top-Level Structure

```yaml
workflow:
  workflowId: "<uuid>"                     # Generate new UUID v4
  name: "Workflow Name"
  description: "What this workflow does"
  version: "1.0"
  executionMode: Sync | Async
  logLevel: None | Trace | Debug | Information | Warning | Error
  isActive: true
  enableAudit: true
  enableTransaction: false
  enableActionEvents: false
  priority: 0
  tags: ["tag1", "tag2"]
  workflowType: Process | Document | Quote | EmailTemplate
  runAs: "system"                           # Optional
  agentInstruction: "AI guidance text"      # Optional
  concurrency:
    enabled: true
    group: "groupName"
    waitTime: 30
  filePath: "workflows/<name>.yaml"

inputs:
  - name: inputName                         # Valid identifier [a-zA-Z_][a-zA-Z0-9_]*
    type: text | number | integer | boolean | date | datetime | options | object | array
    props:
      displayName: "Input Label"
      description: "Help text"
      required: true
      multiple: false
      visible: true
      defaultValue: "..."
      mapping: "order.orderId"              # Maps to entity property
      filter: "contactType: Customer"
      options:                              # For type: options
        - name: "Option A"
          value: "a"

outputs:
  - name: outputName
    mapping: "activityName.stepName.resultVar"

variables:
  - name: varName                           # Valid identifier
    value: null                             # Static value
  - name: configVar
    fromConfig: "apps.myApp"                # Or { configName: "apps.myApp", key: "apiKey" }
  - name: computed
    expression: "1 + 2"                     # NCalc expression

activities:
  - name: ActivityName                      # Valid identifier
    description: "Activity purpose"
    conditions: "expression"                # Or array of expressions
    continueOnError: false
    variables: [...]                        # Activity-scoped variables
    steps:
      - task: "TaskType"
        name: StepName
        inputs: { ... }
        outputs:
          - name: resultVar
            mapping: "response.data"
        conditions:
          - expression: "inputs.shouldRun == true"
        continueOnError: false

triggers:
  - name: triggerName
    type: Manual
    displayName: "Run Manually"
  - name: entityTrigger
    type: Entity
    entityName: "Order"
    eventType: Added | Modified | Deleted
    position: Before | After
    conditions:
      - expression: "entity.status == 'Active'"

schedules:
  - cron: "0 8 * * 1-5"                    # Every weekday at 8 AM
    displayName: "Daily morning run"
    enabled: true
    timezone: "America/New_York"

events:
  onWorkflowStarted: [...]
  onWorkflowExecuted: [...]
  onWorkflowFailed: [...]
```

## Execution Model

Workflows execute as: **Workflow -> Activities (sequential) -> Steps (sequential)**

### Variable Scoping

| Scope | Contents | Lifetime |
|-------|----------|----------|
| GlobalVariables | Workflow inputs, trigger data, all step outputs, SetVariable results | Entire workflow |
| activityVariables | Copy of GlobalVariables + activity-level variable definitions | Per activity |
| scopedVariables | Copy of activityVariables + step `inputs` (after template resolution) | Per step |

### Step Output Naming Convention

Task outputs are stored as: **`ActivityName.StepName.outputKey`**

Outputs are written to both activityVariables and GlobalVariables, so later steps and activities can access them.

```yaml
activities:
  - name: Data
    steps:
      - task: "Query/GraphQL"
        name: GetOrder
        outputs:
          - name: order
            mapping: "order"
# Output accessible as: Data.GetOrder.order
# Nested: Data.GetOrder.order.orderNumber
```

If `continueOnError: true` and the step fails, the error is stored at `ActivityName.StepName.error`.

### System Variables (auto-injected)

| Variable | Description |
|----------|-------------|
| `workflowId` | Current workflow ID |
| `organizationId` | Organization ID |
| `currentUserId` | Triggering user ID |
| `executionId` | Unique execution ID |
| `triggerType` | `Entity` or `Manual` |
| `eventType` | `Added`, `Modified`, `Deleted` |
| `position` | `Before` or `After` |
| `entityName` | Entity name that triggered |
| `entityId` | Entity ID that triggered |
| `data` | Entity data for entity triggers |
| `entity` | Entity object for entity triggers |
| `changes` | Changed fields array for Modified triggers |

### Conditions (apply to any step/activity)

Any step or activity can have `conditions`. All must evaluate to `true` (AND logic) or the step is skipped.

```yaml
steps:
  - task: "Utilities/Log@1"
    name: LogActive
    conditions:
      - expression: "[status] = 'Active'"
      - expression: "isNullOrEmpty([Data.GetOrder.order?]) = false"
    inputs:
      message: "Order is active"
```

### Workflow Events

```yaml
events:
  - type: onWorkflowStarted     # Before workflow execution
    steps: [...]
  - type: onWorkflowExecuted    # After workflow execution (finally)
    steps: [...]
  - type: onWorkflowFailed      # On unhandled error
    steps: [...]
```

Activities support: `onActivityStarted`, `onActivityExecuted`, `onActivityFailed`.

### Task Naming Convention

Format: **`Namespace/TaskName@Version`** — version is optional. Without version, the highest available version is used.

```yaml
- task: "Utilities/Log@1"        # Explicit version 1
- task: "Utilities/HttpRequest"  # Uses highest version
- task: "Query/GraphQL"          # No version = latest
- task: "foreach"                # Control flow tasks have no namespace
```

---

## Variable References & Expressions

There are **two distinct syntaxes** for referencing variables, used in different contexts:

### Template Expressions: `{{ path }}` (in step inputs)

Used in step `inputs` values. Resolves variable paths from scoped variables.

```yaml
inputs:
  orderId: "{{ inputs.orderId }}"                    # Simple reference
  url: "{{ chopinConfig.baseUrl }}/api/v1"           # String interpolation
  order: "{{ Data.GetOrder.order }}"                 # Raw object (single {{ }})
  name: "Order {{ Data.GetOrder.order.orderNumber }}" # String interpolation (multiple)
```

**Key behavior**: A single `{{ path }}` returns the **raw object** (preserving type). Multiple `{{ }}` in a string returns string interpolation.

#### Type Converters (prefix in {{ }})

```yaml
organizationId: "{{ int organizationId }}"
amount: "{{ decimal totalAmount }}"
isActive: "{{ bool isActive }}"
flag: "{{ boolOrFalse someFlag }}"        # null → false
notes: "{{ emptyIfNull notes }}"          # null → ""
notes: "{{ nullIfEmpty notes }}"          # "" → null
config: "{{ fromJson configJsonString }}" # JSON string → object
payload: "{{ toJson someObject }}"        # Object → JSON string
name: "{{ trim value }}"
```

#### Value Directives (in YAML input mappings)

**`expression`** — Evaluate NCalc expression as a value:
```yaml
amount:
  expression: "[price] * [quantity]"
```

**`coalesce`** — First non-null value:
```yaml
displayName:
  coalesce:
    - "{{ customer.name? }}"
    - "{{ customer.email? }}"
    - "Unknown"
```

**`foreach`** (value context) — Transform collections inline:
```yaml
commodities:
  foreach: "sourceCommodities"
  item: "item"
  conditions: "[item.isActive] = true"
  mapping:
    name: "{{ item.name }}"
    quantity: "{{ item.qty }}"
```

**`switch`** (value context) — Value-based switch:
```yaml
perLb:
  switch: "{{ contact.commissionTier }}"
  cases:
    "tier1": "{{ rate.customValues.commission_per_lb_tier1 }}"
    "tier2": "{{ rate.customValues.commission_per_lb_tier2 }}"
  default: "0"
```

**`extends`** — Extend/merge an existing object:
```yaml
orderData:
  extends: "{{ existingOrder }}"
  mapping:
    status: "Updated"
    notes: "{{ newNotes }}"
```

**`$raw`** — Prevent template parsing (pass as-is):
```yaml
template:
  $raw: "This {{ won't }} be parsed"
```

### NCalc Expressions: `[variable]` (in conditions and expression directives)

Used in `conditions[].expression`, `switch` case `when`, and `expression:` value directives. Variables use **square bracket** `[name]` syntax.

```yaml
conditions:
  - expression: "[status] = 'Active' AND [amount] > 100"
  - expression: "isNullOrEmpty([Data.GetOrder.order?]) = false"
  - expression: "any([changes], [each.key] = 'Status') = true"
```

#### Operators

| Type | Operators |
|------|-----------|
| Comparison | `=`, `!=`, `<>`, `<`, `>`, `<=`, `>=` |
| Logical | `AND`, `OR`, `NOT` (also `&&`, `\|\|`, `!`) |
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Ternary | `if(condition, trueVal, falseVal)` |
| Membership | `in(value, val1, val2, ...)` |

#### Collection Functions

| Function | Description |
|----------|-------------|
| `any([items], [each.prop] = 'val')` | True if any item matches |
| `all([items], [each.prop] > 0)` | True if all items match |
| `count([items])` | Count items |
| `sum([items], [each.amount])` | Sum values (optional accessor) |
| `first([items], [item.name])` | First item (optional accessor) |
| `last([items], [item.name])` | Last item (optional accessor) |
| `distinct([items])` | Remove duplicates |
| `reverse([items])` | Reverse collection or string |
| `contains([source], 'needle')` | Check if string/collection contains value |
| `removeEmpty([items])` | Remove null/empty items |
| `concat([list1], [list2])` | Concatenate collections |
| `groupBy([items], [item.category])` | Group items → `[{key, items}]` |
| `join([items], [each.name], ',')` | Join collection values with separator |
| `split([fullName], ' ')` | Split string into list |

#### String Functions

| Function | Description |
|----------|-------------|
| `isNullOrEmpty([var])` | True if null, empty string, or empty list |
| `length([var])` | String length or collection count |
| `lower([name])` / `upper([code])` | Case conversion |
| `left([code], 3)` / `right([code], 3)` | Substring from left/right |
| `replace([name], ' ', '-')` | String replacement |
| `trim([value])` | Trim whitespace |
| `format('{0}-{1}', [prefix], [id])` | String.Format style formatting |
| `base64([value])` / `fromBase64([encoded])` | Base64 encode/decode |
| `bool([value])` | Convert to boolean |

#### Date Functions

| Function | Description |
|----------|-------------|
| `now()` | Current UTC datetime |
| `now('yyyy-MM-dd', 'en-US')` | Formatted current time |
| `addDays([created], 30)` | Add days to date (negative to subtract) |
| `addHours([created], 2)` | Add hours to date |
| `formatDate([date], 'dd/MM/yyyy', 'en-US')` | Format date |
| `dateFromUnix([unixTime])` | Unix timestamp → DateTimeOffset |
| `dateToUtc([localDate])` | Convert to UTC |

#### Math Functions (NCalc built-in)

`Abs(x)`, `Ceiling(x)`, `Floor(x)`, `Round(x, decimals)`, `Min(x, y)`, `Max(x, y)`, `Pow(x, y)`, `Sqrt(x)`, `Truncate(x)`

### Property Path Syntax (in collection, mapping, variable paths)

Used in `collection:` (foreach), `mapping:` (outputs), and variable resolution.

| Pattern | Description | Example |
|---------|-------------|---------|
| `a.b.c` | Dot-separated nested path | `order.customer.name` |
| `prop?` | Optional access (null if missing) | `order.customer?.name?` |
| `list[0]` | Array index | `items[0]` |
| `list[^1]` | Index from end (last item) | `items[^1]` |
| `list[*]` | Flatten/wildcard (all items) | `containers[*].commodities` |
| `list[**]` | Recursive flatten (all depths) | `containerCommodities[**]` |
| `list[condition]` | Filter by condition | `items[status=Active]` |
| `dict['key']` | Dictionary key access | `customValues['myField']` |

---

## System Tasks (Control Flow)

The engine has exactly 3 built-in control-flow tasks. These are handled directly by the executor, not by task handlers.

### foreach — Iterate over collection

```yaml
- task: foreach
  name: ProcessItems
  collection: "Data.GetOrders.result.items"  # Path to array in activity variables
  item: "currentOrder"                       # Variable name (default: "item")
  continueOnError: false
  conditions:                                # Optional: check before entering loop
    - expression: "isNullOrEmpty([Data.GetOrders.result.items]) = false"
  steps:
    - task: "Utilities/Log@1"
      name: LogItem
      inputs:
        message: "Processing: {{ currentOrder.orderNumber }}"
```

**Implicit variables per iteration**: `index` (zero-based counter), `{item}` (current item from collection).

### switch — Conditional branching

Evaluates cases in order, executes the **first** matching case (implicit break). Optional `default` fallback.

```yaml
- task: switch
  name: RouteByStatus
  cases:
    - when:
        - expression: "[Data.GetOrder.order.status] = 'Active'"
      description: "Active orders"
      steps:
        - task: "Utilities/Log@1"
          name: LogActive
          inputs:
            message: "Order is active"

    - when:
        - expression: "[Data.GetOrder.order.status] = 'Draft'"
      steps:
        - task: "Utilities/Log@1"
          name: LogDraft
          inputs:
            message: "Order is draft"

  default:
    - task: "Utilities/Log@1"
      name: LogOther
      inputs:
        message: "Unknown status"
```

**case.when**: Array of conditions (all must be true). Uses NCalc `[variable]` syntax.

### while — Loop with condition

```yaml
- task: while
  name: PageLoop
  maxIterations: 100                         # Safety limit (default: 10000)
  conditions:
    - expression: "[hasMore] = true"
  steps:
    - task: "Query/GraphQL"
      name: FetchPage
      inputs:
        query: "..."
      outputs:
        - name: hasMore
          mapping: "response.hasMore"
```

**Implicit variable**: `iteration` (zero-based counter, removed after while completes).

---

## Task Reference (load by category)

Load the reference file for the task category you need:

!cat .claude/skills/cx-workflow/ref-utilities.md
!cat .claude/skills/cx-workflow/ref-query.md
!cat .claude/skills/cx-workflow/ref-entity.md
!cat .claude/skills/cx-workflow/ref-communication.md
!cat .claude/skills/cx-workflow/ref-filetransfer.md
!cat .claude/skills/cx-workflow/ref-accounting.md
!cat .claude/skills/cx-workflow/ref-other.md

### Quick Task Lookup

| Category | Tasks | Reference |
|----------|-------|-----------|
| Utilities | SetVariable, Log, Error, HttpRequest, Map, Template, Import, Export, CsvParse | ref-utilities.md |
| Query & Workflow | Query/GraphQL, Validation, Workflow/Execute | ref-query.md |
| Entity CRUD | Order, Contact, Commodity, Job, Charge, Discount, Inventory, Movement | ref-entity.md |
| Communication | Email/Send, Document/Render, Attachment, PdfDocument/Merge | ref-communication.md |
| File Transfer | Connect, Disconnect, ListFiles, Download, Upload, Move, Delete | ref-filetransfer.md |
| Accounting | AccountingTransaction, Payment, Number/Generate, SequenceNumber | ref-accounting.md |
| Other | User, Auth, Caching, EDI, Flow/Transition, Notes, AppModule, ActionEvent | ref-other.md |

---

# Flow Workflow YAML Reference

Flow workflows are declarative state machines for entity lifecycle management. Use `workflowType: Flow` in the workflow section.

## Top-Level Structure

```yaml
workflow:
  workflowId: "<uuid>"
  name: "Flow Workflow Name"
  workflowType: Flow                        # Required - identifies this as a Flow workflow
  executionMode: Async
  isActive: true
  priority: 75                              # 0-100, default 50
  tags: ["tag1"]
  agentInstruction: "AI guidance"           # Optional
  concurrency:
    enabled: true
    group: "groupName"
    waitTime: 30

entity:                                     # Required for Flow (replaces activities)
  name: <EntityName>
  type: <EntityType>                        # Required for Order, AccountingTransaction, Contact
  includes: [<navigation-paths>]            # Optional
  query: "<graphql-query>"                  # Optional

states: [...]                               # Required, at least 1 state
transitions: [...]                          # Required, at least 1 transition
aggregations: [...]                         # Optional
```

## Entity Section

Specifies which entity's lifecycle this flow manages.

### Valid Entity Names
Order, Commodity, AccountingTransaction, Workflow, OrganizationConfig, Contact, AppModule, Attachment, OrderCommodity, TrackingEvent, JobOrder

### Entity Types (required for specific entities)

**Order** requires type: Brokerage, ParcelShipment, Quote, WarehouseReceipt, AirShipmentOrder, OceanShipmentOrder, LoadOrder, DeliveryOrder
**AccountingTransaction** requires type: Invoice, Bill, CreditMemo
**Contact** requires type: Customer, Carrier, Vendor, Driver, Employee

```yaml
entity:
  name: Order
  type: ParcelShipment
  includes:
    - Commodities
    - Customer
    - Charges
  query: "{ commodities { id, quantity }, customer { name, email } }"
```

## States Section

Each state represents a status in the entity lifecycle.

```yaml
states:
  - name: Draft                             # Required, unique
    stage: Entry                            # Optional grouping label
    isInitial: true                         # At most 1 initial state
  - name: Active
    stage: Processing
  - name: AwaitingPickup
    parent: Active                          # Hierarchical state
  - name: InTransit
    parent: Active
    onEnter:                                # Steps on entering this state
      - task: SendEmail@1
        inputs:
          template: in_transit_notification
    onExit:                                 # Steps on exiting this state
      - task: Log@1
        inputs:
          message: "Leaving InTransit"
  - name: Delivered
    stage: Complete
    isFinal: true                           # Terminal state, no outgoing transitions
    requireConfirmation: true               # User must confirm before entering
    query: "{ charges { id, amount } }"     # State-specific data query
```

### State Rules
- **name**: Required, must be unique across all states
- **isInitial**: At most one state can be initial
- **isFinal**: Final states cannot be transition sources
- **parent**: References another state; parent cannot be initial or final; children inherit parent transitions

## Transitions Section

Define how entities move between states.

```yaml
transitions:
  - name: submit                            # Required, unique
    displayName: "Submit Order"             # Optional UI label
    from: Draft                             # Single state
    to: Submitted                           # Must be a leaf state (no children)
    trigger: manual                         # manual | auto | event

  - name: auto_approve
    from: Submitted
    to: Approved
    trigger: auto                           # Evaluated automatically
    priority: 10                            # Higher = checked first (default 50)
    conditions:
      - expression: "Order.Amount < 1000"

  - name: payment_received
    from: AwaitingPayment
    to: Paid
    trigger: event                          # External event-driven
    eventName: PaymentConfirmed             # Required when trigger is 'event'

  - name: bulk_transition
    from:                                   # Array of source states
      - Draft
      - Submitted
    to: Cancelled
    trigger: manual

  - name: force_cancel
    from: "*"                               # Wildcard: any non-final state
    to: Cancelled
    trigger: manual
    steps:                                  # Steps during transition
      - task: Log@1
        inputs:
          message: "Force cancelled"
```

### Trigger Types
- **manual**: User-initiated or API call
- **auto**: Automatic evaluation based on conditions; sorted by priority descending
- **event**: External event-driven; requires `eventName`

### From States
- Single state: `from: Draft`
- Multiple states: `from: [Draft, Submitted]`
- Wildcard (any non-final state): `from: "*"`

### Execution Order
1. Validate transition from current state
2. Execute `onExit` steps (from source state)
3. Execute transition `steps`
4. Update entity status
5. Execute `onEnter` steps (on target state)

## Aggregations Section

Reusable data queries for conditions.

```yaml
aggregations:
  - name: allItemsReceived                  # Required, unique
    expression: "all(Order.Commodities, item.ReceivedQuantity >= item.Quantity)"
  - name: totalWeight
    expression: "sum(Order.Commodities, item.Weight)"
  - name: hasAnyDamaged
    expression: "any(Order.Commodities, item.IsDamaged)"
  - name: itemCount
    expression: "count(Order.Commodities)"
  - name: chargesByType
    expression: "sum(Order.Charges, item.Amount)"
    parameter: chargeType                   # Optional parameter
```

### Valid Aggregation Functions
- **all(collection, predicate)** - All items match
- **any(collection, predicate)** - At least one matches
- **sum(collection, selector)** - Sum values
- **count(collection)** - Count items
- **first(collection)** - First item
- **last(collection)** - Last item
- **distinct(collection, selector)** - Unique values
- **groupBy(collection, selector)** - Group by value

---

# Generation Rules

1. **Always scaffold via CLI first** — never write a workflow YAML from scratch. The CLI generates `workflowId` (UUID), `filePath`, and boilerplate correctly.
2. **Follow naming conventions**:
   - Workflow step names: PascalCase (e.g., `GetEntity`, `ProcessItems`)
   - Variable names: camelCase (e.g., `entityData`, `processResult`)
   - State names: PascalCase (e.g., `Draft`, `InTransit`, `AwaitingPickup`)
   - Transition names: camelCase (e.g., `submit`, `autoApprove`, `forceCancel`)
3. **Template expressions** use `{{ expression }}` syntax (double curly braces)
4. **Do not change `workflowId` or `filePath`** — these are set correctly by the CLI scaffold
5. **Standard workflows** require `activities` with at least one step per activity
6. **Flow workflows** require `entity`, `states`, and `transitions` (no `activities`)
7. **Entity triggers** require `entityName` and `eventType`
8. **Flow entity type** is required for Order, AccountingTransaction, and Contact entities

## After Customization

Always validate the final YAML and fix any errors:
```bash
npx cx-cli <generated-file.yaml>
```
