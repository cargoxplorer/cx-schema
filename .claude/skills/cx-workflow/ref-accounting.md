# Accounting, Payment & Finance Tasks Reference

## Accounting Transactions

| Task | Description |
|------|-------------|
| `AccountingTransaction/Generate` | Generate Invoice, Bill, or CreditMemo |
| `AccountingTransaction/Update` | Update accounting transaction |
| `AccountingTransaction/ApplyCreditToInvoices` | Apply credit memo to outstanding invoices |

```yaml
- task: "AccountingTransaction/Generate@1"
  name: GenerateInvoice
  inputs:
    orderId: "{{ inputs.orderId }}"
    transactionType: "Invoice"
  outputs:
    - name: invoice
      mapping: "transaction"
```

```yaml
- task: "AccountingTransaction/ApplyCreditToInvoices@1"
  name: ApplyCredit
  inputs:
    creditMemoId: "{{ inputs.creditMemoId }}"
    invoiceIds:
      - "{{ Data.GetInvoices.invoice1.id }}"
      - "{{ Data.GetInvoices.invoice2.id }}"
```

## Payment

| Task | Description |
|------|-------------|
| `Payment/Create` | Create a payment record |

```yaml
- task: "Payment/Create@1"
  name: CreatePayment
  inputs:
    orderId: "{{ inputs.orderId }}"
    amount: "{{ inputs.amount }}"
    paymentMethod: "{{ inputs.paymentMethod }}"
  outputs:
    - name: payment
      mapping: "payment"
```

## Number Generation

| Task | Description |
|------|-------------|
| `Number/Generate` | Generate sequential number (e.g., invoice numbers) |
| `SequenceNumber/Get` | Get next sequence number |

```yaml
- task: "Number/Generate@1"
  name: GenInvoiceNumber
  inputs:
    format: "INV-{0:D6}"
    sequenceName: "invoice"
  outputs:
    - name: number
      mapping: "number"
```
