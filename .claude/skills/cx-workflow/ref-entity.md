# Entity CRUD Tasks Reference

All entity tasks follow the `Namespace/Operation@Version` pattern. Outputs are stored as `ActivityName.StepName.outputKey`.

## Generic Entity Change

| Task | Description |
|------|-------------|
| `Entity/Change` | Generic entity change — modify custom values on the tracked entity. Designed for **Before** triggers where the entity hasn't been persisted yet. |

```yaml
- task: "Entity/Change@1"
  name: SetDefaults
  inputs:
    changes:
      customValues:
        region: "{{ parseAddress(Order.ShipToAddress).state }}"
        lastModifiedBy: "{{ currentUser.name }}"
```

> **Note**: Async "Before" triggers are forbidden. Before triggers must use `executionMode: Sync`.

## Order

| Task | Description |
|------|-------------|
| `Order/Create` | Create a new order |
| `Order/Update` (v1, v2) | Update order fields |
| `Order/Delete` | Delete an order |
| `Order/Get` | Get order by ID |
| `Order/Copy` | Copy/duplicate an order |
| `Order/Split` | Split order into multiple |
| `Order/Purge` | Purge order data |
| `Order/Import` | Import order from external data |
| `Order/RecalculateCharges` | Recalculate all charges |
| `Order/GenerateTrackingNumber` | Generate tracking number |
| `Order/GetCargoMovementByPalletQuery` | Query cargo movements by pallet |

```yaml
- task: "Order/Create@1"
  name: CreateOrder
  inputs:
    orderType: "ParcelShipment"
    entity:
      customer: "{{ inputs.customerId }}"
      status: "Draft"
  outputs:
    - name: order
      mapping: "order"
```

```yaml
- task: "Order/Update@2"
  name: UpdateOrder
  inputs:
    orderId: "{{ inputs.orderId }}"
    entity:
      status: "Active"
      notes: "Updated by workflow"
```

**Order/Import commodity fields**: When importing commodities, you can supply `packageTypeName` (string) instead of `packageTypeId`. The import handler resolves the name to an ID using an N+1-safe per-import cache (one DB query per unique package type name).

## Contact

| Task | Description |
|------|-------------|
| `Contact/Create` | Create contact |
| `Contact/Update` | Update contact |
| `Contact/Delete` | Delete contact |

## Contact Address

| Task | Description |
|------|-------------|
| `ContactAddress/Create` | Create address |
| `ContactAddress/Update` | Update address |
| `ContactAddress/Delete` | Delete address |
| `ContactAddress/Import` | Bulk import addresses |

## Contact Payment Method

| Task | Description |
|------|-------------|
| `ContactPaymentMethod/Create` | Create payment method |
| `ContactPaymentMethod/Update` | Update payment method |
| `ContactPaymentMethod/SendChargedAmount` | Send charged amount notification |
| `ContactPaymentMethod/VerifyChargedAmount` | Verify charged amount |

## Commodity

| Task | Description |
|------|-------------|
| `Commodity/Create` | Create commodity |
| `Commodity/Update` (v1, v2) | Update commodity |
| `Commodity/Split` | Split commodity into multiple |
| `Commodity/Repack` | Repack commodities |
| `Commodity/Unpack` | Unpack commodity |

## Commodity Tracking Number

| Task | Description |
|------|-------------|
| `CommodityTrackingNumber/Create` | Create tracking number |
| `CommodityTrackingNumber/Update` | Update tracking number |
| `CommodityTrackingNumber/Delete` | Delete tracking number |

## Job

| Task | Description |
|------|-------------|
| `Job/Create` | Create job |
| `Job/Update` | Update job |
| `Job/Delete` | Delete job |
| `Job/Assign` | Assign job to user/driver |
| `Job/Unassign` | Unassign job |

## Charge

| Task | Description |
|------|-------------|
| `Charge/Create` | Create charge |
| `Charge/Update` | Update charge |
| `Charge/Delete` | Delete charge |
| `Charge/DynamicUpdate` | Dynamic update (partial fields) |
| `Charge/Calculate` | Calculate charge amount |

```yaml
- task: "Charge/Create@1"
  name: CreateCharge
  inputs:
    orderId: "{{ inputs.orderId }}"
    chargeType: "Freight"
    amount: "{{ Data.GetRate.rate.amount }}"
    currency: "USD"
  outputs:
    - name: charge
      mapping: "charge"
```

## Discount

| Task | Description |
|------|-------------|
| `Discount/Update` | Update discount |

## Order Sub-Entities

| Task | Description |
|------|-------------|
| `OrderCommodity/Create` | Link commodity to order |
| `OrderCommodity/Update` | Update order-commodity link |
| `OrderCommodity/Delete` | Remove commodity from order |
| `OrderCharge/Create` | Create order charge |
| `OrderDocument/Create` | Create order document |
| `OrderDocument/Send` | Send order document |
| `OrderTrackingEvent/Create` | Create a single tracking event on an order |
| `OrderEntity/ChangeCustomValue` | Change custom field value |

```yaml
# Create a single tracking event
- task: "OrderTrackingEvent/Create@1"
  name: AddPickupEvent
  inputs:
    orderId: "{{ inputs.orderId }}"
    organizationId: "{{ inputs.organizationId }}"
    eventDefinitionName: "Picked Up"
    eventDate: "{{ utcNow() }}"
    description: "Package picked up from shipper"
    location: "{{ order.shipFromAddress?.city }}"
    includeInTracking: true
    sendEmail: false
    skipIfExists: true
    customValues?:
      carrierId: "{{ carrier.contactId }}"
      carrierEventCode: "PU"
```

## Inventory

| Task | Description |
|------|-------------|
| `InventoryItem/Create` | Create inventory item |
| `InventoryItem/Update` | Update inventory item |
| `InventoryItem/Delete` | Delete inventory item |

## Other

| Task | Description |
|------|-------------|
| `Movement/Create` | Create cargo movement |
| `Country/Create`, `Country/Update`, `Country/Delete` | Country CRUD |
| `Cities/Import` | Import cities |
| `Rate/Update` | Update rate |
| `TrackingEvent/Import` | Batch import tracking events into an order |

```yaml
# Batch import tracking events
- task: "TrackingEvent/Import@1"
  name: ImportEvents
  inputs:
    orderId: "{{ order.orderId }}"
    events: "{{ trackingEvents }}"
    matchByFields:
      - "eventDate"
      - "customValues.eventType"
      - "customValues.locationId"
    skipIfExists: true
    createEventDefinitions: true
    matchByEventDefinition:
      - "customValues.carrierId"
      - "customValues.carrierEventCode"
    eventDefinitionDefaults:
      includeInTracking: true
  outputs:
    - name: result
      mapping: "result?"
```

Each event in the `events` array: `eventDefinitionName` (required), `eventDate`, `description`, `location`, `includeInTracking`, `sendEmail`, `isInactive`, `customValues` (object).

Output `result`: `{ added, updated, skipped, failed, total, errors[] }`.

## Note

| Task | Description |
|------|-------------|
| `Note/Create` | Create note in a thread |
| `Note/Update` | Update note content |
| `Note/Delete` | Delete a note |
| `Note/Import` | Bulk import notes |
| `Note/Export` | Export notes for an entity |
| `Note/RenameThread` | Rename a note thread |

## Transmission

| Task | Description |
|------|-------------|
| `Transmission/Create` | Create transmission record linked to orders |
| `Transmission/Update` | Update transmission fields (dynamic) |
| `Transmission/Delete` | Delete transmission record |

Records inbound/outbound message transmissions (EDI, API, Email, Webhook) linked to orders.

```yaml
- task: "Transmission/Create@1"
  name: CreateTransmission
  inputs:
    organizationId: "{{ int organizationId }}"
    transmission:
      orderIds: "{{ orderIds }}"
      channel: "EDI"
      direction: "Outbound"
      messageType: "214"
      sender: "{{ senderISA }}"
      receiver: "{{ receiverISA }}"
      status: "Pending"
      endpoint: "{{ endpoint }}"
      protocol: "SFTP"
  outputs:
    - name: transmission
      mapping: "transmission"
```

```yaml
- task: "Transmission/Update@1"
  name: UpdateTransmission
  inputs:
    organizationId: "{{ int organizationId }}"
    transmissionId: "{{ int Main?.CreateTransmission?.transmission?.id? }}"
    transmission:
      status: "Sent"
      completedAt: "{{ now() }}"
```

```yaml
- task: "Transmission/Delete@1"
  name: DeleteTransmission
  inputs:
    organizationId: "{{ int organizationId }}"
    transmissionId: "{{ int inputs.transmissionId }}"
  outputs:
    - name: success
      mapping: "success"
```

**Create inputs:** `organizationId` (int, required), `transmission` object — `orderIds` (required, at least one), `channel`, `direction` (Inbound/Outbound), `messageType`, `sender`, `receiver`, `status`, `endpoint`, `protocol`, `correlationId` (auto-generated if omitted), `parentId`, `httpStatus`, `byteSize`, `retryCount`, `maxRetries`, `nextRetryAt`, `errorCode`, `errorMessage`, `customValues`, `headers`, `payloadRef`, `scheduledAt`, `startedAt`, `completedAt`, `durationMs`.

**Create outputs:** `transmission` (full TransmissionDto).
**Update inputs:** `organizationId`, `transmissionId`, `transmission` (dynamic partial fields).
**Delete outputs:** `success` (boolean).

**Status enum:** Pending, InProgress, Sent, Received, Delivered, Acknowledged, Rejected, Error, RetryScheduled, Cancelled, Expired, Accepted.

## Accounting Transaction (Additional)

| Task | Description |
|------|-------------|
| `AccountingTransaction/ApplyCredit` | Apply credit memo to invoices |
