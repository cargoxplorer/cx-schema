# Entity CRUD Tasks Reference

All entity tasks follow the `Namespace/Operation@Version` pattern. Outputs are stored as `ActivityName.StepName.outputKey`.

## Generic Entity Change

| Task | Description |
|------|-------------|
| `Entity/Change` | Generic entity change (works for any entity type) |

## Order

| Task | Description |
|------|-------------|
| `Order/Create` | Create a new order |
| `Order/Update` (v1, v2) | Update order fields |
| `Order/Delete` | Delete an order |
| `Order/Get` | Get order by ID |
| `Order/Copy` | Copy/duplicate an order |
| `Order/Split` | Split order into multiple |
| `Order/Purge` | Purge order data |
| `Order/Import` | Import order from external data |
| `Order/RecalculateCharges` | Recalculate all charges |
| `Order/GenerateTrackingNumber` | Generate tracking number |
| `Order/GetCargoMovementByPalletQuery` | Query cargo movements by pallet |

```yaml
- task: "Order/Create@1"
  name: CreateOrder
  inputs:
    orderType: "ParcelShipment"
    entity:
      customer: "{{ inputs.customerId }}"
      status: "Draft"
  outputs:
    - name: order
      mapping: "order"
```

```yaml
- task: "Order/Update@2"
  name: UpdateOrder
  inputs:
    orderId: "{{ inputs.orderId }}"
    entity:
      status: "Active"
      notes: "Updated by workflow"
```

## Contact

| Task | Description |
|------|-------------|
| `Contact/Create` | Create contact |
| `Contact/Update` | Update contact |
| `Contact/Delete` | Delete contact |

## Contact Address

| Task | Description |
|------|-------------|
| `ContactAddress/Create` | Create address |
| `ContactAddress/Update` | Update address |
| `ContactAddress/Delete` | Delete address |
| `ContactAddress/Import` | Bulk import addresses |

## Contact Payment Method

| Task | Description |
|------|-------------|
| `ContactPaymentMethod/Create` | Create payment method |
| `ContactPaymentMethod/Update` | Update payment method |
| `ContactPaymentMethod/SendChargedAmount` | Send charged amount notification |
| `ContactPaymentMethod/VerifyChargedAmount` | Verify charged amount |

## Commodity

| Task | Description |
|------|-------------|
| `Commodity/Create` | Create commodity |
| `Commodity/Update` (v1, v2) | Update commodity |
| `Commodity/Split` | Split commodity into multiple |
| `Commodity/Repack` | Repack commodities |
| `Commodity/Unpack` | Unpack commodity |

## Commodity Tracking Number

| Task | Description |
|------|-------------|
| `CommodityTrackingNumber/Create` | Create tracking number |
| `CommodityTrackingNumber/Update` | Update tracking number |
| `CommodityTrackingNumber/Delete` | Delete tracking number |

## Job

| Task | Description |
|------|-------------|
| `Job/Create` | Create job |
| `Job/Update` | Update job |
| `Job/Delete` | Delete job |
| `Job/Assign` | Assign job to user/driver |
| `Job/Unassign` | Unassign job |

## Charge

| Task | Description |
|------|-------------|
| `Charge/Create` | Create charge |
| `Charge/Update` | Update charge |
| `Charge/Delete` | Delete charge |
| `Charge/DynamicUpdate` | Dynamic update (partial fields) |
| `Charge/Calculate` | Calculate charge amount |

```yaml
- task: "Charge/Create@1"
  name: CreateCharge
  inputs:
    orderId: "{{ inputs.orderId }}"
    chargeType: "Freight"
    amount: "{{ Data.GetRate.rate.amount }}"
    currency: "USD"
  outputs:
    - name: charge
      mapping: "charge"
```

## Discount

| Task | Description |
|------|-------------|
| `Discount/Update` | Update discount |

## Order Sub-Entities

| Task | Description |
|------|-------------|
| `OrderCommodity/Create` | Link commodity to order |
| `OrderCommodity/Update` | Update order-commodity link |
| `OrderCommodity/Delete` | Remove commodity from order |
| `OrderCharge/Create` | Create order charge |
| `OrderDocument/Create` | Create order document |
| `OrderDocument/Send` | Send order document |
| `OrderTrackingEvent/Create` | Create tracking event |
| `OrderEntity/ChangeCustomValue` | Change custom field value |

## Inventory

| Task | Description |
|------|-------------|
| `InventoryItem/Create` | Create inventory item |
| `InventoryItem/Update` | Update inventory item |
| `InventoryItem/Delete` | Delete inventory item |

## Other

| Task | Description |
|------|-------------|
| `Movement/Create` | Create cargo movement |
| `Country/Create`, `Country/Update`, `Country/Delete` | Country CRUD |
| `Cities/Import` | Import cities |
| `Rate/Update` | Update rate |
| `TrackingEvent/Import` | Import tracking events |
