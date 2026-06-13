# Geography & Lookup Entity Reference

## Contents
- Country
- State
- City
- PostalCode
- Port
- Terminal
- Vessel
- CustomCode
- ModeOfTransportation

Country, State, City, PostalCode, Port, Terminal, Vessel, CustomCode, ModeOfTransportation.

## Country

Composite key: `organizationId` + `countryCode`.

| Field | Type | Notes |
|-------|------|-------|
| `countryCode` | `string` | PK part (ISO code) |
| `organizationId` | `int` | PK part |
| `name` | `string` | |
| `customValues` | `Dictionary` | jsonb |

**Collections:** `states`

---

## State

Composite key: `organizationId` + `countryCode` + `stateCode`.

| Field | Type | Notes |
|-------|------|-------|
| `stateCode` | `string` | PK part |
| `countryCode` | `string` | PK part, FK to Country |
| `organizationId` | `int` | PK part |
| `name` | `string` | |
| `customValues` | `Dictionary` | jsonb |

**Navigation:** `country`

---

## City

| Field | Type | Notes |
|-------|------|-------|
| `cityId` | `int` | PK |
| `organizationId` | `int` | |
| `cityName` | `string` | |
| `stateCode` | `string` | FK to State |
| `countryCode` | `string` | FK to Country |
| `longitude` | `double?` | From Location.X (GraphQL) |
| `latitude` | `double?` | From Location.Y (GraphQL) |
| `customValues` | `Dictionary` | jsonb |

**Navigation:** `state`, `country`

---

## PostalCode

PK: `id` (int, auto). Scoped per organization.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `int` | PK |
| `organizationId` | `int` | |
| `code` | `string` | Postal/zip code value |
| `countryCode` | `string` | FK to Country |
| `placeName` | `string` | Place/city name |
| `stateCode` | `string?` | FK to State |
| `accuracy` | `AccuracyTypes?` | 1=Region, 2=Municipality, 3=Neighborhood, 4=Place, 5=Street, 6=Centroid |
| `timeZone` | `string?` | IANA timezone ID (e.g., `America/Chicago`). GraphQL auto-resolves from GPS coordinates when not stored |
| `longitude` | `double?` | From Location.X (GraphQL computed) |
| `latitude` | `double?` | From Location.Y (GraphQL computed) |
| `customValues` | `Dictionary` | jsonb |
| `location` | `Point?` | WGS 84 (SRID 4326). X=longitude, Y=latitude |

**Navigation:** `country`, `state`

**Mutations:** `ChangeCode`, `ChangePlaceName`, `ChangeCoordinates(lat, lng, accuracy)`, `ChangeCountry`/`ChangeCountryCode`, `ChangeState`/`ChangeStateCode`, `ChangeTimeZone`, `ChangeCustomValues`, `ChangeLatitude`, `ChangeLongitude`

---

## Port

String-based PK (e.g., UN/LOCODE).

| Field | Type | Notes |
|-------|------|-------|
| `portId` | `string` | PK |
| `organizationId` | `int` | |
| `name` | `string` | |
| `countryCode` | `string` | FK to Country |
| `stateCode` | `string?` | FK to State |
| `isAir` | `bool` | Mode flags |
| `isMariTime` | `bool` | |
| `isRoad` | `bool` | |
| `isRail` | `bool` | |
| `isMail` | `bool` | |
| `isBorderCrossingPoint` | `bool` | |
| `isMyCompany` | `bool` | |
| `portRemarks` | `string?` | |
| `customValues` | `Dictionary` | jsonb |

**Navigation:** `country`, `state`

---

## Terminal

Organization-scoped terminal / operating location (facility record). Optional Port linkage. Soft deleted; codes are unique only among active terminals in the same organization.

| Field | Type | Notes |
|-------|------|-------|
| `terminalId` | `int` | PK |
| `organizationId` | `int` | Required; tenant scope |
| `name` | `string` | Required display name |
| `code` | `string?` | Optional; unique per organization when not null and `isDeleted=false` |
| `portId` | `string?` | Optional FK to Port (`organizationId` + `portId`) |
| `customValues` | `Dictionary` | jsonb; searchable |
| `isDeleted` | `bool` | Soft delete flag; default false; default queries filter deleted rows |
| `created` / `createdBy` | `DateTime` / `string` | Audit fields |
| `lastModified` / `lastModifiedBy` | `DateTime` / `string` | Audit fields |

**Navigation:** `organization`, `port`, `createdUser`, `updatedUser`

**GraphQL:** `terminal(organizationId, terminalId)`, `terminals(organizationId, filter, search, orderBy)`, `createTerminal`, `updateTerminal`, `deleteTerminal`.

**Search:** `name`, `code`, and `customValues`.

---

## Vessel

| Field | Type | Notes |
|-------|------|-------|
| `vesselId` | `int` | PK |
| `organizationId` | `int` | |
| `name` | `string` | |
| `vesselCode` | `string?` | |
| `carrierId` | `int?` | FK to Contact (carrier) |
| `countryCode` | `string?` | FK to Country (flag state) |

**Navigation:** `carrier`, `country`. No customValues.

---

## CustomCode

Organization-specific lookup codes (Schedule D, Schedule K, etc.).

| Field | Type | Notes |
|-------|------|-------|
| `id` | `int` | PK |
| `organizationId` | `int` | |
| `code` | `string` | |
| `description` | `string` | |
| `isCommonlyUsed` | `bool` | |
| `codeType` | `CustomCodeTypes` enum | ScheduleD, ScheduleK |

No customValues.

---

## ModeOfTransportation

| Field | Type | Notes |
|-------|------|-------|
| `modeOfTransportationId` | `int` | PK |
| `organizationId` | `int` | |
| `description` | `string` | e.g., "Air", "Ocean", "Ground" |
| `customValues` | `Dictionary` | jsonb |

Referenced by Rate, Lane, Discount, and Order (via `customValues.modeOfTransportationId`).
