# Data & Collection Components

## collection

Iterates over data items and renders children as templates. Supports drag-and-drop reordering.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `any` | — | Data source: array, template string, or query ref |
| `itemName` | `string` | `item` | Variable name for current item in templates |
| `itemProps` | `string` | — | Template to transform each item |
| `itemSize` | `number \| {xs,sm,md,lg,xl}` | `{xs:12}` | MUI Grid size per item |
| `itemOffset` | `number \| breakpoints` | — | Grid offset per item |
| `itemOrder` | `number \| breakpoints` | — | Grid order per item |
| `itemSx` | `SxProps` | — | MUI sx per item |
| `itemTag` | `string` | `div` | HTML element wrapping item children |
| `spacing` | `number` | `3` | Grid spacing |
| `columns` | `number` | `12` | Grid column count |
| `containerSx` | `SxProps` | — | Container sx styles |
| `childClassName` | `string` | — | CSS class per item |
| `enableSorting` | `boolean` | — | Enable drag-and-drop reordering |
| `refreshHandler` | `string` | — | Refresh handler name |
| `emptyMessage` | `string` | — | Shown when empty |

**Children:** Yes — each child is rendered per item. Variables: `{itemName}` = current item, `{itemName}Index` = index.

```yaml
# Basic collection with cards
component: collection
name: contactCards
props:
  items: "{{ contacts }}"
  itemName: contact
  itemSize: { xs: 12, md: 6, lg: 4 }
  spacing: 2
  emptyMessage: "No contacts found"
children:
  - component: card
    name: contactCard
    props:
      options:
        header:
          title: "{{ contact.name }}"
          subheader: "{{ contact.email }}"
    children:
      - component: text
        name: phone
        props: { value: "{{ contact.phone }}", type: p }

# Collection with drag-and-drop sorting
component: collection
name: sortableItems
props:
  items: "{{ orderItems }}"
  itemName: item
  enableSorting: true
children:
  - component: row
    name: itemRow
    children:
      - component: text
        name: itemName
        props: { value: "{{ item.name }}" }
      - component: text
        name: itemQty
        props: { value: "Qty: {{ item.quantity }}" }

# Collection from query
component: collection
name: recentOrders
props:
  itemName: order
  itemSize: 12
  refreshHandler: orders
  queries:
    - name: getRecentOrders
      query:
        command: "query { recentOrders { id orderNumber status } }"
children:
  - component: text
    name: orderLabel
    props: { value: "#{{ order.orderNumber }} - {{ order.status }}" }
```

---

## list

MUI List with auto-generated or custom item rendering. Supports selection modes.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `any` | — | Data source |
| `itemName` | `string` | `item` | Variable name per item |
| `dividers` | `boolean` | `false` | Show dividers between items |
| `dense` | `boolean` | `false` | Dense list mode |
| `disablePadding` | `boolean` | `false` | Remove padding |
| `primaryField` | `string` | — | Field for primary text (auto-render) |
| `secondaryField` | `string` | — | Field for secondary text (auto-render) |
| `avatarField` | `string` | — | Field for avatar image URL |
| `icon` | `string` | — | Icon for all items |
| `enableSelect` | `Single \| Multiple` | — | Selection mode (Multiple = checkboxes) |
| `emptyMessage` | `string` | — | Empty state message |
| `containerSx` / `itemSx` | `SxProps` | — | Styles |
| `refreshHandler` | `string` | — | Refresh handler |

**Events:** `onClick` — per item, with item data in variables.

**Children:** Optional — when provided, renders per item (like collection). When omitted, auto-generates from `primaryField`/`secondaryField`.

```yaml
# Auto-generated list
component: list
name: contactList
props:
  items: "{{ contacts }}"
  itemName: contact
  primaryField: contactName
  secondaryField: email
  avatarField: avatarUrl
  dividers: true
  onClick:
    - navigate: "contacts/{{ contact.contactId }}"

# List with selection
component: list
name: selectableItems
props:
  items: "{{ availableItems }}"
  itemName: item
  primaryField: name
  secondaryField: description
  enableSelect: Multiple
  dense: true

# List with custom children
component: list
name: customList
props:
  items: "{{ notifications }}"
  itemName: notif
  dividers: true
children:
  - component: row
    name: notifRow
    props: { spacing: 1, alignItems: center }
    children:
      - component: icon
        name: notifIcon
        props: { icon: "{{ notif.icon }}", color: "{{ notif.color }}" }
      - component: text
        name: notifText
        props: { value: "{{ notif.message }}", type: span }
```

---

## listItem

Composable MUI ListItem with component slots and built-in popover menu.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `primaryComponent` | `ComponentProps` | Primary text area component |
| `secondaryComponent` | `ComponentProps` | Secondary text area component |
| `avatarComponent` | `ComponentProps` | Avatar slot component |
| `secondaryAction` | `ComponentProps` | Right-side action component |
| `selected` | `boolean` | Visual selection state |
| `disabled` | `boolean` | Disabled state |
| `divider` | `boolean` | Bottom divider |
| `button` | `boolean` | Render as ListItemButton |
| `sx` | `object` | MUI styles |
| `menu.icon` | `string` | Menu trigger icon (default: `ellipsis-vertical`) |
| `menu.items[]` | `{label, icon, onClick, disabled}` | Menu items |

**Events:** `onClick`, `menu.items[].onClick`

**Children:** Fallback — rendered when no primary/secondary components.

```yaml
component: listItem
name: orderItem
props:
  button: true
  primaryComponent:
    component: text
    name: orderNum
    props: { value: "Order #{{ item.orderNumber }}", type: span }
  secondaryComponent:
    component: text
    name: orderDate
    props: { value: "{{ format item.created LL }}", type: span, color: text.secondary }
  menu:
    items:
      - label: "Edit"
        icon: edit
        onClick:
          - navigate: "orders/{{ item.id }}"
      - label: "Delete"
        icon: trash
        disabled: "{{ eval item.status === 'Completed' }}"
        onClick:
          - confirm: { title: { en-US: "Delete?" } }
  onClick:
    - navigate: "orders/{{ item.id }}"
```

---

## datasource

Headless data-loading wrapper. Renders children only after queries complete.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `queries` | `QueryDef[]` | Query definitions |
| `refreshHandler` | `string` | Refresh handler name |

**Events:**
| Event | Data | Description |
|-------|------|-------------|
| `onLoading` | — | Fires when loading starts |
| `onSuccess` | `loadedResult` | Fires when data loads |
| `onError` | `error` | Fires on failure |

**Children:** Yes — rendered after all queries complete. Children get loaded data in variables.

```yaml
component: datasource
name: orderData
props:
  refreshHandler: orderDetails
  queries:
    - name: getOrderDetails
      query:
        command: |
          query($id: Int!) {
            orderDetails(id: $id) {
              id orderNumber items { name quantity }
            }
          }
        variables:
          id: "{{ number id }}"
  onSuccess:
    - consoleLog: { message: "Order loaded: {{ loadedResult.orderNumber }}" }
children:
  - component: text
    name: orderTitle
    props: { value: "Order: {{ getOrderDetails.orderNumber }}", type: h3 }
  - component: collection
    name: itemsList
    props:
      items: "{{ getOrderDetails.items }}"
      itemName: lineItem
    children:
      - component: text
        name: lineLabel
        props: { value: "{{ lineItem.name }} x{{ lineItem.quantity }}" }
```

---

## script

External script loader. Headless — renders nothing. Deduplicates across instances.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | **Required.** Script URL |
| `globalCheck` | `string` | — | Global variable to check (e.g., `google.maps`) |
| `removeOnUnmount` | `boolean` | `false` | Remove script on unmount |

**Known auto-detected globals:** Google Maps, jQuery, Stripe, PayPal, YouTube, Facebook, Twitter.

```yaml
component: script
name: googleMaps
props:
  src: "https://maps.googleapis.com/maps/api/js?key={{ mapsApiKey }}"
  globalCheck: "google.maps"
```
