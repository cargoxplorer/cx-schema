# Datagrid Entity Field Pitfalls — Skill Update Design

**Date:** 2026-05-26
**Branch:** `feat/datagrid-entity-field-pitfalls`
**File:** `skills/cxtms-module-builder/ref-components-display.md`

## Problem

Verified findings from the `tms-frontend-web` datagrid source code revealed critical behaviors and pitfalls around entity field definitions that are not documented in the module builder skill. These cause real bugs when Claude Code generates module YAML:

1. `fieldType: select` is legacy — causes picker visibility issues and rendering conflicts
2. Mismatched `onEdit` causes incorrect saves when columns are re-added from picker
3. `showAs` on editable columns changes display rendering (affects legacy `select` fields)
4. `filterByProperty` is undocumented
5. Edit property placement differs between entity fields and grid columns

## Design

### Scope

Extend `skills/cxtms-module-builder/ref-components-display.md` only. No new files. Rules and YAML examples — no source code references or line numbers.

### Changes

#### 1. Extend "Entity Fields & Column Visibility" section

**Add to entity field properties table:**

| Property | Location | Effect |
|---|---|---|
| `filterByProperty` | `props` | Server-side filter path (may differ from display path) |

**Add visibility rules:**

- Do **not** use `fieldType: select` for new entity fields. It is a legacy pattern that requires `showAs` to appear in the column picker and causes rendering conflicts on editable columns (see pitfalls below). Use the appropriate non-select fieldType instead (`text`, `number`, `date`, `enhanced-rangedatetime`, `checkbox`, etc.). All non-select types appear in the picker without needing `showAs`.
- `fieldType: Entity` is filtered out of the column picker entirely by the runtime — do not use it.

**Update "Correct pattern" example** to use `fieldType: text` with `filterByProperty`:

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

#### 2. Add "Entity Field Pitfalls" subsection

New subsection after "Inline Cell Editing":

**Pitfall 1 — `fieldType: select` is legacy (do not use for new fields)**

`fieldType: select` requires `props.showAs` to appear in the column picker — without it, the column is invisible. Non-select types always appear.

When editing existing modules that use `fieldType: select` with inline editing: `showAs` changes how EditableCell renders in display mode. The cell goes through ComponentRender template evaluation instead of raw value display. This produces different visual output than the original grid column definition. Be aware of this dual behavior when maintaining legacy `select` fields.

**Pitfall 2 — Entity field `onEdit` must match grid column `onEdit` verbatim**

When a user re-adds an editable column from the picker, the entity field's `onEdit` replaces the grid column's `onEdit` entirely. If they differ (different mutation, different variable names, different `onSuccess`), the re-added column saves differently. Always copy `onEdit` from the grid view column definition into the entity field definition verbatim.

**Pitfall 3 — Edit properties go inside `props` in entity fields**

Unlike grid view columns where `enableEdit`, `editor`, and `onEdit` are top-level, entity field definitions must place them inside `props`. The runtime automatically promotes them to top-level when building available columns.

**Complete example (resolver column with inline editing):**

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
