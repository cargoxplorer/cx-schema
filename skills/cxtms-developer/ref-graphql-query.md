# GraphQL Query Reference

## CLI Query Command

```bash
npx cxtms query '<graphql-query>'              # Inline query
npx cxtms query my-query.graphql               # From file
npx cxtms query '<query>' --vars '{"key":"v"}' # With variables
```

Requires active login (`npx cxtms login`). Uses the active organization.

## Query Arguments

All root entity queries follow this pattern:

```graphql
orders(
  organizationId: Int!    # Required — active org ID
  filter: String          # Lucene query syntax (see below)
  search: String          # Full-text search across key fields
  orderBy: String         # Comma-separated sort fields
  take: Int               # Page size (alias: limit)
  skip: Int               # Offset (alias: offset)
)
```

Entity-specific extras:
- `orders` — `includeDraft: Boolean` (default false)

Available root queries: `orders`, `contacts`, `commodities`, `accountingTransactions`, `jobs`, `entityFields`, and others.

`entityFields` returns field metadata. When `entityName` is supplied, the API filters out inactive fields and duplicate field names resolve to the active definition with the highest `priority`.

## App Module Metadata Visibility

GraphQL metadata queries hide rows attached to soft-deleted app modules:

- `appComponents` / `appComponent` require the parent `AppModule.IsDeleted != true`
- `appRoutes` and public route queries require the parent module to be active
- `appPermissions` require the parent module to be active
- `entityFields` exclude fields whose `EntityType.AppModule` is deleted

Do not add extra client-side `isDeleted` filters for these metadata screens unless the UI also needs to expose deleted-module diagnostics.

## Filter Syntax (Lucene Query)

Filters use **Lucene Query syntax** (not OData, not NCalc).

### Basic field matching
```
filter: "orderId:196596"
filter: "orderType:ParcelShipment"
filter: "status:Active"
```

### Wildcards
```
filter: "name:*pending*"        # Contains
filter: "code:ABC*"             # Starts with
filter: "status:*Active"        # Ends with
```

### Logical operators
```
filter: "countryCode:US AND name:Test"
filter: "status:Active OR status:Pending"
filter: "NOT customValues.po:123"
filter: "orderType:ParcelShipment AND (status:Active OR status:Pending)"
```

### Nested paths (dot notation)
```
filter: "orderEntities.entityType:Consignee"
filter: "orderEntities.contactId:7128"
filter: "jobs.orders.orderNumber:16*"
```

### Range queries
```
filter: "lastModified:[\"2026-01-01\" TO \"2026-03-15\"]"
filter: "lastModified:[\"2026-01-01\" TO *]"    # >= date
filter: "amount:[100 TO 500]"
```

### NULL checks
```
filter: "customValues.po:NULL"
```

### CustomValues (JSONB fields)
```
filter: "customValues.fieldName:value"
filter: "customValues.fieldName:\"exact match\""
filter: "customValues.fieldName:NULL"
```

### CustomValue join expressions

When a custom value stores a foreign key to a supported entity, use `customValues.key->entity.property` to filter by a property on the joined row. Supported join aliases include `contact`, `order`, `modeOfTransportation`, `country`, and `terminal`.

```
filter: "customValues.carrierId->contact.name:Acme*"
filter: "customValues.terminalId->terminal.name:Chicago*"
filter: "NOT customValues.returnLocationId->terminal.terminalId:NULL"
```

### Filtered collections (bracket notation)
```
filter: "children[category:CatA].name:test"
```

## Mutations

### `importContacts`

Bulk import contacts from an uploaded CSV, JSON, or XLSX file.

```graphql
mutation ImportContacts($input: ImportContactsInput!) {
  importContacts(input: $input) {
    added
    updated
    errors
  }
}
```

`ImportContactsInput` fields:

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | `Int!` | Tenant scope |
| `fileUploadUrl` | `String!` | Uploaded file URL/path |
| `contactType` | `ContactType` | Optional default for new rows; row-level `ContactType` wins |
| `columnMappings` | `MapOfString` | Map internal field paths to inbound column headers |

Behavior notes:
- Matches existing contacts by `ContactId` first.
- Ignores primary key fields during patching.
- Skips nulls and empty strings on updates so blank cells do not clear existing values.
- Resolves nested `division.divisionName` / `Division.DivisionName` to `DivisionId` when possible.

## OrderBy Syntax

```
orderBy: "orderNumber"                # Ascending
orderBy: "-orderNumber"               # Descending
orderBy: "-created,orderNumber"       # Multi-field
orderBy: "customValues.fieldName"     # Custom field sort
orderBy: "orderNumber~ToInt32"        # Type conversion during sort
```

Join expressions are also valid in `orderBy`, including terminal custom-value references:

```
orderBy: "customValues.terminalId->terminal.name"
orderBy: "-customValues.returnLocationId->terminal.name"
```

### `lastTrackingEvent` synthetic sort path (Order / Commodity)

Sort the result list by the winning tracking event of each order or commodity. The "winner" is selected using `COALESCE(EventDate, Created) DESC/ASC, TrackingEventId DESC/ASC` — identical to the DataLoader logic — so SQL-level ordering and per-row resolution are always consistent.

```
orderBy: "-lastTrackingEvent.eventDate"   # Latest event first (DESC)
orderBy: "lastTrackingEvent.eventDate"    # Earliest event first (ASC)
```

Filter to a specific event type using bracket notation before sorting:

```
orderBy: "-lastTrackingEvent[eventDefinition.eventName:Departed].eventDate"
```

- The bracket predicate (`[path:value]`) filters the `TrackingEvents` collection before the winner is picked.
- Only `.eventDate` is supported as the sub-path. The expression resolves to `COALESCE(winner.EventDate, winner.Created)`, so null `EventDate` values fall back to `Created`.
- Works on both `orders` and `commodities` top-level queries.

### Commodity `getContact` resolver

Commodities expose `getContact(idPropertyName: String!)` to resolve a contact ID stored in `customValues`. The lookup is scoped to the commodity organization and returns `null` when the custom value is missing or not a valid integer contact ID.

```graphql
{
  commodities(organizationId: 1, take: 1) {
    items {
      commodityId
      getContact(idPropertyName: "shipperContactId") {
        contactId
        name
      }
    }
  }
}
```

## Order Custom-Value Resolvers

Orders expose `getContactAddress(idPropertyName: String!)` to resolve a contact-address id stored in `customValues` into a `contactAddress` object. The lookup is organization-scoped and returns null/empty when the custom-value key is missing.

```graphql
orders(organizationId: 1, take: 1) {
  items {
    orderId
    getContactAddress(idPropertyName: "pickupContactAddressId") {
      contactAddressId
      name
      addressLine
      cityName
    }
  }
}
```

## Pagination

```graphql
{
  orders(organizationId: 1, take: 50, skip: 0) {
    items { orderId orderNumber }
    totalCount
    pageInfo { hasNextPage hasPreviousPage }
  }
}
```

## Audit Change History

### Entity-level: `changeHistory` computed field

Available on: **Order**, **Contact**, **Commodity**, **AccountingTransaction**

```graphql
{
  orders(organizationId: 1, filter: "orderId:196596", take: 1) {
    items {
      orderId
      changeHistory(maxResults: 20) {
        entityName
        hasMoreRecords
        continuationToken
        changes {
          state         # "Added" | "Modified" | "Deleted"
          userId
          timestamp
          user {
            fullName
            email
          }
          changedFields {
            fieldName
            originalValue
            currentValue
            fieldType
          }
        }
      }
    }
  }
}
```

Arguments: `startDate: DateTime`, `endDate: DateTime`, `maxResults: Int` (default 10)

### Root-level: `auditChanges` query

Query audit changes directly without fetching the entity first:

```graphql
{
  auditChanges(
    organizationId: 1
    filter: "entityName:Order AND primaryKey:196596"
    take: 20
  ) {
    items {
      state
      userId
      timestamp
      user { fullName email }
      changedFields {
        fieldName
        originalValue
        currentValue
        fieldType
      }
    }
  }
}
```

Arguments: `organizationId: Int!`, `filter: String`, `search: String`, `take: Int`, `skip: Int`, `orderBy: String`

Filter fields: `entityName`, `primaryKey`, `userId`, `state`

### Root-level: `auditEntityHistory` grid query filters

The paged audit-history query accepts DataGrid/Lucene filter strings:

- `entityName:"Order*"` — normalized to the entity path segment; quotes, trailing `*`, and trailing `~` are stripped.
- `primaryKey:"123"` — narrows the S3 path to one entity key.
- `timestamp:["2026-05-01T00:00:00Z" TO "NOW"]` — filters parsed audit file timestamps. ISO timestamps and date-math bounds (`NOW-7DAYS`, `NOW/DAY+1DAY`) are supported.
- `user.fullName:"Jane*"` — resolves users by full name, first/last name, username, or email and filters by persisted `userId`.

Sorting supports `timestamp` and `-timestamp`; descending timestamp is the default.

### Entity fields lookup

`entityFields(organizationId, entityName, filter, search, orderBy)` matches `entityName` with case-insensitive SQL `ILIKE`, so exact names and `ILIKE` patterns are both accepted. `search` matches field names by substring.

### Root-level: `auditChangeSummaries` query

High-level summary of changes (grouped by change event):

```graphql
{
  auditChangeSummaries(
    organizationId: 1
    startDate: "2026-03-01T00:00:00Z"
    endDate: "2026-03-15T23:59:59Z"
    maxResults: 50
  ) {
    items {
      changeId
      userId
      timestamp
      changePaths
      organizationId
    }
    continuationToken
    hasMoreRecords
  }
}
```

### Root-level: `auditChange` — single change detail

```graphql
{
  auditChange(filePath: "<s3-file-path>") {
    entityName
    state
    primaryKey
    userId
    timestamp
    originalValues
    currentValues
    fields {
      fieldName
      originalValue
      currentValue
      fieldType
    }
  }
}
```

## GraphQL Type Reference

### EntityAuditHistoryLightResult
| Field | Type |
|-------|------|
| `entityName` | `String` |
| `primaryKey` | `String` |
| `organizationId` | `Int` |
| `changes` | `[AuditChangeEntry!]!` |
| `continuationToken` | `String` |
| `hasMoreRecords` | `Boolean!` |

### AuditChangeEntry
| Field | Type | Notes |
|-------|------|-------|
| `state` | `String` | "Added", "Modified", "Deleted" |
| `userId` | `String` | |
| `timestamp` | `DateTime!` | |
| `user` | `AuditUser` | Lazy-loaded resolver |
| `changedFields` | `[AuditChangeField!]!` | Lazy-loaded resolver |

### AuditChangeField
| Field | Type |
|-------|------|
| `fieldName` | `String!` |
| `originalValue` | `Any` |
| `currentValue` | `Any` |
| `fieldType` | `String!` |

### AuditUser
| Field | Type |
|-------|------|
| `id` | `String` |
| `firstName` | `String` |
| `lastName` | `String` |
| `fullName` | `String` |
| `userName` | `String` |
| `email` | `String` |

## Workflow Execution Queries

### `workflowExecutions` — paginated execution history

Returns paginated `WorkflowExecutionLog` records. Supports Lucene filter scoping, free-text search, and sorting.

```graphql
{
  workflowExecutions(
    organizationId: 1
    filter: "workflowId:abc123 AND status:Failed"
    search: "user@example.com"
    orderBy: "-executedAt"
    take: 50
    skip: 0
  ) {
    items {
      executionId
      workflowId
      status
      executedAt
      userId
    }
    totalCount
    pageInfo { hasNextPage hasPreviousPage }
  }
}
```

**Arguments:**

| Argument | Type | Notes |
|----------|------|-------|
| `organizationId` | `Int!` | Required |
| `filter` | `String` | Lucene query syntax — scope by any field |
| `search` | `String` | Free-text: matches `userId`, `executionId`, `workflowId` |
| `orderBy` | `String` | Default: `-executedAt` (newest first) |
| `take` / `skip` | `Int` | Pagination |

**`filter` examples:**
```
filter: "workflowId:abc123"
filter: "status:Failed"
filter: "userId:user@example.com AND status:Completed"
```

**`search` behavior:** case-insensitive match across `userId`, `executionId` (UUID string), and `workflowId` (UUID string).

### `workflowExecution` — single execution by ID

```graphql
{
  workflowExecution(
    organizationId: 1
    executionId: "00000000-0000-0000-0000-000000000000"
  ) {
    executionId
    workflowId
    status
    executedAt
    userId
  }
}
```

## Discovering Fields

**Always discover field names before building a query.** Do not guess field names — use the tools below.

### CLI: `cxtms gql` — schema exploration commands

```bash
# List all query root fields (what you can query)
npx cxtms gql queries
npx cxtms gql queries --filter order

# List all mutation root fields
npx cxtms gql mutations
npx cxtms gql mutations --filter order

# List all types (filter by name)
npx cxtms gql types --filter audit
npx cxtms gql types --filter order

# Inspect a specific type — shows fields, arguments, input fields, enum values
npx cxtms gql type OrderGqlDto
npx cxtms gql type AuditChangeEntry
npx cxtms gql type EntityAuditHistoryLightResult
npx cxtms gql type CreateOrderInput
```

### Workflow: discover → query

1. **Find the type** — `cxtms gql types --filter order` to find type names
2. **Inspect the type** — `cxtms gql type OrderGqlDto` to see all fields and their types
3. **Check query args** — `cxtms gql queries --filter order` to see arguments
4. **Build and run** — `cxtms query '<graphql-query>'`

### Fallback: error-driven discovery

GraphQL error messages reveal valid field/type names:
- "The field `foo` does not exist on the type `BarType`" — tells you the type name
- "The argument `bar` does not exist" — tells you valid argument patterns

### Other sources

- `npx cxtms schema <name>` — shows workflow/module JSON schema fields (not GraphQL)
- Entity reference files (`ref-entity-*.md`) — document common fields, computed properties, and enums


## Contact Nested Address Resolver

Contacts expose `getContactAddresses(filter, orderBy)` for loading only the addresses needed by a selection set. Prefer this resolver over raw `contactAddresses` when the UI/workflow needs server-side filtering or deterministic sorting.

```graphql
query {
  contacts(organizationId: 1, filter: "contactId:123") {
    items {
      contactId
      name
      getContactAddresses(filter: "addressType:Shipping", orderBy: "cityName") {
        contactAddressId
        addressType
        cityName
        stateCode
        countryCode
      }
    }
  }
}
```
