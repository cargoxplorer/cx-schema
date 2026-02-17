# Utilities Tasks Reference

## Available Tasks

| Task | Description |
|------|-------------|
| `Utilities/SetVariable@1` | Set variables in workflow scope (activity + global) |
| `Utilities/Log@1` | Log all task variables to workflow logger |
| `Utilities/Error@1` | Throw a workflow error with message |
| `Utilities/HttpRequest@1` | HTTP request (GET/POST/PUT/PATCH/DELETE) |
| `Utilities/Map@1` | Map/extract variables from inputs |
| `Utilities/Template@1` | Handlebars template rendering |
| `Utilities/Import@1` | Import data |
| `Utilities/Export@1` | Export data |
| `Utilities/CsvParse@1` | Parse CSV content |
| `Utilities/MoveFile@1` | Move file |
| `Utilities/ValidateReCaptcha` | Validate reCAPTCHA |
| `Utilities/ValidateHMAC` | Validate HMAC signatures |

## SetVariable@1

Sets variables directly into both activity and global scope. No outputs — the side effect IS the variable setting.

```yaml
- task: "Utilities/SetVariable@1"
  name: SetResult
  inputs:
    variables:
      - name: processResult
        value:
          success: true
          orderId: "{{ inputs.orderId }}"
      - name: hasMore
        value:
          expression: "[offset] < [Data?.FetchPage?.result?.totalCount?]"
```

Each variable entry has `name` (string) and `value` (any type, supports expression directives).

## Log@1

Logs all task variables (everything in the step's scoped variables) to the workflow file logger.

```yaml
- task: "Utilities/Log@1"
  name: LogInfo
  inputs:
    message: "Processing order: {{ Data?.GetOrder?.order?.orderNumber? }}"
    level: Information
```

Levels: `Debug`, `Information`, `Warning`, `Error`.

## Error@1

Throws a workflow error that halts execution (unless `continueOnError: true` on a parent step).

```yaml
- task: "Utilities/Error@1"
  name: ThrowValidationError
  conditions:
    - expression: "isNullOrEmpty([Data?.GetOrder?.order?]) = true"
  inputs:
    message: "Order not found: {{ inputs.orderId }}"
```

## HttpRequest@1

Performs HTTP requests to external APIs.

```yaml
- task: "Utilities/HttpRequest@1"
  name: CallApi
  inputs:
    url: "{{ apiBaseUrl }}/api/v1/orders"
    method: POST
    contentType: "application/json"
    headers:
      - name: "Authorization"
        value: "Bearer {{ apiToken }}"
    body:
      orderId: "{{ inputs.orderId }}"
  outputs:
    - name: result
      mapping: "response?.body?"
```

**Response structure**: The task returns a `Dictionary<string, object>` (case-insensitive) with key `response`. The response contains `StatusCode`, `Headers`, and `Body` (PascalCase in C#, but access is case-insensitive). Use `response?.body?` to get the parsed body. You can drill deeper: `response?.body?.output?`, `response?.body?.items?[0]?`.

**Case sensitivity**: Variable paths go through `Dictionary<string, object>(StringComparer.OrdinalIgnoreCase)` — so `body` and `Body` both work. Convention: use lowercase `body`.

Response available at `ActivityName?.CallApi?.result?`.

## Map@1

Extracts/reshapes data from variables into new variables.

```yaml
- task: "Utilities/Map@1"
  name: MapData
  inputs:
    variables:
      - name: orderNumber
        value: "{{ Data?.GetOrder?.order?.orderNumber? }}"
      - name: customerName
        value: "{{ Data?.GetOrder?.order?.customer?.name? }}"
```

## Template@1

Renders a Handlebars template string with data.

```yaml
- task: "Utilities/Template@1"
  name: RenderMessage
  inputs:
    template: "Hello {{name}}, your order {{orderNumber}} is {{status}}."
    data:
      name: "{{ Data?.GetOrder?.order?.customer?.name? }}"
      orderNumber: "{{ Data?.GetOrder?.order?.orderNumber? }}"
      status: "{{ Data?.GetOrder?.order?.status? }}"
  outputs:
    - name: message
      mapping: "result?"
```

## CsvParse@1

Parses CSV content into structured data.

```yaml
- task: "Utilities/CsvParse@1"
  name: ParseCsv
  inputs:
    content: "{{ Data?.DownloadFile?.fileContent? }}"
    delimiter: ","
    hasHeader: true
  outputs:
    - name: rows
      mapping: "rows?"
```

## Export@1

Exports data to file format.

```yaml
- task: "Utilities/Export@1"
  name: ExportData
  inputs:
    data: "{{ Data?.GetOrders?.result?.items? }}"
    format: "csv"
  outputs:
    - name: file
      mapping: "file?"
```

## Import@1

Imports data from file content.

```yaml
- task: "Utilities/Import@1"
  name: ImportData
  inputs:
    content: "{{ fileContent }}"
    format: "csv"
  outputs:
    - name: data
      mapping: "data?"
```
