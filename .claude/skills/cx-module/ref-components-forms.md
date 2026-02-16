# Form & Input Components

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
| `cols` | `number` | Column layout for children |
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

**Field Types:**
| Type | Description |
|------|-------------|
| `text` | Standard text input. `multiple: true` → multi-value tags |
| `number` | Numeric input |
| `email` | Email input |
| `password` | Password input |
| `tel` / `phone` | Phone number with country selector |
| `textarea` | Multi-line text with `rows` prop |
| `checkbox` | Boolean checkbox |
| `radio` | Radio button (use `value` prop) |
| `date` | Date picker |
| `datetime` | Date + time picker |
| `rangedatetime` | Date range picker |
| `enhanced-rangedatetime` | Enhanced date range picker |
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

**Events:**
| Event | Description |
|-------|-------------|
| `onClick` | Fires on click |
| `onChange` | Fires on value change (data: `changedValues`, `checked`) |
| `onBlur` | Fires on blur |
| `onFocus` | Fires on focus |
| `onKeyPress` | Fires on keypress (data: `key`, `keyCode`) |
| `onSelectValue` | Fires on select-async value selection |
| `onEditClick` | Fires when edit icon clicked (select-async, permission-gated) |

```yaml
# Text field
- component: field
  name: companyName
  props:
    type: text
    label: { en-US: "Company Name" }
    required: true
    placeholder: "Enter company name"

# Select field
- component: field
  name: status
  props:
    type: select
    label: { en-US: "Status" }
    items:
      - { label: "Active", value: "active" }
      - { label: "Inactive", value: "inactive" }

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

Dynamic array/list editor for repeating field groups. Supports add/remove/reorder with drag-and-drop.

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
| `cols` | `number` | `1` | Grid columns |
| `groupMode` | `boolean` | `false` | Enable grouping |
| `groupBy` | `string` | — | Field path to group by |
| `groups` | `{key, label, icon?}[]` | — | Group definitions |
| `showIndex` | `boolean` | `false` | Show item index |
| `showDragHandle` | `boolean` | `false` | Show drag handles |

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
    component: row
    name: lineItemRow
    props: { spacing: 2 }
    children:
      - component: field
        name: description
        props: { type: text, label: { en-US: "Description" } }
      - component: field
        name: quantity
        props: { type: number, label: { en-US: "Qty" } }
      - component: field
        name: unitPrice
        props: { type: number, label: { en-US: "Unit Price" } }
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
