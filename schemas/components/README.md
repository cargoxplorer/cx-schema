# Component Schemas

This directory contains individual JSON schema files for each CargoXplorer component type. Breaking down component schemas into separate files improves maintainability, organization, and reusability.

## Directory Structure

```
schema/
├── components/
│   ├── appComponent.json     # Base app component schema
│   ├── navbar.json          # Navigation bar component
│   ├── navbarItem.json      # Navigation item component
│   ├── navDropdown.json     # Navigation dropdown component
│   ├── navbarLink.json      # Navigation link component
│   ├── collection.json      # Collection/iteration component
│   ├── row.json             # Row layout component
│   ├── dataGrid.json        # Data grid component
│   ├── button.json          # Button component
│   ├── form.json            # Form component
│   ├── layout.json          # Layout container component
│   ├── tabs.json            # Tabs container component
│   ├── tab.json             # Individual tab component
│   ├── field.json           # Form field component
│   ├── dropdown.json        # Dropdown menu component
│   ├── datasource.json      # Data source component
│   ├── calendar.json        # Calendar component
│   ├── module.json          # Module component
│   ├── index.json           # Component schema index
│   └── README.md            # This documentation file
├── fields/                  # Field type schemas
│   ├── text.json
│   ├── select-async.json
│   └── ...
└── schemas.json             # Main schema file with references
```

## Benefits of Separate Component Schemas

### 1. **Maintainability**

- Each component schema is in its own file
- Easier to find and update specific component definitions
- Reduces the size of the main schemas.json file

### 2. **Reusability**

- Component schemas can be referenced from multiple locations
- Enables better modular schema design
- Facilitates schema composition and inheritance

### 3. **Organization**

- Clear separation between different component types
- Logical file structure mirrors component hierarchy
- Better developer experience when working with schemas

### 4. **Collaboration**

- Multiple developers can work on different component schemas simultaneously
- Reduces merge conflicts in the main schema file
- Easier code reviews for component-specific changes

## Usage

The main `schemas.json` file now references these separate component files:

```json
{
  "components": {
    "schemas": {
      "button": {
        "$ref": "components/button.json"
      },
      "dataGrid": {
        "$ref": "components/dataGrid.json"
      },
      "form": {
        "$ref": "components/form.json"
      }
      // ... other components
    }
  }
}
```

## Schema References

Each component schema file uses relative references to the main schemas.json file for shared definitions:

```json
{
  "properties": {
    "onClick": {
      "$ref": "../schemas.json#/definitions/actionsList"
    },
    "isHidden": {
      "$ref": "../schemas.json#/definitions/templateExpression"
    }
  }
}
```

## Adding New Components

To add a new component schema:

1. Create a new JSON file in this directory (e.g., `myComponent.json`)
2. Define the component schema following the existing patterns
3. Add a reference to the component in the main `schemas.json` file
4. Update the `index.json` file if needed
5. Update this README.md file

## Component Schema Structure

Each component schema should follow this general structure:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Component Name",
  "type": "object",
  "properties": {
    "component": {
      "type": "string",
      "const": "componentName"
    },
    "name": {
      "type": "string",
      "description": "Component name identifier"
    },
    "props": {
      "type": "object",
      "properties": {
        // Component-specific properties
      }
    },
    "children": {
      "$ref": "../schemas.json#/definitions/componentChildren"
    }
  },
  "required": ["component"]
}
```

## Validation

All component schemas are validated against JSON Schema Draft 07 specification. Ensure your schemas are valid JSON and follow the established patterns for consistency.
