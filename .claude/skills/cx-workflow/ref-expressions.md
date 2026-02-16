# Variable References & Expressions

There are **two distinct syntaxes** for referencing variables, used in different contexts:

## Template Expressions: `{{ path }}` (in step inputs)

Used in step `inputs` values. Resolves variable paths from scoped variables.

```yaml
inputs:
  orderId: "{{ inputs.orderId }}"                    # Simple reference
  url: "{{ chopinConfig.baseUrl }}/api/v1"           # String interpolation
  order: "{{ Data.GetOrder.order }}"                 # Raw object (single {{ }})
  name: "Order {{ Data.GetOrder.order.orderNumber }}" # String interpolation (multiple)
```

**Key behavior**: A single `{{ path }}` returns the **raw object** (preserving type). Multiple `{{ }}` in a string returns string interpolation.

### Type Converters (prefix in {{ }})

```yaml
organizationId: "{{ int organizationId }}"
amount: "{{ decimal totalAmount }}"
isActive: "{{ bool isActive }}"
flag: "{{ boolOrFalse someFlag }}"        # null -> false
notes: "{{ emptyIfNull notes }}"          # null -> ""
notes: "{{ nullIfEmpty notes }}"          # "" -> null
config: "{{ fromJson configJsonString }}" # JSON string -> object
payload: "{{ toJson someObject }}"        # Object -> JSON string
name: "{{ trim value }}"
```

All converters: `string`, `int`, `decimal`, `bool`, `boolOrFalse`, `boolOrTrue`, `datetime`, `emptyIfNull`, `nullIfEmpty`, `luceneString`, `transliterate`, `transliterateUa`, `fromJson`, `toJson`, `trim`

### Value Directives (in YAML input mappings)

**`expression`** -- Evaluate NCalc expression as a value:
```yaml
amount:
  expression: "[price] * [quantity]"
```

**`coalesce`** -- First non-null value:
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
  item: "item"
  conditions: "[item.isActive] = true"
  mapping:
    name: "{{ item.name }}"
    quantity: "{{ item.qty }}"
```

**`switch`** (value context) -- Value-based switch:
```yaml
perLb:
  switch: "{{ contact.commissionTier }}"
  cases:
    "tier1": "{{ rate.customValues.commission_per_lb_tier1 }}"
    "tier2": "{{ rate.customValues.commission_per_lb_tier2 }}"
  default: "0"
```

**`extends`** -- Extend/merge an existing object:
```yaml
orderData:
  extends: "{{ existingOrder }}"
  mapping:
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

**`decrypt`** / **`encrypt`** -- Encryption operations:
```yaml
apiKey:
  decrypt:
    encryptedValue: "{{ encryptedApiKey }}"
    key: "{{ encryptionKey }}"
```

---

## NCalc Expressions: `[variable]` (in conditions and expression directives)

Used in `conditions[].expression`, `switch` case `when`, and `expression:` value directives. Variables use **square bracket** `[name]` syntax.

```yaml
conditions:
  - expression: "[status] = 'Active' AND [amount] > 100"
  - expression: "isNullOrEmpty([Data.GetOrder.order?]) = false"
  - expression: "any([changes], [each.key] = 'Status') = true"
```

### Operators

| Type | Operators |
|------|-----------|
| Comparison | `=`, `!=`, `<>`, `<`, `>`, `<=`, `>=` |
| Logical | `AND`, `OR`, `NOT` (also `&&`, `\|\|`, `!`) |
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Ternary | `if(condition, trueVal, falseVal)` |
| Membership | `in(value, val1, val2, ...)` |

### Collection Functions

| Function | Description |
|----------|-------------|
| `any([items], [each.prop] = 'val')` | True if any item matches |
| `all([items], [each.prop] > 0)` | True if all items match |
| `count([items])` | Count items |
| `sum([items], [each.amount])` | Sum values (optional accessor) |
| `first([items], [item.name])` | First item (optional accessor) |
| `last([items], [item.name])` | Last item (optional accessor) |
| `distinct([items])` | Remove duplicates |
| `reverse([items])` | Reverse collection or string |
| `contains([source], 'needle')` | Check if string/collection contains value |
| `removeEmpty([items])` | Remove null/empty items |
| `concat([list1], [list2])` | Concatenate collections |
| `groupBy([items], [item.category])` | Group items -> `[{key, items}]` |
| `join([items], [each.name], ',')` | Join collection values with separator |
| `split([fullName], ' ')` | Split string into list |

### String Functions

| Function | Description |
|----------|-------------|
| `isNullOrEmpty([var])` | True if null, empty string, or empty list |
| `length([var])` | String length or collection count |
| `lower([name])` / `upper([code])` | Case conversion |
| `left([code], 3)` / `right([code], 3)` | Substring from left/right |
| `replace([name], ' ', '-')` | String replacement |
| `trim([value])` | Trim whitespace |
| `format('{0}-{1}', [prefix], [id])` | String.Format style formatting |
| `base64([value])` / `fromBase64([encoded])` | Base64 encode/decode |
| `bool([value])` | Convert to boolean |
| `transliterate([value])` | Unicode to ASCII |
| `parseAddress([address])` | Parse address -> `{StreetNumber, StreetName}` |

### Date Functions

| Function | Description |
|----------|-------------|
| `now()` | Current UTC datetime |
| `now('yyyy-MM-dd', 'en-US')` | Formatted current time |
| `addDays([created], 30)` | Add days to date (negative to subtract) |
| `addHours([created], 2)` | Add hours to date |
| `formatDate([date], 'dd/MM/yyyy', 'en-US')` | Format date |
| `dateFromUnix([unixTime])` | Unix timestamp -> DateTimeOffset |
| `dateToUtc([localDate])` | Convert to UTC |

### Math Functions (NCalc built-in)

`Abs(x)`, `Ceiling(x)`, `Floor(x)`, `Round(x, decimals)`, `Min(x, y)`, `Max(x, y)`, `Pow(x, y)`, `Sqrt(x)`, `Truncate(x)`

### Domain Functions

| Function | Description |
|----------|-------------|
| `convertWeight([weight], 'Kg', 'Lb')` | Weight unit conversion |
| `convertDimension([length], 'Cm', 'In')` | Dimension unit conversion |

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
