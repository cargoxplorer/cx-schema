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

Available root queries: `orders`, `contacts`, `commodities`, `accountingTransactions`, `jobs`, and others.

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

### Filtered collections (bracket notation)
```
filter: "children[category:CatA].name:test"
```

## OrderBy Syntax

```
orderBy: "orderNumber"                # Ascending
orderBy: "-orderNumber"               # Descending
orderBy: "-created,orderNumber"       # Multi-field
orderBy: "customValues.fieldName"     # Custom field sort
orderBy: "orderNumber~ToInt32"        # Type conversion during sort
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

### TMS MCP: `graphql_schema` / `graphql_type` — equivalent MCP tools

When TMS MCP is available, the same discovery is available via MCP tools:

```
graphql_schema(section: "queries", filter: "order")
graphql_schema(section: "types", filter: "audit")
graphql_type(typeName: "OrderGqlDto")
graphql_execute(query: "{ orders(organizationId: 1, take: 1) { items { orderId } } }")
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
