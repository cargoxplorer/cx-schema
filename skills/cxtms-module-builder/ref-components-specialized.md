# Specialized Components

## Contents
- Calendar component
- Notes component
- Dashboard component
- DashboardWidget component
- Widget component
- Timeline component
- TimelineGrid component
- OAuth2 component

## calendar

FullCalendar integration with GraphQL event sources, timezone support, and programmatic control.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `calendarId` | `string` | — | Calendar ID (template-parsed), used for timezone fetch |
| `initialView` | `string` | `dayGridMonth` | View: `dayGridMonth`, `timeGridWeek`, `timeGridDay`, `listMonth` |
| `height` | `number` | `600` | Calendar height |
| `aspectRatio` | `number` | `1.35` | Calendar aspect ratio |
| `options.headerToolbar` | `object` | — | FullCalendar header toolbar config |
| `options.selectable` | `boolean` | — | Enable date selection |
| `options.editable` | `boolean` | — | Enable drag/resize events |
| `options.weekends` | `boolean` | — | Show weekends |
| `options.nowIndicator` | `boolean` | — | Show current time line |
| `options.eventDisplay` | `string` | — | Event display style |
| `options.eventSources` | `EventSource[]` | — | Event data sources |

**EventSource definition:**
| Prop | Type | Description |
|------|------|-------------|
| `query.command` | `string` | GraphQL query |
| `query.variables` | `object` | Query variables |
| `query.path` | `string` | Path to events in response |
| `query.mapping` | `object` | Field mapping for events |
| `color` | `string` | Event background color |
| `textColor` | `string` | Event text color |

**Events:**
| Event | Data | Description |
|-------|------|-------------|
| `onDateClick` | `date, dateStr, allDay, view` | Date cell clicked |
| `onEventClick` | `event{id,title,start,end,allDay,extendedProps}, view` | Event clicked |
| `onSelect` | `start, end, startStr, endStr, allDay, view` | Date range selected |
| `onEventDrop` | `event, oldEvent, delta, revert` | Event drag-dropped |
| `onEventResize` | `event, oldEvent, revert` | Event resized |
| `onDatesSet` | `start, end, startStr, endStr, view` | Visible range changed |

**Store API:** Stores `calendar_{calendarId}` in context store with: `refresh()`, `changeView()`, `gotoDate()`, `prev()`, `next()`, `today()`.

```yaml
component: calendar
name: shipmentCalendar
props:
  calendarId: "{{ calendarId }}"
  initialView: dayGridMonth
  height: 700
  options:
    selectable: true
    editable: true
    weekends: true
    nowIndicator: true
    headerToolbar:
      left: prev,next,today
      center: title
      right: dayGridMonth,timeGridWeek,timeGridDay
    eventSources:
      - query:
          command: |
            query($start: DateTime!, $end: DateTime!) {
              shipments(startDate: $start, endDate: $end) {
                id title startDate endDate status
              }
            }
          variables:
            start: "{{ startStr }}"
            end: "{{ endStr }}"
          path: shipments
          mapping:
            id: id
            title: title
            start: startDate
            end: endDate
        color: "#1976d2"
  events:
    onEventClick:
      - navigate: "shipments/{{ event.id }}"
    onDateClick:
      - dialog:
          component: Shipments/CreateShipment
          props:
            date: "{{ dateStr }}"
    onSelect:
      - dialog:
          component: Shipments/CreateShipment
          props:
            startDate: "{{ startStr }}"
            endDate: "{{ endStr }}"
```

---

## notes

Rich-text notes/comments component with TipTap editor, message threading, and pagination.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `threadName` | `string` | — | Thread identifier (template-parsed) |
| `title` | `ILocalizeString` | `Notes` | Card title |
| `height` | `number` | `400` | Card max height |
| `placeholder` | `string` | — | Editor placeholder |
| `readonly` | `boolean \| string` | — | Hide input area |
| `options.allowAttachments` | `boolean` | `true` | Show attach button |
| `options.showTimestamps` | `boolean` | `true` | Show relative times |
| `options.showAuthor` | `boolean` | `true` | Show author info |
| `options.inputPosition` | `top \| bottom` | `top` | Input placement |
| `options.autoScroll` | `boolean` | `true` | Auto-scroll to latest |
| `pagination.pageSize` | `number` | `20` | Notes per page |
| `pagination.orderBy` | `string` | `created` | Sort field |
| `pagination.orderDirection` | `ASC \| DESC` | `DESC` | Sort direction |
| `pagination.loadMoreMode` | `button \| auto \| disabled` | `button` | Load more behavior |
| `permissions.create` | `string` | — | Create permission |
| `permissions.edit` | `string` | — | Edit permission |
| `permissions.delete` | `string` | — | Delete permission |

**Events:**
| Event | Description |
|-------|-------------|
| `onNoteCreated` | After note created |
| `onNoteUpdated` | After note updated |
| `onNoteDeleted` | After note deleted |

**Features:** Enter to send, Shift+Enter for newline. Message grouping (5 min window). Date separators. Long message collapse (>500 chars). Edit/delete on hover.

```yaml
component: notes
name: orderNotes
props:
  threadName: "order-{{ orderId }}"
  title: { en-US: "Order Notes" }
  height: 500
  placeholder: "Add a note..."
  options:
    allowAttachments: true
    inputPosition: top
    autoScroll: true
  pagination:
    pageSize: 30
    orderDirection: DESC
    loadMoreMode: button
  permissions:
    create: "Orders/CreateNote"
    edit: "Orders/EditNote"
    delete: "Orders/DeleteNote"
  events:
    onNoteCreated:
      - refresh: orderActivity
```

---

## dashboard

CSS Grid-based dashboard with draggable/resizable widgets.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `toolbar` | `component[]` | — | Filter/form fields in header |
| `options.rows` | `number` | `12` | Grid rows |
| `options.columns` | `number` | `12` | Grid columns |
| `options.gridGap` | `number` | `16` | Gap between cells (px) |
| `options.allowEdit` | `boolean` | `false` | Enable edit mode (drag/resize/add/remove) |
| `options.showGridLines` | `boolean` | `true` | Grid background in edit mode |
| `options.autoSave` | `boolean` | `false` | Auto-save layout |
| `options.title` | `string` | — | Dashboard title |
| `options.height` | `string` | — | Container height |

**Children:** `dashboard-widget` components only.

---

## dashboard-widget

Positioned widget card inside a dashboard. Supports drag-to-move and resize in edit mode.

**Props (under `options`):**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `row` | `number` | `1` | Grid row start |
| `col` | `number` | `1` | Grid column start |
| `rowSpan` | `number` | `1` | Rows spanned |
| `colSpan` | `number` | `1` | Columns spanned |
| `title` | `string` | — | Widget header title |
| `showHeader` | `boolean` | `true` | Show card header |
| `minRowSpan` / `maxRowSpan` | `number` | — | Size constraints |
| `minColSpan` / `maxColSpan` | `number` | — | Size constraints |
| `allowScroll` | `boolean` | `false` | Allow content scroll |

**Children:** Yes — any components.

```yaml
# Dashboard with widgets
component: dashboard
name: operationsDashboard
props:
  options:
    rows: 8
    columns: 12
    gridGap: 16
    allowEdit: true
    title: "Operations Dashboard"
  toolbar:
    - component: field
      name: dateRange
      props: { type: rangedatetime, label: { en-US: "Date Range" } }
children:
  - component: dashboard-widget
    name: revenueWidget
    props:
      options:
        row: 1
        col: 1
        rowSpan: 3
        colSpan: 6
        title: "Revenue"
    children:
      - component: widget
        name: revenueChart
        props:
          type: chart
          queries:
            - name: getRevenue
              query:
                command: "query { monthlyRevenue { month amount } }"

  - component: dashboard-widget
    name: statsWidget
    props:
      options:
        row: 1
        col: 7
        rowSpan: 3
        colSpan: 6
        title: "Quick Stats"
    children:
      - component: widget
        name: orderStats
        props:
          type: stats
          queries:
            - name: getStats
              query:
                command: "query { orderStats { total pending completed } }"
```

---

## widget

Data-driven widget that delegates to sub-components by type.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `type` | `stats \| chart \| kpi \| metric \| table` | **Required.** Widget type |
| `initialValues` | `object` | Data loading config (like form) |
| `queries` | `object` | Named GraphQL queries |
| `data` | `object` | Static data |
| `refreshHandler` | `string` | Refresh handler |

**Events:** `onLoading`, `onSuccess` (data: `loadedData`), `onError` (data: `error`)

---

## timeline

MUI Lab Timeline for displaying events chronologically. Horizontal or vertical orientation.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `horizontal \| vertical` | `horizontal` | Layout mode |
| `view` | `day \| week \| month \| year` | `week` | Time view |
| `startDate` / `endDate` | `string` | — | Initial date range |
| `eventSources` | `EventSource[]` | — | Same pattern as calendar |
| `eventTemplate` | `ComponentProps` | — | Custom event template |
| `options.height` | `string \| number` | `400` | Component height |
| `options.showTodayMarker` | `boolean` | `true` | Today marker |
| `options.enableZoom` | `boolean` | `true` | View switcher |
| `options.enableNavigation` | `boolean` | `true` | Prev/next/today buttons |
| `options.alternating` | `boolean` | `true` | Alternate sides (vertical) |
| `options.dateFormat` | `string` | `MMM DD` | Date format |

**Events:** `onEventClick` (data: `event`)

```yaml
component: timeline
name: orderTimeline
props:
  orientation: vertical
  view: month
  options:
    enableNavigation: true
    alternating: true
  eventSources:
    - query:
        command: "query($id: Int!) { orderHistory(orderId: $id) { id title date type } }"
        variables: { id: "{{ number orderId }}" }
        path: orderHistory
  eventTemplate:
    component: card
    name: eventCard
    props:
      options:
        variant: outlined
        header:
          title: "{{ item.title }}"
          subheader: "{{ format item.date LLL }}"
  events:
    onEventClick:
      - dialog:
          component: Orders/EventDetail
          props: { eventId: "{{ event.id }}" }
```

---

## timeline-grid

CSS Grid-based timeline with swim lanes, drill-down, and virtual scrolling.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `view` | `day \| week \| month \| year` | `week` | Time view |
| `startDate` / `endDate` | `string` | — | Date range |
| `eventSources` | `EventSource[]` | — | Event data sources |
| `eventSources[].query.name` | `string` | `query1`, `query2`... | Source name, used as key in `summaryComponent` `dataSources` |
| `eventTemplate` | `ComponentProps` | — | Custom event template |
| `summaryComponent` | `ComponentProps` | — | Custom component rendered per column in the summary row. Replaces numeric totals when set. |
| `options.height` | `string \| number` | `600` | Container height |
| `options.cellHeight` | `number` | `60/100` | Cell height (px) |
| `options.groupBy` | `string` | — | Field for swim lane grouping |
| `options.showTodayMarker` | `boolean` | `true` | Today marker |
| `options.enableNavigation` | `boolean` | `true` | Nav controls |
| `options.virtualScroll` | `boolean` | `true` | Virtual scrolling |
| `options.hourInterval` | `15 \| 30 \| 60` | `60` | Time intervals (day/week) |
| `options.showWeekends` | `boolean` | `true` | Show weekends |
| `options.showTotalCount` | `boolean` | `false` | Show event totals |

**Summary component variables** (available when `summaryComponent` is set):
| Variable | Type | Description |
|----------|------|-------------|
| `dataSources` | `Record<string, TimelineEvent[]>` | Per-source events filtered to the column, keyed by `query.name` |
| `column` | `ColumnDefinition` | Column metadata (`id`, `label`, `date`, `startDate`, `endDate`) |
| `columnIndex` | `number` | Zero-based column index |
| `totalCount` | `number` | Total event count for the column across all sources |

**Events:**
| Event | Data | Description |
|-------|------|-------------|
| `onEventClick` | `item, view` | Event clicked |
| `onCellClick` | `column, row, date, view` | Empty cell clicked |
| `onViewChange` | `previousView, newView, startDate, endDate` | View changed |
| `onNavigate` | `direction, view, startDate, endDate` | Navigation |
| `onEventsLoaded` | `events, eventCount, view, dataRange` | Data loaded |
| `onLoad` | `view, startDate, endDate, options` | Initial mount |

**Column drill-down:** Click column header: year->month, month->week, week->day.

```yaml
component: timeline-grid
name: scheduleGrid
props:
  view: week
  options:
    height: 700
    cellHeight: 80
    groupBy: assignee
    showWeekends: false
    hourInterval: 30
    showTotalCount: true
    enableNavigation: true
  eventSources:
    - query:
        command: |
          query($start: DateTime!, $end: DateTime!) {
            scheduleEvents(start: $start, end: $end) {
              id title startDate endDate assignee status
            }
          }
        path: scheduleEvents
  events:
    onEventClick:
      - dialog:
          component: Schedule/EventDetail
          props: { eventId: "{{ item.id }}" }
    onCellClick:
      - dialog:
          component: Schedule/CreateEvent
          props: { date: "{{ date }}", assignee: "{{ row }}" }
```

**Summary component example** (per-source breakdown per column):
```yaml
component: timeline-grid
props:
  view: week
  options: { height: 600, enableNavigation: true }
  eventSources:
    - query:
        name: ups
        command: "query($s:String!,$e:String!){ upsShipments(start:$s,end:$e){ id date title } }"
        variables: { s: "{{ startDate }}", e: "{{ endDate }}" }
        path: upsShipments
    - query:
        name: fedex
        command: "query($s:String!,$e:String!){ fedexShipments(start:$s,end:$e){ id date title } }"
        variables: { s: "{{ startDate }}", e: "{{ endDate }}" }
        path: fedexShipments
  summaryComponent:
    component: layout
    props:
      direction: column
    children:
      - component: text
        props: { value: "UPS: {{ dataSources.ups.length }}" }
      - component: text
        props: { value: "FedEx: {{ dataSources.fedex.length }}" }
      - component: text
        props: { value: "Total: {{ totalCount }}" }
```

---

## oauth2

OAuth2 authorization flow button. Opens popup for auth, exchanges code for token.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `clientId` | `string` | OAuth2 client ID (template-parsed) |
| `clientSecret` | `string` | OAuth2 client secret (template-parsed) |
| `authorizationUrl` | `string` | Authorization endpoint |
| `tokenUrl` | `string` | Token exchange endpoint |
| `scopes` | `string[]` | Requested scopes |
| `additionalParams` | `Record<string, string>` | Extra auth URL params |
| `additionalHeaders` | `object` | Extra token request headers |
| `label` | `ILocalizeString` | Button label (default: `Authorize`) |
| `className` | `string` | Button CSS class |

**Events:** `onToken` — fires with `{ token }` when OAuth completes.

```yaml
component: oauth2
name: intuitAuth
props:
  label: { en-US: "Connect QuickBooks" }
  clientId: "{{ quickbooksClientId }}"
  clientSecret: "{{ quickbooksClientSecret }}"
  authorizationUrl: "https://appcenter.intuit.com/connect/oauth2"
  tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
  scopes:
    - com.intuit.quickbooks.accounting
  onToken:
    - mutation:
        command: "mutation($token: String!) { saveOAuthToken(token: $token) { success } }"
        variables: { token: "{{ token }}" }
    - notification: { message: { en-US: "Connected!" }, type: success }
```
