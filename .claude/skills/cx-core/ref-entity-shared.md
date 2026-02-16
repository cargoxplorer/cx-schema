# Shared Entity Reference

Tag, Attachment, Division, EquipmentType, PackageType, Note/NoteThread.

## Tag

Tagging system for orders, commodities, inventory items.

| Field | Type | Notes |
|-------|------|-------|
| `tagId` | `int` | PK |
| `organizationId` | `int` | |
| `name` | `string` | |
| `description` | `string?` | |
| `entityName` | `string` | Discriminator: which entity type this tag belongs to |
| `isDeleted` | `bool` | Soft delete |
| `customValues` | `Dictionary` | jsonb |

**Join entities** (all have own `customValues`):
- `OrderTag` — `orderId` + `tagId` + `customValues`
- `CommodityTag` — `commodityId` + `tagId` + `customValues`
- `InventoryItemTag` — `inventoryItemId` + `tagId` + `customValues`

---

## Attachment

File attachments linked to orders, contacts, jobs, etc.

| Field | Type | Notes |
|-------|------|-------|
| `attachmentId` | `int` | PK |
| `attachmentGuid` | `Guid?` | |
| `fileName` | `string` | |
| `fileUri` | `string` | Storage path |
| `fileExtension` | `string` | Computed from fileName |
| `previewUri` | `string?` | |
| `thumbnailUri` | `string?` | |
| `description` | `string?` | |
| `attachmentType` | `AttachmentType` enum | Picture=1, OtherDocument, Avatar, CustomerDocument |
| `parentId` | `string?` | Polymorphic FK (entity ID as string) |
| `parentType` | `AttachmentParentType` enum | None=0, Order=1, Contact=2, AccountingTransaction=3, EquipmentType=4, Job=5, Commodity=6 |
| `status` | `AttachmentStatus` enum | Active=0, PendingUpload=1, UploadFailed=2 |
| `category` | `AttachmentCategory` enum | General=0, FieldValue=1 |
| `organizationId` | `int` | |
| `customValues` | `Dictionary` | jsonb |

### GraphQL Computed

- `isImage`, `isPdf` — computed from extension
- `presignedFileUri`, `presignedPreviewUri`, `presignedThumbnailUri` — signed URLs
- `getPresignedUri(expiresInDays, uriType)` — custom resolver
- `getParentOrder` — resolve parent Order

---

## Division

Organization divisions/branches.

| Field | Type | Notes |
|-------|------|-------|
| `divisionId` | `int` | PK |
| `organizationId` | `int` | |
| `divisionName` | `string` | |
| `email` | `string?` | |
| `phoneNumber` | `string?` | |
| `faxNumber` | `string?` | |
| `streetAndNumber` | `string?` | |
| `city` | `string?` | |
| `stateCode` | `string?` | FK to State |
| `countryCode` | `string?` | FK to Country |
| `zipCode` | `string?` | |
| `portId` | `string?` | FK to Port |
| `comments` | `string?` | |
| `parentDivisionId` | `int?` | Self-referencing FK |
| `assignDivisionToEntities` | `bool` | |
| `useDivisionInDocumentHeaders` | `bool` | |
| `airAmsOriginatorCode` | `string?` | |

**Navigation:** `country`, `state`, `port`, `parentDivision`, `nestedDivisions` (children). No customValues.

---

## EquipmentType

| Field | Type | Notes |
|-------|------|-------|
| `equipmentTypeId` | `int` | PK |
| `organizationId` | `int` | |
| `name` | `string` | |

No customValues. Linked to carriers via `CarrierEquipment` join.

---

## PackageType

| Field | Type | Notes |
|-------|------|-------|
| `packageTypeId` | `int` | PK |
| `organizationId` | `int` | |
| `name` | `string` | |
| `height` | `decimal` | |
| `length` | `decimal` | |
| `width` | `decimal` | |
| `weight` | `decimal` | |
| `maximumWeight` | `decimal` | |
| `volume` | `decimal` | |
| `air` | `bool` | Mode applicability |
| `ground` | `bool` | |
| `ocean` | `bool` | |
| `containerDescriptionCode` | `string?` | FK |
| `containerTypeCode` | `string?` | FK |
| `packageCategoryCode` | `string` | FK |

**Navigation:** `packageCategory`, `containerDescription`, `containerType`. No customValues.

---

## NoteThread

| Field | Type | Notes |
|-------|------|-------|
| `id` | `Guid` | PK |
| `organizationId` | `int` | |
| `name` | `string` | |
| `slug` | `string` | Lowercase identifier |
| `isDeleted` | `bool` | Soft delete |
| `metadata` | `Dictionary` | jsonb (non-nullable, defaults to {}) |

**Collections:** `notes` (one-to-many)

## Note

| Field | Type | Notes |
|-------|------|-------|
| `id` | `Guid` | PK |
| `threadId` | `Guid` | FK to NoteThread |
| `threadName` | `string` | Snapshot of thread name |
| `content` | `Dictionary` | TipTap document format (root type="doc"), max 256KB |
| `mentions` | `[Dictionary]?` | Mentioned users/entities |
| `tags` | `[string]` | Max 20 tags, each max 32 chars |
| `isPinned` | `bool` | |
| `isDeleted` | `bool` | Soft delete |

**Navigation:** `thread` (NoteThread)
