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
| `orderSummary` | `OrderSummaryView` | One-to-one summary view; supports nested sort paths like `orderSummary.totalPieces` |
| `division` | `Division` | `.name` |
| `equipmentType` | `EquipmentType` | |
| `billToContact` | `Contact` | Full contact object |
| `employeeContact` | `Contact` | |
| `salespersonContact` | `Contact` | |
| `organization` | `Organization` | |
| `entityType` | `EntityType` | |
| `createdUser` | `User` | `.firstName`, `.lastName`, `.email` |
| `updatedUser` | `User` | |

## Workflow Trigger Payload Notes

Order entity triggers include scalar status fields (`orderStatusId`, `orderStatusName`) in the lightweight workflow payload. `orderStatusName` is loaded before mapping when needed, so modified-order workflows and Flow auto-transition expressions can rely on it even if the EF event did not preload the `orderStatus` navigation.

## Search Behavior

Order GraphQL quick search (`orders(search:)` and `orderGroupBy(search:)`) matches core order fields plus related commodity and inventory item fields. InventoryItem data linked from an order commodity, including child/container commodities, is searchable by `sku`, `productName`, `description`, `modelNumber`, and JSON `customValues`. Use this for warehouse-backed order lookup by SKU, item name, model number, color, size, or similar item attributes.

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
| `relatedDispatchRoutes` | `[DispatchRoute]` | Routes linked through dispatch route stop order attachments; supports `filter` and `orderBy`; draft orders return an empty list |
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
| `getTerminal(idPropertyName)` | `Terminal` | Resolve terminal from int `customValues[idPropertyName]` |
| `getPort(idPropertyName)` | `Port` | Resolve port from `customValues[idPropertyName]` |
| `getTerminal(idPropertyName)` | `Terminal` | Resolve terminal from `customValues[idPropertyName]` |
| `getVessel(idPropertyName)` | `Vessel` | Resolve vessel from `customValues[idPropertyName]` |
| `getCountry(idPropertyName)` | `Country` | Resolve country from `customValues[idPropertyName]` |
| `getRoute(idPropertyName)` | `Route` | Resolve route from `customValues[idPropertyName]` |
| `getModeOfTransportation(idPropertyName)` | `ModeOfTransportation` | |
| `getCustomCode(idPropertyName)` | `CustomCode` | |
| `getRelatedOrderByProperty(idPropertyName)` | `Order` | Resolve related order from `customValues[idPropertyName]` |
| `relatedDispatchRoutes(filter, orderBy)` | `[DispatchRoute]` | Routes linked through dispatch route stop order attachments; draft orders return an empty list |
| `getCharge(chargeDescription)` | `Charge` | Single charge by description |
| `getChargesByChargeType(chargeType)` | `[Charge]` | Charges filtered by type |
| `getOrderSummary(weightUnit, volumeUnit, dimensionsUnit)` | `OrderSummary` | |
| `lastTrackingEvent(eventDefinitionName, orderBy?)` | `TrackingEvent` | Most recent (or earliest) tracking event, resolved via batched DataLoader. `orderBy` is **honoured**: omit or prefix with `-` for DESC (latest event: `COALESCE(EventDate, Created) DESC, TrackingEventId DESC`); no prefix for ASC (earliest event: same columns ASC). Default is DESC. |
| `businessDays(path: String!, contactId?: Int)` | `int?` | Business days from the date at `path` to today, using the org business calendar. Optional `contactId` scopes availability blocks to org-wide plus matching contact blocks. Instant values are converted to the org timezone before taking the date; date-only values are not timezone-shifted. Returns `null` if path does not resolve or value is not parseable. |
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
- `terminalId` — terminal reference; sortable/filterable with `customValues.terminalId->terminal.name`
- `deliveryLocationId` — contact-address reference; sortable/filterable with `customValues.deliveryLocationId->contactAddress.name`
- `returnLocationId` — terminal or contact-address return-location reference; sortable/filterable with `customValues.returnLocationId->terminal.name` or `customValues.returnLocationId->contactAddress.name`

**Join expression pattern** — Order queries can sort and filter by properties of entities referenced from `customValues` using `customValues.key->entity.property`. Supported aliases include `contact`, `order`, `modeOfTransportation`, `country`, `terminal`, `contactAddress`, and `port`.

```graphql
orders(
  organizationId: 1
  orderBy: "customValues.deliveryLocationId->contactAddress.name"
  filter: "customValues.returnLocationId->contactAddress.name:Chicago*"
) { items { orderId orderNumber } }

orders(
  organizationId: 1
  orderBy: "customValues.portId->port.name"
) { items { orderId orderNumber } }
```

**Resolver pattern** — Many GraphQL fields resolve entities from customValues IDs:
`getContact(idPropertyName)` reads `customValues[idPropertyName]` as a contact ID and returns the full Contact object. `getTerminal(idPropertyName)` uses the same pattern for terminal IDs. Same pattern for ports, vessels, countries, routes, etc.
