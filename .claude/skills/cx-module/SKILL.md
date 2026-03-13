---
name: cx-module
description: >
  Works with CXTMS app module YAML files — creates, modifies, fixes, validates, and deploys UI screens, forms, grids, and routes.
  Use when the user asks to create, modify, or fix a module YAML file, references *-module.yaml files, or asks about UI components/forms/grids/routes in a CX project.
  Not for workflow YAML files, TypeScript code, or non-YAML tasks.
argument-hint: <description of what to build>
---

You are a CargoXplorer module YAML builder. You generate schema-valid YAML for CX app modules — UI screens, forms, data grids, routes, and components. All output must conform to the JSON schemas in `.cx-schema/`.

**IMPORTANT — use `cxtms` for all module operations:**
- **Scaffold**: `npx cxtms create module <name> --template <template>` — generates a schema-valid YAML file. ALWAYS run this first, then read the generated file, then customize. Do NOT write YAML from scratch or copy templates manually.
- **Scaffold with fields**: `npx cxtms create module <name> --template <template> --options '<json>'`
- **Validate**: `npx cxtms <file.yaml>` — run after every change
- **Schema lookup**: `npx cxtms schema <component>` — e.g., `cxtms schema form`, `cxtms schema dataGrid`
- **Examples**: `npx cxtms example <component>` — show example YAML
- **List schemas**: `npx cxtms list`
- **Extract**: `npx cxtms extract <source> <component> --to <target>` — move components between modules
- **Feature folder**: `npx cxtms create module <name> --template <template> --feature <feature-name>`
- **Deploy to server**: `npx cxtms appmodule deploy <file.yaml> --org <id>` — creates or updates module on the CX server
- **Undeploy from server**: `npx cxtms appmodule undeploy <appModuleId> --org <id>` — removes a module by UUID
- **Publish all**: `npx cxtms publish [--feature <name>] --org <id>` — push all modules and workflows to the server

## Generation Workflow

### Step 1: Scaffold via CLI — MANDATORY

**You MUST run `cxtms create module` to generate the initial file.** Do not skip this step. Do not write YAML from scratch. Do not read template files and copy them manually. The CLI generates correct UUIDs, file paths, and structure.

```bash
npx cxtms create module <name> --template <template>
npx cxtms create module <name> --template <template> --options '<json>'
```

| Template | Use Case |
|----------|----------|
| `default` | Generic module with form |
| `form` | Entity create/edit form |
| `configuration` | Settings/config screen |
| `grid` | List/table view |
| `select` | Reusable async select |

### Step 2: Read the generated file

### Step 3: Customize for the use case

**All templates** — update module name, component names, entity fields, permissions, GraphQL queries/mutations.

**`form`** — update form fields, validationSchema, query/mutation field lists. Add tabs for grouped fields. Customize toolbar buttons. Update dirtyGuard messages.

**`configuration`** — update form fields, initialValues.append defaults, validationSchema rules, query/mutation field lists. Add tabs for grouped settings.

**`grid`** — update view columns, filters, entity fields. Add/remove views. Customize dotsMenu actions. Configure toolbar with export/import actions.

**`select`** — update `valueFieldName`, `itemLabelTemplate`, `itemValueTemplate`. Customize GraphQL query fields and variables. Set `navigateActionPermission`. Configure `dropDownToolbar` create button dialog.

### Step 4: Validate

```bash
npx cxtms <generated-file.yaml>
```

---

## --options Flag

Customize generated modules at scaffold time with `--options`. Accepts inline JSON or a file path.

### Field Array Format (all templates)

```bash
npx cxtms create module "Tariff" --template grid --options '[
  {"name": "code", "type": "text", "label": "Tariff Code", "required": true},
  {"name": "rate", "type": "number", "label": "Rate %"},
  {"name": "effectiveDate", "type": "date"},
  {"name": "isActive", "type": "checkbox", "label": "Active"}
]'
```

### Object Format (with entityName)

```bash
npx cxtms create module "Country" --template select --options '{
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

## Extract Command

Move or copy a component (and its routes) from one module into another. Useful for splitting large modules or sharing components.

```bash
cxtms extract <source-file> <component-name> --to <target-file>
cxtms extract <source-file> <component-name> --to <target-file> --copy
```

### Flags
- `--to <file>` — target module file (required)
- `--copy` — copy instead of move (source keeps the component, target gets a higher-priority copy)

### What Gets Moved/Copied
- The component matching the exact `name` field
- Any routes whose `component` field matches the component name
- Permissions and entities are **NOT** moved

### Examples

```bash
# Move a component to a new file (creates module scaffold automatically)
npx cxtms extract modules/orders.yaml Orders/CreateItem --to modules/order-create.yaml

# Copy a component (source unchanged, target gets higher priority)
npx cxtms extract modules/orders.yaml Orders/CreateItem --to modules/order-create.yaml --copy

# Extract to an existing module
npx cxtms extract modules/main.yaml Dashboard --to modules/dashboard.yaml
```

### New Target Scaffold
When the target file doesn't exist, a new module is created with:
- `module` name derived from filename (PascalCase)
- Fresh `appModuleId` (UUID)
- `application` copied from source
- Empty `entities` and `permissions` arrays

### Workflow
1. Run `extract` to move the component
2. Manually move any related permissions/entities if needed
3. Validate both files: `npx cxtms <source>` and `npx cxtms <target>`

---

## On-Demand References

**Read these files only when needed for the current task.** Do not load all references upfront.

### Entity Field Reference (cx-core)

!cat .claude/skills/cx-core/SKILL.md

### Component Directory

Read the relevant category ref file when building specific component types:

| Category | Components | File |
|----------|-----------|------|
| **Layout & Structure** | `layout`, `row`, `col`, `header`, `tabs`, `toolbar`, `card`, `line`, `slot` | `.claude/skills/cx-module/ref-components-layout.md` |
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
- `components/<type>.json` — component schemas (layout, form, dataGrid, field, button, tabs, card, calendar, collection, appComponent, slot, module)
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
  filePath: "modules/<name>-module.yaml"  # File path in repo

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

## Server Module Commands

Deploy, undeploy, and publish commands are listed in the CLI section at the top of this file. For authentication setup (login, PAT tokens, org management): see [cx-core/ref-cli-auth.md](.claude/skills/cx-core/ref-cli-auth.md)

### Publishing App to GitHub

Use `app publish` to push modified modules and workflows from the CX server to a GitHub repository. This creates a branch and pull request — it does NOT push directly to the target branch.

```bash
# Publish all unpublished changes to GitHub (creates a PR)
npx cxtms app publish

# Publish specific modules and/or workflows by YAML file
npx cxtms app publish modules/my-module.yaml
npx cxtms app publish modules/a.yaml workflows/b.yaml

# Publish with a custom commit message
npx cxtms app publish --message "Add warehouse locations module"

# Force publish all modules and workflows (not just unpublished ones)
npx cxtms app publish --force

# Publish with explicit org
npx cxtms app publish --org 42
```

**What `app publish` does:**
1. Reads `app.yaml` for the `id` (appManifestId), repository, and branch
2. Increments the app version (patch bump)
3. Creates a `publish/{app-name}-v{version}-{timestamp}` branch on GitHub
4. Commits `app.yaml` + selected module/workflow YAML files to the branch
5. Creates a pull request from the publish branch to the target branch
6. Marks published modules and workflows as `hasUnpublishedChanges: false`

**This is a commit-and-push operation** — it commits the current server-side YAML directly to GitHub via the API. No local git repo is involved. The modules and workflows being published are taken from the CX server database, not from local files. The YAML file arguments only identify *which* items to include by their IDs.

**Important:** Modules and workflows must be deployed to the TMS server before they can be published. Use `cxtms appmodule deploy` or `cxtms workflow deploy` first, then `cxtms app publish` to commit them to GitHub.

**Do NOT run `app publish` automatically.** Only publish when the user explicitly requests it. Publishing creates a branch and PR on GitHub, so it should be done once when all changes are ready — not after every deploy.

**Prerequisites:**
- `app.yaml` must exist with a valid `id` field
- The app manifest must be installed on the server (`app install` first)
- The server must have a GitHub token configured for the organization
- The repository and branch must be set on the app manifest

**Related commands:**
- `npx cxtms app install` — install/refresh app from GitHub into the server
- `npx cxtms app install --force` — force reinstall even if same version
- `npx cxtms app install --branch develop` — install from a specific branch
- `npx cxtms app install --skip-changed` — skip modules with local changes
- `npx cxtms app list` — list installed app manifests on the server

---

# Generation Rules

1. **Always scaffold via `cxtms create module` first** — never write YAML from scratch, never copy templates manually
2. **Use localized strings** `{ en-US: "..." }` for all user-visible text
3. **Follow naming conventions**:
   - Module names: PascalCase (e.g., `WarehouseLocations`)
   - Component names: Module/Component pattern (e.g., `WarehouseLocations/List`)
   - Route paths: kebab-case (e.g., `/warehouse-locations`)
   - Permission names: PascalCase with slashes (e.g., `WarehouseLocations/Read`, `System/Contacts/Update`)
4. **Template expressions** use `{{ expression }}` syntax (double curly braces)
5. **Include filePath** property pointing to the YAML file location
6. **Set proper entityKind** when defining entities (Order, Contact, OrderEntity, AccountingTransaction, Calendar, CalendarEvent, Other)
7. **DataGrid options** requires ALL properties: query, rootEntityName, entityKeys, navigationType, enableDynamicGrid, enableViews, enableSearch, enablePagination, enableColumns, enableFilter, defaultView, onRowClick
8. **Form component** requires `validationSchema` in props
9. **Do not change `appModuleId` or `filePath`** — set correctly by CLI scaffold
10. **Always validate** the final YAML: `npx cxtms <file.yaml>`
