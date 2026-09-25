# Communication & Document Tasks Reference

## Contents
- Email/Send task (send emails with templates and attachments)
- Email/VerifyCode task (send and verify email verification codes)
- Document/Render task (render PDF or Excel from HTML templates)
- Document/Send task (send a previously rendered document)
- Attachment tasks (Create, Update, Link, Unlink, Thumbnail, PdfThumbnail, RegenerateThumbnails)
- PdfDocument/Merge task (merge multiple PDFs into one)

## Email/Send

Sends emails with optional templates and attachments.

```yaml
- task: "Email/Send"
  name: SendNotification
  inputs:
    to: "{{ recipient.email }}"
    cc: ["manager@example.com"]
    subject: "Order {{ orderNumber }} Updated"
    body: "<p>Your order status changed to {{ status }}.</p>"
```

With template:
```yaml
- task: "Email/Send"
  name: SendTemplated
  inputs:
    to: "{{ Data.GetOrder.order.customer.email }}"
    template: "order-status-notification"
    templateData:
      orderId: "{{ Data.GetOrder.order.orderId }}"
      orderNumber: "{{ Data.GetOrder.order.orderNumber }}"
      status: "{{ Data.GetOrder.order.status }}"
```

With attachment:
```yaml
- task: "Email/Send"
  name: SendWithDoc
  inputs:
    to: "{{ recipient.email }}"
    subject: "Your Invoice"
    body: "<p>Please find your invoice attached.</p>"
    attachments:
      - fileName: "invoice.pdf"
        content: "{{ GenerateDoc.Render.document }}"
        contentType: "application/pdf"
```

## Email/VerifyCode

Sends and verifies email verification codes.

```yaml
- task: "Email/VerifyCode"
  name: VerifyEmail
  inputs:
    email: "{{ inputs.email }}"
    code: "{{ inputs.verificationCode }}"
```

## Document/Render

Renders documents from HTML templates. Supports PDF (handlebars + chrome-pdf) and Excel (jsrender + html-to-xlsx).

**PDF rendering:**
```yaml
- task: "Document/Render@1"
  name: RenderPdf
  inputs:
    template:
      engine: "handlebars"
      recipe: "chrome-pdf"
      content: |
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; }
          </style>
        </head>
        <body>
          <h1>Invoice #{{orderNumber}}</h1>
          <p>Customer: {{customerName}}</p>
          <table>
            <tr><th>Item</th><th>Amount</th></tr>
            {{#each charges}}
            <tr><td>{{description}}</td><td>{{amount}}</td></tr>
            {{/each}}
          </table>
        </body>
        </html>
    data:
      orderNumber: "{{ Data.GetOrder.order.orderNumber }}"
      customerName: "{{ Data.GetOrder.order.customer.name }}"
      charges: "{{ Data.GetOrder.order.charges }}"
  outputs:
    - name: document
      mapping: "document"
```

**Excel rendering:**
```yaml
- task: "Document/Render@1"
  name: RenderExcel
  inputs:
    template:
      engine: "jsrender"
      recipe: "html-to-xlsx"
      content: |
        <table>
          <tr><th>Order #</th><th>Status</th><th>Amount</th></tr>
          {{for items}}
          <tr><td>{{:orderNumber}}</td><td>{{:status}}</td><td>{{:amount}}</td></tr>
          {{/for}}
        </table>
    data:
      items: "{{ Data.GetOrders.result.items }}"
  outputs:
    - name: document
      mapping: "document"
```

**Engines**: `handlebars`, `jsrender`
**Recipes**: `chrome-pdf`, `html-to-xlsx`, `html`, `xlsx`, `docx`, `csv`

## Document/Send

Sends a previously rendered document.

## Attachment Tasks

| Task | Description |
|------|-------------|
| `Attachment/Create@1` | Create a file attachment on a primary parent, optionally linked to more entities |
| `Attachment/Update@1` | Update attachment fields; changing `parentType`/`parentId` moves the primary link |
| `Attachment/Link@1` | Link an existing attachment to another entity (idempotent) |
| `Attachment/Unlink@1` | Remove a link; the primary link (current parent) can't be unlinked — re-parent instead |
| `Attachment/Thumbnail` | Generate image thumbnail |
| `Attachment/PdfThumbnail` | Generate PDF thumbnail |
| `Attachment/RegenerateThumbnails` | Regenerate all thumbnails |

One attachment can be linked to many Orders, Contacts, Jobs and TrackingEvents. `parentType`/`parentId` is the primary link; `links` and `Attachment/Link@1` add more. Link `entityType`: `Order`, `Contact`, `Job`, `TrackingEvent`; `entityId`: int id, uuid for Job. A missing link target fails the task.

```yaml
- task: "Attachment/Create@1"
  name: CreatePhoto
  inputs:
    attachment:
      fileName: "photo.jpg"
      attachmentType: "Picture"          # Picture, OtherDocument, Avatar, CustomerDocument
      parentType: "Order"
      parentId: "{{ orderId }}"
      links:                             # optional
        - entityType: "TrackingEvent"
          entityId: "{{ trackingEventId }}"
    fileData: "{{ fileData }}"           # base64 / bytes / stream, or fileUrl: "{{ url }}"
  outputs:
    - name: attachment
      mapping: "attachment"

- task: "Attachment/Link@1"
  name: LinkToJob
  inputs:
    attachmentId: "{{ Main.CreatePhoto.attachment.attachmentId }}"   # activity "Main"
    entityType: "Job"
    entityId: "{{ jobId }}"

- task: "Attachment/Unlink@1"
  name: UnlinkFromJob
  inputs:
    attachmentId: "{{ Main.CreatePhoto.attachment.attachmentId }}"
    entityType: "Job"
    entityId: "{{ jobId }}"
```

`Attachment/Link@1` and `Attachment/Unlink@1` output `attachment`.

## PdfDocument/Merge

Merges multiple PDF documents into one.

```yaml
- task: "PdfDocument/Merge@1"
  name: MergePdfs
  inputs:
    documents:
      - "{{ RenderPage1.document }}"
      - "{{ RenderPage2.document }}"
  outputs:
    - name: merged
      mapping: "document"
```
