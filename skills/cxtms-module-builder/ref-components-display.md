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
| `onRowClick` | `action[]` | — | Default row click action |
| `onDataLoad` | `action[]` | — | Action after data loads |
| `items` | `any` | — | Static data (instead of query) |

**View definition:**
| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | View identifier |
| `displayName` | `ILocalizeString` | View label |
| `columns` | `IColumn[]` | Column definitions |
| `filter` | `string` | View-level filter |
| `orderBy` | `{name, direction}[]` | Default sort |
| `onRowClick` | `action[]` | Per-view row click |
| `enableSelect` | `Single \| Multiple` | Per-view selection |
| `childViews` | `object` | Expandable child views |

**Column definition:**
| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Field name |
| `label` | `ILocalizeString` | Column header |
| `isHidden` | `boolean` | Hidden column |
| `showAs` | `{component, props}` | Custom cell renderer |
| `width` | `number` | Column width |
| `sticky` | `left \| right` | Pin column |

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
      columns:
        - name: id
          isHidden: true
        - name: orderNumber
          label: { en-US: "Order #" }
        - name: customerName
          label: { en-US: "Customer" }
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
