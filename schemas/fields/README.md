# Field Type Schemas

This directory contains separate JSON schema files for each field type supported by the CargoXplorer TMS system.

## Available Field Types

### Basic Input Fields

- **text.json** - Basic text input field
- **number.json** - Numeric input field with validation and formatting
- **email.json** - Email input field with validation
- **password.json** - Password input field with security features
- **tel.json** - Telephone number input field with formatting
- **url.json** - URL input field with validation

### Date/Time Fields

- **date.json** - Date picker field
- **datetime.json** - Date/time picker field (timezone-aware options)
- **rangedatetime.json** - Date/time range picker field
- **time.json** - Time picker field

### Selection Fields

- **select.json** - Dropdown select field with static options
- **select-async.json** - Async dropdown select field with GraphQL queries
- **autocomplete-googleplaces.json** - Google Places autocomplete field for addresses
- **checkbox.json** - Checkbox input field
- **radio.json** - Radio button group field

### Text Area

- **textarea.json** - Multi-line text input field

## Schema Structure

Each field type schema includes:

- Field-specific properties and validation
- Event handlers (onChange, onBlur, onFocus, onSelectValue)
- Transformation configurations
- Real-world examples from the CargoXplorer modules
- Complete type safety and validation rules

## Usage

These schemas are referenced by the main `schemas.json` file using conditional validation based on the field `type` property. This modular approach makes it easier to:

1. **Maintain** - Each field type is self-contained
2. **Extend** - Add new field types without modifying the main schema
3. **Validate** - Specific validation rules for each field type
4. **Document** - Clear examples and descriptions for each type

## Integration

The field schemas integrate with:

- **GraphQL queries** - For select-async and autocomplete fields
- **Actions system** - For event handlers and value selection
- **Template expressions** - For dynamic values and transformations
- **Localization** - For multi-language support
- **Permissions** - For role-based field access

## Examples

Each schema includes comprehensive examples derived from real usage patterns in the CargoXplorer TMS modules, ensuring practical applicability and correct implementation.
