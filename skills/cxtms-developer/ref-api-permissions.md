# API Permission Reference

API permissions are app permissions named `API/<Entity>[/<Subtype>]/<Action>`, compared case-insensitively. They are distinct from UI permissions under `System/...`.

## Declaring permissions

Declare API names in a module's `permissions:` block and assign roles as usual:

```yaml
permissions:
  - name: API/Contact/List
    description: List contacts through the API
    roles: [Administrator, Operator]
  - name: API/Contact/Store/Update
    description: Update store contacts
    roles: [Administrator]
```

Actions are `Read`, `Create`, `Update`, `Delete`, `Execute`, and—on configuration or embedded entities—`List` and `Get`.

- Exact grants are independent: `API/Contact/Store/Create` does not grant `Update`.
- API wildcards grant progressively: `API/Contact/Store/*`, `API/Contact/*`, and `API/*` can grant `API/Contact/Store/Create`.
- Wildcards work only below `API/`. A `System/...` permission requires its exact name.
- Required API names are deny-by-default even when an app module does not declare them.
- The core app gives the organization Administrator role `API/*`; other roles need explicit grants.

## Read and write behavior

GraphQL, REST, MCP, and agent writes share the same checks. Subtyped entities use the subtype permission when applicable. Ownership is always checked before the operation.

Direct reads of `Order`, `Commodity`, `InventoryItem`, and `Attachment` require `API/<Entity>/Read`. Root reads of configuration and embedded entities use `API/<Entity>/List` for collections and `API/<Entity>/Get` for one record. This includes contacts, users, accounting entities, organization users/connections, workflows, app metadata, statuses, types, document templates, and entity fields. Nested GraphQL fields remain readable through an authorized parent.

## Workflows

A workflow's own `permission` is always enforced for user-invoked execution. A user-invoked workflow without one requires `API/Workflow/Execute` once that permission is declared. A user-callable `runAs: SYSTEM` workflow must declare a permission. Internal tasks, Flow transitions, after-save handlers, nested commands, schedules, and entity triggers run trusted after the outer operation is authorized.
