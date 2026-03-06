# Order Sub-Entity Field Reference

## Contents
- OrderEntity
- TrackingEvent
- EventDefinition
- LinkedOrder
- OrderDocument

Entities associated with orders: OrderEntity (parties), TrackingEvent, LinkedOrder, OrderDocument.

## OrderEntity

Represents a party role (Shipper, Consignee, Carrier, etc.) on an order.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `orderEntityId` | `int` | PK |
| `orderId` | `int` | FK to Order |
| `contactId` | `int?` | FK to Contact |
| `contactAddressId` | `int?` | FK to ContactAddress |
| `nonContactName` | `string?` | Name when no contact linked |
| `entityType` | `EntityTypes` enum | Shipper, Consignee, Carrier, etc. |
| `orderEntitySequence` | `int` | Sort order |
| `isDeleted` | `bool?` | Soft delete |
| `customValues` | `Dictionary` | jsonb |

### Navigation

| Field | Type |
|-------|------|
| `contact` | `Contact?` |
| `contactAddress` | `ContactAddress?` |

### GraphQL Computed

- `contactName` — mapped from `contact.name`
- `attachments` — filterable collection
- `getOrderEntityAttachments(idPropertyName, filter, orderBy, search)` — resolver

### EntityTypes Enum

Shipper=0, Consignee=1, Carrier=2, Vendor=3, UltimateConsignee=4, NotifyParty=5, Intermediate=6, ForwardingAgent=7, DestinationAgent=8, PickupFrom=9, DeliverTo=10, DeliveryCarrier=11, ReceivedBy=12, USPPI=13

---

## TrackingEvent

Milestone/tracking event on an order or commodity.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `trackingEventId` | `int` | PK |
| `eventDefinitionId` | `int` | FK to EventDefinition |
| `eventDate` | `DateTime?` | When the event occurred |
| `description` | `string?` | |
| `location` | `string?` | |
| `isInactive` | `bool` | |
| `includeInTracking` | `bool` | Show in tracking UI |
| `sendEmail` | `bool` | Trigger email notification |
| `customValues` | `Dictionary` | jsonb |

### Navigation

| Field | Type |
|-------|------|
| `eventDefinition` | `EventDefinition` |

---

## EventDefinition

Template/type definition for tracking events.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `eventDefinitionId` | `int` | PK |
| `eventName` | `string` | |
| `description` | `string?` | |
| `location` | `string?` | Default location |
| `isInactive` | `bool` | |
| `includeInTracking` | `bool` | Default for events |
| `sendEmail` | `bool` | Default for events |
| `sendEmailDocumentId` | `int?` | FK to DocumentTemplate |
| `isAutomaticCreate` | `bool` | Auto-create on triggers |
| `triggerEventName` | `string?` | Trigger config |
| `triggerEntityName` | `string?` | |
| `triggerConditionFields` | `string?` | |
| `customValues` | `Dictionary` | jsonb |

---

## LinkedOrder

Links between orders (source → target).

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `sourceOrderId` | `int` | FK to Order (source) |
| `targetOrderId` | `int` | FK to Order (target) |
| `isDeleted` | `bool` | Soft delete |
| `customValues` | `Dictionary` | jsonb |

### Navigation

| Field | Type |
|-------|------|
| `sourceOrder` | `Order` |
| `targetOrder` | `Order` |

---

## OrderDocument

Document template linked to an order for generation.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `orderDocumentId` | `int` | PK |
| `orderId` | `int` | FK to Order |
| `documentTemplateId` | `int?` | FK to DocumentTemplate |
| `workflowId` | `Guid?` | FK to Workflow (for generation) |
| `lastGeneratedFile` | `string?` | File path/key |
| `lastGeneratedTime` | `DateTime?` | |
| `regenerateOnOrderChange` | `bool` | Auto-regenerate |
| `metadata` | `Dictionary` | jsonb — auto-populated keys: `orderId`, `orderPickupId`, `orderDeliveryId`, `thirdPartyContactId`, `carrierId` |

### Navigation

| Field | Type |
|-------|------|
| `order` | `Order` |
| `documentTemplate` | `DocumentTemplate?` |

### GraphQL Computed

- `getLinkToDocument(expiresInDays)` — returns signed URL
