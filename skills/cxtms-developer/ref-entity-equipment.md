# Equipment Entity Reference

## Contents
- Equipment
- EquipmentStatus

---

## Equipment

Physical equipment/fleet units (trucks, trailers, etc.).

| Field | Type | Notes |
|-------|------|-------|
| `equipmentId` | `int` | PK |
| `organizationId` | `int` | |
| `unitNumber` | `string` | Max 50 chars |
| `equipmentTypeId` | `int` | FK to EquipmentType |
| `equipmentStatusId` | `int` | FK to EquipmentStatus |
| `notes` | `string?` | Max 700 chars |
| `customValues` | `Dictionary?` | jsonb — replace semantics (null clears, otherwise full-replace) |
| `isDeleted` | `bool` | Soft delete |

**Navigation:** `organization`, `equipmentType`, `equipmentStatus`

**Audit fields:** `created`, `createdBy`, `lastModified`, `lastModifiedBy`, `createdUser`, `updatedUser`

### customValues Behavior

Equipment uses **replace semantics** (not merge). Sending `null` clears the dictionary entirely; sending a non-null dictionary replaces it completely. This differs from most other entities that use merge semantics.

### GraphQL

- `equipmentId`, `unitNumber`, `equipmentTypeId`, `equipmentStatusId`, `notes`, `customValues`, `isDeleted`
- `equipmentType` — expanded `EquipmentType` object
- `equipmentStatus` — expanded `EquipmentStatus` object

---

## EquipmentStatus

Configurable statuses for equipment units.

| Field | Type | Notes |
|-------|------|-------|
| `equipmentStatusId` | `int` | PK |
| `organizationId` | `int` | |
| `statusName` | `string` | Max 50 chars |
| `statusDescription` | `string?` | Max 255 chars |
| `statusStage` | `EquipmentStatusStage` enum | Lifecycle stage |
| `priority` | `int` | Sort order |
| `color` | `string?` | Hex color code, max 32 chars |

**Audit fields:** `created`, `createdBy`, `lastModified`, `lastModifiedBy`, `createdUser`, `updatedUser`

No customValues.

### EquipmentStatusStage Enum

`EquipmentStatusStage` — represents the lifecycle stage of an equipment status. Values defined in `TMS.Domain.Enums`.

### GraphQL

- `equipmentStatusId`, `statusName`, `statusDescription`, `statusStage`, `priority`, `color`
