# Warehouse & Inventory Entity Reference

## InventoryItem

SKU-level inventory tracking.

| Field | Type | Notes |
|-------|------|-------|
| `inventoryItemId` | `int` | PK |
| `organizationId` | `int` | |
| `sku` | `string` | Stock keeping unit |
| `productName` | `string?` | |
| `modelNumber` | `string?` | |
| `description` | `string?` | |
| `availableQuantity` | `int` | |
| `backOrderQuantity` | `int` | |
| `height` | `decimal?` | |
| `length` | `decimal?` | |
| `width` | `decimal?` | |
| `weight` | `decimal?` | |
| `volumePiece` | `decimal?` | |
| `dimensionsUnit` | `DimensionsUnit` enum | In, Cm, M, Ft |
| `weightUnit` | `WeightUnit` enum | Lb, Kg |
| `volumeUnit` | `VolumeUnit` enum | Ft, Vlb, Vkg, M, In, Cm |
| `useSerialNumbers` | `bool` | |
| `isInactive` | `bool` | |
| `customerContactId` | `int?` | FK to Contact |
| `manufacturerContactId` | `int?` | FK to Contact |
| `packageTypeId` | `int?` | FK to PackageType |
| `customValues` | `Dictionary` | jsonb |

### Navigation

| Field | Type |
|-------|------|
| `customerContact` | `Contact?` |
| `manufacturerContact` | `Contact?` |
| `packageType` | `PackageType?` |
| `commodities` | `[Commodity]` |
| `inventoryItemTags` | `[InventoryItemTag]` |
| `allTags` | `[InventoryItemAllTagsView]` |

### GraphQL Computed

- `getContact(idPropertyName)` — resolve contact from customValues

---

## WarehouseLocation

Physical storage zones/locations in warehouse.

| Field | Type | Notes |
|-------|------|-------|
| `warehouseLocationId` | `int` | PK |
| `organizationId` | `int` | |
| `code` | `string` | Location code |
| `description` | `string?` | |
| `locationType` | `LocationType` enum | See below |
| `height` | `decimal?` | |
| `length` | `decimal?` | |
| `width` | `decimal?` | |
| `maximumWeight` | `decimal?` | |
| `isInactive` | `bool` | |
| `customerId` | `int?` | FK to Contact |
| `parentZoneId` | `int?` | FK to WarehouseZone |

### LocationType Enum

Receiving, Storage, Replenishment, Picking, QualityControl, Shipping, Mobile, Other, Packing, Service, PutAway

### Navigation

`customer` (Contact), `parentWarehouseZone` (WarehouseZone), `commodities` ([Commodity]). No customValues.

---

## CargoMovement

**Not a separate entity** — implemented as `Order` with `orderType = CargoMovement` (value 7).

Movement-specific data stored in Order's `customValues`:

| CustomValues Key | Type | Notes |
|-----------------|------|-------|
| `movementStatus` | `string` | e.g., "Created" |
| `movementType` | `string` | |
| `destinationLocationId` | `string/int` | Warehouse location ID |
| `destinationLocationDescription` | `string` | |
| `transportationMode` | `string` | |
| `finalMileCarrier` | `string` | |

The Order's `trackingNumber` field serves as the pallet number for cargo movements.

```yaml
# Example: Query cargo movement in workflow
- task: "Query/GraphQL@1"
  name: GetMovement
  inputs:
    query: >-
      query($id: Int!, $orgId: Int!) {
        order(organizationId: $orgId, orderId: $id) {
          orderId orderNumber trackingNumber orderType
          customValues
        }
      }
    variables:
      id: "{{ int inputs.orderId }}"
      orgId: "{{ int organizationId }}"
```
