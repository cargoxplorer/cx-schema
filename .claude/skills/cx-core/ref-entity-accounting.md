# Accounting Transaction Entity Field Reference

Field names as used in workflow expressions: `{{ entity.transactionNumber }}`, `{{ entity.customValues.myField }}`.

## AccountingTransaction Fields

### Scalar Fields

| Field | Type | Notes |
|-------|------|-------|
| `accountingTransactionId` | `int` | Primary key |
| `organizationId` | `int` | Tenant scope |
| `divisionId` | `int` | Division scope |
| `transactionNumber` | `string` | Business-facing number |
| `transactionDate` | `DateTime` | Date of transaction |
| `dueDate` | `DateTime` | Payment due date |
| `paidDate` | `DateTime?` | When fully paid |
| `accountingTransactionType` | `AccountingTransactionType` enum | Invoice, Bill, CreditMemo |
| `accountingTransactionStatus` | `AccountingTransactionStatus` enum | Open, Paid, Void |
| `amountDue` | `decimal` | Charges total minus payments |
| `amountPaid` | `decimal` | Sum of applied payments |
| `paidAs` | `PaidAs` enum | Prepaid, Collect |
| `isDraft` | `bool` | Not yet submitted |
| `note` | `string?` | |
| `accountId` | `int?` | FK to AccountingAccount |
| `applyToContactID` | `int?` | FK to Contact (customer/vendor) |
| `billToContactAddressId` | `int?` | FK to ContactAddress |
| `paymentTermsId` | `int?` | FK to PaymentTerm |
| `created` | `DateTime` | |
| `createdBy` | `string` | User ID |
| `lastModified` | `DateTime` | |
| `lastModifiedBy` | `string` | User ID |

### Navigation Properties

| Field | Type | Notes |
|-------|------|-------|
| `applyToContact` | `Contact` | Customer or vendor |
| `billToContactAddress` | `ContactAddress` | Billing address |
| `division` | `Division` | |
| `organization` | `Organization` | |
| `paymentTerm` | `PaymentTerm` | |
| `account` | `AccountingAccount` | |
| `createdUser` | `User` | |
| `updatedUser` | `User` | |

### Collection Properties

| Field | Type | Notes |
|-------|------|-------|
| `charges` | `[Charge]` | Via AccountingTransactionCharges join |
| `payments` | `[Payment]` | Via AccountingTransactionPayment join |
| `jobs` | `[Job]` | Via JobAccountingTransaction join |

### Computed/Resolved GraphQL Fields

| Field | Returns | Notes |
|-------|---------|-------|
| `getChargesTotalAmount` | `decimal` | Sum of non-void charges |
| `getAmountDue` | `decimal` | Charges total minus amountPaid |
| `getRelatedOrders(filter, orderBy)` | `[Order]` | Orders linked via charges |
| `getRelatedOrdersByOrderType(orderType)` | `[Order]` | Filtered by order type |
| `getRelatedOrderByOrderType(orderType)` | `Order` | First match |
| `changeHistory(startDate, endDate, maxResults)` | `[ChangeHistory]` | Audit trail |

---

## Charge Entity

| Field | Type | Notes |
|-------|------|-------|
| `chargeId` | `int` | Primary key |
| `organizationId` | `int?` | |
| `description` | `string?` | |
| `chargeType` | `ChargeType` enum | Income, Expense, Credit |
| `chargeStatus` | `ChargeStatus` enum | Pending, Open, Posted, Paid, Void |
| `amount` | `decimal` | Calculated: `quantity * price` |
| `price` | `decimal` | Unit price |
| `quantity` | `decimal` | |
| `unit` | `string?` | e.g., "TV", "Pallet", "Kg" |
| `applyBy` | `ApplyBy` enum | Pieces, Weight, ChargeableWeight, Volume, Container, Calculated, FlatRate |
| `applyToContactId` | `int` | FK to Contact (who pays) |
| `paidAs` | `PaidAs` enum | Prepaid, Collect |
| `currencyId` | `int` | FK to Currency |
| `accountingItemId` | `int` | FK to AccountingItem |
| `salesTaxId` | `int?` | FK to SalesTax |
| `salesTaxRate` | `decimal` | |
| `salesTaxAmount` | `decimal` | Computed: `salesTaxRate * amount` |
| `totalAmount` | `decimal` | Computed: `amount + salesTaxAmount` |
| `showInDocuments` | `bool` | |
| `isConsolidated` | `bool` | |
| `allowAutomaticUpdate` | `bool` | |
| `note` | `string?` | |
| `rateId` | `int?` | FK to Rate |
| `customValues` | `Dictionary` | Own customValues |

**Navigation:** `applyToContact`, `currency`, `accountingItem`, `salesTax`, `rate`, `orders` (many-to-many)

---

## Payment Entity

| Field | Type | Notes |
|-------|------|-------|
| `paymentId` | `int` | Primary key |
| `organizationId` | `int` | |
| `divisionId` | `int` | |
| `applyToContactId` | `int` | FK to Contact |
| `amountReceived` | `decimal` | Total payment amount |
| `currencyId` | `int` | FK to Currency |
| `paymentDate` | `DateTime` | |
| `checkNumber` | `string` | |
| `memo` | `string` | |
| `accountingAccountId` | `int` | FK to AccountingAccount |
| `paymentStatus` | `PaymentStatus` enum | Posted=1, Void=2 |
| `customValues` | `Dictionary` | Own customValues |

**Navigation:** `applyToContact`, `currency`, `accountingAccount`, `division`, `organization`, `accountingTransactions` (many-to-many)

**Join entity `AccountingTransactionPayment`** has `amountApplied` field — the amount from this payment applied to a specific transaction.

---

## Enums

### AccountingTransactionType
| Value | Int | Description |
|-------|-----|-------------|
| `Invoice` | 0 | Revenue — billed to customer |
| `Bill` | 1 | Expense — owed to vendor |
| `CreditMemo` | 2 | Credit adjustment |

### AccountingTransactionStatus
`Open=0`, `Paid=1`, `Void=2`

### ChargeType
`Income`, `Expense`, `Credit`

### ChargeStatus
`Pending`, `Open`, `Posted`, `Paid`, `Void`

### ApplyBy
`Pieces`, `Weight`, `ChargeableWeight`, `Volume`, `Container`, `Calculated`, `FlatRate`

### PaymentStatus
`Posted=1`, `Void=2`

### PaidAs
`Prepaid=0`, `Collect=1`

---

## CustomValues

`Dictionary<string, object?>` stored as PostgreSQL `jsonb`. Present on:
- `AccountingTransaction.customValues`
- `Charge.customValues`
- `Payment.customValues`

```yaml
# Access in workflow expressions
invoiceNumber: "{{ entity.transactionNumber }}"
customerName: "{{ entity.applyToContact.name }}"
customField: "{{ entity.customValues.myField }}"

# Charge access via collection
chargeAmount: "{{ entity.charges[0].amount }}"

# NCalc conditions
conditions:
  - expression: "[entity.accountingTransactionStatus] = 'Open'"
  - expression: "[entity.amountDue] > 0"
```
