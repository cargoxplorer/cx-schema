# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `Calendar/RevokeLink@1` task (`schemas/workflows/tasks/calendar.json`, `ref-entity.md`) — revokes an organization connection's system feed link for a calendar; inputs `organizationId`, `calendarId`, `organizationConnectionId`, output `revoked` (STV-387).
- `file.create` barcodes: in `pdf`/`docx` markdown, `![alt](barcode:<format>/<value>?width=…&height=…&text=false)` draws a barcode (15 ZXing formats: Code 128/39/93, Codabar, ITF, MSI, Plessey, EAN-13/8, UPC-A/E, QR, Data Matrix, Aztec, PDF417), documented in ref-agent.md "Barcodes" (CXTMS-328).
- `quickSearch` on module entities (`schemas/schemas.json#/definitions/quickSearch`) and `schemas/quick-search-kinds.json` (per-kind match/select allow-lists): opts an entity into the global quick search. `npx cxtms` validates the block's shape (`schema_violation`) and rules (`invalid_quick_search`); the backend enforces the same rules at module save (CXTMS-365). `entityKind` gains `Job`, `Commodity`, `CalendarAvailabilityBlock` and `AuditChangeEntry`.
- `OrderTrackingEvent/Create@1` — new inputs `autoLinkToCommodities` (per-task override of `tms.trackingEvents.autoLinkToCommodities` org config) and `commodityIds` (explicit list of commodity IDs to link, overriding the auto-link behavior entirely).
- `TrackingEvent/Create@1` — added to the `tracking-event.json` schema and to the `cxtms-workflow-builder` skill (`ref-entity.md`). Exposes `organizationId`, `orderId`, `commodityId`, `commodityIds`, `eventDefinitionId`, `eventDefinitionName`, `eventDate`, `description`, `location`, `includeInTracking`, `sendEmail`, `customValues`, `skipIfExists`, `eventDefinitionValues`.
- `sound` and `vibrate` module actions — audible/haptic device feedback for scan and confirmation flows. String shorthand (`- sound: success`) or object form (`sound: { type, volume }`; `vibrate: { type, pattern, duration }`). New schemas `schemas/actions/sound.json` and `schemas/actions/vibrate.json`, registered in `actions/all.json` and documented in the `cxtms-module-builder` skill.
- `schemas/workflows/agent/agent.json` — `agent.tools[].mode` (enum `auto` \| `approval`, default `auto`) and `agent.model.contextWindow` (positive integer) properties, matching the backend's tool approval (CXTMS-346) and session/context-window support (CXTMS-331). A tool marked `mode: approval` pauses a chat session for a person's decision and is refused outright in a task session. Backed by new `AGT_010` (invalid `mode`) validation and a `model.contextWindow` check folded into the existing `AGT_006`.
- `schemas/workflows/agent/agent.json` — `agent.ui` (`name`, `shortDescription`, `icon`, `color` enum `primary`\|`secondary`\|`info`\|`success`\|`warning`\|`error`, `prompts` with at most 5 items), the AI Assistant's display metadata served by `GET .../ai/models` (CXTMS-351). Backed by backend validation codes `AGT_011` (invalid `ui.color`) and `AGT_012` (more than 5 `ui.prompts`).
- `agent.tools[].mode: always` — pauses a chat for a person in every approval mode; refused in a task session like `approval` (CXTMS-351).
- `schemas/workflows/agent/agent.json` — `agent.tools[]` entries are now `oneOf` a workflow tool (`workflow`, `instructions?`, `mode?`) or a built-in tool (`builtin`: `data.query` \| `data.schema` \| `data.type`, `instructions?`, `mode?`): read-only GraphQL data access for agents as the tools `data_query`, `data_schema`, `data_type` (CXTMS-354). Backed by backend validation codes `AGT_013` (both or neither of `workflow`/`builtin`), `AGT_014` (unknown `builtin`) and `AGT_015` (the same `builtin` listed twice); `AGT_007` is retired.
- `Attachment/Link@1` and `Attachment/Unlink@1` tasks and `attachment.links` on `Attachment/Create@1` (`schemas/workflows/tasks/attachment.json`) — link one attachment to several Orders, Contacts, Jobs and TrackingEvents (CXTMS-342).
- `links` option on the `attachment` field (`schemas/fields/attachment.json`) — link an uploaded file to more Orders, Contacts, Jobs and TrackingEvents besides `parentId`/`parentType`; documented in `cxtms-module-builder/ref-components-forms.md`. `parentId`/`parentType` there use `anyOf` instead of `oneOf`, so a template string no longer matches two branches and fails (CXTMS-343).
- `schemas/workflows/agent/agent.json` — `file.create` added to `agent.tools[].builtin` (tool `file_create`): writes a PDF, Word, Excel or CSV file to the session from Markdown, rows, or a paged GraphQL query. `AGT_014` now also accepts it. `cxtms-workflow-builder/ref-agent.md` documents its argument table, rules, limits and error codes, a new "Producing files" section (where files come from — `file.create` or a captured workflow-tool output — and where they appear: chat reply cards, the Library, and transcript `attachment` blocks with `origin: "produced"`), and the Agent workflow `files` output (`{ attachmentId, fileName, contentType, size, url }`, `url` presigned for 24 hours or `null`, `[]` when nothing was produced) — Agent workflows now produce four fixed outputs, not three (CXTMS-328).

### Changed
- `cxtms-workflow-builder/ref-entity.md` now documents commodity auto-link precedence for `OrderTrackingEvent/Create@1` and guides users between `OrderTrackingEvent/Create@1` vs `TrackingEvent/Create@1`.
- `cxtms-workflow-builder/ref-agent.md` — documents `tools[].mode` and `model.contextWindow`; adds sections on tool approval (chat pause/resume vs. task refusal), history compression (triggers at 80% of `model.contextWindow`, default 256,000 tokens), sessions (a workflow task run vs. a Responses API chat), session ownership and live events (`onAgentSessionEvent`), and a best practice for gating side-effecting tools behind `mode: approval` in chat agents. Corrects the earlier note that `chat` sessions ran as `task` under the hood: `agent.session.type` is now documented as having no runtime effect — the caller (workflow run vs. Responses API) decides the actual session type, and only a `task` session gets the `set_result` tool.
- `templates/workflow-agent.yaml` — scaffolded agent template now includes an example `mode: approval` tool and a commented `model.contextWindow` note.
- `cxtms-workflow-builder/ref-communication.md` — Attachment section rewritten with the real `Attachment/Create@1` inputs (`attachment`, `fileData`/`fileUrl`) and the link tasks; `cxtms-developer/ref-entity-shared.md` — `AttachmentParentType` gains `Route`, `TrackingEvent`, plus attachment link fields, filters and mutations.
- `cxtms-developer/ref-entity-notification.md` — `Notification.entityId` corrected from `int?` to `string?` (`varchar(64)`, following the backend's `NotificationEntityIdToString` migration); documents `entityType: "AgentSession"` carrying the session's GUID instead of an integer PK.
- `cxtms-workflow-builder/ref-agent.md` — documents `agent.ui`, `tools[].mode: always`, the chat's Ask/Auto approval mode (an `approval` tool runs in Auto and is audited as `auto:<userId>`; an `always` tool still pauses), and validation codes `AGT_011`/`AGT_012`.
- `cxtms-workflow-builder/ref-agent.md` — documents built-in data tools (`tools[].builtin`): the three tools, their inputs, the backend guards (query-only, organization scope, depth 12, 64 KB cap) and validation codes `AGT_013`–`AGT_015`; marks `AGT_007` retired.
- `cxtms-workflow-builder/ref-agent.md` — documents files in chat (CXTMS-362): the supported types and limits, what the model receives (labelled, fenced as data, re-sent within a 16 MB per-call budget, placeholders for unreadable files), session attachments and the Library, and the model config's optional `supportsFiles` flag (default `true` for `anthropic`/`openai`, reported per agent as `supports_files`), plus a best practice to set it for models without file support. No YAML schema change: agents do not opt in.

## [1.0.0] - 2025-10-29

### Added
- Initial release of @cxtms/cx-schema
- TypeScript-based validation engine
- CLI tool (`cxtms`) for command-line validation
- Automatic `.cx-schema` folder creation on installation
- VS Code integration script for YAML schema associations
- Comprehensive schema validation for:
  - Module structure
  - Component definitions
  - Routes and permissions
  - Entity definitions
- Support for 62 JSON schema files:
  - Main schemas.json
  - 25 component schemas
  - 19 field type schemas
  - 19 action type schemas
- Detailed error reporting with paths and examples
- Warning detection for deprecated properties
- JSON output format for CI/CD integration
- Programmatic API for custom validation workflows

### Features
- Ajv-based JSON Schema Draft 7 validation
- YAML parsing with js-yaml
- Colored console output with chalk
- Recursive component validation
- Custom reference resolver
- Schema caching for performance
- Example extraction from schemas

### Documentation
- Comprehensive README with usage examples
- Sample module file for testing
- TypeScript type definitions
- API documentation

### Scripts
- `postinstall.js` - Automatic schema setup
- `setup-vscode.js` - VS Code integration
- Local validation script generation

[1.0.0]: https://github.com/cargoxplorer/cx-schema/releases/tag/v1.0.0
