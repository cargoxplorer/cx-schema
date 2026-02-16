# Contact Entity Field Reference

Field names as used in workflow expressions: `{{ entity.name }}`, `{{ entity.customValues.myField }}`.

## Scalar Fields

| Field | Type | Notes |
|-------|------|-------|
| `contactId` | `int` | Primary key |
| `organizationId` | `int` | Tenant scope |
| `name` | `string` | Required. Company/display name |
| `contactFirstName` | `string?` | |
| `contactLastName` | `string?` | |
| `contactType` | `ContactType` enum | See enum below |
| `accountNumber` | `string?` | |
| `emailAddress` | `string?` | |
| `phoneNumber` | `string?` | |
| `mobilePhoneNumber` | `string?` | |
| `faxNumber` | `string?` | |
| `website` | `string?` | |
| `idNumber` | `string?` | EIN, DUNS, etc. |
| `idNumberType` | `IDNumberType?` enum | EIN, DUNS, ForeignEntityId, Other |
| `divisionId` | `int` | Primary division FK |
| `paymentTermId` | `int?` | FK to PaymentTerm |
| `creditLimit` | `decimal?` | |
| `paidAs` | `PaidAs?` enum | Prepaid, Collect |
| `isACorporation` | `bool?` | |
| `isDeleted` | `bool` | Soft delete flag |
| `contactStatusId` | `int?` | FK to ContactStatus |
| `entityTypeId` | `int?` | FK to EntityType |
| `parentContactId` | `int?` | Self-referencing FK |
| `tags` | `[string]` | String array |
| `created` | `DateTime` | |
| `createdBy` | `string` | User ID |
| `lastModified` | `DateTime` | |
| `lastModifiedBy` | `string` | User ID |

## Navigation Properties

| Field | Type | Notes |
|-------|------|-------|
| `division` | `Division` | Primary division |
| `paymentTerm` | `PaymentTerm` | |
| `contactStatus` | `ContactStatus` | `.statusName`, `.statusStage` (Active/Inactive) |
| `entityType` | `EntityType` | |
| `parentContact` | `Contact` | Self-referencing parent |
| `createdUser` | `User` | |
| `updatedUser` | `User` | |

## Collection Properties

| Field | Type | Notes |
|-------|------|-------|
| `contactAddresses` | `[ContactAddress]` | Addresses with types (Billing, Shipping, Other) |
| `contacts` | `[Contact]` | Linked contacts (TO this contact) |
| `linksToContacts` | `[Contact]` | Contacts this one links TO |
| `contactLinks` | `[ContactLink]` | Link details (type: ParentContact, FactoringCompany, SalesPerson) |
| `equipmentTypes` | `[EquipmentType]` | Carrier only |
| `discounts` | `[Discount]` | Via ContactDiscount join |
| `rates` | `[Rate]` | Carrier rates |
| `additionalDivisions` | `[Division]` | Beyond primary division |
| `orders` | `[Order]` | Via OrderCarrier |

## Computed/Resolved GraphQL Fields

| Field | Returns | Notes |
|-------|---------|-------|
| `getContactAddressByType(addressType)` | `[ContactAddress]` | Filter by "Billing", "Shipping", "Other" |
| `getFirstContactAddressByType(addressType)` | `ContactAddress` | First match |
| `getContactAttachments(filter, orderBy)` | `[Attachment]` | |
| `getCustomValuesAttachment(filter)` | `Attachment` | From customValues `attachmentId` key |
| `availableCredit` | `[AvailableCreditByCurrency]` | Carrier/Customer only |
| `changeHistory(startDate, endDate, maxResults)` | `[ChangeHistory]` | Audit trail |

## ContactType Enum

| Value | Int | Notes |
|-------|-----|-------|
| `Customer` | 1 | Can have accounting |
| `Carrier` | 2 | Can have accounting, equipment types |
| `Vendor` | 3 | |
| `Contact` | 4 | Generic, must have linked contact |
| `Driver` | 5 | |
| `Employee` | 6 | Can have user account |
| `SalesPerson` | 7 | |
| `ForwardingAgent` | 8 | |
| `FactoringCompany` | 9 | |
| `Lead` | 10 | |
| `PoolPoint` | 11 | |
| `DistributionCenter` | 12 | |
| `Store` | 13 | |
| `ContactUser` | 14 | User associated with contact |
| `USPPI` | 15 | US Principal Party in Interest |

## ContactAddress Sub-Entity

| Field | Type | Notes |
|-------|------|-------|
| `contactAddressId` | `int` | PK |
| `addressLine` | `string?` | |
| `addressLine2` | `string?` | |
| `addressType` | `AddressType` enum | Billing=1, Shipping=2, Other=3 |
| `cityName` | `string?` | |
| `countryCode` | `string?` | FK to Country |
| `stateCode` | `string?` | FK to State |
| `postalCode` | `string?` | |
| `isInactive` | `bool?` | |
| `latitude` | `double?` | From Location.Y (GraphQL resolved) |
| `longitude` | `double?` | From Location.X (GraphQL resolved) |
| `customValues` | `Dictionary` | Own customValues (separate from Contact) |
| `country` | `Country` | Navigation |
| `state` | `State` | Navigation |

GraphQL resolver: `formattedAddress(outputFormat, addressFormat, lang, multiline)` — formatted string.

## Other Related Enums

| Enum | Values |
|------|--------|
| `IDNumberType` | EIN, DUNS, ForeignEntityId, Other |
| `PaidAs` | Prepaid, Collect |
| `AddressType` | Billing=1, Shipping=2, Other=3 |
| `ContactLinkType` | ParentContact=1, FactoringCompany, SalesPerson, ContactAddressLink |
| `ContactStatusStage` | Active=0, Inactive=1 |
| `PaymentType` | Card=1, AccountCredit=2, Cash=3, Check=4, BankTransfer=5, Other=7 |

## CustomValues

`Dictionary<string, object?>` stored as PostgreSQL `jsonb`. Access in workflows:

```yaml
# Template expressions
value: "{{ entity.name }}"
value: "{{ entity.customValues.myField }}"

# Access contact address
address: "{{ entity.contactAddresses[0].addressLine }}"

# NCalc conditions
conditions:
  - expression: "[entity.contactType] = 'Customer'"

# Update via Contact/Update task
inputs:
  contactId: "{{ entity.contactId }}"
  contact:
    CustomValues.myField: "newValue"
```

**Entities with own customValues:**
- `Contact.customValues` — contact-level custom fields
- `ContactAddress.customValues` — address-level custom fields
- `ContactPaymentMethod.customValues` — payment method custom fields
