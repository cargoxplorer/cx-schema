# Layout & Structure Components

## Contents
- Layout component
- Row component
- Col component
- Header component
- Tabs component
- Toolbar component
- Card component
- Line component
- Slot component

## layout

General-purpose container. Renders MUI Grid or Box with flexbox.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `horizontal \| vertical \| flex` | — | Grid direction |
| `cols` | `number` | — | Equal-width columns (`12/cols` per child) |
| `columns` | `number \| {xs,sm,md,lg,xl}` | — | Responsive column count |
| `spacing` | `number` | `3` | Grid gap spacing |
| `containerTag` | `grid \| box` | `grid` | Grid container vs flexbox Box |
| `containerSx` | `SxProps` | — | MUI sx styles on container |
| `className` | `string` | — | CSS class (template-parsed) |
| `id` | `string` | — | Element ID (template-parsed) |
| `direction` | `row \| column` | — | Explicit flex direction |
| `justifyContent` | `string` | — | Flexbox main-axis alignment |
| `alignItems` | `string` | — | Flexbox cross-axis alignment |
| `refreshHandler` | `string` | — | Remounts on refresh event |
| `permission` | `string` | — | Permission gate |
| `title` | `ILocalizeString` | — | Layout title |
| `icon` | `string` | — | Layout icon |
| `toolbar` | `component[]` | — | Toolbar components |
| `itemDefaults` | `{size?,offset?,order?,sx?}` | — | Default Grid item props for all children |

**Events:** `onClick`

**Children:** Yes — each child rendered via ComponentRender, wrapped in Grid item.

```yaml
# Basic 2-column layout
component: layout
name: detailLayout
props:
  cols: 2
  spacing: 2
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
```

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

## row

Horizontal MUI Grid row. Simpler alternative to layout for single rows.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spacing` | `number` | `3` | Grid spacing |
| `columns` | `number` | — | Grid columns |
| `direction` | `row \| column` | `row` | Grid direction |
| `sx` | `SxProps` | — | MUI sx styles |
| `className` | `string` | — | CSS class |
| `alignItems` | `string` | — | Cross-axis alignment |
| `justifyContent` | `string` | — | Main-axis alignment |

**Children:** Yes — rendered without Grid item wrapper (use `col` children).

```yaml
component: row
name: headerRow
props:
  spacing: 2
  alignItems: center
children:
  - component: col
    name: leftCol
    props: { size: 6 }
    children:
      - component: text
        name: title
        props: { value: "Header", type: h3 }
  - component: col
    name: rightCol
    props: { size: 6 }
    children:
      - component: button
        name: actionBtn
        props: { label: { en-US: "Action" } }
```

---

## col

Grid column item. Child of `row` or `layout`.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `size` | `number \| {xs,sm,md,lg,xl}` | Responsive column width (plain number = xs) |
| `offset` | `number \| {xs,sm,md,lg,xl}` | Responsive column offset |
| `order` | `number \| {xs,sm,md,lg,xl}` | CSS order for reordering |
| `sx` | `SxProps` | MUI sx styles |
| `className` | `string` | CSS class |
| `alignSelf` | `string` | CSS align-self |

**Children:** Yes.

```yaml
component: col
name: mainContent
props:
  size: { xs: 12, md: 8 }
  offset: { md: 2 }
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
