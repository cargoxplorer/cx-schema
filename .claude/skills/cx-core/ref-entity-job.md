# Job Entity Field Reference

Job groups related orders and accounting transactions.

## Job

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | `Guid` | PK (UUID) |
| `organizationId` | `int` | Tenant scope |
| `jobNumber` | `string` | Business-facing number |
| `description` | `string?` | |
| `isDraft` | `bool` | |
| `customerId` | `int?` | FK to Contact |
| `divisionId` | `int?` | FK to Division |
| `employeeId` | `int?` | FK to Contact |
| `jobStatusId` | `int?` | FK to JobStatus |
| `customValues` | `Dictionary` | jsonb |

### Navigation

| Field | Type |
|-------|------|
| `customer` | `Contact?` |
| `division` | `Division?` |
| `employee` | `Contact?` |
| `jobStatus` | `JobStatus?` |

### Collections

| Field | Type | Notes |
|-------|------|-------|
| `orders` | `[Order]` | Via JobOrder join |
| `accountingTransactions` | `[AccountingTransaction]` | Via JobAccountingTransaction join |
| `commodities` | `[Commodity]` | Direct FK |

### GraphQL Computed

- `getJobOrders(filter)` — orders via JobOrder join

---

## JobOrder (Join Entity)

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | `Guid` | FK to Job |
| `orderId` | `int` | FK to Order |

No customValues. No audit fields (uses BaseEntity, not AuditableEntity).

---

## JobStatus

| Field | Type | Notes |
|-------|------|-------|
| `jobStatusId` | `int` | PK |
| `organizationId` | `int` | |
| `jobStatusName` | `string` | |
| `priority` | `int` | |
| `statusStage` | `StatusStage` enum | Pending=1, InProgress, Completed |
| `customValues` | `Dictionary` | jsonb |

---

## StatusStage Enum

Used by JobStatus, OrderStatus, ContactStatus:

| Value | Int |
|-------|-----|
| `Pending` | 1 |
| `InProgress` | 2 |
| `Completed` | 3 |
