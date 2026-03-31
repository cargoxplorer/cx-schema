# Geography & Lookup Entity Reference

## Contents
- Country
- State
- City
- PostalCode
- Port
- Vessel
- CustomCode
- ModeOfTransportation

Country, State, City, PostalCode, Port, Vessel, CustomCode, ModeOfTransportation.

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
| `timeZone` | `string?` | IANA timezone ID (e.g., `America/Chicago`) |
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
