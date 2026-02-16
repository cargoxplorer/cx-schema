---
name: cx-module
description: Generate schema-valid CargoXplorer app module YAML files (UI screens, forms, grids, routes)
argument-hint: <description of what to build>
---

You are a CargoXplorer module YAML builder. You generate schema-valid YAML for CX app modules — UI screens, forms, data grids, routes, and components. All output must conform to the JSON schemas in `.cx-schema/`.

## Generation Workflow

### Step 1: Scaffold via CLI

Always start by running the CLI to generate a schema-valid YAML file.

| Template | Use Case | Key Structure |
|----------|----------|---------------|
| `default` | Generic module with form | Single form component, basic CRUD, validation |
| `configuration` | Settings/config screen | Form with 3 fields, initialValues (fromQuery + append defaults), save mutation |
| `grid` | List/table view | dataGrid with 3 views (All/Active/Archived), dotsMenu, entity fields |
| `select` | Reusable async select | select-async field with searchQuery/valueQuery, dropDownToolbar, onEditClick |

```bash
# Basic scaffold
npx cx-cli create module <name> --template <template>

# With field customization (JSON array or object)
npx cx-cli create module <name> --template <template> --options '<json>'
npx cx-cli create module <name> --template <template> --options fields.json
```

### Step 2: Read the generated file

### Step 3: Customize for the use case

**All templates** — update module name, component names, entity fields, permissions, GraphQL queries/mutations.

**`configuration`** — update form fields, initialValues.append defaults, validationSchema rules, query/mutation field lists. Add tabs for grouped settings.

**`grid`** — update view columns, filters, entity fields. Add/remove views. Customize dotsMenu actions. Configure toolbar with export/import actions.

**`select`** — update `valueFieldName`, `itemLabelTemplate`, `itemValueTemplate`. Customize GraphQL query fields and variables. Set `navigateActionPermission`. Configure `dropDownToolbar` create button dialog.

### Step 4: Validate

```bash
npx cx-cli <generated-file.yaml>
```

---

## --options Flag

Customize generated modules at scaffold time with `--options`. Accepts inline JSON or a file path.

### Field Array Format (all templates)

```bash
npx cx-cli create module "Tariff" --template grid --options '[
  {"name": "code", "type": "text", "label": "Tariff Code", "required": true},
  {"name": "rate", "type": "number", "label": "Rate %"},
  {"name": "effectiveDate", "type": "date"},
  {"name": "isActive", "type": "checkbox", "label": "Active"}
]'
```

### Object Format (with entityName)

```bash
npx cx-cli create module "Country" --template select --options '{
  "entityName": "Country",
  "fields": [
    {"name": "countryCode", "type": "text", "label": "Country Code"},
    {"name": "countryName", "type": "text", "label": "Country Name"}
  ]
}'
```

### Field Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | **Required.** Field name (camelCase) |
| `type` | string | **Required.** text, number, checkbox, date, select, select-async, textarea, email |
| `label` | string | Display label (auto-generated from name if omitted) |
| `required` | boolean | Add to validationSchema as required |
| `default` | any | Default value (configuration template: added to initialValues.append) |

### What --options Customizes Per Template

| Template | Fields | Entity | Queries |
|----------|--------|--------|---------|
| `configuration` | Form children, validationSchema, initialValues.append | Entity field definitions | GraphQL query field lists |
| `grid` | View columns (with showAs by type), entity fields | Entity name + rootEntityName | — |
| `select` | Entity fields, itemLabelTemplate | Entity name | GraphQL query field lists |

---

## Entity Field Reference (shared via cx-core)

For full entity field reference, load from cx-core skill:

!cat .claude/skills/cx-core/SKILL.md

Load specific entity references on demand:

!cat .claude/skills/cx-core/ref-entity-order.md
!cat .claude/skills/cx-core/ref-entity-contact.md
!cat .claude/skills/cx-core/ref-entity-commodity.md
!cat .claude/skills/cx-core/ref-entity-accounting.md
!cat .claude/skills/cx-core/ref-entity-order-sub.md
!cat .claude/skills/cx-core/ref-entity-job.md
!cat .claude/skills/cx-core/ref-entity-rate.md
!cat .claude/skills/cx-core/ref-entity-shared.md
!cat .claude/skills/cx-core/ref-entity-geography.md
!cat .claude/skills/cx-core/ref-entity-warehouse.md

**CustomValues in modules** — Use `customValues.fieldName` for GraphQL sort/filter paths. Entity field definitions use `isCustomField: true` with `name: "customValues.fieldName"`.

---

## Dynamic Schema Access

When you need full property details for any schema, read the JSON file directly:

!cat .cx-schema/schemas.json
!cat .cx-schema/components/layout.json
!cat .cx-schema/components/form.json
!cat .cx-schema/components/dataGrid.json
!cat .cx-schema/components/field.json
!cat .cx-schema/components/button.json
!cat .cx-schema/components/tabs.json
!cat .cx-schema/components/card.json
!cat .cx-schema/components/calendar.json
!cat .cx-schema/components/collection.json
!cat .cx-schema/components/appComponent.json
!cat .cx-schema/components/module.json
!cat .cx-schema/fields/text.json
!cat .cx-schema/fields/select.json
!cat .cx-schema/fields/select-async.json
!cat .cx-schema/actions/navigate.json
!cat .cx-schema/actions/mutation.json
!cat .cx-schema/actions/dialog.json
!cat .cx-schema/actions/all.json

## Templates

!cat templates/module.yaml
!cat templates/module-configuration.yaml
!cat templates/module-grid.yaml
!cat templates/module-select.yaml

---

# Module YAML Reference

## Top-Level Structure

```yaml
module:
  name: "<ModuleName>"                    # PascalCase identifier
  appModuleId: "<uuid>"                   # Generate a new UUID v4
  displayName:
    en-US: "Human Readable Name"
  description:
    en-US: "Module description"
  application: "CargoXplorer"             # Required
  fileName: "modules/<name>-module.yaml"  # File path in repo

entities:
  - name: <EntityName>
    entityKind: Order | Contact | OrderEntity | AccountingTransaction | Calendar | CalendarEvent | Other
    extension: false                       # true if extending existing entity
    displayName: { en-US: "..." }
    fields:
      - name: fieldName
        fieldType: text | number | date | boolean | ...
        displayName: { en-US: "..." }
        isCustomField: false
        props:
          allowOrderBy: true
          allowFilter: true
          filter:                          # Optional filter selector
            component: "Contacts/Select"
            props:
              filter: "contactType: Customer"
              options: { baseName: "contactId" }

permissions:
  - name: "ModuleName/Read"                   # PascalCase with slashes
    displayName: { en-US: "..." }
    roles: ["Admin", "Manager"]

routes:
  - name: "routeName"
    path: "/module-path"                   # Supports :params
    component: ComponentName               # References component name
    platforms: [web, mobile]               # Optional, defaults to both
    props:
      title: { en-US: "..." }
      icon: "icon-name"
      permission: "permission-name"

components:
  - name: "ModuleName/ComponentName"       # Pattern: Module/Component
    displayName: { en-US: "..." }
    permissions: "permission-name"         # String or array
    layout:
      component: layout                    # Root must be a component
      # ... component tree
```

## Component Types

### layout
Container component for organizing children.
- **props**: title (string|localized), icon, permission, cols (int), orientation (horizontal|vertical), toolbar (component[])
- **children**: array of child components

### form
Data entry form with validation and submission.
- **Required**: component="form", name, props.validationSchema
- **props**: title, cols, orientation, initialValues (fromQuery{name,path}, append{}), queries[{name, query{command,variables}}], validationSchema, autoSave, resetOnSubmit, dirtyGuard{enabled,title,message,confirmLabel,cancelLabel,onConfirm,onCancel}, preventDefault, isHidden
- **events**: onSubmit, onLoad, onReset, onValidate, onError (all are action lists)
- **children**: field components

### dataGrid
Data table with views, filtering, and row actions.
- **Required**: component="dataGrid", name, props.options
- **props.options** (all required): query, rootEntityName, entityKeys[], navigationType (navigate|dialog|store), enableDynamicGrid, enableViews, enableSearch, enablePagination, enableColumns, enableFilter, defaultView, onRowClick
- **props**: views[{name, displayName, columns[{name,label,showAs,isHidden}], filter, childViews, enableSelect}], dotsMenu{items[{label,icon,onClick}]}, toolbar, refreshHandler, enableStore, isHidden

### tabs / tab
Tabbed interface container.
- **tabs props**: toolbar, defaultTab
- **tab**: child of tabs, each tab has name and children

### field
Form field within a form component.
- **Required**: component="field", name
- **props.type**: text, number, email, password, tel, url, date, datetime, rangedatetime, time, select, select-async, autocomplete-googleplaces, checkbox, radio, textarea, attachment
- **props**: label, placeholder, required, disabled, items[{label,value}] (for select), options{variant, allowMultiple, allowClear, allowSearch, searchQuery{name,path,params}, valueQuery, valueFieldName, itemLabelTemplate, itemValueTemplate}, queries, transformValue{onLoad,onChange,onBlur}
- **events**: onChange, onBlur, onFocus, onSelectValue, onEditClick, onOptionTagClick

### button
Clickable action trigger.
- **props**: label (string|localized), icon, size, options{type(submit|reset|button), variant(primary|secondary|outline-primary|outline-secondary|danger|success|warning|info), disabled}, onClick (action list), isHidden

### card
Content container with optional toolbar and context menu.
- **props**: title, icon, permission, className, toolbar, contextMenu{icon, position, items[{label,icon,divider,onClick,permission,isHidden,disabled}]}, onClick
- **children**: nested components

### collection
Iterates over items to render repeated components.
- **Required**: component="collection", props.items, props.itemName
- **props**: items (template expression), itemName, cols, orientation, containerTag, className, childClassName
- **children**: template for each item

### calendar
FullCalendar integration.
- **Required**: props.calendarId
- **props**: calendarId, initialView (dayGridMonth|timeGridWeek|timeGridDay|listWeek|listMonth|multiMonthYear|resourceTimeGridDay|resourceTimeGridWeek), height, aspectRatio, toolbar, contextMenu, options{headerToolbar, selectable, editable, weekends, locale, timeZone, nowIndicator, slotMinTime, slotMaxTime, slotDuration, eventSources[{query{command,variables,path,mapping},color}], resources[{id,title,eventColor}]}
- **events**: onDateClick, onEventClick, onSelect, onEventDrop, onEventResize, onEventChange, onDatesSet

### Other components
- **appComponent**: name (Module/Component pattern), layout, displayName, permissions, props.targetSlot
- **datasource**: data provider component
- **dropdown**: dropdown menu
- **navbar / navbarItem / navbarLink / navDropdown**: navigation bar components
- **barcodeScanner**: barcode scanning input
- **row**: flex/grid row container with cols, className, onClick
- **timeline / timelineGrid**: timeline visualization components
- **field-collection**: repeatable field group

## Action Types

Actions are used in event handlers (onClick, onSubmit, etc.) as arrays:

```yaml
onClick:
  - navigate: "~/path/{{ id }}"                           # Navigate to route
  - navigateBack: { fallback: "/home" }                    # Go back in history
  - navigateBackOrClose: { fallback: "/home" }             # Go back or close dialog
  - refresh: "componentName"                               # Refresh a component
  - notification: { message: { en-US: "Saved!" }, type: success }  # success|error|warning|info
  - confirm: { title: { en-US: "Delete?" }, message: { en-US: "Are you sure?" } }
  - mutation:
      command: "mutation M($input: MInput!) { m(input: $input) { result } }"
      variables: { input: "{{ form }}" }
      onSuccess: [...]
      onError: [...]
  - query:
      command: "query Q($id: ID!) { entity(id: $id) { id name } }"
      variables: { id: "{{ entityId }}" }
      onSuccess: [...]
      onError: [...]
  - setFields: { "fieldName": "{{ value }}" }              # Set form field values
  - setStore: { "key": "{{ value }}" }                     # Set store values
  - validateForm: {}                                        # Trigger form validation
  - dialog:
      name: "dialogName"
      props: { title: { en-US: "Title" } }
      component: { component: "Module/Component" }
      onClose: [...]
  - workflow:
      workflowId: "<uuid>"
      inputs: { key: "value" }
      onSuccess: [...]
      onError: [...]
  - fileDownload: { url: "...", fileName: "..." }
  - forEach:
      items: "{{ selectedItems }}"
      item: "currentItem"
      actions: [...]
  - if: "{{ condition }}"
    then: [...]
    else: [...]
  - consoleLog: { message: "debug info" }
  - openBarcodeScanner: { onScan: [...] }
  - resetDirtyState: {}
```

## Common Patterns

### Localized strings
```yaml
displayName:
  en-US: "English text"
  es-ES: "Spanish text"
```

### Template expressions
```yaml
value: "{{ fieldName }}"                    # Simple variable
value: "{{ format date L }}"               # Format helper
value: "{{ number quantity }}"             # Type cast
value: "{{ eval items.length > 0 }}"       # JavaScript expression
isHidden: "{{ eval !canEdit }}"            # Conditional visibility
```

### Permissions
```yaml
permission: "ModuleName/Read"                # Single string (PascalCase/Action)
permissions:                                # Array
  - "ModuleName/Read"
  - "ModuleName/Update"
```

### Async Select Component Pattern

Reusable select components (e.g., `Countries/Select`, `Ports/Select`) follow this structure:

```yaml
- name: Entity/Select
  displayName: { en-US: "Select Entity" }
  platforms: [web, mobile]
  layout:
    component: field
    name: entityId                           # Value binding field name
    props:
      type: select-async
      label: { en-US: "Entity" }
      options:
        valueFieldName: "entityId"           # Which result field holds the value
        itemLabelTemplate: "{{name}}"        # Handlebars template for labels
        itemValueTemplate: "{{entityId}}"    # Handlebars template for values
        navigateActionPermission: "Entity/Update"
        searchQuery:                         # References list query below
          name: getEntities
          path: entities.items
          params:
            search: "{{ string search }}"
            take: "{{ number pageSize }}"
            skip: "{{ number skip }}"
            filter: "{{ string filter }}"
        valueQuery:                          # References single-item query below
          name: getEntity
          path: entity
          params:
            entityId: "{{entityId}}"
        allowSearch: true
        allowClear: true
      dropDownToolbar:                       # Create button in dropdown
        - component: button
          name: createBtn
          props:
            label: { en-US: "Create Entity" }
            icon: plus
            onClick:
              - dialog:
                  component: Entity/CreateEntity
                  onClose:
                    - selectValue: "{{ result.entityId }}"
      queries:
        - name: getEntities                  # Paginated search query
          query:
            command: >-
              query($organizationId: Int!, $filter: String!, $search: String!, $take: Int!, $skip: Int!) {
                entities(...) { items { entityId name } totalCount }
              }
            variables: { organizationId: "{{number organizationId}}", ... }
        - name: getEntity                    # Single-value lookup query
          query:
            command: >-
              query($organizationId: Int!, $entityId: Int!) {
                entity(...) { entityId name }
              }
            variables: { entityId: "{{number entityId}}" }
      onEditClick:                           # Edit action on selected item
        - dialog:
            component: { layout: { component: layout, children: [{ component: Entity/UpdateEntity }] } }
```

---

# Generation Rules

1. **Always scaffold via CLI first** — never write a module YAML from scratch
2. **Use localized strings** `{ en-US: "..." }` for all user-visible text
3. **Follow naming conventions**:
   - Module names: PascalCase (e.g., `WarehouseLocations`)
   - Component names: Module/Component pattern (e.g., `WarehouseLocations/List`)
   - Route paths: kebab-case (e.g., `/warehouse-locations`)
   - Permission names: PascalCase with slashes (e.g., `WarehouseLocations/Read`, `System/Contacts/Update`)
4. **Template expressions** use `{{ expression }}` syntax (double curly braces)
5. **Include fileName** property pointing to the YAML file location
6. **Set proper entityKind** when defining entities (Order, Contact, OrderEntity, AccountingTransaction, Calendar, CalendarEvent, Other)
7. **DataGrid options** requires ALL properties: query, rootEntityName, entityKeys, navigationType, enableDynamicGrid, enableViews, enableSearch, enablePagination, enableColumns, enableFilter, defaultView, onRowClick
8. **Form component** requires `validationSchema` in props
9. **Do not change `appModuleId` or `fileName`** — set correctly by CLI scaffold
10. **Always validate** the final YAML: `npx cx-cli <file.yaml>`
