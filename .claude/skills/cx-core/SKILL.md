---
name: cx-core
description: >
  Provides shared CXTMS entity field reference — domain entities, field names, enums, and customValues patterns.
  Use when the user asks about CX entity fields, enums, customValues, entity relationships, or needs domain reference for Orders, Contacts, Commodities, Jobs, etc.
argument-hint: <entity name or question about fields>
---

Shared domain reference for CargoXplorer entities. Used by `cx-workflow` and `cx-module` skills for entity field names, types, navigation properties, enums, and customValues extension patterns.

## CX Server Authentication & Management

For CLI authentication, PAT tokens, org management, and publishing: see [ref-cli-auth.md](ref-cli-auth.md)

## GraphQL Querying & Audit History

For running GraphQL queries via CLI, filter syntax (Lucene), pagination, audit change history, and field discovery: see [ref-graphql-query.md](ref-graphql-query.md)

## Feature File Layout

All modules and workflows are organized under feature directories:

```
features/
  <feature_name>/
    modules/          # UI module YAML files
    workflows/        # Workflow YAML files
```

When creating new modules or workflows, always place them under the correct feature directory:
- `features/<feature_name>/modules/<name>-module.yaml`
- `features/<feature_name>/workflows/<name>.yaml`

Use `--feature <feature_name>` with `cxtms create` to automatically place files in the correct location.

## Entity Field Reference

Read the relevant entity reference file when needed for the current task. Do not load all files upfront.

| Category | Entities | Reference |
|----------|----------|-----------|
| **Primary** | Order, Contact, Commodity, AccountingTransaction | [ref-entity-order.md](ref-entity-order.md), [ref-entity-contact.md](ref-entity-contact.md), [ref-entity-commodity.md](ref-entity-commodity.md), [ref-entity-accounting.md](ref-entity-accounting.md) |
| **Order sub** | OrderEntity, TrackingEvent, EventDefinition, LinkedOrder, OrderDocument | [ref-entity-order-sub.md](ref-entity-order-sub.md) |
| **Job** | Job, JobOrder, JobStatus | [ref-entity-job.md](ref-entity-job.md) |
| **Pricing** | Rate, Lane, Discount, AccountingItem, AccountingAccount, PaymentTerm | [ref-entity-rate.md](ref-entity-rate.md) |
| **Shared** | Tag, Attachment, Division, EquipmentType, PackageType, Note/NoteThread | [ref-entity-shared.md](ref-entity-shared.md) |
| **Geography** | Country, State, City, Port, Vessel, CustomCode, ModeOfTransportation | [ref-entity-geography.md](ref-entity-geography.md) |
| **Warehouse** | InventoryItem, WarehouseLocation, CargoMovement (Order variant) | [ref-entity-warehouse.md](ref-entity-warehouse.md) |

## CustomValues Pattern

Most entities have `customValues` — a `Dictionary<string, object?>` stored as PostgreSQL `jsonb`:

- **Access (workflow)**: `{{ entity.customValues.fieldName }}` or `{{ entity.customValues['field-name'] }}`
- **Access (module)**: `customValues.fieldName` in GraphQL sort/filter paths
- **Update (workflow)**: `CustomValues.fieldName: "value"` (dot notation) or `customValues: { field: "value" }` (bulk merge)
- **Merge semantics**: upserts keys — does **not** replace entire dictionary
- **Full-text searchable**: included in PostgreSQL `tsvector` via `jsonb_to_tsvector`
- **GraphQL sort/filter**: use `CustomValues.fieldName` path — translates to `jsonb_extract_path_text`

### Entities with customValues

**Primary entities**: Order, Contact, Commodity, AccountingTransaction, Charge, Payment

**Sub-entities**: OrderEntity, OrderCommodity, ContactAddress, ContactPaymentMethod, CommodityType, CommodityTag, OrderTag, LinkedOrder, InventoryItemTag

**Lookup entities**: Job, JobStatus, Tag, Attachment, EventDefinition, Rate, Lane, Discount, AccountingItem, Port, Country, State, City, ModeOfTransportation

**Without customValues**: Division, EquipmentType, PackageType, Vessel, CustomCode, AccountingAccount, PaymentTerm, WarehouseLocation, JobOrder

### Audit Fields (AuditableEntity)

Most entities inherit these fields:

| Field | Type |
|-------|------|
| `created` | `DateTime` |
| `createdBy` | `string` (user ID) |
| `lastModified` | `DateTime` |
| `lastModifiedBy` | `string` (user ID) |
| `createdUser` | `User` navigation |
| `updatedUser` | `User` navigation |

### Entity Kind Mapping

Used in module `entityKind` and Flow workflow `entity.name`:

| EntityKind | Entities |
|------------|----------|
| `Order` | Order (all types: Brokerage, ParcelShipment, Quote, WarehouseReceipt, etc.) |
| `Contact` | Contact (all types: Customer, Carrier, Vendor, Driver, Employee, etc.) |
| `OrderEntity` | OrderEntity (Shipper, Consignee, Carrier roles on an order) |
| `AccountingTransaction` | Invoice, Bill, CreditMemo |
| `Commodity` | Commodity |
| `Calendar` | CalendarEntity |
| `CalendarEvent` | CalendarEvent |
| `Other` | Any custom entity |
