# Template Expressions & Value Directives

## Contents
- Template expression syntax `{{ path }}` (in step inputs)
- Type converters (int, decimal, bool, fromJson, toJson, etc.)
- Value directives (expression, coalesce, foreach, switch, extends, $raw, $eval, encrypt/decrypt)
- Property path syntax (dot paths, array indexing, wildcards, filters, projections)

There are **two distinct syntaxes** for referencing variables, used in different contexts. This file covers **template expressions** used in step inputs. For NCalc conditions and functions, see [ref-expressions-ncalc.md](ref-expressions-ncalc.md).

## Template Expressions: `{{ path }}` (in step inputs)

Used in step `inputs` values. Resolves variable paths from scoped variables.

```yaml
inputs:
  orderId: "{{ inputs.orderId }}"                    # Simple reference
  url: "{{ chopinConfig.baseUrl }}/api/v1"           # String interpolation
  order: "{{ Data.GetOrder.order }}"                 # Raw object (single {{ }})
  name: "Order {{ Data.GetOrder.order.orderNumber }}" # String interpolation (multiple)
```

**Key behavior**: A single `{{ path }}` returns the **raw object** (preserving type). Multiple `{{ }}` in a string returns string interpolation (each resolved value is `.ToString()`).

**Date string normalization in step inputs**: When a string value is merged into a step's input dictionary (via `AddRangeN`), the engine auto-detects date/datetime strings and converts them to ISO format. Common formats recognized: ISO (`2024-03-15`), US (`03/15/2024`), EU (`25/12/2024`), datetime with offset (`2024-03-15T15:30:45+05:00` → UTC). Empty strings are converted to `null`. OLE Automation date numbers (e.g., `"45752"`) are also recognized as dates — but only when the field name includes a date/time keyword (e.g., `departureDate`, `pickupTime`). A numeric string like `"45752"` for a field named `amount` is kept as-is.

### Type Converters (prefix in {{ }})

```yaml
organizationId: "{{ int organizationId }}"
amount: "{{ decimal totalAmount }}"
isActive: "{{ bool isActive }}"
flag: "{{ boolOrFalse someFlag }}"        # null -> false
flagOn: "{{ boolOrTrue someFlag }}"       # null -> true
notes: "{{ emptyIfNull notes }}"          # null -> ""
notes: "{{ nullIfEmpty notes }}"          # "" or whitespace -> null
config: "{{ fromJson configJsonString }}" # JSON string -> dict/array
payload: "{{ toJson someObject }}"        # object -> JSON string
name: "{{ trim value }}"
search: "{{ luceneString query }}"        # escape & quote for Lucene
```

| Converter | Returns | Null handling |
|-----------|---------|---------------|
| `string` | `string` | null. Reads `Stream` to string if value is Stream |
| `int` | `int` | Throws on null |
| `decimal` | `decimal` | Throws on null |
| `bool` | `bool` | Throws on null |
| `boolOrFalse` | `bool` | `false` if null |
| `boolOrTrue` | `bool` | `true` if null |
| `datetime` | `DateTime` | Throws on null |
| `emptyIfNull` | same type | `""` if null, `0` for int?, `0m` for decimal? |
| `nullIfEmpty` | same type | `null` if empty/whitespace string or empty collection |
| `luceneString` | `string` | null |
| `transliterate` | `string` | null (Unicode -> ASCII via Unidecode) |
| `transliterateUa` | `string` | null (Ukrainian-specific rules) |
| `fromJson` | `dict` or `array` | null. Empty string -> empty dict |
| `toJson` | `string` | `""` if null |
| `trim` | `string` | null |
| `toLocalTime` | `DateTime` or `string` | null. Syntax: `{{ toLocalTime path 'TimezoneId' 'format?' }}` |

### Value Directives (in YAML input mappings)

**`expression`** -- Evaluate NCalc expression as a value:
```yaml
amount:
  expression: "[price] * [quantity]"
```

**`coalesce`** -- First non-null value from a list:
```yaml
displayName:
  coalesce:
    - "{{ customer.name? }}"
    - "{{ customer.email? }}"
    - "Unknown"
```

**`foreach`** (value context) -- Transform collections inline:
```yaml
commodities:
  foreach: "sourceCommodities"
  item: "item"                             # default: "item"
  conditions: "[item.isActive] = true"     # optional NCalc filter per item
  continueOnError: false                   # optional, skip errors
  mapping:                                 # dict -> List<dict>, string -> List<object>
    name: "{{ item.name }}"
    quantity: "{{ item.qty }}"
    "{{ item.langKey }}": "{{ item.value }}"  # dynamic key (template-substituted)
```

**`switch`** (value context) -- Value-based switch (case-insensitive match):
```yaml
perLb:
  switch: "{{ contact.commissionTier }}"
  cases:
    "tier1": "{{ rate.customValues.commission_per_lb_tier1 }}"
    "tier2": "{{ rate.customValues.commission_per_lb_tier2 }}"
  default: "0"
```

**`extends`** -- Extend/merge an existing object or array:
```yaml
orderData:
  extends: "{{ existingOrder }}"           # base object or array
  defaultIfNull: {}                        # fallback if extends is null
  mapping:                                 # dict: merge overrides. array: append items
    status: "Updated"
    notes: "{{ newNotes }}"
    "{{ dynamicField }}": "{{ value }}"    # dynamic key (template-substituted)
    legacyField: "$delete"                 # remove key from base object
```

**Remove sentinel `"$delete"`**: Setting any mapping value to the literal string `"$delete"` removes that key from the merged result instead of setting it. This works in `extends` mappings and anywhere dictionary merging occurs (e.g., entity update `customValues`). The sentinel bypasses the duplicate-key guard — it is always safe to delete, even when `overwriteExisting` is false. Exact match only: `"$DELETE"`, `" $delete"`, or `"$delete extra"` are treated as regular string values, not remove markers. To store the literal string `"$delete"` as a value (not a remove command), use direct field assignment patterns rather than a merge mapping.

**`resolve`** -- Entity ID lookup by querying a GraphQL collection:
```yaml
customerId:
  resolve:
    entity: "Contact"                        # Entity type (auto-pluralized for query)
    filter: "name:{{ customerName }}"         # Lucene filter (template-parsed)
    field: "contactId"                       # Field to return (default: <entity>Id)
```
Results are batched and cached per unique `entity|filter|field` combination by `ResolvePreProcessor` before step execution. Cache misses return `null`. Useful inside `foreach` mappings where many items reference the same entity — only one query per unique filter value.

**`$raw`** -- Prevent template parsing (pass as-is):
```yaml
template:
  $raw: "This {{ won't }} be parsed"
```

**`$eval`** -- Parse JSON string then evaluate as template:
```yaml
dynamicConfig:
  $eval: "{{ configJsonString }}"
```

**`decrypt`** / **`encrypt`** -- AES-CBC encryption (optional key/IV, has defaults):
```yaml
apiKey:
  decrypt:
    encryptedValue: "{{ encryptedApiKey }}"
    key: "{{ encryptionKey }}"             # optional Base64 AES key
    initializationVector: "{{ iv }}"       # optional Base64 IV
```

### Template-Substituted Dictionary Keys

Dictionary **keys** (not just values) support `{{ path }}` template expressions. The engine resolves each key through the same template parser before inserting it into the result dictionary. This works in:

- **Generic dictionaries** (plain object mappings in step inputs)
- **`foreach` complex mapping** keys
- **`extends` mapping** keys

```yaml
# Build a dict whose keys depend on a variable
inputs:
  customValues:
    "{{ fieldName }}": "{{ fieldValue }}"          # single variable key
    "{{ prefix }}_{{ lang }}": "translated text"   # composite key
    staticKey: "literal value"                     # plain keys pass through unchanged
```

**Fallback**: If a templated key resolves to null or empty string, the engine keeps the original literal key (e.g., `{{ missingVar }}`) to avoid silently dropping entries. An `InvalidOperationException` during resolution also falls back to the literal key.

---

## Property Path Syntax (in collection, mapping, variable paths)

Used in `collection:` (foreach), `mapping:` (outputs), and variable resolution.

| Pattern | Description | Example |
|---------|-------------|---------|
| `a.b.c` | Dot-separated nested path | `order.customer.name` |
| `prop?` | Optional access (null if missing) | `order.customer?.name?` |

> **Note**: Object-type task inputs (e.g., `headers`, `columnMappings`) are automatically null-safe at the engine level. Omitting an optional object input from YAML returns `null` without errors. The `?` suffix remains required in template expression paths and NCalc conditions.
| `list[0]` | Array index | `items[0]` |
| `list[^1]` | Index from end (last item) | `items[^1]` |
| `list[*]` | Flatten/wildcard (all items) | `containers[*].commodities` |
| `list[*].dictKey` | Wildcard traversal into Dictionary/JObject keys | `items[*].customValues.chapter_en` |
| `list[**]` | Recursive flatten (all depths) | `containerCommodities[**]` |
| `list[-1]` | Depth filter (leaves only) | `tree[**][-1]` |
| `list[condition]` | Filter by condition | `items[status=Active]` |
| `dict['key']` | Dictionary key access | `customValues['myField']` |
| `list[*].{f1 f2}` | Field selector (projection) | `items[*].{name description}` |
| `list[*].{alias:source}` | Field selector with alias | `items[*].{id:commodityId}` |
| `list[*].{alias:_.parent}` | Field selector referencing parent | `items[*].{parentId:_.orderId}` |

**Wildcard traversal into Dictionary/JObject**: After `[*]`, subsequent path segments drill into Dictionary keys and JObject properties on each item. Dictionary-like values are preserved intact (not flattened) so multi-hop paths work: `items[*].customValues.chapter_en` extracts the `chapter_en` key from each item's `customValues` dictionary. This also works with nested dictionaries (`items[*].meta.locale.name`) and JObject items from JSON payloads.

**JArray primitive unwrapping**: When `GetPropertyValue` encounters a JArray where every element is a JValue (primitive), it automatically unwraps the array into a `List<object>` of plain .NET values. This ensures downstream iteration (e.g., `select()`, `zip()`, `foreach`) works with primitives rather than JValue wrappers.
