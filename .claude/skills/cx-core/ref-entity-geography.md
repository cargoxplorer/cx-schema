# Geography & Lookup Entity Reference

## Contents
- Country
- State
- City
- Port
- Vessel
- CustomCode
- ModeOfTransportation

Country, State, City, Port, Vessel, CustomCode, ModeOfTransportation.

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
