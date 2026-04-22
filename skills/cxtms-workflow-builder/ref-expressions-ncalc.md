# NCalc Expressions & Functions

## Contents
- NCalc expression syntax `[variable]` (in conditions and expression directives)
- Operators (comparison, logical, arithmetic, ternary, membership)
- Iterator variables (`[each.*]` and `[item.*]`)
- Collection functions (any, all, count, sum, first, last, distinct, select, zip, groupBy, join, sort, etc.)
- String functions (isNullOrEmpty, length, lower, upper, replace, format, base64, coalesce, etc.)
- Date functions (now, parseDate, addDays, formatDate, dateFromUnix, etc.)
- Math functions (Abs, Ceiling, Floor, Round, Min, Max, etc.)
- Domain functions (convertWeight, convertDimension)

For template expressions `{{ path }}` used in step inputs, see [ref-expressions-template.md](ref-expressions-template.md).

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
- Wildcard traversal continues through POCOs, dictionaries, and `JObject` values, for example `[items[*].customValues.chapter_en?]`

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
- **`[each.*]`** -- used by: `any`, `all`, `sum`, `select`, `join` (3-arg), and projections over `zip(...)` output
- **`[item.*]`** -- used by: `first`, `last`, `groupBy`, `sort`

### Collection Functions

| Function | Description |
|----------|-------------|
| `any([items], [each.prop] = 'val')` | True if any item matches expression. Without expression: checks if collection contains the value. Returns `false` for empty collections |
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
| `select([items], [each.field])` | Project each item via `[each.*]` accessor. Returns flat `List<object>` of projected values. Empty input → empty list |
| `zip([a], [b])` | Pair elements from two or more lists into `[{item1, item2}, ...]`. Custom keys: `zip([a], [b], 'name', 'code')`. Variadic: accepts N lists. Truncates to shortest list. Returns empty list if any input is empty/null. Falls back to `item1`, `item2`, ... when custom key count does not match list count |
| `split([str], ' ')` | Split string by first character of separator. Returns `List<string>` |
| `elementAt([items], 0)` | Get element at index (zero-based) from list |
| `sort([items])` | Sort items ascending by their natural value |
| `sort([items], [item.expr])` | Sort ascending by projected property using `[item.*]` accessor |
| `sort([items], [item.expr], 'asc'\|'desc')` | Sort with explicit direction. `orderBy` is an alias for `sort` |

### String Functions

| Function | Description |
|----------|-------------|
| `isNullOrEmpty([var])` | True if null, empty string, or empty list |
| `length([var])` | String length or collection count. `0` for null strings and non-collections |
| `lower([name])` / `upper([code])` | Case conversion. Handles string, JToken, any `.ToString()` |
| `left([code], 3)` / `right([code], 3)` | Left/right N characters. Returns full string if shorter than N |
| `substring([str], 0, 5)` | Extract substring starting at position for given length |
| `replace([str], 'old', 'new')` | String replacement. Returns null if any arg is null |
| `trim([value])` | Trim whitespace. Returns `""` for null |
| `format('{0}-{1}', [prefix], [id])` | String.Format style. Variadic args. Returns null if format is null |
| `base64([value])` / `fromBase64([encoded])` | Base64 encode/decode. Handles string, byte[], JToken |
| `bool([value])` | Convert to boolean: null->`false`, empty string->`false`, "true"/"false"->parsed, non-zero number->`true`, any object->`true` |
| `transliterate([value])` | Unicode to ASCII (Unidecode). Returns `""` for null |
| `transliterateUa([value])` | Ukrainian-specific transliteration. Returns `""` for null |
| `coalesce([a], [b], 'default')` | First non-null, non-empty/whitespace argument. Variadic. `0` and `false` are kept (not skipped). Returns `null` if all args are null/empty |
| `prop([obj], 'path.to.field')` | Drill into an object by a runtime-computed string path. Supports dotted paths and `?` optional suffix, same as `[obj.path]` but the path is a string argument |
| `parseAddress([address])` | Parse address -> `{StreetNumber, StreetName}`. Handles US and EU formats |

### Date Functions

| Function | Description |
|----------|-------------|
| `parseDate([str])` | Parse date string to DateTime. Supports common formats (ISO, US, etc.) |
| `now()` | Current UTC `DateTime` |
| `now('yyyy-MM-dd', 'en-US')` | Formatted current time as string |
| `addDays([date], 30)` | Add days (decimal, can be negative). Accepts DateTime, DateTimeOffset, string |
| `addHours([date], 2)` | Add hours (decimal, can be negative). Same type handling |
| `formatDate([date], 'dd/MM/yyyy', 'en-US')` | Format date with culture. Accepts DateTime or string |
| `dateFromUnix([unixTime])` | Unix timestamp (seconds) -> `DateTimeOffset`. Accepts int, long, decimal, string |
| `dateToUtc([date])` or `dateToUtc([date], 'en-US')` | Convert to UTC. Optional culture for string parsing |
| `toLocalTime([date], 'America/Chicago')` | Convert UTC datetime to local time in IANA timezone. Returns `null` if date or timezone is invalid |

### Business Date Math (in Lucene filter expressions)

The filter engine (`FilterBy`) supports business-aware date math units in Lucene date expressions:

| Unit | Aliases | Description |
|------|---------|-------------|
| `BHOUR` | `BHOURS` | Add/subtract business hours (respects weekly schedule + holidays) |
| `BDAY` | `BDAYS` | Add/subtract business days (skips non-working days) |

**Usage**: These units are used in **Lucene filter strings** (not NCalc expressions). They require an `IBusinessDateMathResolver` and are resolved via the organization's business calendar.

```
dueDate: [NOW TO NOW+3BDAYS]
pickupDate: [* TO NOW-8BHOURS]
```

### Math Functions (NCalc built-in)

`Abs(x)`, `Ceiling(x)`, `Floor(x)`, `Round(x, decimals)`, `Min(x, y)`, `Max(x, y)`, `Pow(x, y)`, `Sqrt(x)`, `Truncate(x)`

Custom: `ceiling([value])` -- same as `Ceiling` but handles type conversion to double.

### Domain Functions

| Function | Description |
|----------|-------------|
| `convertWeight([weight], 'Kg', 'Lb')` | Weight unit conversion. Returns `decimal` rounded to 5 places |
| `convertDimension([length], 'Cm', 'In')` | Dimension unit conversion. Returns `decimal` rounded to 3 places |
