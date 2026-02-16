# Query, Validation & Workflow Tasks Reference

## Query/GraphQL

Executes internal GraphQL queries against the CX backend. The query runs via MediatR to the internal GraphQL engine.

```yaml
- task: "Query/GraphQL"
  name: GetOrder
  inputs:
    query: |
      query($organizationId: Int!, $orderId: Int!) {
        order(organizationId: $organizationId, orderId: $orderId) {
          orderId
          orderNumber
          status
          customer {
            contactId
            name
          }
        }
      }
    variables:
      organizationId: "{{ organizationId }}"
      orderId: "{{ inputs.orderId }}"
  outputs:
    - name: order
      mapping: "order"
```

The query result is a dictionary. The `mapping` path extracts from the result. Output stored at `ActivityName.GetOrder.order`.

**Notes**:
- `organizationId` is always available as a system variable
- Variables support template expressions: `"{{ int organizationId }}"`
- Multiple queries can be in one step (returns merged results)

## Validation/Validate@1

Validates data against rules. Commonly used in Before entity triggers to block invalid changes.

```yaml
- task: "Validation/Validate@1"
  name: ValidateOrder
  inputs:
    rules:
      - field: "status"
        condition: "[Data.GetOrder.order.status] != 'Cancelled'"
        message: "Cannot modify cancelled orders"
      - field: "amount"
        condition: "[Data.GetOrder.order.amount] > 0"
        message: "Amount must be positive"
```

If validation fails, execution stops and error is returned to the caller.

## Workflow/Execute

Executes a child workflow. Can run sync (wait for result) or async (fire and forget).

```yaml
- task: "Workflow/Execute@1"
  name: RunChild
  inputs:
    workflowId: "<uuid>"
    workflowInputs:
      orderId: "{{ inputs.orderId }}"
      customerId: "{{ Data.GetOrder.order.customer.contactId }}"
```

The child workflow's outputs are available as step outputs: `ActivityName.RunChild.outputName`.

**Circular call detection**: The executor maintains a call stack and throws if a workflow calls itself recursively.

## Workflow/Create, Workflow/Update, Workflow/Delete

CRUD operations on workflow definitions (not executions). Rarely used in standard workflows.

```yaml
- task: "Workflow/Create"
  name: CreateWorkflow
  inputs:
    name: "Generated Workflow"
    document: "{{ workflowYaml }}"
```
