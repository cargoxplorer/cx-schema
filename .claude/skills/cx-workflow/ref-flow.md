# Flow Workflow YAML Reference

## Contents
- Flow top-level structure (workflowType, entity, states, transitions, aggregations)
- Flow entity section (entity name, type, includes, query)
- Flow states section (initial, final, parent hierarchy, onEnter/onExit steps)
- Flow transitions section (manual, auto, event triggers; from/to states; conditions)
- Flow aggregations section (reusable collection expressions: all, any, sum, count)

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
      - task: "Email/Send"
        inputs:
          template: in_transit_notification
    onExit:                                 # Steps on exiting this state
      - task: "Utilities/Log@1"
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
- **isInitial**: At most one state can be initial. When an entity has null status, the engine resolves it to the initial state automatically.
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
      - task: "Utilities/Log@1"
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
