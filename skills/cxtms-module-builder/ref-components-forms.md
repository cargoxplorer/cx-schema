# Form & Input Components

## Contents
- Mobile-friendly form layout (adaptive design)
- Form component
- Field component
- FieldCollection component
- BarcodeScanner component

---

## Mobile-Friendly Form Layout

> See **`ref-components-layout.md` → Adaptive / Responsive Design** for breakpoint definitions and the full responsive prop reference. This section covers form-specific patterns.

`form` itself is a flexbox column — children stack top-to-bottom with no horizontal flow. To create responsive multi-column forms (one column on mobile, two on tablet, etc.), wrap fields in a `layout` child and use **modern MUI Grid v2 spacing** (`columnSpacing` + `rowSpacing`, both responsive) plus `itemDefaults.size`.

> **Do NOT** use `cols: N`, the `row` component, or CSS `className`s for form layout. Use `layout` + `size` + `columnSpacing`/`rowSpacing` + `sx` only.

### Pattern 1 — Responsive 2-column form (1 column on mobile)

```yaml
component: form
name: contactForm
props:
  validationSchema:
    firstName: { type: string, required: true }
    lastName:  { type: string, required: true }
    email:     { type: string, required: true }
children:
  - component: layout
    name: contactFields
    props:
      columnSpacing: { xs: 1, md: 2 }   # tighter horizontal gap on mobile
      rowSpacing: { xs: 2, md: 3 }      # comfortable vertical breathing room
      itemDefaults:
        size: { xs: 12, md: 6 }         # 1 col mobile, 2 col tablet+
    children:
      - component: field
        name: firstName
        props: { type: text, label: { en-US: "First Name" } }
      - component: field
        name: lastName
        props: { type: text, label: { en-US: "Last Name" } }
      - component: field
        name: email
        props:
          type: email
          label: { en-US: "Email" }
          size: { xs: 12 }              # always full width
      - component: field
        name: notes
        props:
          type: textarea
          label: { en-US: "Notes" }
          rows: 4
          size: { xs: 12 }              # textareas always full width
```

### Pattern 2 — Three-tier form (1 / 2 / 3 columns)

```yaml
component: form
name: productForm
props:
  validationSchema:
    sku: { type: string, required: true }
children:
  - component: layout
    props:
      columnSpacing: { xs: 1, sm: 2, md: 3 }
      rowSpacing: { xs: 2, md: 3 }
      itemDefaults:
        size: { xs: 12, sm: 6, lg: 4 }  # phone: 1 col, tablet: 2 col, desktop: 3 col
    children:
      - component: field
        name: sku
        props: { type: text, label: { en-US: "SKU" } }
      - component: field
        name: name
        props: { type: text, label: { en-US: "Name" } }
      - component: field
        name: price
        props: { type: number, label: { en-US: "Price" } }
      - component: field
        name: weight
        props: { type: number, label: { en-US: "Weight" } }
      - component: field
        name: status
        props: { type: select, label: { en-US: "Status" } }
      - component: field
        name: category
        props: { type: select, label: { en-US: "Category" } }
```

### Pattern 3 — Section cards that reflow

Group related fields into cards. The cards stack on mobile and sit side-by-side on desktop.

```yaml
component: form
name: orderForm
props:
  validationSchema: { orderNumber: { type: string, required: true } }
children:
  - component: layout
    props:
      spacing: { xs: 2, md: 3 }         # uniform gap between cards
      itemDefaults:
        size: { xs: 12, lg: 6 }         # cards stack on phone/tablet, split on desktop
    children:
      - component: card
        name: customerCard
        props:
          options:
            variant: outlined
            header: { title: "Customer" }
        children:
          - component: layout
            props:
              columnSpacing: { xs: 1, md: 2 }
              rowSpacing: 2
              itemDefaults:
                size: { xs: 12, sm: 6 }
            children:
              - component: field
                name: customerId
                props: { type: select-async, label: { en-US: "Customer" } }
              - component: field
                name: poNumber
                props: { type: text, label: { en-US: "PO #" } }
      - component: card
        name: shippingCard
        props:
          options:
            variant: outlined
            header: { title: "Shipping" }
        children:
          - component: layout
            props:
              columnSpacing: { xs: 1, md: 2 }
              rowSpacing: 2
              itemDefaults:
                size: { xs: 12, sm: 6 }
            children:
              - component: field
                name: shipDate
                props: { type: date, label: { en-US: "Ship Date" } }
              - component: field
                name: carrier
                props: { type: select, label: { en-US: "Carrier" } }
```

### Pattern 4 — Paired fields that wrap together

Fields that belong together (qty + uom, from + to dates, address city/state/zip) should share breakpoints so they always wrap as a unit. Use a responsive `columns` total to pack 3 short fields into a single mobile row.

```yaml
- component: layout
  props:
    columns: { xs: 12, md: 12 }
    columnSpacing: { xs: 1, md: 2 }
    rowSpacing: 2
  children:
    - component: field
      name: quantity
      props: { type: number, label: { en-US: "Qty" }, size: { xs: 4 } }
    - component: field
      name: uom
      props: { type: select, label: { en-US: "UOM" }, size: { xs: 4 } }
    - component: field
      name: weight
      props: { type: number, label: { en-US: "Weight" }, size: { xs: 4 } }
```

### Pattern 5 — Toolbar that adapts

```yaml
- component: layout
  name: formActions
  props:
    columnSpacing: { xs: 1, md: 2 }
    sx: { justifyContent: { xs: 'space-between', md: 'flex-end' } }
  children:
    - component: button
      name: cancel
      props: { label: { en-US: "Cancel" }, variant: outlined }
    - component: button
      name: save
      props: { label: { en-US: "Save" }, options: { type: submit, variant: primary } }
```

### Form mobile checklist

- **Default to 1 column on `xs`** — never assume horizontal space. Use `itemDefaults.size: { xs: 12, ... }`.
- **2 columns on `md+`** for paired short fields (firstName/lastName, qty/uom, from/to).
- **Long fields full-width**: `textarea`, `quill`, `attachment`, `notes`, multi-line inputs → `size: { xs: 12 }`.
- **Cap visible columns**: max 2 on `sm`, max 3 on `md`, max 4 on `lg`. More than that overcrowds.
- **Group with cards** when a form has 3+ logical sections — gives clear visual breaks on mobile and reflow targets on desktop.
- **Use the modern Grid spacing pattern**: `columnSpacing` + `rowSpacing` (responsive maps) over the legacy single-number `spacing`. Tighter columns on phones, comfortable rows always.
- **Toolbar on phones**: prefer `space-between` (cancel left, save right) so primary action stays in the thumb zone. Switch to `flex-end` on `md+`.
- **Validation messages** appear under the field — make sure `helperText` length doesn't break tight 2-col `sm` layouts.
- **Tap targets ≥ 44px**: don't set `size: small` on primary buttons / interactive fields on `xs`.

### What NOT to do in form layouts

- ❌ `cols: N` on `form` (or anywhere) — non-responsive, ignored on mobile.
- ❌ `row` component for new layouts — use `layout`.
- ❌ `className: "row"` / `className: "col-md-6"` / any Bootstrap-style class — these don't affect MUI Grid sizing. Use `size` + `columns` instead.
- ❌ Custom CSS classes on `layout` / `row` / `col` for sizing or spacing — those props belong on `size`, `spacing`, `rowSpacing`, `columnSpacing`, `sx`, or `containerSx`.
- ❌ Mixing `spacing` with explicit `rowSpacing` AND `columnSpacing` (the explicit ones override).

---

## form

Data entry form with validation, queries, and submission. Wraps React Hook Form's FormProvider.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | `ILocalizeString` | Form title |
| `initialValues` | `object \| query config` | Initial data — static object, template, or query config |
| `initialValues.fromQuery` | `{name, path}` | Load initial values from a named query |
| `initialValues.append` | `Record<string, any>` | Merge additional defaults after query load |
| `validationSchema` | `Record<string, {type, required?, ...}>` | Yup-based validation rules |
| `queries` | `QueryDef[]` | GraphQL queries for data loading |
| `prefix` | `string` | Field name namespace prefix |
| `refreshHandler` | `string` | Remount on refresh event |
| `dirtyGuard` | `DirtyGuardProps` | Unsaved changes protection |
| `dirtyGuard.enabled` | `boolean` | Enable guard |
| `dirtyGuard.title` | `ILocalizeString` | Dialog title |
| `dirtyGuard.message` | `ILocalizeString` | Dialog message |
| `dirtyGuard.confirmLabel` | `ILocalizeString` | Confirm button text |
| `dirtyGuard.cancelLabel` | `ILocalizeString` | Cancel button text |
| `autoSave` | `boolean` | Auto-save on field change |
| `resetOnSubmit` | `boolean` | Reset form after submit |
| `preventDefault` | `boolean` | Prevent default form submit |
| `toolbar` | `component[]` | Toolbar components |
| ~~`cols: N`~~ | _legacy_ | **Do not use.** Non-responsive. Wrap children in a `layout` with `itemDefaults.size: { xs: 12, md: 6 }` instead. See "Mobile-Friendly Form Layout" above. |
| `orientation` | `string` | Layout orientation |

**Events:**
| Event | Description |
|-------|-------------|
| `onSubmit` | Action chain on form submission |
| `onChange` | Action chain on any field change |
| `onLoad` | Action chain when form data loads |
| `onReset` | Action chain on form reset |
| `onValidate` | Action chain on validation |
| `onError` | Action chain on error |

**Children:** Yes — typically `field` components. Provides `formName` and `createMode` in variables.

```yaml
component: form
name: orderForm
props:
  title: { en-US: "Order Details" }
  toolbar:
    - component: button
      name: saveBtn
      props:
        label: { en-US: "Save" }
        icon: check
        options: { type: submit, variant: primary }
  queries:
    - name: getOrder
      query:
        command: |
          query GetOrder($id: Int!) {
            order(id: $id) { id orderNumber status }
          }
        variables:
          id: "{{ number id }}"
  initialValues:
    fromQuery:
      name: getOrder
      path: order
    append:
      status: "Draft"
  validationSchema:
    orderNumber:
      type: string
      required: true
    status:
      type: string
      required: true
  dirtyGuard:
    enabled: true
    title: { en-US: "Unsaved Changes" }
    message: { en-US: "You have unsaved changes. Leave?" }
    confirmLabel: { en-US: "Leave" }
    cancelLabel: { en-US: "Stay" }
  onSubmit:
    - mutation:
        command: |
          mutation SaveOrder($input: OrderInput!) {
            saveOrder(input: $input) { id }
          }
        variables:
          input: "{{ form }}"
        onSuccess:
          - notification: { message: { en-US: "Saved!" }, type: success }
          - navigateBack: { fallback: "/orders" }
children:
  - component: layout
    name: orderFormFields
    props:
      columnSpacing: { xs: 1, md: 2 }   # tighter on mobile, breathing room on desktop
      rowSpacing: { xs: 2, md: 3 }
      itemDefaults:
        size: { xs: 12, md: 6 }         # 1 col on phone, 2 col on tablet+
    children:
      - component: field
        name: orderNumber
        props: { type: text, label: { en-US: "Order Number" }, required: true }
      - component: field
        name: status
        props:
          type: select
          label: { en-US: "Status" }
          items:
            - { label: "Draft", value: "Draft" }
            - { label: "Active", value: "Active" }
```

---

## field

Polymorphic form field — renders different input types based on `type` prop.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `type` | `string` | **Required.** Field type (see table below) |
| `label` | `ILocalizeString` | Localized label |
| `placeholder` | `string` | Placeholder text (template-parsed) |
| `disabled` | `string \| boolean` | Disable state (template expression) |
| `readonly` | `boolean` | Read-only mode |
| `required` | `boolean` | Required field |
| `prefix` | `string` | Field name prefix for nested paths |
| `transformValue` | `{onEdit?, onLoad?}` | Template expressions to transform values |
| `multiple` | `boolean` | Multi-value mode (for `text`) |
| `autoComplete` | `string` | HTML autocomplete attribute |
| `rows` | `number` | Rows for textarea (default 2) |
| `defaultCountry` | `string` | Default country for phone type |
| `isClearable` | `boolean` | Allow clearing the value |
| `InputProps` | `object` | Passed to underlying MUI TextField |
| `size` | `number \| {xs,sm,md,lg,xl}` | When the field is a child of a `layout`, controls the Grid item width per breakpoint. Use `{ xs: 12, md: 6 }` for 1-col mobile / 2-col tablet+. Omit to inherit `itemDefaults.size` from parent layout. |
| `offset` | `number \| {xs,sm,md,lg,xl}` | Leading offset (push field right) when inside a `layout` |
| `order` | `number \| {xs,sm,md,lg,xl}` | Visual order per breakpoint when inside a `layout` |

**Field Types:**
| Type | Description |
|------|-------------|
| `text` | Standard text input. `multiple: true` → multi-value tags |
| `number` | Numeric input |
| `number-select` | Numeric input with up/down controls and long-press repeat; supports `min`, `max`, `step`, and `options.decimalScale` / `fixedDecimalScale` / `allowNegative` |
| `email` | Email input |
| `password` | Password input |
| `tel` / `phone` | Phone number with country selector |
| `textarea` | Multi-line text with `rows` prop |
| `checkbox` | Boolean checkbox |
| `radio` | Radio button (use `value` prop) |
| `toggle` | Segmented toggle button group. `allowMultiple: true` gives array values; MUI props (size, color, orientation) live under `options`. Supports icons, disabled items, `enforceValue`, and `defaultValue`. |
| `date` | Date picker |
| `datetime` | Date + time picker |
| `rangedatetime` | Date range picker |
| `enhanced-rangedatetime` | Enhanced date range picker |

**Enhanced rangedatetime filter behavior:** `more_than` emits bracketed Lucene ranges such as `field:[* TO NOW-7DAYS]`; boolean/number falsy values (`false`, `0`) are preserved as real filter values; and switching away from Empty/Not Empty clears the previous `NULL` term instead of latching it.
| `time` | Time picker |
| `select` | Dropdown select from `items[]` |
| `select-async` | Async search select (GraphQL-backed) |
| `autocomplete` | Autocomplete from `items[]` |
| `autocomplete-async` | Async autocomplete (GraphQL-backed) |
| `autocomplete-googleplaces` | Google Places autocomplete |
| `file` | File upload (converts to byte array) |
| `attachment` | File attachment |
| `hidden` | Hidden input |
| `quill` | Rich text editor (Quill) |
| `object` | JSON object editor |
| `yaml` | YAML editor |
| `secret` | Encrypted secret input — stores `${secret:qualifiedName}` reference. Requires `secretPath` prop for naming and sends `setSecret(input: { organizationId, secretName, secretValue })` / `deleteSecret(input: { organizationId, secretName })` using the current organization. |

**Select/Async options (under `options`):**
| Prop | Type | Description |
|------|------|-------------|
| `items` | `{label, value}[]` | Static select items |
| `allowMultiple` | `boolean` | Multi-select mode |
| `allowClear` | `boolean` | Show clear button |
| `allowSearch` | `boolean` | Searchable dropdown |
| `valueFieldName` | `string` | Result field holding the value |
| `itemLabelTemplate` | `string` | Handlebars template for labels |
| `itemValueTemplate` | `string` | Handlebars template for values |
| `navigateActionPermission` | `string` | Permission for edit icon |
| `searchQuery` | `{name, path, params}` | Paginated search query ref |
| `valueQuery` | `{name, path, params}` | Single-value lookup query ref |
| `variant` | `string` | Select variant |

**Google Places autocomplete:** `autocomplete-googleplaces` uses the organization-level Google Maps API key from `apps.google.googleMapsApiKey`. Do not put API keys in module YAML. Configure `searchQuery.params` and `valueQuery.params` only:

```yaml
- component: field
  name: pickupAddress
  props:
    type: autocomplete-googleplaces
    label: { en-US: "Pickup address" }
    options:
      itemLabelTemplate: "{{ description }}"
      searchQuery:
        params:
          input: "{{ search }}"
          types: ["address"]
          language: "en-US"
      valueQuery:
        params:
          fields: ["name", "address_components", "formatted_address", "geometry", "place_id"]
```

**Events:**
| Event | Description |
|-------|-------------|
| `onClick` | Fires on click |
| `onChange` | Fires on value change (data: `changedValues`, `checked`) |
| `onBlur` | Fires on blur |
| `onFocus` | Fires on focus |
| `onKeyPress` | Fires on keypress (data: `key`, `keyCode`) |
| `onSelectValue` | Fires on select-async value selection |
| `onEditClick` | Fires when edit icon clicked. Supported on `text`, `select-async`, and `autocomplete-async` fields when a single value is set. Passes current form values (with optional `valueFieldName`) to the action context |

```yaml
# Text field
- component: field
  name: companyName
  props:
    type: text
    label: { en-US: "Company Name" }
    required: true
    placeholder: "Enter company name"


# Number select with arrow controls
- component: field
  name: pieces
  props:
    type: number-select
    label: { en-US: "Pieces" }
    min: 0
    max: 999
    step: 1
    options:
      decimalScale: 0

# Select field
- component: field
  name: status
  props:
    type: select
    label: { en-US: "Status" }
    items:
      - { label: "Active", value: "active" }
      - { label: "Inactive", value: "inactive" }

# Toggle field
- component: field
  name: priority
  props:
    type: toggle
    label: { en-US: "Priority" }
    allowMultiple: false
    enforceValue: true
    defaultValue: normal
    options:
      size: small
      color: primary
      orientation: horizontal
    items:
      - { label: "Normal", value: normal }
      - { label: "High", value: high }

# Async select with search
- component: field
  name: customerId
  props:
    type: select-async
    label: { en-US: "Customer" }
    options:
      valueFieldName: contactId
      itemLabelTemplate: "{{contactName}}"
      itemValueTemplate: "{{contactId}}"
      allowSearch: true
      allowClear: true
      searchQuery:
        name: getContacts
        path: contacts.items
        params:
          search: "{{ string search }}"
          take: "{{ number pageSize }}"
          skip: "{{ number skip }}"
      valueQuery:
        name: getContact
        path: contact
        params:
          contactId: "{{ contactId }}"
    queries:
      - name: getContacts
        query:
          command: >-
            query($search: String!, $take: Int!, $skip: Int!) {
              contacts(search: $search, take: $take, skip: $skip) {
                items { contactId contactName } totalCount
              }
            }
      - name: getContact
        query:
          command: >-
            query($contactId: Int!) {
              contact(contactId: $contactId) { contactId contactName }
            }
          variables:
            contactId: "{{ number contactId }}"

# Date field with transform
- component: field
  name: effectiveDate
  props:
    type: date
    label: { en-US: "Effective Date" }
    transformValue:
      onLoad: "{{ format effectiveDate YYYY-MM-DD }}"

# Conditional visibility
- component: field
  name: notes
  props:
    type: textarea
    label: { en-US: "Notes" }
    rows: 4
    disabled: "{{ eval !canEdit }}"
```

---

## field-collection

Dynamic array/list editor for repeating field groups. Supports add/remove/reorder with drag-and-drop and optional up/down move buttons. Reorder UI adds stable internal `_uuid` keys to object rows only when drag handles or move buttons are shown, so non-reorder payloads stay untouched.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fieldName` | `string` | — | **Required.** Form array field binding |
| `itemTemplate` | `ComponentProps` | — | Template for each item |
| `itemType` | `object \| string \| number \| boolean` | `object` | Item type |
| `options.allowAdd` | `boolean` | `true` | Show add button |
| `options.allowRemove` | `boolean` | `true` | Show remove buttons |
| `options.allowRemoveAll` | `boolean` | `false` | Show remove all button |
| `options.allowReorder` | `boolean` | `true` | Enable drag-and-drop |
| `options.minItems` | `number` | `0` | Minimum items (auto-created) |
| `options.maxItems` | `number` | `∞` | Maximum items |
| `addButton.label` | `ILocalizeString` | `Add Item` | Add button label |
| `addButton.icon` | `string` | `plus` | Add button icon |
| `addButton.position` | `top \| bottom \| both` | `bottom` | Add button placement |
| `defaultItem` | `any` | — | Template for new items |
| `layout` | `list \| grid \| accordion` | `list` | Layout mode |
| `cols` | `number` | `1` | Grid columns (non-responsive). For adaptive item layouts, set `cols: 1` and use a `layout` inside `itemTemplate` with `itemDefaults.size: { xs, md }`. |
| `groupCols` | `number \| {xs,sm,md,lg,xl}` | `1` | Group columns when `groupMode` is true |
| `groupSpacing` | `number` | `0` | Spacing between group columns |
| `groupMode` | `boolean` | `false` | Enable grouping |
| `groupBy` | `string` | — | Field path to group by |
| `groups` | `{key, label, icon?}[]` | — | Group definitions |
| `showIndex` | `boolean` | `false` | Show item index |
| `showDragHandle` | `boolean` | `false` | Show drag handles |
| `showMoveButtons` | `boolean` | `false` | Show up/down move buttons for accessible reordering; requires `options.allowReorder` |

**Children:** Uses `itemTemplate` (not `children`). Each item gets `item`, `index`, `collection` variables.

```yaml
component: field-collection
name: lineItems
props:
  fieldName: lineItems
  options:
    allowAdd: true
    allowRemove: true
    allowReorder: true
    minItems: 1
    maxItems: 50
  addButton:
    label: { en-US: "Add Line Item" }
    icon: plus
    position: bottom
  defaultItem:
    description: ""
    quantity: 1
    unitPrice: 0
  layout: list
  itemTemplate:
    component: layout
    name: lineItemRow
    props:
      columnSpacing: { xs: 1, md: 2 }
      rowSpacing: 2
    children:
      - component: field
        name: description
        props:
          type: text
          label: { en-US: "Description" }
          size: { xs: 12, md: 6 }
      - component: field
        name: quantity
        props:
          type: number
          label: { en-US: "Qty" }
          size: { xs: 6, md: 3 }
      - component: field
        name: unitPrice
        props:
          type: number
          label: { en-US: "Unit Price" }
          size: { xs: 6, md: 3 }
```

Grouped collections can render groups in multiple columns. Use a fixed `groupCols` count or responsive breakpoint counts; each count is converted to Material UI's 12-column grid.

```yaml
component: field-collection
name: businessHours
props:
  fieldName: businessHours
  groupMode: true
  groupBy: dayOfWeek
  groupCols: { xs: 1, md: 2, lg: 4 }
  groupSpacing: 2
  groups:
    - { key: 1, label: { en-US: Monday } }
    - { key: 2, label: { en-US: Tuesday } }
  layout: accordion
  itemTemplate:
    component: layout
    props: { cols: 2 }
    children:
      - component: field
        name: startTime
        props: { type: time, label: { en-US: Start } }
      - component: field
        name: endTime
        props: { type: time, label: { en-US: End } }
```

---

## barcodeScanner

Headless barcode/keyboard scanner listener. Captures rapid keystrokes and fires on scan.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `minBarcodeLength` | `number` | `4` | Min chars to qualify as scan |
| `onScan` | `action[]` | — | **Required.** Action on scan detection |

**Renders:** Nothing (empty fragment). Listens on `document` keypress.

**Scan data:** `result: { data: string, format: 'input' }`

```yaml
component: barcodeScanner
name: scanner
props:
  minBarcodeLength: 6
  onScan:
    - setFields:
        barcode: "{{ result.data }}"
    - notification:
        message: { en-US: "Scanned: {{ result.data }}" }
        type: info
```
