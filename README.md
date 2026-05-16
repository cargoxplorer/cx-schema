# @cxtms/cx-schema

[![npm version](https://img.shields.io/npm/v/@cxtms/cx-schema.svg)](https://www.npmjs.com/package/@cxtms/cx-schema)
[![npm downloads](https://img.shields.io/npm/dm/@cxtms/cx-schema.svg)](https://www.npmjs.com/package/@cxtms/cx-schema)
[![Build Status](https://github.com/cargoxplorer/cx-schema/workflows/Publish%20to%20npm/badge.svg)](https://github.com/cargoxplorer/cx-schema/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Schema validation package for CXTMS YAML modules and workflows. This package provides comprehensive validation for YAML-based configurations used in CXTMS.

## Features

- **Module & Workflow Validation**: Validate both UI modules and workflow definitions
- **CLI Tool**: Full-featured command-line interface with multiple commands
- **Project Scaffolding**: `init` command to bootstrap new projects
- **Template Generation**: `create` command to generate modules and workflows from templates
- **Report Generation**: Generate validation reports in HTML, Markdown, or JSON formats
- **Auto-Detection**: Automatically detects file type (module vs workflow)
- **TypeScript Support**: Full TypeScript types and declarations included
- **VS Code Integration**: Optional setup for YAML schema validation in VS Code
- **Detailed Error Reporting**: Clear error messages with paths and suggestions

## Installation

```bash
npm install @cxtms/cx-schema
```

## Quick Start

```bash
# Initialize a new project
npx cxtms init

# Create a new module
npx cxtms create module orders

# Create a new workflow
npx cxtms create workflow invoice-processor

# Validate files
npx cxtms modules/*.yaml workflows/*.yaml

# Generate validation report
npx cxtms report modules/*.yaml --report report.html
```

## CLI Commands

### validate (default)

Validate YAML file(s) against JSON Schema definitions.

```bash
cxtms [files...]
cxtms validate [files...]

# Examples
cxtms modules/orders-module.yaml
cxtms modules/*.yaml workflows/*.yaml
cxtms --verbose modules/orders-module.yaml
cxtms --format json modules/orders-module.yaml
```

### init

Initialize a new CX project with configuration files.

```bash
cxtms init
```

Creates:
- `app.yaml` - Project configuration
- `README.md` - Project documentation
- `AGENTS.md` - AI assistant instructions for validation
- `modules/` - Directory for module files
- `workflows/` - Directory for workflow files

### create

Create a new module or workflow from template.

```bash
cxtms create <type> <name>

# Examples
cxtms create module orders
cxtms create workflow invoice-generator
```

Generated files include:
- Unique UUID identifiers
- `fileName` property for GitHub repo tracking
- Sample structure with common patterns

### report

Generate validation report for multiple files.

```bash
cxtms report [files...] --report <output-file>

# Examples
cxtms report modules/*.yaml --report report.html
cxtms report workflows/*.yaml --report report.md
cxtms report modules/*.yaml workflows/*.yaml --report results.json
```

Report formats (auto-detected from extension):
- **HTML** - Styled report with summary cards and detailed errors
- **Markdown** - Documentation-friendly tables and lists
- **JSON** - Machine-readable for CI/CD pipelines

### schema

Display the JSON Schema definition for a component or task.

```bash
cxtms schema <name>

# Examples
cxtms schema form
cxtms schema dataGrid
cxtms schema workflow
cxtms schema foreach
```

### example

Show example YAML for a component or task.

```bash
cxtms example <name>

# Examples
cxtms example form
cxtms example workflow
```

### list

List all available schemas for validation.

```bash
cxtms list
cxtms list --type module
cxtms list --type workflow
```

## CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help message |
| `--version` | `-v` | Show version number |
| `--type <type>` | `-t` | Validation type: `module`, `workflow`, or `auto` (default: `auto`) |
| `--format <format>` | `-f` | Output format: `pretty`, `json`, or `compact` (default: `pretty`) |
| `--schemas <path>` | `-s` | Path to custom schemas directory |
| `--verbose` | | Show detailed output with schema paths |
| `--quiet` | `-q` | Only show errors, suppress other output |
| `--report <file>` | `-r` | Generate report to file (html, md, or json) |
| `--report-format <fmt>` | | Report format: `html`, `markdown`, or `json` |

## Output Formats

### Pretty (default)

Human-readable output with colored formatting and detailed error info.

```
╔═══════════════════════════════════════════════════════════════════╗
║                  CX SCHEMA VALIDATION REPORT                     ║
╚═══════════════════════════════════════════════════════════════════╝

  File:    modules/my-module.yaml
  Type:    module
  Status:  ✓ PASSED
  Errors:  0
  Warnings:0
```

### Compact

Minimal output for batch processing.

```
PASS modules/orders-module.yaml
PASS modules/contacts-module.yaml
FAIL modules/broken-module.yaml (3 errors)
```

### JSON

JSON output for programmatic processing.

```json
{
  "isValid": true,
  "errors": [],
  "warnings": [],
  "summary": {
    "file": "modules/my-module.yaml",
    "status": "PASSED",
    "errorCount": 0
  }
}
```

## Programmatic API

```typescript
import { ModuleValidator, WorkflowValidator } from '@cxtms/cx-schema';

// Validate a module
const moduleValidator = new ModuleValidator({
  schemasPath: './.cx-schema'
});
const moduleResult = await moduleValidator.validateModule('modules/orders.yaml');

// Validate a workflow
const workflowValidator = new WorkflowValidator({
  schemasPath: './.cx-schema/workflows'
});
const workflowResult = await workflowValidator.validateWorkflow('workflows/process.yaml');

if (moduleResult.isValid) {
  console.log('✓ Module is valid');
} else {
  moduleResult.errors.forEach(error => {
    console.error(`${error.type}: ${error.message} at ${error.path}`);
  });
}
```

## Templates

Templates are stored in the `templates/` directory and use placeholder syntax:

| Placeholder | Description |
|-------------|-------------|
| `{{name}}` | Sanitized name (lowercase, dashes) |
| `{{displayName}}` | Title case display name |
| `{{uuid}}` | Generated UUID |
| `{{fileName}}` | Relative path to the file |

### Module Template

Generated modules include:
- Module metadata with `appModuleId` and `fileName`
- Sample entities and permissions
- Routes for list and detail views
- Layout components with dataGrid and form

### Workflow Template

Generated workflows include:
- Workflow metadata with `workflowId` and `fileName`
- Sample inputs, outputs, and variables
- Activity with common task examples (Log, Query/GraphQL, switch)
- Manual trigger

## Available Schemas

### Module Schemas

**Components:** layout, form, dataGrid, tabs, tab, field, button, collection, dropdown, datasource, calendar, card, navbar, timeline

**Fields:** text, textarea, number, select, select-async, date, datetime, time, checkbox, radio, attachment, autocomplete-googleplaces

**Actions:** navigate, navigateBack, mutation, query, notification, dialog, workflow, setFields, setStore, validateForm

### Workflow Schemas

**Core:** workflow, activity, input, output, variable, trigger, schedule

**Control Flow:** foreach, switch, while, validation

**Utilities:** map, setVariable, httpRequest, log, error, csv, export, template

**Entities:** order, contact, commodity, job, attachment, charge, payment

**Communication:** email-send, document-render, document-send

**Query:** graphql (Query/GraphQL, Query/GraphQL@1)

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Validation passed (no errors) |
| `1` | Validation failed (errors found) |
| `2` | CLI error (invalid arguments, file not found, etc.) |

## CI/CD Integration

### GitHub Actions

```yaml
- name: Validate YAML files
  run: |
    npx cxtms --format compact modules/*.yaml workflows/*.yaml

- name: Generate validation report
  run: |
    npx cxtms report modules/*.yaml workflows/*.yaml --report validation-report.html

- name: Upload report
  uses: actions/upload-artifact@v3
  with:
    name: validation-report
    path: validation-report.html
```

### GitLab CI

```yaml
validate:
  script:
    - npx cxtms --format json modules/*.yaml > validation-results.json
  artifacts:
    paths:
      - validation-results.json
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

staged_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(yaml|yml)$')

if [ -n "$staged_files" ]; then
  npx cxtms --format compact $staged_files
  if [ $? -ne 0 ]; then
    echo "Validation failed. Please fix errors before committing."
    exit 1
  fi
fi
```

## VS Code Integration

To enable YAML schema validation and autocomplete in VS Code:

```bash
node node_modules/@cxtms/cx-schema/scripts/setup-vscode.js
```

This creates/updates `.vscode/settings.json` with schema associations.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CX_SCHEMA_PATH` | Default path to schemas directory |
| `NO_COLOR` | Disable colored output |

## Development

### Building from Source

```bash
git clone <repository>
cd cx-schema
npm install
npm run build
```

### Testing Locally

```bash
npm pack
# In another project:
npm install /path/to/cxtms-cx-schema-1.0.0.tgz
```

## License

MIT

## Support

For issues and questions, please visit the [GitHub repository](https://github.com/cargoxplorer/cx-schema/issues).
