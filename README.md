# @cxtms/cx-schema

[![npm version](https://img.shields.io/npm/v/@cxtms/cx-schema.svg)](https://www.npmjs.com/package/@cxtms/cx-schema)
[![npm downloads](https://img.shields.io/npm/dm/@cxtms/cx-schema.svg)](https://www.npmjs.com/package/@cxtms/cx-schema)
[![Build Status](https://github.com/cargoxplorer/cx-schema/workflows/Publish%20to%20npm/badge.svg)](https://github.com/cargoxplorer/cx-schema/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Schema validation package for CargoXplorer YAML modules. This package provides comprehensive validation for YAML-based module configurations used in the CargoXplorer Transportation Management System (TMS).

## Features

- **Automatic Schema Setup**: Creates `.cx-schema` folder with all schema files on installation
- **CLI Tool**: Easy-to-use command-line interface for module validation
- **TypeScript Support**: Full TypeScript types and declarations included
- **VS Code Integration**: Optional setup for YAML schema validation in VS Code
- **Comprehensive Validation**: Validates module structure, components, routes, entities, and permissions
- **Detailed Error Reporting**: Clear error messages with paths and suggestions

## Installation

```bash
npm install @cxtms/cx-schema
```

After installation, the package automatically creates a `.cx-schema` folder in your project root containing all schema files.

## Usage

### CLI Tool

Validate a single module file:

```bash
npx cx-validate modules/countries-module.yaml
```

Validate with custom schemas path:

```bash
npx cx-validate --schemas ./custom-schemas modules/test-module.yaml
```

Output results in JSON format:

```bash
npx cx-validate --json modules/test-module.yaml > result.json
```

### Programmatic API

```typescript
import { ModuleValidator } from '@cxtms/cx-schema';

async function validateModule() {
  const validator = new ModuleValidator({
    schemasPath: './.cx-schema',
    strictMode: true,
    includeWarnings: true
  });

  const result = await validator.validateModule('modules/countries-module.yaml');

  if (result.isValid) {
    console.log('✓ Module is valid');
  } else {
    console.error('✗ Validation failed');
    result.errors.forEach(error => {
      console.error(`${error.type}: ${error.message} at ${error.path}`);
    });
  }
}
```

### VS Code Integration

To enable YAML schema validation and autocomplete in VS Code:

```bash
node node_modules/@cxtms/cx-schema/scripts/setup-vscode.js
```

Or add to your `package.json`:

```json
{
  "scripts": {
    "setup-vscode": "node node_modules/@cxtms/cx-schema/scripts/setup-vscode.js"
  }
}
```

Then run:

```bash
npm run setup-vscode
```

This will create/update `.vscode/settings.json` with schema associations for your module files.

## Validation Options

### ValidatorOptions

```typescript
interface ValidatorOptions {
  schemasPath?: string;      // Path to schemas directory (default: .cx-schema)
  strictMode?: boolean;       // Enable strict validation (default: true)
  includeWarnings?: boolean;  // Include warnings in results (default: true)
}
```

## Validation Result

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

interface ValidationError {
  type: string;           // Error type (e.g., 'missing_property', 'schema_violation')
  path: string;           // Path to the error in the module
  message: string;        // Error message
  schemaPath?: string;    // Path in the schema that failed
  example?: any;          // Example value from schema
}

interface ValidationSummary {
  file: string;
  timestamp: string;
  status: 'PASSED' | 'FAILED';
  errorCount: number;
  warningCount: number;
  errorsByType: Record<string, number>;
}
```

## Common Error Types

- `yaml_syntax_error`: Invalid YAML syntax
- `missing_property`: Required property is missing
- `schema_violation`: Value doesn't match schema requirements
- `invalid_component`: Component structure is invalid
- `deprecated_property`: Using deprecated property (warning)

## Module Structure

A valid module must have the following structure:

```yaml
module:
  name: ModuleName
  appModuleId: uuid-v4
  displayName:
    en-US: "Display Name"
  application: ApplicationName

components:
  - name: Component/Name
    displayName:
      en-US: "Component Display Name"
    platforms: [web, mobile]
    layout:
      component: layout
      props: {}
      children: []

routes:
  - path: /module-path
    component: Component/Name
    permission: module.permission

entities:
  - name: EntityName
    fields: []

permissions:
  - module.permission
```

## Schema Files

The `.cx-schema` folder contains:

- `schemas.json` - Main schema definitions
- `components/` - Component-specific schemas (layout, dataGrid, form, field, etc.)
- `fields/` - Field type schemas (text, number, select, date, etc.)
- `actions/` - Action type schemas (navigate, mutation, query, etc.)

## Scripts

### npm Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "validate": "cx-validate modules/*.yaml",
    "validate:single": "cx-validate",
    "setup-vscode": "node node_modules/cx-schema-validator/scripts/setup-vscode.js"
  }
}
```

### Local Validation Script

After installation, you can also use the local validation script:

```bash
node .cx-schema/validate.js modules/your-module.yaml
```

## CI/CD Integration

For continuous integration, use the `--json` flag to get machine-readable output:

```yaml
# GitHub Actions example
- name: Validate Modules
  run: |
    npx cx-validate --json modules/*.yaml > validation-result.json
    if [ $? -ne 0 ]; then
      echo "Validation failed"
      exit 1
    fi
```

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

For issues and questions, please visit the repository or contact the CargoXplorer team.
