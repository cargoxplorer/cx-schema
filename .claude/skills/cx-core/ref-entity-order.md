# Order Entity Field Reference

## Contents
- Order Scalar Fields
- Order Navigation Properties
- Order Collection Properties
- Pre-filtered OrderEntity Collections (GraphQL)
- Order Computed/Resolved GraphQL Fields
- OrderTypes Enum
- EntityTypes Enum (for OrderEntity)
- Order CustomValues

Field names as used in workflow expressions: `{{ entity.orderId }}`, `{{ entity.customValues.myField }}`.

## Scalar Fields

| Field | Type | Notes |
|-------|------|-------|
| `orderId` | `int` | Primary key |
| `organizationId` | `int` | Tenant scope |
| `orderNumber` | `string` | Business-facing number |
| `trackingNumber` | `string?` | |
| `orderType` | `OrderTypes` enum | See enum below |
| `isDraft` | `bool` | Draft orders excluded from default queries |
| `orderStatusId` | `int` | FK to OrderStatus |
| `lastOrderStatusModified` | `DateTime?` | Auto-set on status change |
| `entityTypeId` | `int?` | FK to EntityType |
| `divisionId` | `int` | FK to Division |
| `equipmentTypeId` | `int?` | FK to EquipmentType |
| `billToContactId` | `int?` | FK to Contact |
| `employeeContactId` | `int?` | FK to Contact |
| `salespersonContactId` | `int?` | FK to Contact |
| `created` | `DateTime` | |
| `createdBy` | `string` | User ID |
| `lastModified` | `DateTime` | |
| `lastModifiedBy` | `string` | User ID |

## Navigation Properties

| Field | Type | Notes |
|-------|------|-------|
| `orderStatus` | `OrderStatus` | `.statusName`, `.statusStage` |
| `division` | `Division` | `.name` |
| `equipmentType` | `EquipmentType` | |
| `billToContact` | `Contact` | Full contact object |
| `employeeContact` | `Contact` | |
| `salespersonContact` | `Contact` | |
| `organization` | `Organization` | |
| `entityType` | `EntityType` | |
| `createdUser` | `User` | `.firstName`, `.lastName`, `.email` |
| `updatedUser` | `User` | |

## Collection Properties

| Field | Type | Notes |
|-------|------|-------|
| `orderEntities` | `[OrderEntity]` | Shipper, Consignee, Carrier, etc. (by `entityType`) |
| `charges` | `[Charge]` | Direct charges |
| `orderCommodities` | `[OrderCommodity]` | Join to commodities (has own `customValues`) |
| `trackingEvents` | `[TrackingEvent]` | Milestones |
| `orderDocuments` | `[OrderDocument]` | |
| `jobs` | `[Job]` | |
| `jobOrders` | `[JobOrder]` | |
| `orderTags` | `[OrderTag]` | |
| `orderCarriers` | `[OrderCarrier]` | |
| `allTags` | `[OrderAllTagsView]` | View: all tags including from commodities |
| `allRelatedOrders` | `[OrderRelatedOrdersView]` | Orders sharing commodities |
| `attachmentsSummary` | `OrderAttachmentSummaryView?` | DB view: `.totalCount`, `.hasAny` (active attachments) |
| `notesSummary` | `OrderNoteSummaryView?` | DB view: `.totalCount`, `.hasAny` (non-deleted notes) |
| `outgoingLinks` | `[LinkedOrder]` | |
| `incomingLinks` | `[LinkedOrder]` | |

## Pre-filtered OrderEntity Collections (GraphQL)

These are virtual fields that filter `orderEntities` by type:

| Field | EntityType |
|-------|------------|
| `orderEntityCarriers` | Carrier |
| `orderEntityVendors` | Vendor |
| `orderEntityPickups` | Shipper |
| `orderEntityDeliveries` | Consignee |
| `orderEntityDeliveryCarriers` | DeliveryCarrier |
| `orderEntityDeliverTo` | DeliverTo |
| `orderEntityPickupFrom` | PickupFrom |
| `orderEntityDestinationAgent` | DestinationAgent |
| `orderEntityForwardingAgent` | ForwardingAgent |
| `orderEntityIntermediate` | Intermediate |
| `orderEntityNotifyParty` | NotifyParty |
| `orderEntityUltimateConsignee` | UltimateConsignee |
| `orderEntityReceivedBy` | ReceivedBy |
| `orderEntityUsppi` | USPPI |

## Computed/Resolved GraphQL Fields

| Field | Returns | Notes |
|-------|---------|-------|
| `commoditySummary` | `CommoditySummary` | `.totalWeight`, `.totalPieces`, `.totalQuantity`, `.totalVolume` |
| `accountingSummary` | `AccountingSummary` | |
| `getContact(idPropertyName)` | `Contact` | Resolve contact from `customValues[idPropertyName]` |
| `getPort(idPropertyName)` | `Port` | Resolve port from `customValues[idPropertyName]` |
| `getVessel(idPropertyName)` | `Vessel` | Resolve vessel from `customValues[idPropertyName]` |
| `getCountry(idPropertyName)` | `Country` | Resolve country from `customValues[idPropertyName]` |
| `getRoute(idPropertyName)` | `Route` | Resolve route from `customValues[idPropertyName]` |
| `getModeOfTransportation(idPropertyName)` | `ModeOfTransportation` | |
| `getCustomCode(idPropertyName)` | `CustomCode` | |
| `getRelatedOrderByProperty(idPropertyName)` | `Order` | Resolve related order from `customValues[idPropertyName]` |
| `getCharge(chargeDescription)` | `Charge` | Single charge by description |
| `getChargesByChargeType(chargeType)` | `[Charge]` | Charges filtered by type |
| `getOrderSummary(weightUnit, volumeUnit, dimensionsUnit)` | `OrderSummary` | |
| `lastTrackingEvent(eventDefinitionName)` | `TrackingEvent` | Most recent |
| `attachmentsSummary` | `OrderAttachmentSummaryGqlDto` | `.totalCount` (int), `.hasAny` (bool) — batched DataLoader, backed by DB view |
| `notesSummary` | `OrderNoteSummaryGqlDto` | `.totalCount` (int), `.hasAny` (bool) — batched DataLoader, backed by DB view |
| `notesCount(threadFilter)` | `int` | |
| `changeHistory(startDate, endDate, maxResults)` | `[ChangeHistory]` | Audit trail |
| `getCommoditiesWithRelatedOrder(orderType!, filter?)` | `[Commodity]` | Leaf commodities linked to related orders of specified type. Traverses commodity hierarchy, excludes wrappers. |

## OrderTypes Enum

| Value | Int | Notes |
|-------|-----|-------|
| `Order` | 0 | Generic order |
| `Quote` | 1 | |
| `WarehouseReceipt` | 2 | Warehouse order |
| `Purchase` | 3 | Pickup order |
| `ParcelShipment` | 4 | |
| `AirShipmentOrder` | 5 | |
| `OceanShipmentOrder` | 6 | |
| `CargoMovement` | 7 | |
| `EntityType` | 8 | Type defined by EntityType |
| `PickupOrder` | 9 | |
| `LoadOrder` | 10 | |
| `BookingOrder` | 11 | |
| `Freight` | 12 | |
| `DeliveryOrder` | 13 | |

## EntityTypes Enum (for OrderEntity)

| Value | Int | Description |
|-------|-----|-------------|
| `Shipper` | 0 | Origin party |
| `Consignee` | 1 | Destination party |
| `Carrier` | 2 | Transport provider |
| `Vendor` | 3 | |
| `UltimateConsignee` | 4 | |
| `NotifyParty` | 5 | |
| `Intermediate` | 6 | |
| `ForwardingAgent` | 7 | |
| `DestinationAgent` | 8 | |
| `PickupFrom` | 9 | |
| `DeliverTo` | 10 | |
| `DeliveryCarrier` | 11 | |
| `ReceivedBy` | 12 | |
| `USPPI` | 13 | US Principal Party in Interest |

## CustomValues

`Dictionary<string, object?>` stored as PostgreSQL `jsonb`. Access in workflows:

```yaml
# Template expressions
value: "{{ entity.customValues.myField }}"
value: "{{ entity.customValues['my-field'] }}"

# NCalc conditions
conditions:
  - expression: "isNullOrEmpty([entity.customValues.myField?]) = false"

# Update via Order/Update task
inputs:
  orderId: "{{ entity.orderId }}"
  order:
    CustomValues.myField: "newValue"        # Dot notation (single field)
    customValues:                            # Bulk update (merge)
      field1: "value1"
      field2: "{{ computed }}"
```

**Known system customValues keys:**
- `modeOfTransportationId` / `modeOfTransportationIdDescription` — transport mode

**Resolver pattern** — Many GraphQL fields resolve entities from customValues IDs:
`getContact(idPropertyName)` reads `customValues[idPropertyName]` as a contact ID and returns the full Contact object. Same pattern for ports, vessels, countries, routes, etc.
