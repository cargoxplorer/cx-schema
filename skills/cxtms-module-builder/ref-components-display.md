# Data Display Components

## Contents
- DataGrid component
- Text component
- Markup component
- Badge component
- Icon component
- Image component
- Photo component
- Summary component
- Diff component
- Viewer component
- Embed component

## dataGrid

Full-featured data table with views, filtering, sorting, pagination, and row actions.

**Responsive layout:**
- **Toolbar**: ViewSelector and search input stack full-width on mobile (`xs`), then collapse to auto-width on `sm` and above. Search input enforces a `20ch` minimum width on `sm+`.
- **Filters**: Filter inputs use a responsive grid — 1 per row on `xs`/`sm`, 2 per row on `md`, 3 per row on `lg`, 4 per row on `xl`.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `toolbar` | `component[]` | Header toolbar components |
| `dotsMenu` | `{items[]}` | Three-dot menu per row |
| `dotsMenu.items[]` | `{label, icon, onClick, permission, isHidden, disabled}` | Menu item |

**Row-aware dots menu expressions:** `dotsMenu.items[].disabled` and `isHidden` are evaluated with component props plus the current row data. Reference row fields directly, e.g. `disabled: "{{ eval status !== 'Ready' || isLocked }}"`.
| `views` | `ITableViewProps[]` | View definitions |
| `enableSelect` | `Single \| Multiple` | Row selection mode |
| `isInDialog` | `boolean` | Optimize for dialog (10 rows) |
| `refreshHandler` | `string` | Refresh handler name |

**Options (under `props.options`):**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `query` | `string` | — | **Required.** GraphQL entity name |
| `rootEntityName` | `string` | — | **Required.** Entity name for dynamic grid |
| `entityKeys` | `string[]` | — | **Required.** Primary key fields |
| `includeEntityKeysInExport` | `boolean` | `true` | Force `entityKeys`/primary keys into exports even when hidden, preserving ID-first re-import matching. Set `false` for id-less templates or cross-space copies. |
| `navigationType` | `navigate \| dialog \| store` | — | **Required.** Row click behavior |
| `enableDynamicGrid` | `boolean` | — | Enable dynamic columns |
| `enableViews` | `boolean` | — | Show view selector |
| `enableSearch` | `boolean` | — | Show search input |
| `enablePagination` | `boolean` | — | Show pagination |
| `enableColumns` | `boolean` | — | Show column selector |
| `enableFilter` | `boolean` | — | Show filter panel |
| `defaultView` | `string` | — | Default view name |
| `defaultPageSize` | `number` | `20` | Rows per page |
| `enableRefresh` | `boolean` | — | Auto-refresh |
| `refreshInterval` | `number` | `30000` | Auto-refresh polling interval (ms) |
| `enableChangeTracking` | `boolean` | `true` | Track data changes |
| `highlightNew` | `boolean` | `true` | Highlight newly added rows |
| `highlightUpdated` | `boolean` | `true` | Highlight rows with updated values |
| `highlightForRefreshes` | `number` | `1` | Per-row TTL — refresh cycles a highlight persists |
| `defaultExpandedRows` | `boolean` | `false` | Pre-expand parent rows once on first load when `childViews` exist; refreshes preserve user collapse/expand choices |
| `onRowClick` | `action[]` | — | Default row click action |
| `onDataLoad` | `action[]` | — | Action after data loads |
| `items` | `any` | — | Static data (instead of query) |

**Pagination display:** when `totalCount` is `0`, DataGrid shows `Showing 0 to 0 of 0 entries` instead of starting at row `1`.

**View definition:**
| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | View identifier |
| `displayName` | `ILocalizeString` | View label |
| `columns` | `IColumn[]` | Column definitions |
| `filter` | `string` | View-level filter |
| `search` | `string` | Default search term seeded once on initial load; supports `{{ }}` templates; URL/user search wins |
| `orderBy` | `{name, direction}[]` | Default sort |
| `paginationPosition` | `top \| bottom` | Place pagination controls above or below rows (`bottom` default) |
| `onRowClick` | `action[]` | Per-view row click |
| `enableSelect` | `Single \| Multiple` | Per-view selection |
| `includeEntityKeysInExport` | `boolean` | Per-view override for exporting entity keys |
| `childViews` | `object` | Expandable child views |

**Column definition:**
| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Field name or resolver expression |
| `label` | `ILocalizeString` | Column header |
| `isHidden` | `boolean \| template` | Available in picker but hidden by default; also excluded from export when truthy |
| `isVisible` | `boolean \| template` | Inverse visibility flag; excluded from export when false |
| `showAs` | `{component, props, queries}` | Custom cell renderer |
| `width` | `number` | Column width |
| `sticky` | `left \| right` | Pin column |
| `enableEdit` | `boolean` | Enable inline editing (requires `editor`) |
| `editor` | `{component, props}` | Editor component (required with `enableEdit`) |
| `onEdit` | `action[]` | Action on edit commit. Variables: `changedValues`, `value`, `index`, + row data |
| `exportPath` | `string` | Export key/path override (top-level or `props.exportPath`). Fallback: `exportPath ?? path ?? name` |
| `exportTemplate` | `string` | Template expression for export-only formatted value (top-level or `props.exportTemplate`); exposed at `store.<gridName>.exportTemplates` |
| `path` | `string` | Data path for column value. Fallback for `exportPath` |
| `subQueries` | `string[]` | Extra GraphQL field paths to fetch without displaying them as columns |
| `excludeFromQuery` | `boolean` | Exclude from GraphQL query and CSV export |

```yaml
component: dataGrid
name: ordersGrid
props:
  refreshHandler: orders
  dotsMenu:
    items:
      - label: { en-US: "Edit" }
        onClick:
          - navigate: "orders/{{ id }}"
      - label: { en-US: "Delete" }
        onClick:
          - confirm:
              title: { en-US: "Delete?" }
              message: { en-US: "Are you sure?" }
          - mutation:
              command: "mutation($id: Int!) { deleteOrder(id: $id) { success } }"
              variables: { id: "{{ number id }}" }
          - refresh: orders
  views:
    - name: all
      displayName: { en-US: "All Orders" }
      paginationPosition: top
      columns:
        - name: id
          isHidden: true
        - name: orderNumber
          label: { en-US: "Order #" }
          subQueries:
            - customer.name
        - name: customerName
          label: { en-US: "Customer" }
          exportPath: customer.displayName
        - name: totalAmount
          label: { en-US: "Total" }
          exportTemplate: "{{ formatCurrency totalAmount currencyCode }}"
        - name: status
          label: { en-US: "Status" }
          showAs:
            component: Badges/StatusesBadge
        - name: created
          label: { en-US: "Created" }
          showAs:
            component: text
            props:
              value: "{{ format created L }}"
      orderBy:
        - name: created
          direction: DESC
    - name: active
      displayName: { en-US: "Active" }
      filter: "status:Active"
      search: "{{ inputs.customerName }}"
      columns:
        - name: id
          isHidden: true
        - name: orderNumber
          label: { en-US: "Order #" }
        - name: customerName
          label: { en-US: "Customer" }
  options:
    query: orders
    rootEntityName: Order
    entityKeys: [id]
    navigationType: navigate
    enableDynamicGrid: true
    enableViews: true
    enableSearch: true
    enablePagination: true
    enableColumns: true
    enableFilter: true
    defaultView: all
    defaultExpandedRows: true
    includeEntityKeysInExport: true
    onRowClick:
      - navigate: "orders/{{ id }}"
  toolbar:
    - component: dropdown
      props:
        label: { en-US: "Actions" }
        icon: activity
        items:
          - label: { en-US: "Export" }
            onClick:
              - notification: { message: { en-US: "Exporting..." }, type: success }
```

### Entity Fields & Column Visibility

When `rootEntityName` is set in datagrid options, the component fetches entity field definitions via GraphQL at runtime. Entity fields become "available columns" in the column picker — they are **not visible by default**. To make an entity field visible by default, add it to a view's `columns` array.

**Entity field properties** (in `entities[].fields[]`):

| Property | Location | Effect |
|----------|----------|--------|
| `allowOrderBy: false` | `props` | Disables sorting |
| `allowFilter: false` | `props` | Hides from filter picker |
| `allowSelect: false` | `props` | Hides from standard column picker; filter picker still uses `allowFilter` |
| `filterByProperty` | `props` | Filter against a different field/path than the display column; nested filter paths honor parent `filterByProperty` values |
| `isInactive: true` | top-level | Marks field as inactive |
| `isCustomField: true` | top-level | Marks as custom field |
| `priority: <int>` | top-level | Resolves duplicate field definitions across app modules; highest active priority wins |

**Visibility rules:**

- Do **not** use `fieldType: select` for new entity fields. It is a legacy pattern that requires `props.showAs` to appear in the column picker and causes rendering conflicts on editable columns (see pitfalls below). Use the appropriate non-select fieldType instead (`text`, `number`, `date`, `enhanced-rangedatetime`, `checkbox`, etc.). All non-select types appear in the picker without needing `showAs`.
- `fieldType: Entity` is filtered out of the column picker entirely by the runtime — do not use it.
- `isHidden` is only valid on view columns, not entity field definitions.
- View column `name` must exactly match entity field `name`. If they differ (e.g., using a GraphQL alias prefix), the datagrid treats them as two separate columns — one always visible from the view, one hidden in the picker from the entity field.
- Saved database views override YAML definitions. User customizations take priority. If a user has saved a view, YAML visibility changes have no effect until the saved view is deleted.

**Correct pattern** (resolver column, sortable, filterable, in picker):

```yaml
entities:
  - name: MyEntity
    entityKind: Order
    fields:
      - name: 'getTerminal(idPropertyName:"terminalId").name'
        displayName: { en-US: Terminal }
        description: { en-US: Terminal }
        fieldType: text
        isInactive: false
        isCustomField: true
        props:
          orderByProperty: "customValues.terminalId->terminal.name"
          filterByProperty: "customValues.terminalId"
          filter:
            component: Terminals/Select

views:
  - name: all
    columns:
      - name: 'getTerminal(idPropertyName:"terminalId").name'  # matches entity field exactly
        label: { en-US: Terminal }
```

### Export + Re-import Keys

DataGrid export configuration now prepends missing `options.entityKeys` by default. This is intentional: import tasks can match by primary key first, so users can export a grid, edit business-key columns, and re-import without creating duplicate records.

Disable key injection only for clean/template exports:

```yaml
props:
  options:
    entityKeys: [contactAddressId]
    includeEntityKeysInExport: false
  views:
    - name: publicTemplate
      includeEntityKeysInExport: false
```

### Inline Cell Editing

**Both `enableEdit: true` AND `editor` are required** for inline editing to activate.

Example with built-in field editor:

```yaml
columns:
  - name: trackingNumber
    enableEdit: true
    editor: { component: field }
    onEdit:
      - mutation:
          variables:
            trackingNumber: "{{ changedValues }}"
```

Example with select-async editor — use `{{ value }}` in `onEdit`:

```yaml
columns:
  - name: customValues.returnLocation
    enableEdit: true
    editor:
      component: Terminals/Select
    onEdit:
      - mutation:
          variables:
            input:
              values:
                customValues:
                  returnLocationId: "{{ number value }}"
```

### Entity Field Pitfalls

**Pitfall 1 — `fieldType: select` is legacy (do not use for new fields)**

`fieldType: select` requires `props.showAs` to appear in the column picker — without it, the column is invisible. Non-select types always appear.

When editing existing modules that use `fieldType: select` with inline editing: `showAs` changes how EditableCell renders in display mode. The cell goes through ComponentRender template evaluation instead of raw value display. This produces different visual output than the original grid column definition. Be aware of this dual behavior when maintaining legacy `select` fields.

**Pitfall 2 — Entity field `onEdit` must match grid column `onEdit` verbatim**

When a user re-adds an editable column from the picker, the entity field's `onEdit` replaces the grid column's `onEdit` entirely. If they differ (different mutation, different variable names, different `onSuccess`), the re-added column saves differently. Always copy `onEdit` from the grid view column definition into the entity field definition verbatim.

**Pitfall 3 — Edit properties go inside `props` in entity fields**

Unlike grid view columns where `enableEdit`, `editor`, and `onEdit` are top-level, entity field definitions must place them inside `props`. The runtime automatically promotes them to top-level when building available columns.

**Example — entity field with inline editing:**

```yaml
entities:
  - name: MyEntity
    entityKind: Order
    fields:
      - name: 'getTerminal(idPropertyName:"terminalId").name'
        displayName: { en-US: Terminal }
        description: { en-US: Terminal }
        fieldType: text
        isInactive: false
        isCustomField: true
        props:
          enableEdit: true                   # inside props, not top-level
          editor:
            component: Terminals/Select
          onEdit:                            # must match grid column onEdit exactly
            - mutation:
                command: |
                  mutation UpdateOrderMutation($input: UpdateOrderInput!) {
                    updateOrder(input: $input) { order { orderId } }
                  }
                variables:
                  input:
                    organizationId: "{{number organizationId}}"
                    orderId: "{{number orderId}}"
                    values:
                      customValues:
                        terminalId: "{{ number value }}"
                onSuccess:
                  - refresh: orders
          orderByProperty: "customValues.terminalId->terminal.name"
          filterByProperty: "customValues.terminalId"
          filter:
            component: Terminals/Select
```

### Sorting Resolver Columns

Resolver columns (e.g., `getTerminal(idPropertyName:"terminalId").name`) cannot be sorted by default — the backend rejects them as invalid entity properties. Use `orderByProperty` in column `props` to override the sort field:

```yaml
- name: 'getTerminal(idPropertyName:"terminalId").name'
  label: { en-US: Terminal }
  props:
    orderByProperty: "customValues.terminalId->terminal.name"
```

Join syntax format: `customValues.{idPropertyName}->{entityAlias}.{property}`

Single-level property access only (`terminal.name` works, `contact.address.city` does not).

Registered join entities: `contact`, `order`, `modeOfTransportation`, `country`, `terminal`, `contactAddress`.

Contact-address custom values can use the same override pattern, for example `customValues.deliveryLocationId->contactAddress.name` or `customValues.returnLocationId->contactAddress.name`.

Alternative: disable sorting with `allowOrderBy: false` in column props.

### Hidden Query Dependencies

Use column-level `subQueries` when a column renderer, action, conditional style, or export needs related GraphQL fields that should not appear as visible columns. The runtime appends these paths to the query selection and preserves them when users add the column in view settings.

```yaml
- name: orderNumber
  label: { en-US: Order # }
  subQueries:
    - customer.name
    - customer.primaryContact.email
  showAs:
    component: text
    props:
      value: "{{ orderNumber }} — {{ customer.name }}"
```

### CSV Export

`exportPath` controls the column key used for CSV export. Fallback chain: `exportPath ?? path ?? name`.

For resolver columns, `exportPath` must use the GraphQL response key **without arguments**:

```yaml
# Correct — GraphQL response uses "getTerminal" as the key
- name: 'getTerminal(idPropertyName:"terminalId").name'
  exportPath: "getTerminal.name"
  label: { en-US: Terminal }

# Wrong — response key does not include arguments, CSV values will be empty
- name: 'getTerminal(idPropertyName:"terminalId").name'
  exportPath: 'getTerminal(idPropertyName:"terminalId").name'
```

For aliased resolver fields, use the alias as the response key:

```yaml
- name: 'returnLocation : getTerminal(idPropertyName:"returnLocationId").name'
  exportPath: "returnLocation.name"
```

---

## text

Typography text display with template interpolation.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Text content (template-parsed, localized) |
| `type` | `h1-h6 \| p \| span \| block` | `span` | HTML element / MUI variant |
| `color` | `string` | `text` | MUI color |
| `options` | `object` | — | Additional MUI Typography props |
| `label` | `string \| localized \| template` | — | Optional label rendered with the text |
| `labelPosition` | `top \| left` | `top` | Label placement |
| `labelColor` | `string` | `text.secondary` | MUI color for label |
| `labelWidth` | `string \| number` | `auto` | Minimum label width when `labelPosition: left` |
| `stopPropagation` | `boolean` | — | Stop click propagation |

**Events:** `onClick`

```yaml
- component: text
  name: orderTitle
  props:
    value: "Order #{{ orderNumber }}"
    type: h4
    color: primary

- component: text
  name: statusLabel
  props:
    label: { en-US: "Last updated" }
    labelPosition: left
    labelWidth: 8rem
    value: "{{ format lastModified LLL }}"
    type: span
    color: text.secondary
```

---

## markup

Markdown renderer using ReactMarkdown with GitHub Flavored Markdown.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | — | Markdown content (template-parsed) |
| `options.className` | `string` | `markup-content` | Wrapper CSS class |
| `options.wrapper` | `string` | `div` | Wrapper HTML element |

```yaml
component: markup
name: description
props:
  content: |
    ## Instructions
    - Step 1: Fill in the form
    - Step 2: Click **Save**
    - Step 3: Review the results
  options:
    className: help-text
```

---

## badge

Colored chip/badge with dot indicator.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Badge text (template-parsed) |
| `colorKey` | `string` | Color lookup key (template-parsed; defaults to lowercased label) |
| `options.colors` | `Record<string, {label, bgcolor, dot}>` | Color map (must include `default`) |
| `onClick` | `Action[]` | Actions to dispatch when the badge is clicked. Makes the badge interactive (pointer cursor). |

```yaml
component: badge
name: statusBadge
props:
  label: "{{ status }}"
  options:
    colors:
      active: { label: "Active", bgcolor: "#e8f5e9", dot: "#4caf50" }
      inactive: { label: "Inactive", bgcolor: "#fce4ec", dot: "#f44336" }
      default: { label: "Unknown", bgcolor: "#f5f5f5", dot: "#9e9e9e" }

# Badge with click action
component: badge
name: priorityBadge
props:
  label: "{{ order.priority }}"
  colorKey: "{{ order.priority }}"
  options:
    colors:
      high: { label: "High", bgcolor: "#fce4ec", dot: "#f44336" }
      normal: { label: "Normal", bgcolor: "#e8f5e9", dot: "#4caf50" }
      default: { label: "Unknown", bgcolor: "#f5f5f5", dot: "#9e9e9e" }
  onClick:
    - navigate:
        route: order-detail
        params: { id: "{{ order.id }}" }
```

---

## icon

Icon renderer. Supports FontAwesome, Tabler, and Feather icons.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `icon` | `string` | Icon name: FontAwesome name, `tabler-*` class, or `activity` |
| `color` | `string` | MUI palette color (e.g., `primary`, `error.light`) or CSS color |
| `iconColor` | `string` | Higher-priority color override |
| `style` | `object` | Inline styles |

```yaml
component: icon
name: statusIcon
props:
  icon: check-circle
  color: success
```

---

## image

Simple responsive image.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | — | Image URL (template-parsed) |
| `alt` | `string` | `image` | Alt text |
| `sx` | `SxProps` | `{maxWidth:'100%', height:'auto'}` | Styles |
| `className` | `string` | — | CSS class |

```yaml
component: image
name: logo
props:
  url: "{{ logoUrl }}"
  alt: "Company Logo"
  sx: { maxWidth: 200, borderRadius: 1 }
```

---

## photo

Camera capture component. Opens device camera, captures photos, uploads to S3.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `onTakePhoto` | `action[]` | Action after capture+upload (data: `fileUrl`, `fileName`) |
| `onClosePhoto` | `action[]` | Action on Save & Close |

```yaml
component: photo
name: itemPhoto
props:
  onTakePhoto:
    - setFields:
        photoUrl: "{{ fileUrl }}"
    - notification: { message: { en-US: "Photo captured" }, type: success }
  onClosePhoto:
    - refresh: photos
```

---

## summary

Expandable accordion with summary items (icon + label + value) in header.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Heading text |
| `items` | `{label, value, icon?, iconColor?}[]` | Summary data (values template-parsed) |
| `options.allowExpand` | `boolean` | Enable expand/collapse |
| `options.defaultExpanded` | `boolean` | Start expanded |
| `refreshHandler` | `string` | Refresh handler |

**Children:** Yes — rendered in AccordionDetails when `allowExpand: true`.

```yaml
component: summary
name: orderSummary
props:
  label: "Order Summary"
  items:
    - { label: "Total", value: "{{ totalAmount }}", icon: "dollar-sign", iconColor: "primary" }
    - { label: "Items", value: "{{ itemCount }}", icon: "package" }
    - { label: "Status", value: "{{ status }}", icon: "activity" }
  options:
    allowExpand: true
    defaultExpanded: false
```

---

## diff

Side-by-side diff viewer for comparing text.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `oldValue` | `string` | — | Before text (template-parsed) |
| `newValue` | `string` | — | After text (template-parsed) |
| `leftTitle` | `string` | `Old` | Left pane title |
| `rightTitle` | `string` | `New` | Right pane title |
| `useDarkTheme` | `boolean` | auto | Dark theme (auto-detects from MUI) |

```yaml
component: diff
name: configDiff
props:
  oldValue: "{{ previousConfig }}"
  newValue: "{{ currentConfig }}"
  leftTitle: "Previous Version"
  rightTitle: "Current Version"
```

---

## viewer

PDF/image document viewer with optional download.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | — | File URL (template-parsed) |
| `type` | `pdf \| image` | auto | File type (auto-detects from extension) |
| `options.enableDownload` | `boolean` | — | Show download button |
| `options.fileName` | `string` | — | Download filename |
| `options.title` | `ILocalizeString` | — | Viewer title |
| `options.height` | `string` | `600px` | Container height |
| `options.width` | `string` | `100%` | Container width |

```yaml
component: viewer
name: documentViewer
props:
  url: "{{ documentUrl }}"
  options:
    title: { en-US: "Invoice Document" }
    enableDownload: true
    fileName: "invoice-{{ orderNumber }}.pdf"
    height: "800px"
```

---

## embed

Iframe embed for external URLs.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `url` | `string` | Iframe source URL (template-parsed) |
| `className` | `string` | Wrapper CSS class |

```yaml
component: embed
name: externalReport
props:
  url: "https://reports.example.com/dashboard?id={{ reportId }}"
  className: "full-width-embed"
```
