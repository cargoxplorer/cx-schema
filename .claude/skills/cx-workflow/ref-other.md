# Other Tasks Reference

## User & Auth

| Task | Description |
|------|-------------|
| `User/Create` | Create user account |
| `User/Update` | Update user |
| `User/Delete` | Delete user |
| `User/GetVerificationCode` | Get phone verification code |
| `User/GetEmailVerificationCode` | Get email verification code |
| `User/GetResetPasswordToken` | Get password reset token |
| `Authentication/OAuth2` | Execute OAuth2 authentication flow |

```yaml
- task: "Authentication/OAuth2"
  name: Authenticate
  inputs:
    provider: "{{ oauthConfig.provider }}"
    clientId: "{{ oauthConfig.clientId }}"
    clientSecret: "{{ oauthConfig.clientSecret }}"
    tokenUrl: "{{ oauthConfig.tokenUrl }}"
  outputs:
    - name: token
      mapping: "accessToken"
```

## Caching

| Task | Description |
|------|-------------|
| `Caching/SetCache` | Store value in in-memory cache |
| `Caching/GetCache` | Retrieve value from cache |

```yaml
- task: "Caching/SetCache@1"
  name: CacheRate
  inputs:
    key: "rate-{{ inputs.carrierId }}"
    value: "{{ Data.GetRate.rate }}"
    ttl: 3600
```

```yaml
- task: "Caching/GetCache@1"
  name: GetCachedRate
  inputs:
    key: "rate-{{ inputs.carrierId }}"
  outputs:
    - name: rate
      mapping: "value"
```

## EDI & Structured File Parsing

| Task | Description |
|------|-------------|
| `X12/Parse` | Parse X12 EDI documents (850, 856) |
| `EDIFACT/Parse` | Parse EDIFACT messages (IFTMIN) |
| `EDIFACT/Generate` | Generate EDIFACT messages (IFTMIN) |
| `EDI/Parse` | **Deprecated** — alias for X12/Parse, use `X12/Parse` instead |
| `StructuredFile/Parse` | Parse structured files |

```yaml
- task: "X12/Parse@1"
  name: ParseX12
  inputs:
    ediData: "{{ Transfer.Download.content }}"
    transactionSet: "850"
    validateSchema: true
  outputs:
    - name: parsed
      mapping: "document"
```

```yaml
- task: "EDIFACT/Parse@1"
  name: ParseEdifact
  inputs:
    edifactData: "{{ Transfer.Download.content }}"
    messageType: "IFTMIN"
  outputs:
    - name: parsed
      mapping: "document"
```

```yaml
- task: "EDIFACT/Generate@1"
  name: GenerateEdifact
  inputs:
    messageType: "IFTMIN"
    data: "{{ shipmentData }}"
  outputs:
    - name: edifactData
      mapping: "edifactData"
    - name: messageType
      mapping: "messageType"
```

## Flow

| Task | Description |
|------|-------------|
| `Flow/Transition` | Trigger a Flow state transition programmatically |

```yaml
- task: "Flow/Transition@1"
  name: TransitionOrder
  inputs:
    entityName: "Order"
    entityId: "{{ inputs.orderId }}"
    transition: "approve"
```

## Notes

| Task | Description |
|------|-------------|
| `Note/Create` | Create a note |
| `Note/Update` | Update a note |
| `Note/Delete` | Delete a note |
| `NoteThread/Rename` | Rename note thread |
| `Notes/Import` | Bulk import notes |
| `Notes/Export` | Bulk export notes |

## App Module

| Task | Description |
|------|-------------|
| `AppModule/Create` | Create app module |
| `AppModule/Update` | Update app module |
| `AppModule/Delete` | Delete app module |

## Action Events

| Task | Description |
|------|-------------|
| `ActionEvent/Create` | Create action event (triggers UI notifications or webhook) |

```yaml
- task: "ActionEvent/Create"
  name: NotifyUser
  inputs:
    eventName: "OrderStatusChanged"
    data:
      orderId: "{{ inputs.orderId }}"
      newStatus: "{{ Data.GetOrder.order.status }}"
```
