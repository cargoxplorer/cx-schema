# Rate, Pricing & Accounting Lookup Reference

## Rate

Carrier/vendor rates with tariff rules.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `rateId` | `int` | PK |
| `organizationId` | `int` | |
| `rateNumber` | `string?` | |
| `rateType` | `RateType` enum | StandardClientRate=0, ClientRate=1, CarrierRate=2, CommissionRate=3 |
| `carrierId` | `int?` | FK to Contact |
| `clientId` | `int?` | FK to Contact |
| `currencyId` | `int?` | FK to Currency |
| `accountingItemId` | `int?` | FK to AccountingItem |
| `modeOfTransportationId` | `int?` | FK |
| `commodityTypeId` | `int?` | FK |
| `effectiveDate` | `DateTime?` | |
| `expirationDate` | `DateTime?` | |
| `contractNumber` | `string?` | |
| `amendmentNumber` | `string?` | |
| `transitDaysMin` | `int?` | |
| `transitDaysMax` | `int?` | |
| `serviceType` | `ServiceType?` enum | PortToDoor=1, DoorToDoor=2, DoorToPort=3, PortToPort=4 |
| `frequency` | `Frequency?` enum | Daily=1, Weekly=2, Biweekly=3, Monthly=4, Other=5 |
| `automaticallyCreateCharge` | `bool` | |
| `isHazardous` | `bool?` | |
| `notes` | `string?` | |
| `tariff` | `TariffOptions` | JSON object (see below) |
| `routeId` | `int?` | FK to Route |
| `routeLegId` | `int?` | FK to RouteLeg |
| `customValues` | `Dictionary` | jsonb |

### Port References (on Rate)

| Field | Type |
|-------|------|
| `portOfReceiptId` | `string?` → Port |
| `portOfLoadingId` | `string?` → Port |
| `portOfUnloadingId` | `string?` → Port |
| `portOfDeliveryId` | `string?` → Port |
| `countryOfOriginCode` | `string?` → Country |
| `countryOfDestinationCode` | `string?` → Country |

### TariffOptions (JSON object)

| Field | Type | Notes |
|-------|------|-------|
| `baseCharge` | `decimal?` | |
| `minimum` | `decimal?` | |
| `maximum` | `decimal?` | |
| `rateMultiplier` | `decimal?` | |
| `ratePer` | `decimal?` | |
| `applyBy` | `ApplyBy?` enum | Pieces, Weight, ChargeableWeight, Volume, Container, Calculated, FlatRate |
| `unitType` | `Units?` enum | Ft, Vlb, Vkg, M, Lb, Kg |
| `ratePerType` | `RatePerType?` enum | Unit, Range |
| `calculatedOf` | `CalculatedOfTypes?` enum | Income, Expense, Profit, IncomeFreight |
| `percentageOfType` | `PercentageOfType?` enum | Cost, Income, Profit |
| `minimumChargeableWeight` | `decimal?` | |
| `minimumWeight` | `decimal?` | |
| `maximumWeight` | `decimal?` | |
| `rateData` | `[{rateIndex, rateValue, packageTypeId}]` | |

---

## Lane

Shipping lanes linking origin/destination.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | `int` | PK |
| `organizationId` | `int` | |
| `contactId` | `int` | FK to Contact |
| `description` | `string?` | |
| `originPortId` | `string?` | FK to Port |
| `destinationPortId` | `string?` | FK to Port |
| `originCityId` | `int?` | FK to City |
| `destinationCityId` | `int?` | FK to City |
| `customValues` | `Dictionary` | jsonb |

### Navigation

`contact`, `originPort`, `destinationPort`, `originCity`, `destinationCity`, `modeOfTransportations` (M2M)

---

## Discount

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `discountId` | `int` | PK |
| `organizationId` | `int` | |
| `name` | `string?` | |
| `promoCode` | `string?` | |
| `description` | `string?` | |
| `type` | `DiscountType` enum | Percentage=1, FixedAmount=2 |
| `value` | `decimal` | Percentage or fixed amount |
| `startDate` | `DateTime` | |
| `endDate` | `DateTime` | |
| `isActive` | `bool` | |
| `usageLimit` | `int?` | Max times discount can be used |
| `usedCount` | `int` | |
| `activationLimit` | `int?` | |
| `activationCount` | `int` | |
| `minimumChargeAmount` | `decimal?` | |
| `minimumWeight` | `decimal?` | |
| `minimumWeightUnit` | `WeightUnit?` | Lb, Kg |
| `accountingItemId` | `int` | FK |
| `targetContactTags` | `[string]` | Tag-based targeting |
| `customValues` | `Dictionary` | jsonb |

### Navigation

`carriers` (M2M via ContactDiscount), `transportationModes` (M2M), `destinationCountries` (M2M), `validationWorkflows` (M2M)

---

## AccountingItem

Chart of accounts line items.

| Field | Type | Notes |
|-------|------|-------|
| `accountingItemId` | `int` | PK |
| `organizationId` | `int` | |
| `itemCode` | `string?` | |
| `description` | `string` | |
| `itemType` | `ItemType` enum | Other=0, Freight=1, Valuation=2, Tax=3, OtherFreight=4, Inventory=5 |
| `price` | `decimal?` | |
| `accountId` | `int` | FK to AccountingAccount |
| `salesTaxId` | `int?` | FK to SalesTax |
| `tariff` | `TariffOptions?` | Same JSON as Rate |
| `isInactive` | `bool` | |
| `customValues` | `Dictionary` | jsonb |

---

## AccountingAccount

| Field | Type | Notes |
|-------|------|-------|
| `accountId` | `int` | PK |
| `organizationId` | `int` | |
| `accountName` | `string` | |
| `accountNumber` | `string?` | |
| `accountType` | `AccountType` enum | AccountReceivable=1, AccountPayable=2 |
| `parentAccountId` | `int?` | Self-referencing FK |
| `isInactive` | `bool` | |

No customValues.

---

## PaymentTerm

| Field | Type | Notes |
|-------|------|-------|
| `paymentTermId` | `int` | PK |
| `organizationId` | `int` | |
| `description` | `string` | |
| `netDueDays` | `int` | Days until due |
| `discountPaidWithinDays` | `int?` | Early payment discount window |
| `discountPercentage` | `int?` | Early payment discount % |
| `isInactive` | `bool` | |

No customValues.
