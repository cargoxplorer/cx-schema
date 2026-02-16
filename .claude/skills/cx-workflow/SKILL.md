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

```bash
# Standard workflow — scaffold with basic template
npx cx-cli create workflow <name> --template basic

# Standard workflow — inside a feature folder
npx cx-cli create workflow <name> --template basic --feature <feature-name>

# Full scaffold (includes GraphQL, switch, variables, outputs)
npx cx-cli create workflow <name>
npx cx-cli create workflow <name> --feature <feature-name>
```

Choose the name based on the user's description (kebab-case). Use `--feature` when the workflow belongs to a specific feature. Use `--template basic` (recommended) to get a minimal starting point.

### Step 2: Read the generated file

Read the generated YAML file so you have the scaffold with the correct workflowId, filePath, and structure.

### Step 3: Customize for the use case

Determine whether this is a **standard** workflow (sequential automation with activities and steps) or a **Flow** workflow (declarative state machine for entity lifecycle management).

Edit the generated file to add/modify:
- **workflow metadata**: update `name`, `description`, `executionMode`, `workflowType`, `tags`, etc.
- **inputs**: add/change input parameters for the use case
- **variables**: add workflow-scoped variables as needed
- **activities & steps**: replace the placeholder Log step with the actual task steps
- **outputs**: add output mappings if the workflow returns data
- **triggers**: update triggers (Manual, Entity, Schedule) as needed
- For **Flow workflows**: remove `activities`, add `entity`, `states`, `transitions`, `aggregations`

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

## Workflow Task Types

### Control Flow

**foreach** - Iterate over collection
```yaml
- task: foreach
  name: ProcessItems
  collection: "GetData.items"               # Path to array
  item: "currentItem"                       # Variable name (default: "item")
  index: "i"                                # Optional index variable
  parallel: true                            # Optional parallel execution
  maxParallelism: 5
  steps: [...]
```

**switch** - Conditional branching
```yaml
- task: switch
  name: CheckStatus
  cases:
    - when: "GetData.status == 'Active'"
      steps: [...]
    - when: "GetData.status == 'Pending'"
      steps: [...]
  default:
    steps: [...]
```

**while** - Loop with condition
```yaml
- task: while
  name: PollUntilReady
  conditions:
    - expression: "status != 'Complete'"
  maxIterations: 100
  steps: [...]
```

### Data & Utilities

**Query/GraphQL** - Execute GraphQL queries
```yaml
- task: "Query/GraphQL"
  name: GetEntity
  inputs:
    query: |
      query GetEntity($id: ID!) {
        entity(id: $id) { id name status }
      }
    variables:
      id: "{{ inputs.entityId }}"
    cacheKey: "entity-{{ inputs.entityId }}"
    cacheDuration: "5m"
  outputs:
    - name: entityData
      mapping: "data.entity"
```

**Utilities/SetVariable@1** - Set workflow variables
```yaml
- task: "Utilities/SetVariable@1"
  name: SetResult
  inputs:
    variables:
      - name: processResult
        value: { success: true, processedAt: "{{ now() }}" }
```

**Utilities/Log@1** - Log messages
```yaml
- task: "Utilities/Log@1"
  name: LogInfo
  inputs:
    message: "Processing entity {{ inputs.entityId }}"
    level: Information                      # Debug | Information | Warning | Error
    data: { entityId: "{{ inputs.entityId }}" }
```

**Utilities/HttpRequest@1** - HTTP API calls
```yaml
- task: "Utilities/HttpRequest@1"
  name: CallExternalApi
  inputs:
    url: "https://api.example.com/resource"
    method: GET | POST | PUT | PATCH | DELETE
    contentType: "application/json"
    headers:
      - name: "Authorization"
        value: "Bearer {{ variables.apiToken }}"
    body: { key: "value" }
    timeout: 30000
    retry: { count: 3, delay: 1000 }
    cache: { key: "api-cache", duration: "5m" }
  outputs:
    - name: apiResponse
      mapping: "body"
```

### Communication

**Email/Send** - Send emails
```yaml
- task: "Email/Send"
  name: SendNotification
  inputs:
    to: "{{ recipient.email }}"             # String or array
    cc: ["manager@example.com"]
    subject: "Order {{ orderId }} Update"
    body: "<p>Your order has been updated.</p>"
    template: "order-notification"          # Or use template name
    templateData: { orderId: "{{ orderId }}", status: "{{ status }}" }
    attachments:
      - fileName: "report.pdf"
        content: "{{ renderedDocument }}"
        contentType: "application/pdf"
```

### Documents

**Document/Render** - Render documents from templates
```yaml
- task: "Document/Render"
  name: RenderInvoice
  inputs:
    template:
      content: "<html>...</html>"
      engine: handlebars | jsrender
      recipe: html | chrome-pdf | xlsx | docx | csv
      chrome:
        landscape: false
        format: "A4"
        marginTop: "1cm"
    data: { order: "{{ GetOrder.order }}" }
  outputs:
    - name: renderedDoc
      mapping: "content"
```

**Document/Send** - Send rendered documents

### Entity Operations

**Order/Create@1, Order/Update@1, Order/Update@2, Order/Delete@1, Order/Get@1**
```yaml
- task: "Order/Create@1"
  name: CreateOrder
  inputs:
    orderType: "Purchase"
    entity: { customer: "{{ inputs.customerId }}", items: "{{ inputs.items }}" }
  outputs:
    - name: newOrder
      mapping: "order"
```

**Contact/Create@1, Contact/Update@1, Contact/Delete@1, Contact/Get@1** - Contact CRUD
**Job/Create@1, Job/Update@1, Job/Delete@1, Job/Get@1** - Job operations
**Commodity/** - Commodity operations
**Attachment/** - File attachment operations
**Charge/** - Charge/billing operations
**Payment/** - Payment processing
**Accounting/Transaction** - Accounting entries

### Other Tasks

**Workflow/Execute@1** - Execute child workflow
```yaml
- task: "Workflow/Execute@1"
  name: RunChildWorkflow
  inputs:
    workflowId: "<uuid>"                    # Or workflowName
    workflowInputs: { entityId: "{{ inputs.entityId }}" }
    async: false
    timeout: 60000
```

**Export** - Data export
**CSV** - CSV file processing
**Template** - Template rendering
**Map** - Data transformation/mapping
**Validation** - Data validation
**Error** - Throw error / error handling

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
