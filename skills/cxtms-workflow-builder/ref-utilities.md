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
| `Utilities/UnzipFile@1` | Extract files from ZIP archive (local path or URL) |
| `Utilities/ResolveTimezone@1` | Resolve IANA timezone and UTC offset from lat/lng coordinates |

## UnzipFile@1

Extracts files from a ZIP archive. Accepts a local file path (from `saveToFile` or previous step) or a URL (`file://`, `http://`, `https://`). Files are extracted to a workflow-scoped temp directory with auto-cleanup.

```yaml
- task: "Utilities/UnzipFile@1"
  name: ExtractArchive
  inputs:
    filePath: "{{ Main?.DownloadArchive?.result?.FilePath? }}"
    filePattern: "*.csv"
  outputs:
    - name: files
      mapping: "Files?"
    - name: count
      mapping: "Count?"
```

**Inputs:** `filePath` (string, local path) OR `fileUrl` (string, URL — `file://`, `http://`, `https://`). Optional: `filePattern` (glob pattern, e.g. `*.csv`, `data_*.json`).
**Outputs:** `Files` (string[] — full paths to extracted files), `Count` (int — number of matched files).
Provide one of `filePath` or `fileUrl`. Common pattern: HttpRequest with `saveToFile: true` → UnzipFile with `filePath`.

```yaml
# Download + unzip + import pipeline
- task: "Utilities/HttpRequest@1"
  name: Download
  inputs:
    url: "{{ downloadUrl }}"
    method: GET
    saveToFile: true
  outputs:
    - name: result
      mapping: "response?"

- task: "Utilities/UnzipFile@1"
  name: Unzip
  inputs:
    filePath: "{{ Main?.Download?.result?.FilePath? }}"
    filePattern: "*.csv"
  outputs:
    - name: files
      mapping: "Files?"

- task: foreach
  name: ProcessFiles
  collection: "Main?.Unzip?.files?"
  steps:
    - task: "Utilities/Import@1"
      name: ImportFile
      inputs:
        fileUrl: "file://{{ item }}"
        format: "csv"
```

---

## ResolveTimezone@1

Resolves IANA timezone ID and current UTC offset from geographic coordinates using offline boundary lookup (GeoTimeZone).

```yaml
- task: "Utilities/ResolveTimezone@1"
  name: ResolveTimezone
  inputs:
    latitude: "{{ postalCode.location.y }}"
    longitude: "{{ postalCode.location.x }}"
  outputs:
    - name: tz
      mapping: "timezoneId?"
    - name: offset
      mapping: "utcOffset?"
```

**Inputs:** `latitude` (double/string, required), `longitude` (double/string, required)
**Outputs:** `timezoneId` (string, e.g. `America/Chicago`), `utcOffset` (double, e.g. `-5`)
Throws `WorkflowRuntimeException` if lat/lng missing or unparseable.

---

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

**`saveToFile` mode**: When `saveToFile: true`, the response body is saved to a temp file instead of being returned in memory. The response object changes to `{ StatusCode, Headers, FilePath }`. Use this for large file downloads, then pass `FilePath` to downstream tasks like `UnzipFile` or `Import`.

```yaml
- task: "Utilities/HttpRequest@1"
  name: DownloadArchive
  inputs:
    url: "{{ downloadUrl }}"
    method: GET
    saveToFile: true
  outputs:
    - name: result
      mapping: "response?"
# result.FilePath contains the temp file path
```

**Action events**: When an HTTP request operates on a specific entity (e.g., sending parcel info for an order), enable `actionEvents` in the inputs so the system can track and notify about the request. Include `eventDataExt` with the entity ID to link the event to the entity.

```yaml
- task: "Utilities/HttpRequest@1"
  name: CallCarrierApi
  inputs:
    actionEvents:
      enabled: true
      eventName: "carrier.sendParcelInfo"
      eventDataExt:
        orderId: "{{ inputs.orderId }}"
    url: "{{ carrierConfig?.baseUrl? }}/api/shipments"
    method: POST
    contentType: "application/json"
    body:
      trackingNumber: "{{ Data?.GetOrder?.order?.trackingNumber? }}"
  outputs:
    - name: result
      mapping: "response?.body?"
```

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

Parses CSV/TSV data from a URL (file://, http://, https://). Headers are trimmed of whitespace, BOM, and special characters. Outputs: `records` (array of dicts), `count` (int), `hasRecords` (boolean).

```yaml
- task: "Utilities/CsvParse@1"
  name: ParseCsv
  inputs:
    url: "{{ Data?.DownloadFile?.filePath? }}"
    hasHeader: true
  outputs:
    - name: rows
      mapping: "records?"
    - name: rowCount
      mapping: "count?"
```

Tab-delimited with custom columns (e.g. GeoNames postal code files):

```yaml
- task: "Utilities/CsvParse@1"
  name: ParsePostalCodes
  inputs:
    url: "{{ Data?.UnzipFiles?.filePath? }}"
    delimiter: "\t"
    columns:
      - CountryCode
      - Code
      - PlaceName
      - StateName
      - StateCode
      - AdminName2
      - AdminCode2
      - AdminName3
      - AdminCode3
      - Latitude
      - Longitude
      - Accuracy
  outputs:
    - name: postalCodes
      mapping: "records?"
    - name: totalCount
      mapping: "count?"
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

Imports data from file content or URL. Supports `file://` URLs for local files (e.g. from UnzipFile output).

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

```yaml
# Import from local file (e.g. extracted from ZIP)
- task: "Utilities/Import@1"
  name: ImportLocalFile
  inputs:
    fileUrl: "file://{{ localFilePath }}"
    format: "csv"
  outputs:
    - name: data
      mapping: "data?"
```

**`file://` URL support**: Import, Order/Import, PostalCodes/Import, and Notes/Import all accept `file://` URLs via UrlStreamHelper. This enables pipeline patterns: HttpRequest (saveToFile) → UnzipFile → Import (file://).
