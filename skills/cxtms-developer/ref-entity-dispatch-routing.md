# Dispatch Routing Entity Field Reference

Dispatch routing covers reusable weekly route templates, daily dispatch routes, route statuses, stop statuses, and stops.

## DispatchRouteType Enum

| Value | Notes |
|-------|-------|
| `Delivery` | Delivery route or stop |
| `Pickup` | Pickup route or stop |

## DispatchRouteStatus

| Field | Type | Notes |
|-------|------|-------|
| `dispatchRouteStatusId` | `int` | PK |
| `organizationId` | `int` | Tenant scope |
| `statusName` | `string` | Display name |
| `statusDescription` | `string?` | Optional description |
| `statusStage` | `StatusStage` | `Pending`, `InProgress`, `Completed` |
| `routeType` | `DispatchRouteType?` | Null applies to any route type |
| `priority` | `int` | Display sort order |
| `color` | `string?` | Hex/display color |
| `customValues` | `Dictionary` | jsonb |

## DispatchRouteStopStatus

| Field | Type | Notes |
|-------|------|-------|
| `dispatchRouteStopStatusId` | `int` | PK |
| `organizationId` | `int` | Tenant scope |
| `statusName` | `string` | Display name; unique per organization for active statuses |
| `statusDescription` | `string?` | Optional description |
| `statusStage` | `StatusStage` | `Pending`, `InProgress`, `Completed` |
| `stopType` | `DispatchRouteType?` | Null applies to any stop type |
| `priority` | `int` | Display sort order |
| `color` | `string?` | Hex/display color |
| `customValues` | `Dictionary` | jsonb |
| `isDeleted` | `bool` | Soft-delete flag |

## DispatchRouteTemplate

| Field | Type | Notes |
|-------|------|-------|
| `dispatchRouteTemplateId` | `int` | PK |
| `organizationId` | `int` | Tenant scope |
| `name` | `string` | Template name |
| `routeType` | `DispatchRouteType` | `Delivery` or `Pickup` |
| `daysOfWeek` | `DayOfWeek[]` | Matching generation days |
| `divisionId` | `int?` | FK to Division |
| `equipmentTypeId` | `int?` | Planned equipment type |
| `enabled` | `bool` | Generation skips disabled templates |
| `stops` | `[DispatchRouteTemplateStop]` | Ordered by `sequence` |
| `customValues` | `Dictionary` | jsonb |

## DispatchRouteTemplateStop

| Field | Type | Notes |
|-------|------|-------|
| `dispatchRouteTemplateStopId` | `int` | PK |
| `dispatchRouteTemplateId` | `int` | Parent template |
| `stopContactId` | `int?` | Store/location contact (nullable; use with or without `contactAddressId`) |
| `contactAddressId` | `int?` | Optional stop address |
| `stopType` | `DispatchRouteType` | Defaults to template route type when omitted |
| `sequence` | `int` | 1-based order |
| `estimatedServiceMinutes` | `int?` | Planned service time |
| `customValues` | `Dictionary` | jsonb (use for ad-hoc address when not using a contact) |

## DispatchRoute

| Field | Type | Notes |
|-------|------|-------|
| `dispatchRouteId` | `int` | PK |
| `organizationId` | `int` | Tenant scope |
| `name` | `string` | Route name |
| `routeType` | `DispatchRouteType` | `Delivery` or `Pickup` |
| `routeDate` | `Date` | `yyyy-MM-dd` |
| `dispatchRouteStatusId` | `int` | FK to DispatchRouteStatus |
| `dispatchRouteTemplateId` | `int?` | Source template when generated |
| `divisionId` | `int?` | FK to Division |
| `driverContactId` | `int?` | Driver contact assignment |
| `equipmentId` | `int?` | Equipment assignment |
| `isDraft` | `bool` | Generated/new routes start as draft |
| `isInactive` | `bool` | Soft-delete flag |
| `collapsedIntoDispatchRouteId` | `int?` | Route merge target |
| `stops` | `[DispatchRouteStop]` | Ordered by `plannedSequence` |
| `customValues` | `Dictionary` | jsonb |

## DispatchRouteStop

| Field | Type | Notes |
|-------|------|-------|
| `dispatchRouteStopId` | `int` | PK |
| `dispatchRouteId` | `int` | Parent route |
| `stopContactId` | `int?` | Store/location contact (nullable; use with or without `contactAddressId`) |
| `contactAddressId` | `int?` | Optional stop address |
| `stopType` | `DispatchRouteType` | Defaults to route route type when omitted |
| `plannedSequence` | `int` | Planned 1-based order |
| `actualSequence` | `int?` | Actual execution order |
| `estimatedServiceMinutes` | `int?` | Planned service time |
| `dispatchRouteStopStatusId` | `int?` | FK to DispatchRouteStopStatus |
| `dispatchRouteStopStatus` | `DispatchRouteStopStatus?` | Optional expanded stop status |
| `actualArrivalTime` | `DateTime?` | Actual arrival timestamp |
| `actualCompletionTime` | `DateTime?` | Actual completion timestamp |
| `orderIds` | `int[]` | Attached order IDs; always projected |
| `orders` | `[DispatchRouteStopOrder]` | Attached order links; expand `order` when needed |
| `customValues` | `Dictionary` | jsonb (use for ad-hoc address when not using a contact) |

## DispatchRouteStopOrder

| Field | Type | Notes |
|-------|------|-------|
| `dispatchRouteStopOrderId` | `int` | PK |
| `dispatchRouteStopId` | `int` | Parent stop |
| `orderId` | `int` | Attached order |
| `order` | `Order?` | Optional expanded order |
| `customValues` | `Dictionary` | jsonb on the stop/order link |

## GraphQL Notes

- Queries: `dispatchRouteStatus`, `dispatchRouteStatuses`, `dispatchRouteStopStatus`, `dispatchRouteStopStatuses`, `dispatchRouteTemplate`, `dispatchRouteTemplates`, `dispatchRoute`, `dispatchRoutes`.
- Mutations use `input: { organizationId, values }` and return payload fields named `dispatchRouteStatus`, `dispatchRouteStopStatus`, `dispatchRouteTemplate`, `dispatchRoute`, or `generateDispatchRoutesResult`.
- Stop status mutations: `createDispatchRouteStopStatus`, `updateDispatchRouteStopStatus`, `deleteDispatchRouteStopStatus`.
- Route stops can be anchored by location (`stopContactId`, `contactAddressId`, ad-hoc `customValues`) or by attached `orderIds`.
- Create accepts nested route stops with `dispatchRouteStopStatusId` and `orderIds`. Dynamic route updates and stop add/update mutations also accept `dispatchRouteStopStatusId` and `orderIds`; statuses are organization-scoped and validated against stop type, and when `orderIds` is present, the attached orders are reconciled to exactly those IDs after organization validation.
- Dynamic route/template updates can replace the full `stops` array: existing stops with IDs are sparse-updated, new stops are inserted, omitted existing stops are soft-deleted, and sequence/plannedSequence is reassigned from array order. Dedicated stop add/update/remove/reorder mutations remain available for targeted edits.
- Orders expose `relatedDispatchRoutes(filter, orderBy)` for routes linked through stop order attachments; draft orders return no related routes.
- Route generation is idempotent per template/date and creates draft routes.
