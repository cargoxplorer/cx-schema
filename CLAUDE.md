# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repo is the home of the **cxtms-\* Claude Code skills** (`cxtms-developer`, `cxtms-module-builder`, `cxtms-workflow-builder`) — the knowledge base and generation rules that teach Claude Code how to build CargoXplorer modules and workflows. It also contains `cxtms`, a TypeScript CLI tool the skills use to scaffold, validate, and inspect YAML files.

The three pillars:
1. **Skills** (`skills/`) — SKILL.md + ref-*.md files that Claude Code loads when generating YAML
2. **Schemas** (`schemas/`) — JSON Schema definitions that enforce correctness
3. **CLI** (`src/cli.ts` → `cxtms`) — scaffolding from templates, validation, schema introspection

Published as `@cxtms/cx-schema` npm package, consumed by CX application repos.

## Build & CLI

```bash
npm run build                              # TypeScript → dist/
npx cxtms create workflow <n> --template <t>  # Scaffold from template (skills always start here)
npx cxtms create module <n> --template <t>    # Scaffold from template
npx cxtms <file.yaml>                     # Validate any YAML (skills always validate after changes)
npx cxtms <file.yaml> --verbose           # Detailed errors with schema paths
npx cxtms schema <name>                   # Show JSON schema (skills use this to look up task/component schemas)
npx cxtms example <name>                  # Show example YAML
npx cxtms list                            # List all available schemas
```

No test suite (`npm test` is a no-op). Verify changes by scaffolding from templates and running `cxtms` validation.

## Architecture

### Skills (`skills/`) — the primary deliverable

Each skill has a `SKILL.md` entry point and `ref-*.md` reference files loaded on demand.

- **`cxtms-developer`** — Shared entity field reference (Order, Contact, Commodity, Job, etc.), enums, customValues patterns, GraphQL queries, CLI auth. Loaded by both cxtms-module-builder and cxtms-workflow-builder as a dependency.
- **`cxtms-module-builder`** — Teaches Claude Code to generate UI module YAML. References: layout, form, data grid, field types, actions, routes. Uses cxtms to scaffold (`create module`) and validate.
- **`cxtms-workflow-builder`** — Teaches Claude Code to generate workflow YAML. References: task types (utilities, query, entity CRUD, communication, file transfer, accounting), expression syntax, Flow state machines. Uses cxtms to scaffold (`create workflow --template <t>`) and validate.

**Skill contract**: skills instruct Claude Code to always scaffold via `cxtms create` (never write YAML from scratch), then customize the output, then validate with `cxtms`. The CLI, schemas, and templates exist to support this workflow.

**Keep skills and CLI in sync**: when adding or changing CLI commands, templates, or schemas, always update the corresponding skill SKILL.md/ref-*.md files so Claude Code knows about the new capabilities. The skills are how the CLI gets used — an undocumented CLI feature is an invisible one.

### CLI (`src/cli.ts`) — tooling for skills

Single-file CLI (~2200 lines) handling all commands: `validate`, `create`, `extract`, `init`, `schema`, `example`, `list`, `report`. Auto-detects file type by checking for `workflow:` vs `module:` keys in YAML.

**Template system**: `templates/*.yaml` files use `{{variable}}` placeholders processed at create time. Runtime CX expressions are escaped as `\{{...}}` in templates so they survive processing and become `{{...}}` in output. Variables: `name`, `displayName`, `displayNameNoSpaces`, `uuid`, `fileName`.

**`--options` support** (modules only): Parses JSON field definitions and injects them into form children, dataGrid columns, entity fields, validationSchema, and GraphQL queries.

### Validators

- **`ModuleValidator`** (`src/validator.ts`) — validates UI module YAML (components, routes, entities, permissions). Recursively walks `children` arrays. Schemas in `schemas/components/`, `schemas/fields/`, `schemas/actions/`.
- **`WorkflowValidator`** (`src/workflowValidator.ts`) — validates workflow YAML (activities, steps, triggers, schedules). Validates each task type against its schema. Schemas in `schemas/workflows/` with subdirectories `tasks/`, `flow/`, `common/`.

Both use Ajv (Draft 7) and are exported from `src/index.ts` as the library API.

### Schema Directory Layout

```
schemas/
├── schemas.json                    # Main module schema
├── components/*.json               # UI components (form, dataGrid, layout, tabs, etc.)
├── fields/*.json                   # Field types (text, number, select, date, etc.)
├── actions/*.json                  # Action types (navigate, mutation, query, etc.)
└── workflows/
    ├── workflow.json               # Top-level workflow schema (conditional validation for Flow/PublicApi)
    ├── activity.json, input.json, output.json, variable.json, trigger.json, schedule.json
    ├── tasks/*.json                # Task-type schemas (foreach, switch, graphql, order, etc.)
    ├── flow/*.json                 # Flow state machine schemas (entity, state, transition, aggregation)
    └── common/*.json               # Shared definitions (condition, expression, mapping)
```

**Dual copies**: `schemas/` is the source of truth. `.cx-schema/` is a gitignored local copy created by `postinstall.js` for consuming projects. When editing schemas, update `schemas/` — the `.cx-schema/` copy must be synced manually during development (or just `cp schemas/... .cx-schema/...`).

### Workflow Templates

12 templates in `templates/`: `workflow.yaml` (default), `workflow-basic.yaml`, `workflow-entity-trigger.yaml`, `workflow-document.yaml`, `workflow-scheduled.yaml`, `workflow-utility.yaml`, `workflow-webhook.yaml`, `workflow-public-api.yaml`, `workflow-mcp-tool.yaml`, `workflow-ftp-tracking.yaml`, `workflow-ftp-edi.yaml`, `workflow-api-tracking.yaml`.

5 module templates: `module.yaml` (default), `module-grid.yaml`, `module-form.yaml`, `module-select.yaml`, `module-configuration.yaml`.

### Workflow Types

`workflowType` in YAML controls behavior. Omit for standard process workflows.

| Type | Key Requirement |
|------|----------------|
| `Document` | Must be Sync, requires `file` output |
| `Flow` | Requires `entity`, `states`, `transitions` (no `activities`) |
| `Webhook` | Anonymous HTTP endpoint, `payload`/`request` auto-injected inputs |
| `PublicApi` | Requires `api` section (path, method, auth), must be Sync |
| `Quote` | Quote generation workflows |

### Conditional Schema Validation

`workflow.json` uses JSON Schema `allOf`/`if`/`then` for type-specific rules:
- `workflowType: "Flow"` → requires `entity`, disallows `activities`
- `workflowType: "PublicApi"` → requires `api` section
- All others → requires `activities`

### Key Design Patterns

- Input `props` has `additionalProperties: true` — new fields like `in` (for PublicApi) and `format` are additive
- Output schema supports both `additionalProperties` (legacy) and `props` (new, for OpenAPI metadata)
- All workflow templates include event handlers (onActivityStarted/Completed/Failed, onWorkflowStarted/Executed/Failed)
- Template expressions: `{{ path }}` in step inputs (raw object or string interpolation), `[variable]` in NCalc conditions
- Null-safe `?` operator is used by default on all variable paths except guaranteed system variables

<!-- cx-schema-instructions -->
## CargoXplorer Project

This is a CargoXplorer (CX) application. Modules and workflows are defined as YAML files validated against JSON schemas provided by `@cxtms/cx-schema`.

### Project Structure

```
app.yaml              # Application manifest (name, version, description)
modules/              # UI module YAML files
workflows/            # Workflow YAML files
features/             # Feature-scoped modules and workflows
  <feature>/
    modules/
    workflows/
```

### CLI — `cxtms`

**Always scaffold via CLI, never write YAML from scratch.**

| Command | Description |
|---------|-------------|
| `npx cxtms create module <name>` | Scaffold a UI module |
| `npx cxtms create workflow <name>` | Scaffold a workflow |
| `npx cxtms create module <name> --template <t>` | Use a specific template |
| `npx cxtms create workflow <name> --template <t>` | Use a specific template |
| `npx cxtms create module <name> --feature <f>` | Place under features/<f>/modules/ |
| `npx cxtms <file.yaml>` | Validate a YAML file |
| `npx cxtms <file.yaml> --verbose` | Validate with detailed errors |
| `npx cxtms schema <name>` | Show JSON schema for a component or task |
| `npx cxtms example <name>` | Show example YAML |
| `npx cxtms list` | List all available schemas |
| `npx cxtms extract <src> <comp> --to <tgt>` | Move component between modules |

**Module templates:** `default`, `form`, `grid`, `select`, `configuration`
**Workflow templates:** `basic`, `entity-trigger`, `document`, `scheduled`, `scheduled-execute`, `utility`, `webhook`, `public-api`, `mcp-tool`, `ftp-tracking`, `ftp-edi`, `api-tracking`

### Skills (slash commands)

| Skill | Purpose |
|-------|---------|
| `/cxtms-module-builder <description>` | Generate a UI module (forms, grids, screens) |
| `/cxtms-workflow-builder <description>` | Generate a workflow (automation, triggers, integrations) |
| `/cxtms-developer <entity or question>` | Look up entity fields, enums, and domain reference |

### Workflow: Scaffold → Customize → Validate

1. **Scaffold** — `npx cxtms create module|workflow <name> --template <t>`
2. **Read** the generated file
3. **Customize** for the use case
4. **Validate** — `npx cxtms <file.yaml>` — run after every change, fix all errors
<!-- cx-schema-instructions -->
