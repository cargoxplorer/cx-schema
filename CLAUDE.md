# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript-based schema validation package for CargoXplorer YAML modules. Validates module configurations including components, routes, entities, and permissions using JSON Schema and Ajv validator.

## Build Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Build without restore (as per user config)
dotnet build --no-restore

# Prepare for publishing (runs build automatically)
npm run prepare
```

## Testing & Validation

```bash
# Validate a YAML module file
npx cx-validate modules/your-module.yaml

# Validate with custom schemas path
npx cx-validate --schemas ./custom-schemas modules/test-module.yaml

# Output JSON format (useful for CI/CD)
npx cx-validate --json modules/test-module.yaml
```

## Project Structure

- `src/validator.ts` - Core `ModuleValidator` class that orchestrates validation
  - Uses Ajv with JSON Schema Draft 7
  - Validates module structure, components, routes, entities
  - Recursively validates nested components and their children
  - Provides detailed error reporting with paths and schema violations

- `src/utils/schemaLoader.ts` - Schema loading system
  - Recursively loads schemas from `schemas/` directory
  - Manages three schema subdirectories: components/, fields/, actions/
  - Caches schemas in a Map with file URIs for Ajv registration

- `src/types.ts` - TypeScript type definitions for validation results and module structure

- `schemas/` - JSON Schema definitions organized by type
  - `schemas.json` - Main schema definitions
  - `components/*.json` - Component-specific schemas (layout, dataGrid, form, field, etc.)
  - `fields/*.json` - Field type schemas (text, number, select, date, etc.)
  - `actions/*.json` - Action type schemas (navigate, mutation, query, etc.)

- `scripts/` - Installation and setup scripts
  - `postinstall.js` - Automatically creates `.cx-schema` folder in consuming projects
  - `setup-vscode.js` - Configures VS Code YAML schema validation

## Architecture Notes

**Validation Flow:**
1. `ModuleValidator` constructor loads all schemas from `schemas/` directory
2. Schemas are registered with Ajv using file-based keys (e.g., "components/layout.json")
3. `validateModule()` parses YAML, validates top-level structure, then delegates to specialized validators
4. Component validation is recursive - validates component schemas and walks children arrays
5. Errors accumulate in arrays and are returned with detailed paths and type categorization

**Schema Registration:**
- Each schema file is mapped to a key based on its path relative to `schemas/`
- The `getSchemaId()` method (src/validator.ts:75) converts file paths to Ajv schema IDs
- Component-specific schemas are looked up by component type (e.g., "components/layout.json")

**Error Types:**
- `yaml_syntax_error` - Invalid YAML
- `missing_property` - Required property missing
- `schema_violation` - Ajv schema validation failed
- `invalid_component` - Component structure invalid
- `deprecated_property` - Using deprecated property (warning)

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Output: `dist/` directory with declarations and source maps
- Strict mode enabled
