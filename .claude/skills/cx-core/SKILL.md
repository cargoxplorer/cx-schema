---
name: cx-core
description: Shared CargoXplorer entity field reference — domain entities, field names, enums, and customValues patterns
argument-hint: <entity name or question about fields>
---

Shared domain reference for CargoXplorer entities. Used by `cx-workflow` and `cx-module` skills for entity field names, types, navigation properties, enums, and customValues extension patterns.

## CX Server Authentication & Management

The CLI can authenticate against CX environments and manage server resources. Auth is required for push, delete, execute, logs, publish, and org commands.

### Authentication

```bash
# Login to a CX environment (OAuth2 + PKCE — opens browser)
npx cx-cli login https://tms-v3-dev.usatrt.com

# Logout from a CX environment
npx cx-cli logout https://tms-v3-dev.usatrt.com

# List stored sessions
npx cx-cli logout
```

Sessions are stored in `~/.cxtms/` as JSON token files. The CLI auto-refreshes expired tokens.

### PAT Tokens (alternative to OAuth)

For CI/CD or headless environments, use Personal Access Tokens instead of interactive OAuth:

```bash
# Check PAT status and setup instructions
npx cx-cli pat setup

# Create a new PAT token (requires OAuth login first)
npx cx-cli pat create "my-ci-token"

# List active PAT tokens
npx cx-cli pat list

# Revoke a PAT token
npx cx-cli pat revoke <tokenId>
```

After creating a PAT, add to `.env` in your project root:
```
CXTMS_AUTH=pat_xxxxx...
CXTMS_SERVER=https://tms-v3-dev.usatrt.com
```

When `CXTMS_AUTH` is set, the CLI skips OAuth and uses the PAT token directly. `CXTMS_SERVER` provides the server URL (or set `server` in `app.yaml`).

### Organization Management

```bash
# List organizations on the server
npx cx-cli orgs list

# Select an organization interactively
npx cx-cli orgs select

# Set active organization by ID
npx cx-cli orgs use <orgId>

# Show current context (server, org, app)
npx cx-cli orgs use
```

The active org is cached in the token file and used by all server commands. Override with `--org <id>`.

### Session Resolution

Server commands resolve the target session in this order:
1. `CXTMS_AUTH` env var → PAT token auth (with `CXTMS_SERVER` or `app.yaml` server field)
2. `app.yaml` `server` field in CWD → matches stored OAuth session
3. Single stored session in `~/.cxtms/` → uses it automatically
4. Multiple sessions → error, asks to add `server` to `app.yaml`

### Publish

```bash
# Publish all modules and workflows from current project
npx cx-cli publish

# Publish only a specific feature directory
npx cx-cli publish --feature billing
npx cx-cli publish billing

# Publish with explicit org ID
npx cx-cli publish --org 42
```

Validates all YAML files first, then pushes modules and workflows to the server. Skips files with validation errors and reports results.

---

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

Use `--feature <feature_name>` with `cx-cli create` to automatically place files in the correct location.

## Entity Field Reference

### Primary Entities

!cat .claude/skills/cx-core/ref-entity-order.md
!cat .claude/skills/cx-core/ref-entity-contact.md
!cat .claude/skills/cx-core/ref-entity-commodity.md
!cat .claude/skills/cx-core/ref-entity-accounting.md

### Order Sub-Entities & Related

!cat .claude/skills/cx-core/ref-entity-order-sub.md
!cat .claude/skills/cx-core/ref-entity-job.md

### Pricing & Accounting Lookups

!cat .claude/skills/cx-core/ref-entity-rate.md

### Shared & Lookup Entities

!cat .claude/skills/cx-core/ref-entity-shared.md
!cat .claude/skills/cx-core/ref-entity-geography.md

### Warehouse & Inventory

!cat .claude/skills/cx-core/ref-entity-warehouse.md

| Category | Entities | Reference |
|----------|----------|-----------|
| **Primary** | Order, Contact, Commodity, AccountingTransaction | ref-entity-order/contact/commodity/accounting.md |
| **Order sub** | OrderEntity, TrackingEvent, EventDefinition, LinkedOrder, OrderDocument | ref-entity-order-sub.md |
| **Job** | Job, JobOrder, JobStatus | ref-entity-job.md |
| **Pricing** | Rate, Lane, Discount, AccountingItem, AccountingAccount, PaymentTerm | ref-entity-rate.md |
| **Shared** | Tag, Attachment, Division, EquipmentType, PackageType, Note/NoteThread | ref-entity-shared.md |
| **Geography** | Country, State, City, Port, Vessel, CustomCode, ModeOfTransportation | ref-entity-geography.md |
| **Warehouse** | InventoryItem, WarehouseLocation, CargoMovement (Order variant) | ref-entity-warehouse.md |

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
