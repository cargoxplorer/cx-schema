# Notification Entity Reference

Real-time notification system. Notifications are org-scoped with per-user read tracking via `UserNotification`.

## Notification

| Field | Type | Notes |
|-------|------|-------|
| `notificationId` | `int` | PK |
| `organizationId` | `int` | FK to Organization |
| `title` | `string` | Required |
| `message` | `string?` | Body text, supports Markdown |
| `type` | `NotificationType` | System=0, OrderUpdate=1, TaskAssignment=2, Alert=3, Info=4 |
| `priority` | `NotificationPriority` | Low=0, Normal=1, High=2, Urgent=3 |
| `targetUserId` | `string?` | If set, targets one user; if null, broadcasts to all active org users |
| `entityType` | `string?` | Linked entity type (e.g. "Order", "Job") |
| `entityId` | `int?` | Linked entity PK |
| `expiresAt` | `DateTime?` | Optional expiration |
| `created` / `lastModified` | `DateTime` | Audit fields (from `AuditableEntity`) |
| `createdBy` / `lastModifiedBy` | `string` | Audit fields |

### Domain Methods

- `ChangeTitle(string)`, `ChangeMessage(string?)`, `ChangeType(NotificationType)`, `ChangePriority(NotificationPriority)`, `ChangeExpiresAt(DateTime?)`

---

## UserNotification

Per-user read state join entity.

| Field | Type | Notes |
|-------|------|-------|
| `userNotificationId` | `int` | PK |
| `notificationId` | `int` | FK to Notification |
| `userId` | `string` | FK to ApplicationUser |
| `isRead` | `bool` | Default false |
| `readAt` | `DateTime?` | Set when marked read |

### Domain Methods

- `MarkAsRead()` — sets `IsRead = true`, `ReadAt = UtcNow`
- `MarkAsUnread()` — resets both

---

## GraphQL

### Queries

- `getNotification(organizationId, notificationId)` → single notification for current user (projected from UserNotification)
- `getNotifications(organizationId, filter?, search?, orderBy?)` → offset-paged list for current user; default sort: `-notification.created`
- `getUnreadNotificationCount(organizationId)` → int

### Mutations

- `createNotification(organizationId, values)` → creates Notification + UserNotification rows; publishes to subscription topic per user
- `markNotificationRead(organizationId, notificationId)` → bool
- `markAllNotificationsRead(organizationId)` → int (count marked)
- `deleteNotification(organizationId, notificationId)` → DeleteResult

### Subscriptions

- `onNotificationReceived(organizationId, userId)` → real-time via PostgreSQL NOTIFY/LISTEN
  - Topic: `{organizationId}_{userId}_notifications`

### GraphQL DTO (projected from UserNotification)

Flattens `Notification` + `UserNotification` into single DTO: `notificationId`, `organizationId`, `title`, `message`, `type`, `priority`, `targetUserId`, `entityType`, `entityId`, `expiresAt`, `isRead`, `readAt`, `created`, `createdBy`, `lastModified`, `lastModifiedBy`, plus resolved `createdUser` / `updatedUser`.

---

## Targeting Logic

On `CreateNotification`:
1. If `targetUserId` is provided → single `UserNotification` row
2. If null → queries all active `UserEmployee` records in org → one `UserNotification` per user
3. After save, publishes `NotificationDto` to each user's subscription topic via `INotificationEventSender`

## Infrastructure

- `NotificationConfiguration` — EF Core config: title max length, indexes on `OrganizationId`, composite index on `(OrganizationId, Created DESC)` for paging
- `UserNotificationConfiguration` — indexes on `UserId`, `NotificationId`, composite on `(UserId, IsRead)`
- `NotificationEventSender` — uses HotChocolate `ITopicEventSender` to publish to subscription topics
- Real-time delivery: PostgreSQL `NOTIFY/LISTEN` channel (configured in `DependencyInjection`)
