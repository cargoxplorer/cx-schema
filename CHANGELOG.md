# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `OrderTrackingEvent/Create@1` — new inputs `autoLinkToCommodities` (per-task override of `tms.trackingEvents.autoLinkToCommodities` org config) and `commodityIds` (explicit list of commodity IDs to link, overriding the auto-link behavior entirely).
- `TrackingEvent/Create@1` — added to the `tracking-event.json` schema and to the `cxtms-workflow-builder` skill (`ref-entity.md`). Exposes `organizationId`, `orderId`, `commodityId`, `commodityIds`, `eventDefinitionId`, `eventDefinitionName`, `eventDate`, `description`, `location`, `includeInTracking`, `sendEmail`, `customValues`, `skipIfExists`, `eventDefinitionValues`.

### Changed
- `cxtms-workflow-builder/ref-entity.md` now documents commodity auto-link precedence for `OrderTrackingEvent/Create@1` and guides users between `OrderTrackingEvent/Create@1` vs `TrackingEvent/Create@1`.

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
