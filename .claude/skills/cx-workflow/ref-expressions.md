# Variable References & Expressions

There are **two distinct syntaxes** for referencing variables, used in different contexts.

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

## NCalc Expressions: `[variable]` (in conditions and expression directives)

Used in `conditions[].expression`, `switch` case `when`, and `expression:` value directives. Variables use **square bracket** `[name]` syntax.

```yaml
conditions:
  - expression: "[status] = 'Active' AND [amount] > 100"
  - expression: "isNullOrEmpty([Data.GetOrder.order?]) = false"
  - expression: "any([changes], [each.key] = 'Status') = true"
```

**Parameter resolution rules**:
- Empty strings are converted to `null` (so `""` is treated as no value)
- Numeric strings are auto-converted to `decimal` when needed (e.g., `[price] > 100` works even if price is the string `"150"`)
- Dot paths resolve deep: `[Activity.Step.output.nested.field]`
- Optional suffix `?` prevents errors: `[order.customer?.name?]`

### Operators

| Type | Operators |
|------|-----------|
| Comparison | `=`, `!=`, `<>`, `<`, `>`, `<=`, `>=` |
| Logical | `AND`, `OR`, `NOT` (also `&&`, `\|\|`, `!`) |
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Ternary | `if(condition, trueVal, falseVal)` |
| Membership | `in(value, val1, val2, ...)` |

### Iterator Variables

Functions use two iterator variable names:
- **`[each.*]`** -- used by: `any`, `all`, `sum`, `join` (3-arg)
- **`[item.*]`** -- used by: `first`, `last`, `groupBy`

### Collection Functions

| Function | Description |
|----------|-------------|
| `any([items], [each.prop] = 'val')` | True if any item matches expression. Without expression: checks if collection contains the value |
| `all([items], [each.prop] > 0)` | True if all items match. Returns `false` for null/empty collections |
| `count([items])` | Count items in list or JToken. Returns `0` for non-collections |
| `sum([items], [each.amount])` | Sum values as `decimal`. Optional `[each.*]` accessor. Skips nulls |
| `first([items])` or `first([items], [item.name])` | First item or evaluate expression on first item. Returns `""` if empty |
| `last([items])` or `last([items], [item.name])` | Last item or evaluate expression on last item. Returns `""` if empty |
| `distinct([items])` | Remove duplicates. Uses deep comparison for dictionaries |
| `reverse([items])` | Reverse collection or string |
| `contains([source], 'needle')` | String contains, JArray contains, list contains, or dict key/value contains |
| `removeEmpty([items])` | Remove null and whitespace-only items |
| `concat([list1], [list2], ...)` | Concatenate multiple collections into flat list. Variadic args. Skips nulls |
| `groupBy([items], [item.cat])` | Group by one or more key expressions. Returns `[{key, items}]`. Multi-key: keys joined with `\|` |
| `join([items], [each.name], ',')` | Join collection with `[each.*]` accessor and separator (3-arg) |
| `join([items], ',')` | Join collection directly with separator (2-arg) |
| `split([str], ' ')` | Split string by first character of separator. Returns `List<string>` |

### String Functions

| Function | Description |
|----------|-------------|
| `isNullOrEmpty([var])` | True if null, empty string, or empty list |
| `length([var])` | String length or collection count. `0` for null strings and non-collections |
| `lower([name])` / `upper([code])` | Case conversion. Handles string, JToken, any `.ToString()` |
| `left([code], 3)` / `right([code], 3)` | Left/right N characters. Returns full string if shorter than N |
| `replace([str], 'old', 'new')` | String replacement. Returns null if any arg is null |
| `trim([value])` | Trim whitespace. Returns `""` for null |
| `format('{0}-{1}', [prefix], [id])` | String.Format style. Variadic args. Returns null if format is null |
| `base64([value])` / `fromBase64([encoded])` | Base64 encode/decode. Handles string, byte[], JToken |
| `bool([value])` | Convert to boolean: null->`false`, empty string->`false`, "true"/"false"->parsed, non-zero number->`true`, any object->`true` |
| `transliterate([value])` | Unicode to ASCII (Unidecode). Returns `""` for null |
| `transliterateUa([value])` | Ukrainian-specific transliteration. Returns `""` for null |
| `parseAddress([address])` | Parse address -> `{StreetNumber, StreetName}`. Handles US and EU formats |

### Date Functions

| Function | Description |
|----------|-------------|
| `now()` | Current UTC `DateTime` |
| `now('yyyy-MM-dd', 'en-US')` | Formatted current time as string |
| `addDays([date], 30)` | Add days (decimal, can be negative). Accepts DateTime, DateTimeOffset, string |
| `addHours([date], 2)` | Add hours (decimal, can be negative). Same type handling |
| `formatDate([date], 'dd/MM/yyyy', 'en-US')` | Format date with culture. Accepts DateTime or string |
| `dateFromUnix([unixTime])` | Unix timestamp (seconds) -> `DateTimeOffset`. Accepts int, long, decimal, string |
| `dateToUtc([date])` or `dateToUtc([date], 'en-US')` | Convert to UTC. Optional culture for string parsing |

### Math Functions (NCalc built-in)

`Abs(x)`, `Ceiling(x)`, `Floor(x)`, `Round(x, decimals)`, `Min(x, y)`, `Max(x, y)`, `Pow(x, y)`, `Sqrt(x)`, `Truncate(x)`

Custom: `ceiling([value])` -- same as `Ceiling` but handles type conversion to double.

### Domain Functions

| Function | Description |
|----------|-------------|
| `convertWeight([weight], 'Kg', 'Lb')` | Weight unit conversion. Returns `decimal` rounded to 5 places |
| `convertDimension([length], 'Cm', 'In')` | Dimension unit conversion. Returns `decimal` rounded to 3 places |

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
