# Other Tasks Reference

## Contents
- User & Auth tasks (User CRUD, verification codes, OAuth2 authentication)
- Caching tasks (SetCache and GetCache for in-memory key-value storage)
- EDI & Structured File Parsing tasks (EDI/Parse for X12/EDIFACT, StructuredFile/Parse)
- Flow/Transition task (trigger state machine transitions programmatically)
- Note tasks (Create, Update, Delete, NoteThread/Rename, bulk Import/Export)
- AppModule tasks (Create, Update, Delete app modules)
- ActionEvent/Create task (trigger UI notifications or webhooks)

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
| `EDI/Parse` | Parse EDI documents (X12, EDIFACT) |
| `StructuredFile/Parse` | Parse structured files |

```yaml
- task: "EDI/Parse@1"
  name: ParseEdi
  inputs:
    content: "{{ Transfer.Download.content }}"
    format: "X12"
  outputs:
    - name: parsed
      mapping: "document"
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
