# Interactive & Navigation Components

## button

MUI Button with icon, label, loading state, and action dispatch.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `ILocalizeString` | Button text (localized, template-parsed) |
| `icon` | `string` | Icon name (template-parsed) |
| `stopPropagation` | `boolean` | Stop click event propagation |
| `options.variant` | `string` | Visual variant (see mapping below) |
| `options.disabled` | `boolean \| string` | Disable state (template expression) |
| `options.type` | `submit \| reset \| button` | Button type |
| `options.sx` | `SxProps` | MUI sx styles |
| `options.className` | `string` | CSS class |

**Variant mapping:**
| YAML Value | MUI Rendered |
|------------|-------------|
| `primary` | `contained` + primary color |
| `secondary` | `outlined` + secondary color |
| `outline-primary` | `outlined` + primary color |
| `outline-secondary` | `outlined` + secondary color |
| `danger` | `contained` + error color |
| `success` | `contained` + success color |
| `warning` | `contained` + warning color |
| `info` | `contained` + info color |
| `link` / `text` | `text` variant |
| `contained-primary` | compound format supported |

**Events:** `onClick` — dispatches action chain with loading spinner while executing.

```yaml
# Primary submit button
- component: button
  name: saveBtn
  props:
    label: { en-US: "Save" }
    icon: check
    options:
      type: submit
      variant: primary

# Danger button with confirmation
- component: button
  name: deleteBtn
  props:
    label: { en-US: "Delete" }
    icon: trash
    options:
      variant: danger
    onClick:
      - confirm:
          title: { en-US: "Delete Item?" }
          message: { en-US: "This action cannot be undone." }
      - mutation:
          command: "mutation($id: Int!) { deleteItem(id: $id) { success } }"
          variables: { id: "{{ number id }}" }
          onSuccess:
            - notification: { message: { en-US: "Deleted" }, type: success }
            - navigateBack: { fallback: "/items" }

# Conditional disabled state
- component: button
  name: approveBtn
  props:
    label: { en-US: "Approve" }
    icon: check-circle
    options:
      variant: success
      disabled: "{{ eval status !== 'Pending' }}"
    onClick:
      - mutation:
          command: "mutation($id: Int!) { approveOrder(id: $id) { success } }"
          variables: { id: "{{ number id }}" }
```

---

## dropdown

Action dropdown menu (not a form select). MUI Button + Menu with permission-gated items.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `ILocalizeString` | Trigger button label |
| `icon` | `string` | Trigger button icon |
| `name` | `string` | Component name |
| `items` | `MenuItem[]` | Menu items |
| `items[].label` | `ILocalizeString` | Item label |
| `items[].value` | `any` | Item key |
| `items[].disabled` | `string \| boolean` | Disable (template expression) |
| `items[].permission` | `string` | Permission gate — hidden if not granted |
| `items[].onClick` | `action[]` | Per-item action |
| `options.size` | `string` | Button size (default: `medium`) |
| `options.variant` | `string` | Button variant (default: `outlined`) |

**Events:** `onClick` (button level), `items[].onClick` (per item)

```yaml
component: dropdown
name: actionsDropdown
props:
  label: { en-US: "Actions" }
  icon: activity
  options:
    variant: secondary
  items:
    - label: { en-US: "Export CSV" }
      onClick:
        - notification: { message: { en-US: "Exporting..." }, type: info }
    - label: { en-US: "Import" }
      permission: "Module/Import"
      onClick:
        - dialog:
            component: Module/ImportDialog
    - label: { en-US: "Archive All" }
      disabled: "{{ eval selectedItems.length === 0 }}"
      onClick:
        - confirm: { title: { en-US: "Archive?" }, message: { en-US: "Archive selected items?" } }
```

---

## menuButton

Collapsible menu with custom component children. Paper container with click toggle.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `ILocalizeString` | Trigger element text |
| `options` | `object` | HTML attributes on trigger div |
| `options.allowCreate` | `boolean` | Show children with `create` in name |

**Children:** Yes — each child rendered as a MenuItem via ComponentRender. Children with `create` in name are gated by `allowCreate`.

```yaml
component: menuButton
name: quickActions
props:
  label: { en-US: "Quick Actions" }
  options:
    allowCreate: true
children:
  - component: button
    name: createOrder
    props: { label: { en-US: "Create Order" }, icon: plus }
  - component: button
    name: viewReports
    props: { label: { en-US: "View Reports" }, icon: bar-chart }
```

---

## link

HTML anchor link with template-parsed URL and label.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Display text (template-parsed, localized) |
| `to` | `string` | URL href (template-parsed) |
| `options` | `object` | Additional `<a>` attributes (target, rel, etc.) |

```yaml
component: link
name: externalLink
props:
  label: "View on External System"
  to: "https://external.com/entity/{{ entityId }}"
  options:
    target: _blank
    rel: noopener noreferrer
```

---

## redirect

Programmatic navigation — renders nothing (or spinner with delay).

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `string` | — | **Required.** Destination (template-parsed) |
| `params` | `Record<string, any>` | — | Query parameters |
| `delay` | `number` | `0` | Delay in ms before redirect |
| `replace` | `boolean` | `false` | Use replace instead of push |
| `condition` | `any` | — | Template expression; skip redirect if falsy |

**Path types:**
- `http://...` / `https://...` — External redirect
- `~path` — System path (bypasses org prefix)
- `/path` — Org-relative path (prepends `/org/{orgId}/v2/`)

```yaml
# Conditional redirect
component: redirect
name: createRedirect
props:
  condition: "{{ eval !id }}"
  path: "/orders/create"

# External redirect with delay
component: redirect
name: externalRedirect
props:
  path: "https://external.com/order/{{ externalId }}"
  delay: 2000
```

---

## navbar

Vertical navigation menu with accordion submenus. Uses `@menu/vertical-menu`.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `items` | `component[]` | Primary nav items (navbarItem, navbarLink, navDropdown) |
| `contextItems` | `component[]` | Additional nav items (bottom section) |

**Children:** No — uses `items` and `contextItems` props.

---

## navbarItem

Nav section with optional label header. Child of `navbar`.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `ILocalizeString` | Section header label |

**Children:** Yes — rendered as section content.

---

## navbarLink

Single navigation link. Child of `navbarItem` or `navDropdown`.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `to` | `string` | Target path (template-parsed, locale-prefixed) |
| `label` | `ILocalizeString` | Link display text |
| `icon` | `string` | Menu item icon |

**Events:** `onClick`

---

## navDropdown

Collapsible submenu. Child of `navbarItem`. Auto-expands if child path matches current URL.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `label` | `ILocalizeString` | Submenu label |
| `icon` | `string` | Submenu icon |

**Children:** Yes — typically `navbarLink` items.

```yaml
# Full navbar example
component: navbar
name: mainNav
props:
  items:
    - component: navbarItem
      name: mainSection
      props:
        label: { en-US: "Main" }
      children:
        - component: navbarLink
          name: dashboard
          props:
            to: "/dashboard"
            label: { en-US: "Dashboard" }
            icon: home
        - component: navDropdown
          name: ordersMenu
          props:
            label: { en-US: "Orders" }
            icon: package
          children:
            - component: navbarLink
              name: allOrders
              props:
                to: "/orders"
                label: { en-US: "All Orders" }
            - component: navbarLink
              name: createOrder
              props:
                to: "/orders/create"
                label: { en-US: "Create Order" }
```
