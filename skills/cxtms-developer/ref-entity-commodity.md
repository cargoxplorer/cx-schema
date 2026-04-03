# Commodity Entity Field Reference

## Contents
- Commodity Scalar Fields
- Commodity Navigation Properties
- Commodity Collection Properties
- Commodity Computed/Resolved GraphQL Fields
- Commodity Container/Child Pattern (Self-Referencing)
- CommodityTrackingNumber Sub-Entity
- OrderCommodity Join Entity
- Commodity Enums
- Commodity CustomValues
- CommodityEvent (Bridge Entity)

Field names as used in workflow expressions: `{{ entity.description }}`, `{{ entity.customValues.myField }}`.

## Scalar Fields

| Field | Type | Notes |
|-------|------|-------|
| `commodityId` | `int` | Primary key |
| `organizationId` | `int` | Tenant scope |
| `description` | `string` | Required |
| `pieces` | `int` | Number of pieces |
| `quantity` | `int?` | Inner quantity per piece |
| `unit` | `string?` | Unit of measure (e.g., "TV", "Pallet", "Kg") |
| `note` | `string?` | |
| `serialNumber` | `string?` | Domain only (not in GraphQL) |
| `isDeleted` | `bool?` | Soft delete |

### Weight Fields

| Field | Type | Notes |
|-------|------|-------|
| `weight` | `decimal?` | Per piece (or total if `weightByTotal`) |
| `weightTotal` | `decimal?` | Calculated: `weight * pieces` |
| `weightUnit` | `WeightUnit` enum | Lb, Kg |
| `weightByTotal` | `bool` | When true, weight = sum of children |

### Dimension Fields

| Field | Type | Notes |
|-------|------|-------|
| `length` | `decimal?` | |
| `width` | `decimal?` | |
| `height` | `decimal?` | |
| `dimensionsUnit` | `DimensionsUnit` enum | In, Cm, M, Ft |

### Volume Fields

| Field | Type | Notes |
|-------|------|-------|
| `volumePiece` | `decimal?` | Calculated: `L * W * H` converted to volumeUnit |
| `volumeTotal` | `decimal?` | Calculated: `pieces * volumePiece` |
| `volumeUnit` | `VolumeUnit` enum | Ft, Vlb, Vkg, M, In, Cm |

### Value Fields

| Field | Type | Notes |
|-------|------|-------|
| `unitaryValue` | `decimal?` | Value per unit |
| `unitaryValueTotal` | `decimal?` | Calculated: `unitaryValue * quantity * pieces` |
| `valueByTotal` | `bool` | When true, value = sum of children |

### Foreign Keys

| Field | Type | Notes |
|-------|------|-------|
| `commodityStatusId` | `int?` | FK to CommodityStatus |
| `commodityTypeId` | `int?` | FK to CommodityType |
| `packageTypeId` | `int?` | FK to PackageType |
| `warehouseLocationId` | `int?` | FK — cascades to children |
| `containerCommodityId` | `int?` | FK self-ref (parent commodity) |
| `jobId` | `Guid?` | FK to Job |
| `inventoryItemId` | `int?` | FK to InventoryItem |
| `billToContactId` | `int?` | FK to Contact |
| `created` | `DateTime` | |
| `createdBy` | `string` | User ID |
| `lastModified` | `DateTime` | |
| `lastModifiedBy` | `string` | User ID |

## Navigation Properties

| Field | Type | Notes |
|-------|------|-------|
| `commodityStatus` | `CommodityStatus` | `.statusName`, `.statusStage` |
| `commodityType` | `CommodityType` | `.code`, `.description` |
| `packageType` | `PackageType` | `.name` |
| `warehouseLocation` | `WarehouseLocation` | |
| `containerCommodity` | `Commodity` | Parent commodity |
| `job` | `Job` | |
| `inventoryItem` | `InventoryItem` | |
| `billToContact` | `Contact` | |
| `createdUser` | `User` | |
| `updatedUser` | `User` | |

## Collection Properties

| Field | Type | Notes |
|-------|------|-------|
| `containerCommodities` | `[Commodity]` | Child commodities in this container |
| `orderCommodities` | `[OrderCommodity]` | Join to orders (has own `customValues`) |
| `commodityTrackingNumbers` | `[CommodityTrackingNumber]` | Tracking numbers |
| `commodityTags` | `[CommodityTag]` | Tags (has own `customValues`) |
| `allTags` | `[CommodityAllTagsView]` | View: includes inherited tags |
| `trackingEvents` | `[TrackingEvent]` | |
| `shipments` | `[Order]` | Related orders (GraphQL) |

## Computed/Resolved GraphQL Fields

| Field | Returns | Notes |
|-------|---------|-------|
| `totalAmount` | `decimal` | Computed: `unitaryValue * quantity` |
| `packageTypeName` | `string` | From packageType.name |
| `trackingNumbers` | `[TrackingNumber]` | From commodityTrackingNumbers |
| `getChildCommodities(filter)` | `[Commodity]` | Child commodities |
| `getParentCommodity` | `Commodity` | Parent commodity |
| `getRelatedOrders(filter)` | `[Order]` | Related orders |
| `getRelatedOrder(filter)` | `Order` | First related order |
| `getCommodityTrackingNumber(idPropertyName)` | `TrackingNumber` | Lookup |
| `getCommodityAttachments(filter)` | `[Attachment]` | |
| `changeHistory(startDate, endDate, maxResults)` | `[ChangeHistory]` | Audit trail |

## Container/Child Pattern (Self-Referencing)

Commodities form a tree via `containerCommodityId`:

```
Container Commodity (parent)
  ├── Child Commodity 1
  ├── Child Commodity 2
  └── Child Commodity 3
```

- Parent → children: `containerCommodities` collection
- Child → parent: `containerCommodity` navigation
- When `weightByTotal=true`, weight is computed as sum of children
- Changing warehouse location on parent cascades to children
- Changing commodity status on parent cascades to children
- Deleting parent cascades to children

## CommodityTrackingNumber Sub-Entity

| Field | Type | Notes |
|-------|------|-------|
| `commodityTrackingNumberId` | `int` | PK |
| `trackingNumber` | `string` | |
| `trackingNumberType` | `string?` | BOL, PRO, PO, etc. |
| `isPrimary` | `bool` | |
| `syncOrderId` | `int?` | |

## OrderCommodity Join Entity

Links commodities to orders with per-association metadata:

| Field | Type | Notes |
|-------|------|-------|
| `commodityId` | `int` | |
| `orderId` | `int` | |
| `customValues` | `Dictionary` | **Own** customValues, separate from Commodity |
| `commodity` | `Commodity` | Navigation |
| `order` | `Order` | Navigation |

## Enums

### WeightUnit
`Lb`, `Kg`

### DimensionsUnit
`In`, `Cm`, `M`, `Ft`

### VolumeUnit
| Value | Description |
|-------|-------------|
| `Ft` | Cubic feet |
| `Vlb` | Volumetric lbs |
| `Vkg` | Volumetric kg |
| `M` | Cubic meters |
| `In` | Cubic inches |
| `Cm` | Cubic cm |

### CommodityStatusStage
`Pending=1`, `InProgress`, `Completed`

### CommodityStatus (enum, distinct from entity)
`Pending`, `OnRoute`, `Delivered`, `Cancelled`, `InQuote`, `OnHand`, `OnPacking`, `InTransit`

## CustomValues

`Dictionary<string, object?>` stored as PostgreSQL `jsonb`. Access in workflows:

```yaml
# Template expressions
value: "{{ entity.description }}"
value: "{{ entity.customValues.myField }}"
value: "{{ entity.containerCommodity.description }}"

# Access weight with unit conversion
weight: "{{ entity.weight }}"

# NCalc conditions
conditions:
  - expression: "[entity.pieces] > 0 AND isNullOrEmpty([entity.customValues.lotNumber?]) = false"

# Update via Commodity/Update task
inputs:
  commodityId: "{{ entity.commodityId }}"
  commodity:
    CustomValues.lotNumber: "LOT-001"
    CustomValues.hazmat: true
```

**Entities with own customValues:**
- `Commodity.customValues` — commodity-level fields
- `OrderCommodity.customValues` — per-order-per-commodity fields
- `CommodityType.customValues` — type-level fields
- `CommodityTag.customValues` — tag-level fields

---

## CommodityEvent (Bridge Entity)

Links tracking events to individual commodities for granular item-level tracking.

| Field | Type | Notes |
|-------|------|-------|
| `commodityEventId` | `int` | PK |
| `commodityId` | `int` | FK to Commodity |
| `trackingEventId` | `int` | FK to TrackingEvent |

**Navigation:** `commodity`, `trackingEvent` (with `eventDefinition`)

Used in Flow workflow aggregations:
```yaml
aggregations:
  - name: "hasCommodityEvent"
    parameter: "eventCode"
    expression: "any([Commodity.CommodityEvents], [each.TrackingEvent.EventDefinition.EventCode] = [eventCode])"
```
