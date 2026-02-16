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
| `form` | Entity create/edit form | Form with query, initialValues, validationSchema, save mutation, toolbar (Save/Cancel), dirtyGuard |
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

**`form`** — update form fields, validationSchema, query/mutation field lists. Add tabs for grouped fields. Customize toolbar buttons. Update dirtyGuard messages.

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
| `default` | any | Default value (form/configuration template: added to initialValues.append) |

### What --options Customizes Per Template

| Template | Fields | Entity | Queries |
|----------|--------|--------|---------|
| `form` | Form children, validationSchema, initialValues.append | Entity field definitions | GraphQL query field lists (preserves `id`) |
| `configuration` | Form children, validationSchema, initialValues.append | Entity field definitions | GraphQL query field lists |
| `grid` | View columns (with showAs by type), entity fields | Entity name + rootEntityName | — |
| `select` | Entity fields, itemLabelTemplate | Entity name | GraphQL query field lists |

---

## On-Demand References

**Read these files only when needed for the current task.** Do not load all references upfront.

### Entity Fields (cx-core)

Read `.claude/skills/cx-core/SKILL.md` for entity overview. Then read specific entity refs:

| Entity | File |
|--------|------|
| Order | `.claude/skills/cx-core/ref-entity-order.md` |
| Contact | `.claude/skills/cx-core/ref-entity-contact.md` |
| Commodity | `.claude/skills/cx-core/ref-entity-commodity.md` |
| Accounting | `.claude/skills/cx-core/ref-entity-accounting.md` |
| Order Sub-entities | `.claude/skills/cx-core/ref-entity-order-sub.md` |
| Job | `.claude/skills/cx-core/ref-entity-job.md` |
| Rate | `.claude/skills/cx-core/ref-entity-rate.md` |
| Shared | `.claude/skills/cx-core/ref-entity-shared.md` |
| Geography | `.claude/skills/cx-core/ref-entity-geography.md` |
| Warehouse | `.claude/skills/cx-core/ref-entity-warehouse.md` |

**CustomValues in modules** — Use `customValues.fieldName` for GraphQL sort/filter paths. Entity field definitions use `isCustomField: true` with `name: "customValues.fieldName"`.

### Component Directory

Read the relevant category ref file when building specific component types:

| Category | Components | File |
|----------|-----------|------|
| **Layout & Structure** | `layout`, `row`, `col`, `header`, `tabs`, `toolbar`, `card`, `line` | `.claude/skills/cx-module/ref-components-layout.md` |
| **Forms & Input** | `form`, `field`, `field-collection`, `barcodeScanner` | `.claude/skills/cx-module/ref-components-forms.md` |
| **Data Display** | `dataGrid`, `text`, `markup`, `badge`, `icon`, `image`, `photo`, `summary`, `diff`, `viewer`, `embed` | `.claude/skills/cx-module/ref-components-display.md` |
| **Interactive & Nav** | `button`, `dropdown`, `menuButton`, `link`, `redirect`, `navbar`, `navbarItem`, `navbarLink`, `navDropdown` | `.claude/skills/cx-module/ref-components-interactive.md` |
| **Data & Collections** | `collection`, `list`, `listItem`, `datasource`, `script` | `.claude/skills/cx-module/ref-components-data.md` |
| **Specialized** | `calendar`, `notes`, `dashboard`, `dashboard-widget`, `widget`, `timeline`, `timeline-grid`, `oauth2` | `.claude/skills/cx-module/ref-components-specialized.md` |

### Templates

Read the relevant template after scaffolding to understand the generated structure:

| Template | File |
|----------|------|
| default | `templates/module.yaml` |
| form | `templates/module-form.yaml` |
| configuration | `templates/module-configuration.yaml` |
| grid | `templates/module-grid.yaml` |
| select | `templates/module-select.yaml` |

### JSON Schemas

Read schema files from `.cx-schema/` only when debugging validation errors:
- `schemas.json` — main schema definitions
- `components/<type>.json` — component schemas (layout, form, dataGrid, field, button, tabs, card, calendar, collection, appComponent, module)
- `fields/<type>.json` — field schemas (text, select, select-async)
- `actions/<type>.json` — action schemas (navigate, mutation, dialog, all)

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
