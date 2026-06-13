# Layout & Structure Components

## Contents
- Adaptive / Responsive Design (mobile, tablet, desktop)
- Layout component
- Row component
- Col component
- Header component
- Tabs component
- Toolbar component
- Card component
- Line component
- Slot component

---

## Adaptive / Responsive Design (Mobile, Tablet, Desktop)

CXTMS UI uses MUI Grid v2 breakpoints. **Design mobile-first**: define `xs` behavior, then progressively enhance for `sm`, `md`, `lg`, `xl`.

### Breakpoints

| Token | Min width | Target devices |
|-------|-----------|----------------|
| `xs` | 0px | Phone (portrait) |
| `sm` | 600px | Phone (landscape), small tablet |
| `md` | 900px | Tablet, small laptop |
| `lg` | 1200px | Desktop |
| `xl` | 1536px | Large desktop / wide monitor |

### Responsive props (modern MUI Grid v2)

These accept a number (treated as `xs`) **or** an object keyed by breakpoint:

| Prop | Where | Example |
|------|-------|---------|
| `size` | any layout child | `size: { xs: 12, sm: 6, md: 4, lg: 3 }` |
| `offset` | any layout child | `offset: { md: 2 }` |
| `order` | any layout child | `order: { xs: 2, md: 1 }` |
| `columns` | `layout` container | `columns: { xs: 4, md: 12 }` (total grid columns) |
| `spacing` | `layout` container | `spacing: { xs: 1, sm: 2, md: 3 }` (sets BOTH row + column gap) |
| `columnSpacing` | `layout` container | `columnSpacing: { xs: 1, md: 3 }` (horizontal gap only) |
| `rowSpacing` | `layout` container | `rowSpacing: { xs: 2, md: 4 }` (vertical gap only) |
| `itemDefaults.size` | `layout` container | `itemDefaults: { size: { xs: 12, md: 6 } }` |

> **Modern spacing pattern** (MUI Grid v2 `row-and-column-spacing`): use `rowSpacing` and `columnSpacing` independently when you need different gap values for stacked vs side-by-side, or to tighten the layout on phones. Use `spacing` when both axes should match. All three accept responsive breakpoint maps.

### Legacy props — DO NOT use in new code

| Legacy | Replace with |
|--------|-------------|
| `cols: N` (on `layout` or `form`) | `itemDefaults: { size: { xs: 12, md: <12/N> } }` on a `layout`. Non-responsive and ignored on mobile. |
| `row` component | `layout` component with responsive `columns` / `itemDefaults.size`. `row` has no breakpoint-aware `columns` and no `itemDefaults`. Existing `row` usages can stay; new code uses `layout`. |
| Bare `spacing: 3` (single number) | Still valid, but prefer `rowSpacing` / `columnSpacing` (or responsive `spacing: { xs, md }`) for adaptive layouts. |

### Mobile-first patterns

#### One column on mobile → two on tablet → three on desktop
```yaml
component: layout
name: detailFields
props:
  rowSpacing: { xs: 2, md: 3 }       # vertical gap grows on desktop
  columnSpacing: { xs: 0, sm: 2, md: 3 }  # horizontal gap only when columns appear
  itemDefaults:
    size: { xs: 12, sm: 6, md: 4 }
children:
  - component: field
    name: name
    props: { type: text, label: { en-US: "Name" } }
  - component: field
    name: code
    props: { type: text, label: { en-US: "Code" } }
  - component: field
    name: status
    props: { type: select, label: { en-US: "Status" } }
```

#### Side-by-side on desktop, stacked on mobile (8/4 split)
```yaml
component: layout
props:
  spacing: { xs: 2, md: 3 }          # uniform gap, larger on desktop
children:
  - component: card
    name: mainPanel
    props:
      size: { xs: 12, md: 8 }
    children: [ ... ]
  - component: card
    name: sidebar
    props:
      size: { xs: 12, md: 4 }
    children: [ ... ]
```

#### Reorder on mobile (e.g., put summary first on phones)
```yaml
component: layout
props:
  rowSpacing: { xs: 2, md: 0 }       # spacing only when stacked
  columnSpacing: { md: 3 }
children:
  - component: card
    name: details
    props:
      size: { xs: 12, md: 8 }
      order: { xs: 2, md: 1 }
    children: [ ... ]
  - component: card
    name: summary
    props:
      size: { xs: 12, md: 4 }
      order: { xs: 1, md: 2 }
    children: [ ... ]
```

#### Responsive total columns (12-grid on desktop, 4-grid on mobile)
```yaml
component: layout
props:
  columns: { xs: 4, md: 12 }
  spacing: { xs: 1, md: 2 }
children:
  - component: field
    name: a
    props: { type: text, size: { xs: 4, md: 3 } }
  - component: field
    name: b
    props: { type: text, size: { xs: 4, md: 3 } }
  - component: field
    name: c
    props: { type: text, size: { xs: 4, md: 6 } }
```

#### Different row vs column gaps (modern row-and-column-spacing pattern)
```yaml
# Form fields: tight column gap, comfortable row gap, both grow on desktop
component: layout
props:
  columnSpacing: { xs: 1, md: 2 }
  rowSpacing: { xs: 2, md: 4 }
  itemDefaults:
    size: { xs: 12, md: 6 }
children:
  - component: field
    name: firstName
    props: { type: text, label: { en-US: "First Name" } }
  - component: field
    name: lastName
    props: { type: text, label: { en-US: "Last Name" } }
  - component: field
    name: email
    props: { type: email, label: { en-US: "Email" }, size: { xs: 12 } }
```

#### Flex-wrapping toolbar / chip set (no grid math)
```yaml
component: layout
name: actions
props:
  containerTag: box       # flex-wrap container, not Grid
  spacing: { xs: 1, md: 2 }
  alignItems: center
children:
  - component: button
    name: refresh
    props: { label: { en-US: "Refresh" }, icon: refresh-cw }
  - component: button
    name: export
    props: { label: { en-US: "Export" }, icon: download }
```

### Mobile sanity checklist

- Default to single column (`size: 12`) on `xs`. Never assume horizontal space on phones.
- Don't exceed **2 columns on `sm`**, **3 columns on `md`**, **4 columns on `lg`**. Avoid 5+ across.
- Long fields (`textarea`, `quill`, `attachment`, multiline notes) should always be `size: { xs: 12 }` regardless of viewport.
- Tap targets ≥ 44px — use default `button` size for primary actions on mobile, not `size: small`.
- `tabs` are horizontally scrollable; verify labels are short or use `icon` only on `xs`.
- Avoid horizontal scroll inside a card on `xs`. Use `dataGrid` filter collapse or stack columns into a card-list view.
- Pair fields that belong together (firstName/lastName, qty/uom, from/to) — give them the same breakpoints so they always wrap together.
- Use `containerTag: box` for **non-grid** flex-wrap layouts (icon toolbars, chip sets, tag rows) — saves you from grid math.

### Style rules — do not use for layouts

- **Do NOT use CSS class names (`className`) for layout** on `layout`, `row`, or `col`. Use:
  - `size` / `columns` / `offset` for sizing
  - `spacing` / `rowSpacing` / `columnSpacing` for gaps
  - `sx` / `containerSx` / `itemDefaults.sx` for any visual tweaks (colors, borders, custom margins)
  - `containerTag: box` for flex-wrap layouts
- **Do NOT use `cols: N`** on `layout` or `form`. Use `itemDefaults: { size: { xs: 12, md: <12/N> } }`.
- **Do NOT use the `row` component** in new code. Use `layout` with responsive `columns` and `itemDefaults.size`.
- **Do NOT mix `spacing` with both `rowSpacing` and `columnSpacing`** — when both axes are set explicitly, omit `spacing`.

---

## layout

General-purpose container. Renders MUI Grid or Box with flexbox.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `number \| {xs,sm,md,lg,xl}` | `12` | Total grid columns. Use a breakpoint map for responsive grid resolution (e.g. `{ xs: 4, md: 12 }`). |
| `spacing` | `number \| string \| {xs,sm,md,lg,xl}` | `3` | Grid gap (BOTH row and column). Accepts a breakpoint map per modern MUI Grid v2. Set `rowSpacing` / `columnSpacing` to override one axis. |
| `columnSpacing` | `number \| string \| {xs,sm,md,lg,xl}` | — | Horizontal gap only. Overrides `spacing` on the column axis. |
| `rowSpacing` | `number \| string \| {xs,sm,md,lg,xl}` | — | Vertical gap only. Overrides `spacing` on the row axis. |
| `itemDefaults` | `{size?,offset?,order?,sx?,alignSelf?}` | — | Default Grid item props applied to every child (overridable per-child). **Primary lever for responsive child sizing.** |
| `containerTag` | `grid \| box` | `grid` | `grid` = MUI Grid (12-col math); `box` = flex-wrap container (no grid math). For `box`, only `spacing` is used (as the `gap` value). |
| `containerSx` | `SxProps` | — | MUI sx styles on container |
| `id` | `string` | — | Element ID (template-parsed) |
| `direction` | `row \| column` | `row` | Explicit flex direction (overrides `orientation`) |
| `orientation` | `horizontal \| vertical \| flex` | `horizontal` | Convenience wrapper that sets `direction` |
| `justifyContent` | `flex-start \| flex-end \| center \| space-between \| space-around \| space-evenly` | — | Flexbox main-axis alignment |
| `alignItems` | `flex-start \| flex-end \| center \| stretch \| baseline` | — | Flexbox cross-axis alignment |
| `margin` / `marginTop` / `marginBottom` / `marginLeft` / `marginRight` | `number \| string` | — | Container margin (MUI spacing units or CSS values) |
| `padding` / `paddingTop` / `paddingBottom` / `paddingLeft` / `paddingRight` | `number \| string` | — | Container padding |
| `refreshHandler` | `string` | — | Remounts on refresh event |
| `permission` | `string` | — | Permission gate |
| `title` | `ILocalizeString` | — | Layout title |
| `icon` | `string` | — | Layout icon |
| `toolbar` | `component[]` | — | Toolbar components |
| ~~`cols: number`~~ | _legacy_ | — | **Deprecated.** Non-responsive equal-width columns. Replace with `itemDefaults: { size: { xs: 12, md: <12/N> } }`. |
| ~~`className`~~ | _legacy_ | — | **Do not use for layout styling.** Layouts must use `size`, `columns`, `spacing`/`columnSpacing`/`rowSpacing`, and `sx` / `containerSx` / `itemDefaults.sx` for visual control — not CSS class names. |

**Events:** `onClick`

**Children:** Yes — each child rendered via ComponentRender, wrapped in Grid item.

```yaml
# Adaptive 2-column layout (1 col on mobile, 2 on tablet+)
# Modern MUI Grid v2 spacing: tighter columns + comfortable rows, both grow on desktop.
component: layout
name: detailLayout
props:
  columnSpacing: { xs: 1, md: 2 }
  rowSpacing: { xs: 2, md: 3 }
  itemDefaults:
    size: { xs: 12, md: 6 }
  title:
    en-US: "Detail View"
  icon: file-text
  permission: "Module/Read"
children:
  - component: field
    name: firstName
    props: { type: text, label: { en-US: "First Name" } }
  - component: field
    name: lastName
    props: { type: text, label: { en-US: "Last Name" } }
  - component: field
    name: notes
    props:
      type: textarea
      label: { en-US: "Notes" }
      rows: 3
      size: { xs: 12 }    # always full width — overrides itemDefaults
```

> **Do NOT use `cols: 2`** — non-responsive and forces the same column count on every viewport. Use `itemDefaults: { size: { xs: 12, md: 6 } }` instead.
> **Do NOT use CSS class names for layout styling.** Use breakpoint props (`size`, `columns`), spacing props (`spacing`, `rowSpacing`, `columnSpacing`), and `sx` / `containerSx` / `itemDefaults.sx` for visual control. The `className` prop is reserved for non-layout styling concerns (theming hooks, animations, etc.) and should generally be omitted.

```yaml
# Horizontal flex layout with toolbar
component: layout
name: pageLayout
props:
  orientation: vertical
  toolbar:
    - component: button
      name: saveBtn
      props:
        label: { en-US: "Save" }
        icon: check
        options: { type: submit, variant: primary }
children:
  - component: form
    name: myForm
    # ...
```

---

## row — LEGACY (use `layout` instead)

> **For new code, use `layout` instead of `row`.** The `layout` component supports `itemDefaults`, breakpoint-mapped `columns`, and the modern `rowSpacing`/`columnSpacing` pattern. The `row` component is kept for backwards compatibility with existing modules.

Horizontal MUI Grid row. Existing usages can stay; do not introduce new `row` blocks.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spacing` | `number \| string \| {xs,sm,md,lg,xl}` | `3` | Grid gap (both axes). Accepts breakpoint maps. |
| `columnSpacing` | `number \| string \| {xs,sm,md,lg,xl}` | — | Horizontal gap only |
| `rowSpacing` | `number \| string \| {xs,sm,md,lg,xl}` | — | Vertical gap only |
| `columns` | `number \| {xs,sm,md,lg,xl}` | `12` | Grid total columns |
| `direction` | `row \| column` | `row` | Grid direction |
| `sx` | `SxProps` | — | MUI sx styles |
| `alignItems` | `string` | — | Cross-axis alignment |
| `justifyContent` | `string` | — | Main-axis alignment |
| ~~`className`~~ | _legacy_ | — | **Do not use for layout styling.** Use `sx` instead. |

**Children:** Yes — rendered without Grid item wrapper (use children with responsive `size`).

```yaml
# PREFERRED — equivalent adaptive header using `layout` (modern, with row/column spacing)
component: layout
name: headerLayout
props:
  rowSpacing: { xs: 1, sm: 0 }
  columnSpacing: { sm: 2 }
  alignItems: center
children:
  - component: text
    name: title
    props:
      value: "Header"
      type: h3
      size: { xs: 12, sm: 8 }
  - component: button
    name: actionBtn
    props:
      label: { en-US: "Action" }
      size: { xs: 12, sm: 4 }
      sx: { textAlign: { xs: 'left', sm: 'right' } }
```

```yaml
# LEGACY (existing modules only — do not use in new code)
component: row
name: headerRow
props:
  spacing: { xs: 1, sm: 2 }
  alignItems: center
children:
  - component: col
    props: { size: { xs: 12, sm: 8 } }
    children:
      - component: text
        name: title
        props: { value: "Header", type: h3 }
  - component: col
    props: { size: { xs: 12, sm: 4 } }
    children:
      - component: button
        name: actionBtn
        props: { label: { en-US: "Action" } }
```

---

## col

Grid column item. Child of `row` or `layout`. The primary primitive for **per-child responsive sizing**.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `size` | `number \| {xs,sm,md,lg,xl}` | Column width in 12-grid (or parent's `columns` total). Plain number = `xs` only. Object = per-breakpoint width. |
| `offset` | `number \| {xs,sm,md,lg,xl}` | Leading offset (push column right) |
| `order` | `number \| {xs,sm,md,lg,xl}` | CSS `order` — change visual order per breakpoint |
| `sx` | `SxProps` | MUI sx styles |
| `alignSelf` | `string` | CSS align-self |
| ~~`className`~~ | _legacy_ | **Do not use for layout styling.** Use `sx` instead. |

**Children:** Yes.

```yaml
# Centered content column — full-width on mobile, 8 of 12 on desktop with 2-col offset
component: col
name: mainContent
props:
  size: { xs: 12, md: 8 }
  offset: { md: 2 }
children:
  - component: text
    name: body
    props: { value: "Content...", type: p }
```

```yaml
# Reorder on mobile — show summary above details on phones, beside on desktop
component: row
children:
  - component: col
    name: details
    props:
      size: { xs: 12, md: 8 }
      order: { xs: 2, md: 1 }
    children: [ ... ]
  - component: col
    name: summary
    props:
      size: { xs: 12, md: 4 }
      order: { xs: 1, md: 2 }
    children: [ ... ]
```

---

## header

Section header with title and optional subtitle.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Rendered as `<h3>` |
| `subtitle` | `string` | Rendered as `<h4>` with divider |
| `className` | `string` | Additional CSS class |

**Children:** Yes.

```yaml
component: header
name: sectionHeader
props:
  title: "Contact Information"
  subtitle: "Primary contact details"
```

---

## tabs

Tabbed interface with MUI TabContext. Tab state stored in URL params.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `options` | `object` | Additional props spread to Tab elements |
| `toolbar` | `component[]` | Action components next to tab list |
| `useNavigationForTabs` | `boolean` | Push to history instead of replace |

**Tab children props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `ILocalizeString` | Tab label (localized, template-parsed) |
| `isVisible` | `string` | Template expression — show when truthy |
| `isHidden` | `string` | Template expression — hide when truthy |
| `options` | `object` | Additional Tab element props |

**Children:** Each child = one tab. Content rendered inside TabPanel via LayoutComponent.

```yaml
component: tabs
name: detailTabs
props:
  toolbar:
    - component: button
      name: refreshBtn
      props: { label: { en-US: "Refresh" }, icon: refresh-cw }
children:
  - name: general
    props:
      label: { en-US: "General" }
    children:
      - component: field
        name: name
        props: { type: text, label: { en-US: "Name" } }
  - name: advanced
    props:
      label: { en-US: "Advanced" }
      isHidden: "{{ eval !isAdmin }}"
    children:
      - component: field
        name: config
        props: { type: textarea, label: { en-US: "Config" } }
```

---

## toolbar

Nav-style toolbar with title and action buttons.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | `ILocalizeString` | Toolbar title (navbar brand) |
| `buttons` | `component[]` | Action components (right-aligned) |

**Children:** No — uses `buttons` prop.

```yaml
component: toolbar
name: pageToolbar
props:
  title: { en-US: "Order Management" }
  buttons:
    - component: button
      name: exportBtn
      props: { label: { en-US: "Export" }, icon: download }
    - component: button
      name: createBtn
      props: { label: { en-US: "Create" }, icon: plus, options: { variant: primary } }
```

---

## card

MUI Card container with optional header, content, and actions.

**Props (under `options`):**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `elevation \| outlined` | — | MUI Card variant |
| `elevation` | `number` | — | Shadow depth |
| `sx` | `SxProps` | — | Card sx styles |
| `className` | `string` | — | Additional CSS class |
| `bgcolor` | `string` | — | Background color |
| `color` | `string` | — | Text color |
| `header` | `{title?, subheader?, sx?}` | — | Renders MUI CardHeader |
| `disableContentWrapper` | `boolean` | `false` | Skip CardContent wrapper |
| `contentSx` | `SxProps` | — | CardContent styles |
| `contentClassName` | `string` | `card-content` | CardContent CSS class |

**Children:** Yes — wrapped in CardContent (unless `disableContentWrapper`).

```yaml
component: card
name: summaryCard
props:
  options:
    variant: outlined
    header:
      title: "Summary"
      subheader: "Last updated today"
    contentSx:
      padding: 2
children:
  - component: text
    name: total
    props: { value: "Total: {{ totalAmount }}", type: h4 }
```

---

## slot

Extension point that renders dynamically registered components targeting a named slot. Enables cross-module UI extensions without modifying the original layout.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | — | Slot name to match. Supports templates: `TMS/{{entityType}}/Actions` |
| `itemTag` | `string` | `React.Fragment` | HTML element to wrap each extension (`div`, `li`, etc.) |

**Children:** No — extensions are loaded from the database at runtime.

Extension components must define `props.targetSlot` matching the slot name, `props.order` for sort order, and a `layout` object.

```yaml
# Define a slot extension point
component: slot
props:
  name: "TMS/ShipmentDashboard/Tabs"
```

```yaml
# Extension component (registered via another module's appComponents)
name: "TMS/ShipmentDashboard/TrackingTab"
props:
  targetSlot: "TMS/ShipmentDashboard/Tabs"
  order: 10
layout:
  component: tab
  props:
    label: { en-US: "Tracking" }
  children:
    - component: layout
      props:
        component: "TMS/Tracking/Panel"
```

**Naming convention:** `{Module}/{Entity}/{Location}` (e.g., `TMS/OrderDetail/Actions`)

---

## line

Simple `<hr>` horizontal divider.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options.style` | `CSSProperties` | `margin: 0.5rem 0` | Inline styles |

```yaml
component: line
name: divider
props:
  options:
    style: { margin: "1rem 0" }
```

---

## slot

Extension point that renders UI elements injected by other modules (via `appComponent` with `targetSlot`). Slots render extensions from the database — they have no YAML `children`.

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | Yes | Slot name to match against. Extension components target this name via `targetSlot`. Supports template expressions. |
| `itemTag` | `string` | No | HTML element type to wrap each extension (e.g., `li`, `div`) |

**Children:** No — slots render extension components registered in the database, not YAML children.

**Naming convention:** Use `Module/Entity/Location` pattern for slot names to avoid collisions (e.g., `Orders/Detail/Sidebar`, `Contacts/Form/Actions`).

```yaml
# Basic slot — extension point in a layout
component: slot
name: sidebarSlot
props:
  name: "Orders/Detail/Sidebar"
```

```yaml
# Dynamic slot name using template expression
component: slot
name: entitySlot
props:
  name: "{{ eval `Orders/${entityType}/Actions` }}"
```

```yaml
# Slot with itemTag for list-style extensions
component: slot
name: menuSlot
props:
  name: "Navigation/MainMenu/Items"
  itemTag: li
```

**How extensions target slots:** Other modules register extension components using `appComponent` with `targetSlot` and optional `order` to control rendering position within the slot. See `appComponent.json` schema for details.


## dashboard persistence

Editable dashboard layout persistence is scoped by dashboard name, organization, and current user. Reads, resets, and cancel-edit restores must include the current user so one user never loads or deletes another user's saved layout.
