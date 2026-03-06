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
```

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

---

## Property Path Syntax (in collection, mapping, variable paths)

Used in `collection:` (foreach), `mapping:` (outputs), and variable resolution.

| Pattern | Description | Example |
|---------|-------------|---------|
| `a.b.c` | Dot-separated nested path | `order.customer.name` |
| `prop?` | Optional access (null if missing) | `order.customer?.name?` |
| `list[0]` | Array index | `items[0]` |
| `list[^1]` | Index from end (last item) | `items[^1]` |
| `list[*]` | Flatten/wildcard (all items) | `containers[*].commodities` |
| `list[**]` | Recursive flatten (all depths) | `containerCommodities[**]` |
| `list[-1]` | Depth filter (leaves only) | `tree[**][-1]` |
| `list[condition]` | Filter by condition | `items[status=Active]` |
| `dict['key']` | Dictionary key access | `customValues['myField']` |
| `list[*].{f1 f2}` | Field selector (projection) | `items[*].{name description}` |
| `list[*].{alias:source}` | Field selector with alias | `items[*].{id:commodityId}` |
| `list[*].{alias:_.parent}` | Field selector referencing parent | `items[*].{parentId:_.orderId}` |
