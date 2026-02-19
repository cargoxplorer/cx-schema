#!/usr/bin/env node

/**
 * CX Schema Validator CLI - Unified validation for YAML modules and workflows
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import YAML, { isSeq, isMap, YAMLSeq, Document as YAMLDocument } from 'yaml';
import { ModuleValidator } from './validator';
import { WorkflowValidator } from './workflowValidator';
import { ValidationResult, ValidationError } from './types';
import { computeExtractPriority } from './extractUtils';

// ============================================================================
// Types
// ============================================================================

type ValidationType = 'module' | 'workflow' | 'auto';
type OutputFormat = 'pretty' | 'json' | 'compact';
type ReportFormat = 'html' | 'markdown' | 'json';

interface CLIOptions {
  help: boolean;
  version: boolean;
  schemasPath?: string;
  type: ValidationType;
  format: OutputFormat;
  verbose: boolean;
  showSchema: string | null;
  showExample: string | null;
  listSchemas: boolean;
  listTasks: boolean;
  quiet: boolean;
  report?: string;
  reportFormat: ReportFormat;
  createType?: 'module' | 'workflow';
  createName?: string;
  template?: string;
  feature?: string;
  createOptions?: string;
  createTasks?: string;
  extractTo?: string;
  extractCopy?: boolean;
}

interface FileValidationResult {
  file: string;
  fileType: ValidationType;
  result: ValidationResult;
}

interface ReportData {
  timestamp: string;
  totalFiles: number;
  passedFiles: number;
  failedFiles: number;
  totalErrors: number;
  totalWarnings: number;
  errorsByType: Record<string, number>;
  errorsByFile: Record<string, number>;
  files: FileValidationResult[];
}

interface ParsedArgs {
  command: string | null;
  files: string[];
  options: CLIOptions;
}

// ============================================================================
// Constants
// ============================================================================

const VERSION = require('../package.json').version;
const PROGRAM_NAME = 'cx-cli';

// ============================================================================
// Help Text
// ============================================================================

const HELP_TEXT = `
${chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════════════════╗')}
${chalk.bold.cyan('║')}                     ${chalk.bold.white('CX SCHEMA VALIDATOR')} ${chalk.gray(`v${VERSION}`)}                         ${chalk.bold.cyan('║')}
${chalk.bold.cyan('║')}          ${chalk.gray('Unified validation for CargoXplorer YAML files')}               ${chalk.bold.cyan('║')}
${chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════════════╝')}

${chalk.bold.yellow('DESCRIPTION:')}
  Validates CargoXplorer YAML module and workflow files against JSON Schema
  definitions. Provides detailed error feedback with examples and schema
  references to help fix validation issues.

${chalk.bold.yellow('USAGE:')}
  ${chalk.cyan(PROGRAM_NAME)} [command] [options] <files...>

${chalk.bold.yellow('COMMANDS:')}
  ${chalk.green('validate')}        Validate YAML file(s) ${chalk.gray('(default command)')}
  ${chalk.green('report')}          Generate validation report for multiple files
  ${chalk.green('init')}            Initialize a new CX project (app.yaml, folders, docs)
  ${chalk.green('create')}          Create a new module, workflow, or task-schema from template
  ${chalk.green('extract')}         Extract a component (and its routes) to another module
  ${chalk.green('sync-schemas')}    Regenerate all.json from task schema directory
  ${chalk.green('install-skills')}  Install Claude Code skills into project .claude/skills/
  ${chalk.green('setup-claude')}    Add CX project instructions to CLAUDE.md
  ${chalk.green('update')}          Update @cxtms/cx-schema to the latest version
  ${chalk.green('schema')}          Show JSON schema for a component or task
  ${chalk.green('example')}         Show example YAML for a component or task
  ${chalk.green('list')}            List available schemas (modules, workflows, tasks)
  ${chalk.green('version')}         Show version number
  ${chalk.green('help')}            Show this help message

${chalk.bold.yellow('OPTIONS:')}
  ${chalk.green('-h, --help')}              Show this help message
  ${chalk.green('-v, --version')}           Show version number
  ${chalk.green('-t, --type <type>')}       Validation type: ${chalk.cyan('module')}, ${chalk.cyan('workflow')}, or ${chalk.cyan('auto')} ${chalk.gray('(default: auto)')}
  ${chalk.green('-f, --format <format>')}   Output format: ${chalk.cyan('pretty')}, ${chalk.cyan('json')}, or ${chalk.cyan('compact')} ${chalk.gray('(default: pretty)')}
  ${chalk.green('-s, --schemas <path>')}    Path to schemas directory
  ${chalk.green('--verbose')}               Show detailed output with schema paths
  ${chalk.green('--quiet')}                 Only show errors, suppress other output
  ${chalk.green('-r, --report <file>')}     Generate report to file (html, md, or json)
  ${chalk.green('--report-format <fmt>')}   Report format: ${chalk.cyan('html')}, ${chalk.cyan('markdown')}, or ${chalk.cyan('json')} ${chalk.gray('(default: auto from extension)')}
  ${chalk.green('--template <name>')}       Template variant for create command (e.g., ${chalk.cyan('basic')})
  ${chalk.green('--feature <name>')}        Place file under features/<name>/ instead of root
  ${chalk.green('--options <json>')}        JSON field definitions for create (inline or file path)
  ${chalk.green('--tasks <list>')}         Comma-separated task enums for create task-schema
  ${chalk.green('--to <file>')}            Target file for extract command
  ${chalk.green('--copy')}                 Copy component instead of moving (source unchanged, target gets higher priority)

${chalk.bold.yellow('VALIDATION EXAMPLES:')}
  ${chalk.gray('# Validate a module YAML file')}
  ${chalk.cyan(`${PROGRAM_NAME} modules/countries-module.yaml`)}

  ${chalk.gray('# Validate a workflow YAML file')}
  ${chalk.cyan(`${PROGRAM_NAME} workflows/my-workflow.yaml`)}

  ${chalk.gray('# Auto-detect file type and validate')}
  ${chalk.cyan(`${PROGRAM_NAME} --type auto my-file.yaml`)}

  ${chalk.gray('# Validate with custom schemas directory')}
  ${chalk.cyan(`${PROGRAM_NAME} --schemas ./custom-schemas file.yaml`)}

  ${chalk.gray('# Output validation results as JSON')}
  ${chalk.cyan(`${PROGRAM_NAME} --format json file.yaml > results.json`)}

  ${chalk.gray('# Validate multiple files')}
  ${chalk.cyan(`${PROGRAM_NAME} module1.yaml module2.yaml workflow1.yaml`)}

${chalk.bold.yellow('PROJECT COMMANDS:')}
  ${chalk.gray('# Initialize a new project')}
  ${chalk.cyan(`${PROGRAM_NAME} init`)}

  ${chalk.gray('# Create a new module from template')}
  ${chalk.cyan(`${PROGRAM_NAME} create module my-module`)}

  ${chalk.gray('# Create a new workflow from template')}
  ${chalk.cyan(`${PROGRAM_NAME} create workflow my-workflow`)}

  ${chalk.gray('# Create from a specific template variant')}
  ${chalk.cyan(`${PROGRAM_NAME} create workflow my-workflow --template basic`)}

  ${chalk.gray('# Create inside a feature folder')}
  ${chalk.cyan(`${PROGRAM_NAME} create workflow my-workflow --feature billing`)}

  ${chalk.gray('# Create module with custom fields')}
  ${chalk.cyan(`${PROGRAM_NAME} create module my-config --template configuration --options '[{"name":"host","type":"text"},{"name":"port","type":"number"}]'`)}

  ${chalk.gray('# Create a task schema with pre-populated task enums')}
  ${chalk.cyan(`${PROGRAM_NAME} create task-schema filetransfer --tasks "FileTransfer/Connect@1,FileTransfer/Disconnect@1"`)}

  ${chalk.gray('# Sync all.json after manually adding/removing task schemas')}
  ${chalk.cyan(`${PROGRAM_NAME} sync-schemas`)}

  ${chalk.gray('# Extract a component to a new module')}
  ${chalk.cyan(`${PROGRAM_NAME} extract modules/orders.yaml Orders/CreateItem --to modules/order-create.yaml`)}

${chalk.bold.yellow('SCHEMA COMMANDS:')}
  ${chalk.gray('# Show schema for a component')}
  ${chalk.cyan(`${PROGRAM_NAME} schema form`)}
  ${chalk.cyan(`${PROGRAM_NAME} schema dataGrid`)}

  ${chalk.gray('# Show schema for a workflow task')}
  ${chalk.cyan(`${PROGRAM_NAME} schema foreach`)}
  ${chalk.cyan(`${PROGRAM_NAME} schema graphql`)}

  ${chalk.gray('# Show example YAML for a component')}
  ${chalk.cyan(`${PROGRAM_NAME} example form`)}
  ${chalk.cyan(`${PROGRAM_NAME} example workflow`)}

  ${chalk.gray('# List all available schemas')}
  ${chalk.cyan(`${PROGRAM_NAME} list`)}
  ${chalk.cyan(`${PROGRAM_NAME} list --type workflow`)}

${chalk.bold.yellow('VALIDATION TYPES:')}
  ${chalk.bold('module')}     - CargoXplorer UI module definitions (components, routes, entities)
  ${chalk.bold('workflow')}   - CargoXplorer workflow definitions (activities, tasks, triggers)
  ${chalk.bold('auto')}       - Auto-detect based on file content (checks for 'workflow:' vs 'module:')

${chalk.bold.yellow('OUTPUT FORMATS:')}
  ${chalk.bold('pretty')}     - Colorized, human-readable output with detailed error info
  ${chalk.bold('json')}       - JSON output suitable for CI/CD pipelines
  ${chalk.bold('compact')}    - Minimal output showing only pass/fail and error count

${chalk.bold.yellow('EXIT CODES:')}
  ${chalk.green('0')}  - Validation passed (no errors)
  ${chalk.red('1')}  - Validation failed (errors found)
  ${chalk.red('2')}  - CLI error (invalid arguments, file not found, etc.)

${chalk.bold.yellow('ENVIRONMENT VARIABLES:')}
  ${chalk.green('CX_SCHEMA_PATH')}     - Default path to schemas directory
  ${chalk.green('NO_COLOR')}           - Disable colored output

${chalk.bold.yellow('MORE INFORMATION:')}
  Documentation: ${chalk.underline.cyan('https://github.com/cxtms/cx-schema')}
  Report issues: ${chalk.underline.cyan('https://github.com/cxtms/cx-schema/issues')}
`;

const SCHEMA_HELP = `
${chalk.bold.yellow('SCHEMA COMMAND')}

Show the JSON Schema definition for a component, field, action, or task.

${chalk.bold.yellow('USAGE:')}
  ${chalk.cyan(`${PROGRAM_NAME} schema <name>`)}

${chalk.bold.yellow('AVAILABLE SCHEMAS:')}

  ${chalk.bold('Module Components:')}
    form, dataGrid, layout, tabs, tab, field, button, collection,
    dropdown, datasource, calendar, card, navbar, timeline

  ${chalk.bold('Workflow Core:')}
    workflow, activity, input, output, variable, trigger, schedule

  ${chalk.bold('Workflow Tasks:')}
    foreach, switch, while, validation, graphql, httpRequest,
    setVariable, map, log, error, csv, export, template, import,
    order, contact, contact-address, contact-payment-method,
    commodity, job, attachment, charge, payment,
    email-send, document-render, document-send, pdf-document,
    accounting-transaction, number, workflow-execute,
    filetransfer, caching, flow-transition, user, authentication,
    edi, note, appmodule, action-event, inventory, movement

${chalk.bold.yellow('EXAMPLES:')}
  ${chalk.cyan(`${PROGRAM_NAME} schema form`)}
  ${chalk.cyan(`${PROGRAM_NAME} schema foreach`)}
  ${chalk.cyan(`${PROGRAM_NAME} schema workflow`)}
`;

const LIST_HELP = `
${chalk.bold.yellow('LIST COMMAND')}

List all available schemas for validation.

${chalk.bold.yellow('USAGE:')}
  ${chalk.cyan(`${PROGRAM_NAME} list [options]`)}

${chalk.bold.yellow('OPTIONS:')}
  ${chalk.green('--type <type>')}    Filter by type: module, workflow, or all ${chalk.gray('(default: all)')}

${chalk.bold.yellow('EXAMPLES:')}
  ${chalk.cyan(`${PROGRAM_NAME} list`)}
  ${chalk.cyan(`${PROGRAM_NAME} list --type module`)}
  ${chalk.cyan(`${PROGRAM_NAME} list --type workflow`)}
`;

const INIT_HELP = `
${chalk.bold.yellow('INIT COMMAND')}

Initialize a new CX project with app.yaml, folders, and documentation.

${chalk.bold.yellow('USAGE:')}
  ${chalk.cyan(`${PROGRAM_NAME} init [name]`)}

${chalk.bold.yellow('ARGUMENTS:')}
  ${chalk.green('name')}          App name ${chalk.gray('(default: current directory name)')}

${chalk.bold.yellow('FILES CREATED:')}
  ${chalk.green('app.yaml')}      - Application manifest (name, description, version)
  ${chalk.green('README.md')}     - Project documentation
  ${chalk.green('AGENTS.md')}     - AI assistant instructions for validation

${chalk.bold.yellow('DIRECTORIES:')}
  ${chalk.green('modules/')}      - UI module YAML definitions
  ${chalk.green('workflows/')}    - Workflow YAML definitions
  ${chalk.green('features/')}     - Feature-scoped modules and workflows

${chalk.bold.yellow('EXAMPLES:')}
  ${chalk.cyan(`${PROGRAM_NAME} init`)}                   ${chalk.gray('# Use directory name')}
  ${chalk.cyan(`${PROGRAM_NAME} init my-app`)}             ${chalk.gray('# Use custom name')}
  ${chalk.cyan(`${PROGRAM_NAME} init @cargox/my-app`)}     ${chalk.gray('# Use scoped name')}
`;

const CREATE_HELP = `
${chalk.bold.yellow('CREATE COMMAND')}

Create a new module or workflow from template.

${chalk.bold.yellow('USAGE:')}
  ${chalk.cyan(`${PROGRAM_NAME} create <type> <name>`)}

${chalk.bold.yellow('TYPES:')}
  ${chalk.green('module')}    - Create a new UI module YAML file
  ${chalk.green('workflow')}  - Create a new workflow YAML file

${chalk.bold.yellow('WORKFLOW TEMPLATES:')}
  ${chalk.green('basic')}           Minimal starting point (default if --template omitted uses full template)
  ${chalk.green('entity-trigger')}  React to entity changes (Before/After triggers)
  ${chalk.green('document')}        Generate PDF/Excel documents
  ${chalk.green('scheduled')}       Cron-based batch processing
  ${chalk.green('utility')}         Reusable helper (called via Workflow/Execute)
  ${chalk.green('webhook')}         HTTP endpoint for external callers (anonymous, rate-limited)
  ${chalk.green('public-api')}      REST API endpoint with OpenAPI documentation
  ${chalk.green('mcp-tool')}        Expose workflow as MCP tool for AI agents
  ${chalk.green('ftp-tracking')}    Import tracking events from FTP
  ${chalk.green('ftp-edi')}         Import orders from FTP via EDI
  ${chalk.green('api-tracking')}    Fetch tracking from carrier API

${chalk.bold.yellow('EXAMPLES:')}
  ${chalk.cyan(`${PROGRAM_NAME} create module orders`)}
  ${chalk.cyan(`${PROGRAM_NAME} create workflow invoice-generator`)}
  ${chalk.cyan(`${PROGRAM_NAME} create workflow stripe-events --template webhook`)}
  ${chalk.cyan(`${PROGRAM_NAME} create workflow get-order --template public-api`)}
`;

const EXTRACT_HELP = `
${chalk.bold.yellow('EXTRACT COMMAND')}

Extract a component (and its routes) from one module into another.

${chalk.bold.yellow('USAGE:')}
  ${chalk.cyan(`${PROGRAM_NAME} extract <source-file> <component-name> --to <target-file> [--copy]`)}

${chalk.bold.yellow('OPTIONS:')}
  ${chalk.green('--copy')}   Copy instead of move. Source stays unchanged, target gets higher priority.

${chalk.bold.yellow('WHAT GETS MOVED:')}
  ${chalk.green('Component')}   - The component matching the exact name
  ${chalk.green('Routes')}      - Any routes whose component field matches the name
  ${chalk.gray('Permissions and entities are NOT moved')}

${chalk.bold.yellow('PRIORITY (--copy mode):')}
  When using --copy, the target module gets a priority higher than the source:
  ${chalk.gray('Source priority 1  → Target priority 2')}
  ${chalk.gray('Source no priority → Target priority 1')}

${chalk.bold.yellow('EXAMPLES:')}
  ${chalk.cyan(`${PROGRAM_NAME} extract modules/orders.yaml Orders/CreateItem --to modules/order-create.yaml`)}
  ${chalk.cyan(`${PROGRAM_NAME} extract modules/main.yaml Dashboard --to modules/dashboard.yaml`)}
  ${chalk.cyan(`${PROGRAM_NAME} extract modules/orders.yaml Orders/CreateItem --to modules/order-create.yaml --copy`)}
`;

// ============================================================================
// Templates
// ============================================================================

function generateAppYaml(name: string): string {
  const dirName = path.basename(process.cwd());
  const appName = name || dirName;
  const scopedName = appName.startsWith('@') ? appName : `@cargox/${appName}`;
  return `id: "${generateUUID()}"
name: "${scopedName}"
description: ""
author: "CargoX"
version: "1.0.0"
repository: ""
`;
}

function generateReadme(): string {
  return `# CargoXplorer Application

This project contains CargoXplorer modules and workflows.

## Project Structure

\`\`\`
├── app.yaml           # Application manifest
├── modules/           # UI module definitions
│   └── *.yaml
├── workflows/         # Workflow definitions
│   └── *.yaml
├── features/          # Feature-scoped modules and workflows
│   └── <feature>/
│       ├── modules/
│       └── workflows/
├── README.md          # This file
└── AGENTS.md          # AI assistant instructions
\`\`\`

## Validation

### Install the validator

\`\`\`bash
npm install @cxtms/cx-schema
\`\`\`

### Validate files

\`\`\`bash
# Validate all modules
npx cx-cli modules/*.yaml

# Validate all workflows
npx cx-cli workflows/*.yaml

# Validate with detailed output
npx cx-cli --verbose modules/my-module.yaml

# Generate validation report
npx cx-cli report modules/*.yaml workflows/*.yaml --report report.html
\`\`\`

### Create new files

\`\`\`bash
# Create a new module
npx cx-cli create module my-module

# Create a new workflow
npx cx-cli create workflow my-workflow
\`\`\`

### View schemas and examples

\`\`\`bash
# List available schemas
npx cx-cli list

# View schema for a component
npx cx-cli schema form

# View example YAML
npx cx-cli example workflow
\`\`\`

## Documentation

- [CX Schema CLI Documentation](https://docs.cargoxplorer.com/docs/documents/cx-schema-cli)
- [Module Development Guide](https://docs.cargoxplorer.com/docs/development/app-modules)
- [Workflow Development Guide](https://docs.cargoxplorer.com/docs/development/workflows)
`;
}

function generateAgentsMd(): string {
  return `# AI Assistant Instructions for CargoXplorer Development

This file provides instructions for AI assistants (like Claude, GPT, Copilot) when working with this CargoXplorer project.

## Validation Commands

When making changes to YAML files, always validate them:

\`\`\`bash
# Validate a specific module file
npx cx-cli modules/<module-name>.yaml

# Validate a specific workflow file
npx cx-cli workflows/<workflow-name>.yaml

# Validate all files with a report
npx cx-cli report modules/*.yaml workflows/*.yaml --report validation-report.md
\`\`\`

## Schema Reference

Before editing components or tasks, check the schema:

\`\`\`bash
# View schema for components
npx cx-cli schema form
npx cx-cli schema dataGrid
npx cx-cli schema layout

# View schema for workflow tasks
npx cx-cli schema foreach
npx cx-cli schema graphql
npx cx-cli schema switch
\`\`\`

## Creating New Files

Use templates to create properly structured files:

\`\`\`bash
# Create a new module
npx cx-cli create module <name>

# Create a new workflow
npx cx-cli create workflow <name>

# Create from a specific template variant
npx cx-cli create workflow <name> --template basic

# Create inside a feature folder (features/<name>/workflows/)
npx cx-cli create workflow <name> --feature billing
\`\`\`

## Module Structure

Modules contain UI component definitions:

- **Components**: form, dataGrid, layout, tabs, card, etc.
- **Fields**: text, number, select, date, checkbox, etc.
- **Actions**: navigate, mutation, query, setFields, etc.
- **Routes**: Define navigation paths

## Workflow Structure

Workflows contain automation definitions:

- **workflow**: Metadata (workflowId, name, executionMode)
- **inputs/outputs**: Parameter definitions
- **variables**: Internal state
- **activities**: Ordered steps containing tasks
- **triggers**: Manual, Entity, or Scheduled triggers

### Common Task Types

- **Control flow**: foreach, switch, while, validation
- **Data**: Query/GraphQL, Map@1, SetVariable@1
- **Entity operations**: Order/Create@1, Contact/Update@1, etc.
- **Communication**: Email/Send@1, Document/Render@1

## Best Practices

1. **Always validate** after making changes to YAML files
2. **Use verbose mode** (\`--verbose\`) for detailed error information
3. **Check schemas** before adding new properties
4. **Use templates** when creating new files
5. **Generate reports** for batch validation of multiple files
`;
}

function findTemplatesPath(): string | undefined {
  // Check for templates in node_modules
  const nodeModulesTemplates = path.join(
    process.cwd(),
    'node_modules',
    '@cxtms/cx-schema',
    'templates'
  );
  if (fs.existsSync(nodeModulesTemplates)) {
    return nodeModulesTemplates;
  }

  // Check in package directory (for development)
  const packageTemplates = path.join(__dirname, '../templates');
  if (fs.existsSync(packageTemplates)) {
    return packageTemplates;
  }

  return undefined;
}

function loadTemplate(templateName: string, variant?: string): string {
  const templatesPath = findTemplatesPath();
  if (!templatesPath) {
    throw new Error('Could not find templates directory');
  }

  // Try variant-specific template first (e.g., workflow-basic.yaml)
  if (variant) {
    const variantFile = path.join(templatesPath, `${templateName}-${variant}.yaml`);
    if (fs.existsSync(variantFile)) {
      return fs.readFileSync(variantFile, 'utf-8');
    }
    throw new Error(`Template variant not found: ${templateName}-${variant}. Available templates: ${listTemplates(templatesPath, templateName)}`);
  }

  const templateFile = path.join(templatesPath, `${templateName}.yaml`);
  if (!fs.existsSync(templateFile)) {
    throw new Error(`Template not found: ${templateName}`);
  }

  return fs.readFileSync(templateFile, 'utf-8');
}

function listTemplates(templatesPath: string, type: string): string {
  const files = fs.readdirSync(templatesPath)
    .filter(f => f.startsWith(`${type}-`) && f.endsWith('.yaml'))
    .map(f => f.replace(`${type}-`, '').replace('.yaml', ''));
  return files.length > 0 ? files.join(', ') : 'none';
}

function processTemplate(template: string, variables: Record<string, string>): string {
  let result = template;

  // Replace all {{variableName}} placeholders (but not \{{...}} which are escaped)
  for (const [key, value] of Object.entries(variables)) {
    // Match {{key}} but not \{{key}}
    const regex = new RegExp(`(?<!\\\\)\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }

  // Unescape \{{ to {{ (for runtime expressions like {{inputs.entityId}})
  result = result.replace(/\\(\{\{)/g, '$1');

  return result;
}

function generateTemplateContent(type: 'module' | 'workflow', name: string, fileName: string, variant?: string, createOptions?: string): string {
  const template = loadTemplate(type, variant);

  const displayName = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const variables: Record<string, string> = {
    name,
    displayName,
    displayNameNoSpaces: displayName.replace(/\s/g, ''),
    uuid: generateUUID(),
    fileName: fileName.replace(/\\/g, '/')
  };

  let result = processTemplate(template, variables);

  if (createOptions) {
    result = applyCreateOptions(result, createOptions);
  }

  return result;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// Create Options (--options) Support
// ============================================================================

interface CreateFieldOption {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  default?: any;
}

interface CreateOptionsObject {
  entityName?: string;
  fields: CreateFieldOption[];
}

function parseCreateOptions(optionsArg: string): CreateOptionsObject {
  const jsonStr = resolveOptionsJson(optionsArg);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e: any) {
    throw new Error(`Invalid --options JSON: ${e.message}`);
  }

  let result: CreateOptionsObject;
  if (Array.isArray(parsed)) {
    result = { fields: parsed };
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.fields)) {
    result = { entityName: parsed.entityName, fields: parsed.fields };
  } else {
    throw new Error('--options must be a JSON array of fields or an object with { entityName?, fields[] }');
  }

  for (const field of result.fields) {
    if (!field.name) throw new Error('Each field in --options must have a "name" property');
    if (!field.type) throw new Error(`Field "${field.name}" in --options must have a "type" property`);
  }

  return result;
}

function resolveOptionsJson(optionsArg: string): string {
  const trimmed = optionsArg.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return trimmed;
  }
  // Treat as file path
  if (fs.existsSync(trimmed)) {
    return fs.readFileSync(trimmed, 'utf-8');
  }
  throw new Error(`Invalid --options: not valid JSON and file not found: ${trimmed}`);
}

function fieldNameToLabel(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function fieldTypeToSchemaType(fieldType: string): string {
  switch (fieldType) {
    case 'number': return 'number';
    case 'checkbox': return 'boolean';
    default: return 'string';
  }
}

function findFormComponents(obj: any): any[] {
  const forms: any[] = [];
  if (!obj || typeof obj !== 'object') return forms;
  if (obj.component === 'form') {
    forms.push(obj);
  }
  if (obj.layout) {
    forms.push(...findFormComponents(obj.layout));
  }
  if (obj.children && Array.isArray(obj.children)) {
    for (const child of obj.children) {
      forms.push(...findFormComponents(child));
    }
  }
  return forms;
}

function updateQueryFields(queryStr: string, fieldNames: string[]): string {
  // Replace the innermost { fieldList } in a GraphQL query with new field names
  return queryStr.replace(
    /\{([^{}]+)\}/g,
    (match, inner: string) => {
      const lines = inner.trim().split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const allIdentifiers = lines.every((l: string) => /^[a-zA-Z_]\w*$/.test(l));
      if (allIdentifiers && lines.length > 0) {
        const newFields = fieldNames.map(f => `    ${f}`).join('\n');
        return `{\n${newFields}\n  }`;
      }
      return match;
    }
  );
}

function applyFieldsToForm(form: any, fields: CreateFieldOption[]): void {
  // Generate children (field components)
  form.children = fields.map(f => {
    const props: any = {
      label: { 'en-US': f.label || fieldNameToLabel(f.name) },
      type: f.type
    };
    if (f.required) props.required = true;
    return { component: 'field', name: f.name, props };
  });

  if (!form.props) return;

  // Generate initialValues.append from defaults
  const append: Record<string, any> = {};
  for (const f of fields) {
    if (f.default !== undefined) {
      append[f.name] = f.default;
    }
  }
  if (Object.keys(append).length > 0) {
    if (!form.props.initialValues) form.props.initialValues = {};
    form.props.initialValues.append = append;
  } else if (form.props.initialValues?.append) {
    delete form.props.initialValues.append;
  }

  // Generate validationSchema
  const schema: Record<string, any> = {};
  for (const f of fields) {
    const entry: any = { type: fieldTypeToSchemaType(f.type) };
    if (f.required) entry.required = true;
    schema[f.name] = entry;
  }
  form.props.validationSchema = schema;

  // Update query field lists
  const fieldNames = fields.map(f => f.name);
  if (form.props.queries && Array.isArray(form.props.queries)) {
    for (const q of form.props.queries) {
      if (q.query?.command && typeof q.query.command === 'string') {
        // Preserve 'id' in query if it was originally present and not in custom fields
        const preserveId = !fieldNames.includes('id') && /\bid\b/.test(q.query.command);
        const queryFieldNames = preserveId ? ['id', ...fieldNames] : fieldNames;
        q.query.command = updateQueryFields(q.query.command, queryFieldNames);
      }
    }
  }
}

function findDataGridComponents(obj: any): any[] {
  const grids: any[] = [];
  if (!obj || typeof obj !== 'object') return grids;
  if (obj.component === 'dataGrid') {
    grids.push(obj);
  }
  if (obj.layout) {
    grids.push(...findDataGridComponents(obj.layout));
  }
  if (obj.children && Array.isArray(obj.children)) {
    for (const child of obj.children) {
      grids.push(...findDataGridComponents(child));
    }
  }
  return grids;
}

function fieldTypeToShowAs(fieldType: string): any | null {
  switch (fieldType) {
    case 'date':
      return { component: 'text', props: { value: `{{ format ${fieldType} L }}` } };
    case 'number':
      return { component: 'text', props: { value: `{{ ${fieldType} }}` } };
    case 'checkbox':
      return { component: 'Badges/StatusesBadge' };
    default:
      return null;
  }
}

function buildColumnFromField(field: CreateFieldOption): any {
  const col: any = {
    name: field.name,
    label: { 'en-US': field.label || fieldNameToLabel(field.name) }
  };
  const showAs = fieldTypeToShowAs(field.type);
  if (showAs) col.showAs = showAs;
  return col;
}

function applyFieldsToGrid(grid: any, fields: CreateFieldOption[]): void {
  if (!grid.props?.views || !Array.isArray(grid.props.views)) return;

  const customColumns = fields.map(f => buildColumnFromField(f));

  for (const view of grid.props.views) {
    if (!view.columns || !Array.isArray(view.columns)) continue;

    // Keep id (hidden) and system columns (created, lastModified), replace the rest
    const idCols = view.columns.filter((c: any) => c.name === 'id');
    const systemCols = view.columns.filter((c: any) =>
      c.name === 'created' || c.name === 'lastModified'
    );

    view.columns = [...idCols, ...customColumns, ...systemCols];
  }
}

function applyFieldsToEntities(doc: any, fields: CreateFieldOption[], entityName?: string): void {
  if (!doc.entities || !Array.isArray(doc.entities)) return;

  for (const entity of doc.entities) {
    if (entityName) {
      entity.name = entityName;
      entity.displayName = { 'en-US': fieldNameToLabel(entityName) };
    }

    entity.fields = fields.map(f => ({
      name: f.name,
      displayName: { 'en-US': f.label || fieldNameToLabel(f.name) },
      fieldType: f.type
    }));
  }
}

function applyEntityNameToGrid(grid: any, entityName: string): void {
  if (grid.props?.options) {
    grid.props.options.rootEntityName = entityName;
  }
}

function findSelectAsyncFields(obj: any): any[] {
  const selects: any[] = [];
  if (!obj || typeof obj !== 'object') return selects;
  if (obj.component === 'field' && obj.props?.type === 'select-async') {
    selects.push(obj);
  }
  if (obj.layout) {
    selects.push(...findSelectAsyncFields(obj.layout));
  }
  if (obj.children && Array.isArray(obj.children)) {
    for (const child of obj.children) {
      selects.push(...findSelectAsyncFields(child));
    }
  }
  return selects;
}

function applyFieldsToSelectAsync(selectField: any, fields: CreateFieldOption[]): void {
  if (!selectField.props) return;

  const fieldNames = fields.map(f => f.name);

  // Update query field lists in GraphQL queries
  if (selectField.props.queries && Array.isArray(selectField.props.queries)) {
    for (const q of selectField.props.queries) {
      if (q.query?.command && typeof q.query.command === 'string') {
        q.query.command = updateQueryFields(q.query.command, fieldNames);
      }
    }
  }

  // Build itemLabelTemplate from fields (exclude id-like fields)
  const labelFields = fields.filter(f => !f.name.toLowerCase().endsWith('id'));
  if (labelFields.length > 0 && selectField.props.options) {
    const labelParts = labelFields.map(f => `{{${f.name}}}`);
    selectField.props.options.itemLabelTemplate = labelParts.join(' - ');
  }
}

function applyCreateOptions(content: string, optionsArg: string): string {
  const opts = parseCreateOptions(optionsArg);
  const fields = opts.fields;

  // Extract comment header (lines before YAML content)
  const lines = content.split('\n');
  const headerLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') {
      headerLines.push(line);
    } else {
      break;
    }
  }

  // Parse YAML
  const doc = YAML.parse(content) as any;
  if (!doc) throw new Error('Failed to parse template YAML for --options processing');

  let applied = false;

  if (doc.components && Array.isArray(doc.components)) {
    for (const comp of doc.components) {
      // Apply to form components (configuration template)
      const forms = findFormComponents(comp);
      for (const form of forms) {
        applyFieldsToForm(form, fields);
        applied = true;
      }

      // Apply to dataGrid components (grid template)
      const grids = findDataGridComponents(comp);
      for (const grid of grids) {
        applyFieldsToGrid(grid, fields);
        if (opts.entityName) {
          applyEntityNameToGrid(grid, opts.entityName);
        }
        applied = true;
      }

      // Apply to select-async fields (select template)
      const selects = findSelectAsyncFields(comp);
      for (const sel of selects) {
        applyFieldsToSelectAsync(sel, fields);
        applied = true;
      }
    }
  }

  // Apply to entities
  if (doc.entities && Array.isArray(doc.entities)) {
    applyFieldsToEntities(doc, fields, opts.entityName);
    applied = true;
  }

  if (!applied) {
    console.warn(chalk.yellow('Warning: --options provided but no form or dataGrid component found in template'));
    return content;
  }

  // Dump back to YAML
  const yamlContent = YAML.stringify(doc, {
    indent: 2,
    lineWidth: 0,
    singleQuote: false,
  });

  return headerLines.join('\n') + yamlContent;
}

// ============================================================================
// Init and Create Commands
// ============================================================================

function runInit(name?: string): void {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                  CX PROJECT INITIALIZATION                        ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝\n'));

  const files = [
    { name: 'app.yaml', content: generateAppYaml(name || '') },
    { name: 'README.md', content: generateReadme() },
    { name: 'AGENTS.md', content: generateAgentsMd() }
  ];

  const createdDirs: string[] = [];
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];

  // Create directories
  for (const dir of ['modules', 'workflows', 'features']) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      createdDirs.push(dir);
    }
  }

  // Create files
  for (const file of files) {
    const filePath = path.join(process.cwd(), file.name);
    if (fs.existsSync(filePath)) {
      skippedFiles.push(file.name);
    } else {
      fs.writeFileSync(filePath, file.content, 'utf-8');
      createdFiles.push(file.name);
    }
  }

  // Output summary
  if (createdDirs.length > 0) {
    console.log(chalk.bold('  Created directories:'));
    for (const dir of createdDirs) {
      console.log(chalk.green(`    ✓ ${dir}/`));
    }
    console.log('');
  }

  if (createdFiles.length > 0) {
    console.log(chalk.bold('  Created files:'));
    for (const file of createdFiles) {
      console.log(chalk.green(`    ✓ ${file}`));
    }
    console.log('');
  }

  if (skippedFiles.length > 0) {
    console.log(chalk.bold('  Skipped (already exist):'));
    for (const file of skippedFiles) {
      console.log(chalk.yellow(`    - ${file}`));
    }
    console.log('');
  }

  // Setup CLAUDE.md with CX instructions
  runSetupClaude();

  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.gray(`    1. Edit ${chalk.white('app.yaml')} to configure your project`));
  console.log(chalk.gray(`    2. Create modules: ${chalk.white(`${PROGRAM_NAME} create module <name>`)}`));
  console.log(chalk.gray(`    3. Create workflows: ${chalk.white(`${PROGRAM_NAME} create workflow <name>`)}`));
  console.log(chalk.gray(`    4. Validate files: ${chalk.white(`${PROGRAM_NAME} modules/*.yaml`)}`));
  console.log('');
}

function runCreate(type: string | undefined, name: string | undefined, template?: string, feature?: string, createOptions?: string): void {
  // Handle task-schema creation separately
  if (type === 'task-schema') {
    runCreateTaskSchema(name, createOptions);
    return;
  }

  if (!type || !['module', 'workflow'].includes(type)) {
    console.error(chalk.red('Error: Invalid or missing type. Use: module, workflow, or task-schema'));
    console.error(chalk.gray(`Example: ${PROGRAM_NAME} create module my-module`));
    process.exit(2);
  }

  if (!name) {
    console.error(chalk.red(`Error: Missing name for ${type}`));
    console.error(chalk.gray(`Example: ${PROGRAM_NAME} create ${type} my-${type}`));
    process.exit(2);
  }

  // Sanitize name: replace invalid chars with hyphen, collapse runs, trim edges
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

  // Determine output directory and file
  // workflows/ or features/<feature>/workflows/ (same for modules)
  const baseDir = type === 'module' ? 'modules' : 'workflows';
  const dir = feature
    ? path.join('features', feature.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, ''), baseDir)
    : baseDir;
  const fileName = `${safeName}.yaml`;
  const filePath = path.join(process.cwd(), dir, fileName);

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    console.error(chalk.red(`Error: File already exists: ${filePath}`));
    process.exit(2);
  }

  // Create directory if needed
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Generate content from template
  const relativeFileName = path.join(dir, fileName);
  let content: string;
  try {
    content = generateTemplateContent(type as 'module' | 'workflow', safeName, relativeFileName, template, createOptions);
  } catch (error: any) {
    console.error(chalk.red(`Error loading template: ${error.message}`));
    process.exit(2);
  }

  // Write file
  fs.writeFileSync(filePath, content, 'utf-8');

  console.log(chalk.green(`\n✓ Created ${type}: ${path.join(dir, fileName)}`));
  console.log(chalk.gray(`\n  Next steps:`));
  console.log(chalk.gray(`    1. Edit ${chalk.white(filePath)} to customize`));
  console.log(chalk.gray(`    2. Validate: ${chalk.white(`${PROGRAM_NAME} ${filePath}`)}`));
  console.log(chalk.gray(`    3. View schema: ${chalk.white(`${PROGRAM_NAME} schema ${type}`)}`));
  console.log('');
}

// ============================================================================
// Create Task Schema Command
// ============================================================================

function runCreateTaskSchema(name: string | undefined, tasks?: string): void {
  if (!name) {
    console.error(chalk.red('Error: Missing name for task-schema'));
    console.error(chalk.gray(`Example: ${PROGRAM_NAME} create task-schema filetransfer --tasks "FileTransfer/Connect@1,FileTransfer/Disconnect@1"`));
    process.exit(2);
  }

  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

  // Find schemas directory — prefer source schemas/ in dev, fall back to standard resolution
  let schemasDir = path.join(process.cwd(), 'schemas');
  if (!fs.existsSync(schemasDir)) {
    const resolved = findSchemasPath();
    if (!resolved) {
      console.error(chalk.red('Error: Cannot find schemas directory'));
      process.exit(2);
    }
    schemasDir = resolved;
  }

  const tasksDir = path.join(schemasDir, 'workflows', 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  const filePath = path.join(tasksDir, `${safeName}.json`);
  if (fs.existsSync(filePath)) {
    console.error(chalk.red(`Error: Schema file already exists: ${filePath}`));
    process.exit(2);
  }

  // Parse --tasks flag (passed via --options)
  const taskEnums: string[] = [];
  if (tasks) {
    for (const t of tasks.split(',')) {
      const trimmed = t.trim();
      if (trimmed) taskEnums.push(trimmed);
    }
  }

  // Derive a title from the name
  const title = safeName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') + ' Tasks';

  // Build the schema JSON
  const schema: Record<string, any> = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title,
    description: `${title} operations`,
    type: 'object',
    properties: {
      task: {
        type: 'string',
        ...(taskEnums.length > 0 ? { enum: taskEnums } : {}),
        description: 'Task type identifier'
      },
      name: {
        type: 'string',
        description: 'Step name identifier'
      },
      description: {
        type: 'string',
        description: 'Step description'
      },
      conditions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            expression: { type: 'string' }
          },
          required: ['expression']
        }
      },
      continueOnError: {
        type: 'boolean'
      },
      inputs: {
        type: 'object',
        description: `${title} inputs`,
        additionalProperties: true
      },
      outputs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            mapping: { type: 'string' }
          },
          required: ['name', 'mapping']
        }
      }
    },
    required: ['task'],
    additionalProperties: true
  };

  fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf-8');

  // Sync all.json
  syncAllJson(tasksDir);

  // Invalidate cache so new schema is immediately discoverable
  _workflowTaskNamesCache = null;

  console.log(chalk.green(`\n✓ Created task schema: ${path.relative(process.cwd(), filePath)}`));
  console.log(chalk.gray(`\n  Next steps:`));
  console.log(chalk.gray(`    1. Edit ${chalk.white(filePath)} to add typed input properties`));
  console.log(chalk.gray(`    2. Verify: ${chalk.white(`${PROGRAM_NAME} schema ${safeName}`)}`));
  console.log(chalk.gray(`    3. all.json has been auto-updated with the new reference`));
  console.log('');
}

// ============================================================================
// Sync all.json (auto-regenerate $ref entries from task schema directory)
// ============================================================================

function syncAllJson(tasksDir: string): void {
  const files = fs.readdirSync(tasksDir)
    .filter(f => f.endsWith('.json') && f !== 'all.json' && f !== 'generic.json')
    .sort();

  const anyOfRefs = files.map(f => ({ $ref: f }));
  // generic.json always last as fallback
  if (fs.existsSync(path.join(tasksDir, 'generic.json'))) {
    anyOfRefs.push({ $ref: 'generic.json' });
  }

  const allJson = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'All Workflow Tasks',
    description: 'Aggregator schema for all workflow task types. Uses anyOf to allow matching any known task type or falling back to generic task structure.',
    type: 'object',
    anyOf: anyOfRefs
  };

  fs.writeFileSync(
    path.join(tasksDir, 'all.json'),
    JSON.stringify(allJson, null, 2) + '\n',
    'utf-8'
  );
}

function runSyncSchemas(): void {
  // Find schemas directory
  let schemasDir = path.join(process.cwd(), 'schemas');
  if (!fs.existsSync(schemasDir)) {
    const resolved = findSchemasPath();
    if (!resolved) {
      console.error(chalk.red('Error: Cannot find schemas directory'));
      process.exit(2);
    }
    schemasDir = resolved;
  }

  const tasksDir = path.join(schemasDir, 'workflows', 'tasks');
  if (!fs.existsSync(tasksDir)) {
    console.error(chalk.red('Error: Tasks directory not found'));
    process.exit(2);
  }

  syncAllJson(tasksDir);

  // Invalidate cache
  _workflowTaskNamesCache = null;

  const taskCount = fs.readdirSync(tasksDir)
    .filter(f => f.endsWith('.json') && f !== 'all.json' && f !== 'generic.json')
    .length;

  console.log(chalk.green(`\n✓ Synced all.json with ${taskCount} task schemas (+ generic fallback)`));
  console.log('');
}

// ============================================================================
// Install Skills Command
// ============================================================================

function findPackageSkillsDir(): string | null {
  // Skills live in the package's .claude/skills/ directory
  // When running from dist/cli.js, the package root is one level up
  const packageRoot = path.resolve(__dirname, '..');
  const skillsDir = path.join(packageRoot, '.claude', 'skills');
  if (fs.existsSync(skillsDir)) {
    return skillsDir;
  }
  return null;
}

function copyDirectorySync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function runInstallSkills(): void {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                  INSTALL CLAUDE CODE SKILLS                       ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝\n'));

  const packageSkillsDir = findPackageSkillsDir();
  if (!packageSkillsDir) {
    console.error(chalk.red('Error: Could not find skills in the cx-schema package.'));
    process.exit(2);
  }

  const projectRoot = process.cwd();
  const skillNames = ['cx-core', 'cx-module', 'cx-workflow'];
  let installed = 0;

  for (const skillName of skillNames) {
    const skillSource = path.join(packageSkillsDir, skillName);
    if (!fs.existsSync(skillSource)) {
      console.log(chalk.yellow(`  Skipping ${skillName} (not found in package)`));
      continue;
    }

    const skillDest = path.join(projectRoot, '.claude', 'skills', skillName);
    console.log(`  Installing ${chalk.cyan(skillName)}...`);

    // Remove existing skill directory to clean up stale files
    if (fs.existsSync(skillDest)) {
      fs.rmSync(skillDest, { recursive: true });
    }

    copyDirectorySync(skillSource, skillDest);
    installed++;
  }

  // Remove deprecated cx-build skill if it exists
  const oldSkillDest = path.join(projectRoot, '.claude', 'skills', 'cx-build');
  if (fs.existsSync(oldSkillDest)) {
    fs.rmSync(oldSkillDest, { recursive: true });
    console.log(chalk.gray('  Removed deprecated cx-build skill.'));
  }

  console.log('');
  console.log(chalk.green(`✓ Installed ${installed} skill(s) to .claude/skills/`));
  console.log('');
}

// ============================================================================
// Update Command
// ============================================================================

function runUpdate(): void {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                  UPDATE @cxtms/cx-schema                          ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝\n'));

  const { execSync } = require('child_process');

  console.log('  Updating to latest version...\n');

  try {
    execSync('npm install @cxtms/cx-schema@latest', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Read installed version from the updated package
    const installedPkgPath = path.join(process.cwd(), 'node_modules', '@cxtms', 'cx-schema', 'package.json');
    let installedVersion = 'unknown';
    if (fs.existsSync(installedPkgPath)) {
      installedVersion = JSON.parse(fs.readFileSync(installedPkgPath, 'utf-8')).version;
    }

    console.log('');
    console.log(chalk.green(`✓ @cxtms/cx-schema updated to v${installedVersion}`));
  } catch (error: any) {
    console.error(chalk.red('\nError: Failed to update @cxtms/cx-schema'));
    console.error(chalk.gray(error.message));
    process.exit(1);
  }

  // Reinstall skills and update CLAUDE.md (postinstall handles schemas)
  runInstallSkills();
  runSetupClaude();
}

// ============================================================================
// Setup Claude Command
// ============================================================================

const CX_CLAUDE_MARKER = '<!-- cx-schema-instructions -->';

function generateClaudeMdContent(): string {
  return `${CX_CLAUDE_MARKER}
## CargoXplorer Project

This is a CargoXplorer (CX) application. Modules and workflows are defined as YAML files validated against JSON schemas provided by \`@cxtms/cx-schema\`.

### Project Structure

\`\`\`
app.yaml              # Application manifest (name, version, description)
modules/              # UI module YAML files
workflows/            # Workflow YAML files
features/             # Feature-scoped modules and workflows
  <feature>/
    modules/
    workflows/
\`\`\`

### CLI — \`cx-cli\`

**Always scaffold via CLI, never write YAML from scratch.**

| Command | Description |
|---------|-------------|
| \`npx cx-cli create module <name>\` | Scaffold a UI module |
| \`npx cx-cli create workflow <name>\` | Scaffold a workflow |
| \`npx cx-cli create module <name> --template <t>\` | Use a specific template |
| \`npx cx-cli create workflow <name> --template <t>\` | Use a specific template |
| \`npx cx-cli create module <name> --feature <f>\` | Place under features/<f>/modules/ |
| \`npx cx-cli <file.yaml>\` | Validate a YAML file |
| \`npx cx-cli <file.yaml> --verbose\` | Validate with detailed errors |
| \`npx cx-cli schema <name>\` | Show JSON schema for a component or task |
| \`npx cx-cli example <name>\` | Show example YAML |
| \`npx cx-cli list\` | List all available schemas |
| \`npx cx-cli extract <src> <comp> --to <tgt>\` | Move component between modules |

**Module templates:** \`default\`, \`form\`, \`grid\`, \`select\`, \`configuration\`
**Workflow templates:** \`basic\`, \`entity-trigger\`, \`document\`, \`scheduled\`, \`utility\`, \`webhook\`, \`public-api\`, \`mcp-tool\`, \`ftp-tracking\`, \`ftp-edi\`, \`api-tracking\`

### Skills (slash commands)

| Skill | Purpose |
|-------|---------|
| \`/cx-module <description>\` | Generate a UI module (forms, grids, screens) |
| \`/cx-workflow <description>\` | Generate a workflow (automation, triggers, integrations) |
| \`/cx-core <entity or question>\` | Look up entity fields, enums, and domain reference |

### Workflow: Scaffold → Customize → Validate

1. **Scaffold** — \`npx cx-cli create module|workflow <name> --template <t>\`
2. **Read** the generated file
3. **Customize** for the use case
4. **Validate** — \`npx cx-cli <file.yaml>\` — run after every change, fix all errors
${CX_CLAUDE_MARKER}`;
}

function runSetupClaude(): void {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                  SETUP CLAUDE.md                                  ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝\n'));

  const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
  const cxContent = generateClaudeMdContent();

  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf-8');

    if (existing.includes(CX_CLAUDE_MARKER)) {
      // Replace existing CX section
      const markerRegex = new RegExp(
        CX_CLAUDE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[\\s\\S]*?' +
        CX_CLAUDE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      const updated = existing.replace(markerRegex, cxContent);
      fs.writeFileSync(claudeMdPath, updated, 'utf-8');
      console.log(chalk.green('  ✓ Updated CX instructions in existing CLAUDE.md'));
    } else {
      // Append to existing file
      const separator = existing.endsWith('\n') ? '\n' : '\n\n';
      fs.writeFileSync(claudeMdPath, existing + separator + cxContent + '\n', 'utf-8');
      console.log(chalk.green('  ✓ Appended CX instructions to existing CLAUDE.md'));
    }
  } else {
    // Create new file
    fs.writeFileSync(claudeMdPath, `# Project Instructions\n\n${cxContent}\n`, 'utf-8');
    console.log(chalk.green('  ✓ Created CLAUDE.md with CX instructions'));
  }

  console.log('');
}

// ============================================================================
// Extract Command
// ============================================================================

function runExtract(sourceFile: string | undefined, componentName: string | undefined, targetFile: string | undefined, copy?: boolean): void {
  // Validate args
  if (!sourceFile || !componentName || !targetFile) {
    console.error(chalk.red('Error: Missing required arguments'));
    console.error(chalk.gray(`Usage: ${PROGRAM_NAME} extract <source-file> <component-name> --to <target-file> [--copy]`));
    process.exit(2);
  }

  // Check source exists
  if (!fs.existsSync(sourceFile)) {
    console.error(chalk.red(`Error: Source file not found: ${sourceFile}`));
    process.exit(2);
  }

  // Read and parse source (Document API preserves comments)
  const sourceContent = fs.readFileSync(sourceFile, 'utf-8');
  const srcDoc = YAML.parseDocument(sourceContent);
  const sourceJS = srcDoc.toJS() as any;
  if (!sourceJS || !Array.isArray(sourceJS.components)) {
    console.error(chalk.red(`Error: Source file is not a valid module (missing components array): ${sourceFile}`));
    process.exit(2);
  }

  // Get the AST components sequence
  const srcComponents = srcDoc.get('components', true) as YAMLSeq;
  if (!isSeq(srcComponents)) {
    console.error(chalk.red(`Error: Source components is not a sequence: ${sourceFile}`));
    process.exit(2);
  }

  // Find component by exact name match
  const compIndex = srcComponents.items.findIndex((item) => {
    return isMap(item) && item.get('name') === componentName;
  });
  if (compIndex === -1) {
    const available = sourceJS.components.map((c: any) => c.name).filter(Boolean);
    console.error(chalk.red(`Error: Component not found: ${componentName}`));
    if (available.length > 0) {
      console.error(chalk.gray('Available components:'));
      for (const name of available) {
        console.error(chalk.gray(`  - ${name}`));
      }
    }
    process.exit(2);
  }

  // Get the component AST node (clone for copy, take for move)
  const componentNode = copy
    ? srcDoc.createNode(sourceJS.components[compIndex])
    : srcComponents.items[compIndex];

  // Capture comment: if this is the first item, the comment lives on the parent seq
  let componentComment: string | undefined;
  if (compIndex === 0 && srcComponents.commentBefore) {
    componentComment = srcComponents.commentBefore;
    if (!copy) {
      // Transfer the comment away from the source seq (it belongs to the extracted component)
      srcComponents.commentBefore = undefined;
    }
  } else {
    componentComment = (componentNode as any).commentBefore;
  }

  // Find matching routes (by index in AST)
  const srcRoutes = srcDoc.get('routes', true) as YAMLSeq | undefined;
  const matchedRouteIndices: number[] = [];
  if (isSeq(srcRoutes)) {
    srcRoutes.items.forEach((item, idx) => {
      if (isMap(item) && item.get('component') === componentName) {
        matchedRouteIndices.push(idx);
      }
    });
  }

  // Collect route AST nodes (clone for copy, reference for move)
  const routeNodes = matchedRouteIndices.map(idx => {
    if (copy) {
      return srcDoc.createNode(sourceJS.routes[idx]);
    }
    return srcRoutes!.items[idx];
  });

  // Load or create target document
  let tgtDoc: YAMLDocument;
  let targetCreated = false;
  if (fs.existsSync(targetFile)) {
    const targetContent = fs.readFileSync(targetFile, 'utf-8');
    tgtDoc = YAML.parseDocument(targetContent);
    const targetJS = tgtDoc.toJS() as any;
    if (!targetJS || !Array.isArray(targetJS.components)) {
      console.error(chalk.red(`Error: Target file is not a valid module (missing components array): ${targetFile}`));
      process.exit(2);
    }
    // Check for duplicate component name
    const duplicate = targetJS.components.find((c: any) => c.name === componentName);
    if (duplicate) {
      console.error(chalk.red(`Error: Target already contains a component named "${componentName}"`));
      process.exit(2);
    }
  } else {
    // Create new module scaffold
    const baseName = path.basename(targetFile, path.extname(targetFile));
    const moduleName = baseName
      .split('-')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');

    const sourceModule = typeof sourceJS.module === 'object' ? sourceJS.module : null;
    const displayName = moduleName.replace(/([a-z])([A-Z])/g, '$1 $2');
    const moduleObj: any = {
      name: moduleName,
      appModuleId: generateUUID(),
      displayName: { 'en-US': displayName },
      description: { 'en-US': `${displayName} module` },
      application: sourceModule?.application || sourceJS.application || 'cx',
    };

    // In copy mode, set priority higher than source
    if (copy) {
      const sourcePriority = sourceModule?.priority;
      moduleObj.priority = computeExtractPriority(sourcePriority);
    }

    // Parse from string so the document has proper AST context for comment preservation
    const scaffoldStr = YAML.stringify({
      module: moduleObj,
      entities: [],
      permissions: [],
      components: [],
      routes: []
    }, { indent: 2, lineWidth: 0, singleQuote: false });
    tgtDoc = YAML.parseDocument(scaffoldStr);
    targetCreated = true;
  }

  // Add component to target (ensure block style so comments are preserved)
  const tgtComponents = tgtDoc.get('components', true) as YAMLSeq;
  if (isSeq(tgtComponents)) {
    tgtComponents.flow = false;
    // Apply the captured comment: if it's the first item in target, set on seq; otherwise on node
    if (componentComment) {
      if (tgtComponents.items.length === 0) {
        tgtComponents.commentBefore = componentComment;
      } else {
        (componentNode as any).commentBefore = componentComment;
      }
    }
    tgtComponents.items.push(componentNode);
  } else {
    tgtDoc.addIn(['components'], componentNode);
  }

  // In move mode, remove component from source
  if (!copy) {
    srcComponents.items.splice(compIndex, 1);
  }

  // Add routes to target
  if (routeNodes.length > 0) {
    let tgtRoutes = tgtDoc.get('routes', true) as YAMLSeq | undefined;
    if (!isSeq(tgtRoutes)) {
      tgtDoc.set('routes', tgtDoc.createNode([]));
      tgtRoutes = tgtDoc.get('routes', true) as YAMLSeq;
    }
    tgtRoutes!.flow = false;
    for (const routeNode of routeNodes) {
      tgtRoutes!.items.push(routeNode);
    }

    // In move mode, remove routes from source (reverse order to preserve indices)
    if (!copy && isSeq(srcRoutes)) {
      for (let i = matchedRouteIndices.length - 1; i >= 0; i--) {
        srcRoutes.items.splice(matchedRouteIndices[i], 1);
      }
    }
  }

  // Ensure target directory exists
  const targetDir = path.dirname(targetFile);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Write files (toString preserves comments)
  const toStringOpts = { indent: 2, lineWidth: 0, singleQuote: false };
  if (!copy) {
    fs.writeFileSync(sourceFile, srcDoc.toString(toStringOpts), 'utf-8');
  }
  fs.writeFileSync(targetFile, tgtDoc.toString(toStringOpts), 'utf-8');

  // Print summary
  const action = copy ? 'Copied' : 'Extracted';
  console.log(chalk.green(`\n✓ ${action} component: ${chalk.bold(componentName)}`));
  console.log(chalk.gray(`  Routes ${copy ? 'copied' : 'moved'}: ${matchedRouteIndices.length}`));
  if (!copy) {
    console.log(chalk.gray(`  Source: ${sourceFile} (updated)`));
  } else {
    console.log(chalk.gray(`  Source: ${sourceFile} (unchanged)`));
  }
  console.log(chalk.gray(`  Target: ${targetFile} (${targetCreated ? 'created' : 'updated'})`));
  console.log('');
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(args: string[]): ParsedArgs {
  const files: string[] = [];
  let command: string | null = null;
  const options: CLIOptions = {
    help: false,
    version: false,
    type: 'auto',
    format: 'pretty',
    verbose: false,
    showSchema: null,
    showExample: null,
    listSchemas: false,
    listTasks: false,
    quiet: false,
    reportFormat: 'json'
  };

  // Check for commands
  const commands = ['validate', 'schema', 'example', 'list', 'help', 'version', 'report', 'init', 'create', 'extract', 'sync-schemas', 'install-skills', 'update', 'setup-claude'];
  if (args.length > 0 && commands.includes(args[0])) {
    command = args[0];
    args = args.slice(1);
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg === '--schemas' || arg === '-s') {
      options.schemasPath = args[++i];
    } else if (arg === '--type' || arg === '-t') {
      const typeArg = args[++i];
      if (['module', 'workflow', 'auto'].includes(typeArg)) {
        options.type = typeArg as ValidationType;
      } else {
        console.error(chalk.red(`Invalid type: ${typeArg}. Use: module, workflow, or auto`));
        process.exit(2);
      }
    } else if (arg === '--format' || arg === '-f') {
      const formatArg = args[++i];
      if (['pretty', 'json', 'compact'].includes(formatArg)) {
        options.format = formatArg as OutputFormat;
      } else {
        console.error(chalk.red(`Invalid format: ${formatArg}. Use: pretty, json, or compact`));
        process.exit(2);
      }
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--json') {
      options.format = 'json';
    } else if (arg === '--report' || arg === '-r') {
      options.report = args[++i];
    } else if (arg === '--report-format') {
      const reportFormatArg = args[++i];
      if (['html', 'markdown', 'json'].includes(reportFormatArg)) {
        options.reportFormat = reportFormatArg as ReportFormat;
      } else {
        console.error(chalk.red(`Invalid report format: ${reportFormatArg}. Use: html, markdown, or json`));
        process.exit(2);
      }
    } else if (arg === '--template') {
      options.template = args[++i];
    } else if (arg === '--feature') {
      options.feature = args[++i];
    } else if (arg === '--options') {
      options.createOptions = args[++i];
    } else if (arg === '--tasks') {
      options.createTasks = args[++i];
    } else if (arg === '--to') {
      options.extractTo = args[++i];
    } else if (arg === '--copy') {
      options.extractCopy = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    } else {
      console.error(chalk.red(`Unknown option: ${arg}`));
      console.error(`Use ${chalk.cyan(`${PROGRAM_NAME} --help`)} for usage information`);
      process.exit(2);
    }
  }

  // Handle schema command
  if (command === 'schema' && files.length > 0) {
    options.showSchema = files[0];
  }

  // Handle example command
  if (command === 'example' && files.length > 0) {
    options.showExample = files[0];
  }

  // Handle list command
  if (command === 'list') {
    options.listSchemas = true;
  }

  // Handle help command
  if (command === 'help') {
    options.help = true;
  }

  // Handle version command
  if (command === 'version') {
    options.version = true;
  }

  return { command, files, options };
}

// ============================================================================
// Schema Path Finding
// ============================================================================

function findSchemasPath(): string | undefined {
  // Check environment variable
  if (process.env.CX_SCHEMA_PATH && fs.existsSync(process.env.CX_SCHEMA_PATH)) {
    return process.env.CX_SCHEMA_PATH;
  }

  // Check for .cx-schema in current directory
  const localSchemas = path.join(process.cwd(), '.cx-schema');
  if (fs.existsSync(localSchemas)) {
    return localSchemas;
  }

  // Check for schemas in node_modules
  const nodeModulesSchemas = path.join(
    process.cwd(),
    'node_modules',
    '@cxtms/cx-schema',
    'schemas'
  );
  if (fs.existsSync(nodeModulesSchemas)) {
    return nodeModulesSchemas;
  }

  // Check in package directory (for development)
  const packageSchemas = path.join(__dirname, '../schemas');
  if (fs.existsSync(packageSchemas)) {
    return packageSchemas;
  }

  return undefined;
}

// ============================================================================
// Auto-detection
// ============================================================================

function detectFileType(filePath: string): ValidationType {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = YAML.parse(content) as any;

    if (data && typeof data === 'object') {
      if ('workflow' in data) {
        return 'workflow';
      }
      if ('module' in data || 'components' in data) {
        return 'module';
      }
    }

    // Check file path for hints
    if (filePath.includes('workflow')) {
      return 'workflow';
    }
    if (filePath.includes('module')) {
      return 'module';
    }

    // Default to module
    return 'module';
  } catch {
    return 'module';
  }
}

// ============================================================================
// Schema Display
// ============================================================================

// Cache for dynamically discovered workflow task schema names
let _workflowTaskNamesCache: Set<string> | null = null;

function getWorkflowTaskNames(schemasPath: string): Set<string> {
  if (_workflowTaskNamesCache) return _workflowTaskNamesCache;
  const tasksDir = path.join(schemasPath, 'workflows', 'tasks');
  _workflowTaskNamesCache = new Set<string>();
  if (fs.existsSync(tasksDir)) {
    for (const file of fs.readdirSync(tasksDir)) {
      if (file.endsWith('.json') && file !== 'all.json') {
        _workflowTaskNamesCache.add(file.replace('.json', '').toLowerCase().replace(/[^a-z0-9-]/g, ''));
      }
    }
  }
  // Also include common definitions
  const commonDir = path.join(schemasPath, 'workflows', 'common');
  if (fs.existsSync(commonDir)) {
    for (const file of fs.readdirSync(commonDir)) {
      if (file.endsWith('.json')) {
        _workflowTaskNamesCache.add(file.replace('.json', '').toLowerCase().replace(/[^a-z0-9-]/g, ''));
      }
    }
  }
  return _workflowTaskNamesCache;
}

function findSchemaFile(schemasPath: string, name: string, preferWorkflow: boolean = false): string | null {
  // Normalize name: lowercase, strip non-alphanumeric except hyphens
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '');

  // Dynamically detect workflow schema names from directory contents
  const workflowCoreNames = ['workflow', 'activity', 'input', 'output', 'variable', 'trigger', 'schedule'];
  const workflowTaskNames = getWorkflowTaskNames(schemasPath);
  const isWorkflowSchema = workflowCoreNames.includes(normalizedName) ||
                           workflowTaskNames.has(normalizedName);

  // Build search paths using normalized name for consistency
  const searchPaths = preferWorkflow || isWorkflowSchema
    ? [
        // Workflow schemas first for workflow-related names
        path.join(schemasPath, 'workflows', `${normalizedName}.json`),
        path.join(schemasPath, 'workflows', 'tasks', `${normalizedName}.json`),
        path.join(schemasPath, 'workflows', 'common', `${normalizedName}.json`),
        // Then module schemas
        path.join(schemasPath, 'components', `${normalizedName}.json`),
        path.join(schemasPath, 'fields', `${normalizedName}.json`),
        path.join(schemasPath, 'actions', `${normalizedName}.json`)
      ]
    : [
        // Module schemas first
        path.join(schemasPath, 'components', `${normalizedName}.json`),
        path.join(schemasPath, 'fields', `${normalizedName}.json`),
        path.join(schemasPath, 'actions', `${normalizedName}.json`),
        // Then workflow schemas
        path.join(schemasPath, 'workflows', `${normalizedName}.json`),
        path.join(schemasPath, 'workflows', 'tasks', `${normalizedName}.json`),
        path.join(schemasPath, 'workflows', 'common', `${normalizedName}.json`)
      ];

  for (const schemaPath of searchPaths) {
    if (fs.existsSync(schemaPath)) {
      return schemaPath;
    }
  }

  // Also try with the original name (preserving case) for backwards compatibility
  if (normalizedName !== name) {
    const caseSensitivePaths = [
      path.join(schemasPath, 'workflows', 'tasks', `${name}.json`),
      path.join(schemasPath, 'workflows', `${name}.json`),
      path.join(schemasPath, 'components', `${name}.json`),
      path.join(schemasPath, 'fields', `${name}.json`),
      path.join(schemasPath, 'actions', `${name}.json`)
    ];
    for (const schemaPath of caseSensitivePaths) {
      if (fs.existsSync(schemaPath)) {
        return schemaPath;
      }
    }
  }

  // Try fuzzy matching
  const allSchemas = getAllSchemas(schemasPath);
  for (const schema of allSchemas) {
    const schemaBaseName = path.basename(schema, '.json').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (schemaBaseName === normalizedName || schemaBaseName.includes(normalizedName)) {
      return schema;
    }
  }

  return null;
}

function getAllSchemas(schemasPath: string): string[] {
  const schemas: string[] = [];

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        scanDir(filePath);
      } else if (file.endsWith('.json')) {
        schemas.push(filePath);
      }
    }
  }

  scanDir(schemasPath);
  return schemas;
}

function showSchema(schemasPath: string, name: string): void {
  const schemaFile = findSchemaFile(schemasPath, name);

  if (!schemaFile) {
    console.error(chalk.red(`Schema not found: ${name}`));
    console.error(chalk.gray(`Use '${PROGRAM_NAME} list' to see available schemas`));
    process.exit(2);
  }

  const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
  const relativePath = path.relative(schemasPath, schemaFile);

  console.log(chalk.bold.cyan(`\nSchema: ${relativePath}\n`));
  console.log(chalk.gray('─'.repeat(70)));
  console.log(JSON.stringify(schema, null, 2));
  console.log(chalk.gray('─'.repeat(70)));
}

function showExample(schemasPath: string, name: string): void {
  const schemaFile = findSchemaFile(schemasPath, name);

  if (!schemaFile) {
    console.error(chalk.red(`Schema not found: ${name}`));
    console.error(chalk.gray(`Use '${PROGRAM_NAME} list' to see available schemas`));
    process.exit(2);
  }

  const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
  const relativePath = path.relative(schemasPath, schemaFile);

  console.log(chalk.bold.cyan(`\nExample for: ${relativePath}\n`));
  console.log(chalk.gray('─'.repeat(70)));

  // Generate example from schema
  const example = generateExampleFromSchema(schema, name);
  console.log(YAML.stringify(example, { indent: 2, lineWidth: 100 }));
  console.log(chalk.gray('─'.repeat(70)));
}

function generateExampleFromSchema(schema: any, name: string): any {
  // Check for x-example or examples in schema
  if (schema['x-example']) {
    return schema['x-example'];
  }
  if (schema['x-examples'] && Array.isArray(schema['x-examples'])) {
    return schema['x-examples'][0];
  }
  if (schema.examples && Array.isArray(schema.examples)) {
    return schema.examples[0];
  }

  // Generate basic example from properties
  const example: any = {};

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
      if (prop['x-example'] !== undefined) {
        example[key] = prop['x-example'];
      } else if (prop.const !== undefined) {
        example[key] = prop.const;
      } else if (prop.enum && prop.enum.length > 0) {
        example[key] = prop.enum[0];
      } else if (prop.type === 'string') {
        example[key] = prop.description ? `<${key}>` : 'example';
      } else if (prop.type === 'number' || prop.type === 'integer') {
        example[key] = 1;
      } else if (prop.type === 'boolean') {
        example[key] = true;
      } else if (prop.type === 'array') {
        example[key] = [];
      } else if (prop.type === 'object') {
        example[key] = {};
      }
    }
  }

  return example;
}

function listSchemas(schemasPath: string, type: ValidationType): void {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║              AVAILABLE SCHEMAS                            ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝\n'));

  if (type === 'auto' || type === 'module') {
    console.log(chalk.bold.yellow('MODULE SCHEMAS:'));
    console.log(chalk.gray('─'.repeat(50)));

    // Components
    const componentsDir = path.join(schemasPath, 'components');
    if (fs.existsSync(componentsDir)) {
      console.log(chalk.bold('\n  Components:'));
      const components = fs.readdirSync(componentsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      console.log(chalk.green('    ' + components.join(', ')));
    }

    // Fields
    const fieldsDir = path.join(schemasPath, 'fields');
    if (fs.existsSync(fieldsDir)) {
      console.log(chalk.bold('\n  Fields:'));
      const fields = fs.readdirSync(fieldsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      console.log(chalk.green('    ' + fields.join(', ')));
    }

    // Actions
    const actionsDir = path.join(schemasPath, 'actions');
    if (fs.existsSync(actionsDir)) {
      console.log(chalk.bold('\n  Actions:'));
      const actions = fs.readdirSync(actionsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      console.log(chalk.green('    ' + actions.join(', ')));
    }
  }

  if (type === 'auto' || type === 'workflow') {
    console.log(chalk.bold.yellow('\nWORKFLOW SCHEMAS:'));
    console.log(chalk.gray('─'.repeat(50)));

    // Workflow core
    const workflowsDir = path.join(schemasPath, 'workflows');
    if (fs.existsSync(workflowsDir)) {
      console.log(chalk.bold('\n  Core:'));
      const core = fs.readdirSync(workflowsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      console.log(chalk.green('    ' + core.join(', ')));

      // Tasks
      const tasksDir = path.join(workflowsDir, 'tasks');
      if (fs.existsSync(tasksDir)) {
        console.log(chalk.bold('\n  Tasks:'));
        const tasks = fs.readdirSync(tasksDir)
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''));
        console.log(chalk.green('    ' + tasks.join(', ')));
      }

      // Common
      const commonDir = path.join(workflowsDir, 'common');
      if (fs.existsSync(commonDir)) {
        console.log(chalk.bold('\n  Common Definitions:'));
        const common = fs.readdirSync(commonDir)
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''));
        console.log(chalk.green('    ' + common.join(', ')));
      }
    }
  }

  console.log(chalk.gray('\n─'.repeat(50)));
  console.log(chalk.gray(`\nUse '${PROGRAM_NAME} schema <name>' to view a specific schema`));
  console.log(chalk.gray(`Use '${PROGRAM_NAME} example <name>' to see an example\n`));
}

// ============================================================================
// Error Formatting
// ============================================================================

function getSchemaSnippet(schemasPath: string, error: ValidationError): string | null {
  if (!error.schemaPath) return null;

  // Try to extract component type from path
  const pathMatch = error.path.match(/components?\[?\d*\]?\.?(\w+)?/);
  if (pathMatch && pathMatch[1]) {
    const schemaFile = findSchemaFile(schemasPath, pathMatch[1]);
    if (schemaFile) {
      try {
        const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
        return JSON.stringify(schema, null, 2).slice(0, 500) + '...';
      } catch {
        return null;
      }
    }
  }
  return null;
}

function formatErrorPretty(
  error: ValidationError,
  index: number,
  schemasPath: string,
  verbose: boolean
): string {
  const lines: string[] = [];

  // Error header
  lines.push(chalk.red(`\n┌─ Error #${index + 1}: ${error.type.toUpperCase().replace(/_/g, ' ')}`));
  lines.push(chalk.red('│'));

  // Path
  lines.push(chalk.red('│  ') + chalk.bold('Path:    ') + chalk.yellow(error.path || '/'));

  // Message
  lines.push(chalk.red('│  ') + chalk.bold('Message: ') + error.message);

  // Schema path (verbose mode)
  if (verbose && error.schemaPath) {
    lines.push(chalk.red('│  ') + chalk.bold('Schema:  ') + chalk.gray(error.schemaPath));
  }

  // Example (if available)
  if (error.example !== undefined) {
    lines.push(chalk.red('│'));
    lines.push(chalk.red('│  ') + chalk.bold('Example:'));
    const exampleLines = JSON.stringify(error.example, null, 2).split('\n');
    exampleLines.forEach(line => {
      lines.push(chalk.red('│    ') + chalk.green(line));
    });
  }

  // Suggestion based on error type
  const suggestion = getSuggestion(error);
  if (suggestion) {
    lines.push(chalk.red('│'));
    lines.push(chalk.red('│  ') + chalk.bold('Suggestion: ') + chalk.cyan(suggestion));
  }

  lines.push(chalk.red('│'));
  lines.push(chalk.red('└' + '─'.repeat(60)));

  return lines.join('\n');
}

function getSuggestion(error: ValidationError): string | null {
  switch (error.type) {
    case 'missing_property':
      const propMatch = error.message.match(/property:\s*(\w+)/i) || error.path.match(/\.(\w+)$/);
      if (propMatch) {
        return `Add the required property '${propMatch[1]}' to your YAML`;
      }
      return 'Check required properties in the schema';

    case 'schema_violation':
      if (error.message.includes('enum')) {
        return 'The value must be one of the allowed values. Check the schema for valid options.';
      }
      if (error.message.includes('type')) {
        return 'Check that the value type matches the expected type (string, number, boolean, etc.)';
      }
      if (error.message.includes('additionalProperties')) {
        return 'Remove unrecognized properties. Use `cx-cli schema <type>` to see allowed properties.';
      }
      return 'Review the schema requirements for this property';

    case 'yaml_syntax_error':
      return 'Check YAML indentation and syntax. Use a YAML linter to identify issues.';

    case 'invalid_task_type':
      return `Use 'cx-cli list --type workflow' to see available task types`;

    case 'invalid_activity':
      return 'Each activity must have a "name" and "steps" array';

    default:
      return null;
  }
}

function formatWarningPretty(warning: any, index: number): string {
  const lines: string[] = [];
  lines.push(chalk.yellow(`\n⚠ Warning #${index + 1}: ${warning.type.toUpperCase().replace(/_/g, ' ')}`));
  lines.push(chalk.gray(`  Path: ${warning.path}`));
  lines.push(`  ${warning.message}`);
  return lines.join('\n');
}

// ============================================================================
// Result Output
// ============================================================================

function printResultPretty(
  result: ValidationResult,
  fileType: ValidationType,
  schemasPath: string,
  verbose: boolean
): void {
  const { summary, errors, warnings } = result;

  // Header
  console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('                  CX SCHEMA VALIDATION REPORT                     ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝\n'));

  // Summary
  console.log(chalk.bold('  File:    ') + summary.file);
  console.log(chalk.bold('  Type:    ') + chalk.cyan(fileType === 'auto' ? 'auto-detected' : fileType));
  console.log(chalk.bold('  Time:    ') + chalk.gray(summary.timestamp));
  console.log(
    chalk.bold('  Status:  ') +
    (summary.status === 'PASSED'
      ? chalk.green.bold('✓ PASSED')
      : chalk.red.bold('✗ FAILED'))
  );
  console.log(chalk.bold('  Errors:  ') + (summary.errorCount > 0 ? chalk.red(summary.errorCount) : chalk.green('0')));
  console.log(chalk.bold('  Warnings:') + (summary.warningCount > 0 ? chalk.yellow(summary.warningCount) : chalk.green('0')));

  // Error breakdown
  if (summary.errorCount > 0) {
    console.log('\n' + chalk.bold('  Errors by Type:'));
    for (const [type, count] of Object.entries(summary.errorsByType)) {
      console.log(chalk.gray(`    ${type}: `) + chalk.red(count));
    }
  }

  // Errors
  if (errors.length > 0) {
    console.log('\n' + chalk.bold.red('═══════════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.red('                           ERRORS'));
    console.log(chalk.bold.red('═══════════════════════════════════════════════════════════════════'));

    errors.forEach((error, index) => {
      console.log(formatErrorPretty(error, index, schemasPath, verbose));
    });
  }

  // Warnings
  if (warnings.length > 0) {
    console.log('\n' + chalk.bold.yellow('═══════════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.yellow('                          WARNINGS'));
    console.log(chalk.bold.yellow('═══════════════════════════════════════════════════════════════════'));

    warnings.forEach((warning, index) => {
      console.log(formatWarningPretty(warning, index));
    });
  }

  // Footer with help
  if (errors.length > 0) {
    console.log('\n' + chalk.gray('─'.repeat(70)));
    console.log(chalk.gray('  Tips:'));
    console.log(chalk.gray(`    • Use '${PROGRAM_NAME} schema <name>' to view schema requirements`));
    console.log(chalk.gray(`    • Use '${PROGRAM_NAME} example <name>' to see example YAML`));
    console.log(chalk.gray(`    • Use '${PROGRAM_NAME} list' to see all available schemas`));
    console.log(chalk.gray('─'.repeat(70)));
  }

  console.log('');
}

function printResultCompact(result: ValidationResult, filePath: string): void {
  const status = result.isValid ? chalk.green('PASS') : chalk.red('FAIL');
  const errorInfo = result.summary.errorCount > 0 ? chalk.red(` (${result.summary.errorCount} errors)`) : '';
  console.log(`${status} ${filePath}${errorInfo}`);
}

function printResultJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

// ============================================================================
// Report Generation
// ============================================================================

function buildReportData(results: FileValidationResult[]): ReportData {
  const errorsByType: Record<string, number> = {};
  const errorsByFile: Record<string, number> = {};
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const fileResult of results) {
    const errorCount = fileResult.result.errors.length;
    totalErrors += errorCount;
    totalWarnings += fileResult.result.warnings.length;

    if (errorCount > 0) {
      errorsByFile[fileResult.file] = errorCount;
    }

    for (const error of fileResult.result.errors) {
      const type = error.type || 'unknown';
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalFiles: results.length,
    passedFiles: results.filter(r => r.result.isValid).length,
    failedFiles: results.filter(r => !r.result.isValid).length,
    totalErrors,
    totalWarnings,
    errorsByType,
    errorsByFile,
    files: results
  };
}

function generateJsonReport(data: ReportData): string {
  return JSON.stringify(data, null, 2);
}

function generateMarkdownReport(data: ReportData): string {
  const lines: string[] = [];

  // Header
  lines.push('# CX Schema Validation Report');
  lines.push('');
  lines.push(`Generated: ${data.timestamp}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Files | ${data.totalFiles} |`);
  lines.push(`| Passed | ${data.passedFiles} |`);
  lines.push(`| Failed | ${data.failedFiles} |`);
  lines.push(`| Total Errors | ${data.totalErrors} |`);
  lines.push(`| Total Warnings | ${data.totalWarnings} |`);
  lines.push(`| Pass Rate | ${((data.passedFiles / data.totalFiles) * 100).toFixed(1)}% |`);
  lines.push('');

  // Errors by Type
  if (Object.keys(data.errorsByType).length > 0) {
    lines.push('## Errors by Type');
    lines.push('');
    lines.push('| Error Type | Count |');
    lines.push('|------------|-------|');
    for (const [type, count] of Object.entries(data.errorsByType).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push('');
  }

  // Failed Files
  const failedFiles = data.files.filter(f => !f.result.isValid);
  if (failedFiles.length > 0) {
    lines.push('## Failed Files');
    lines.push('');
    for (const fileResult of failedFiles) {
      lines.push(`### ${fileResult.file}`);
      lines.push('');
      lines.push(`- **Type:** ${fileResult.fileType}`);
      lines.push(`- **Errors:** ${fileResult.result.errors.length}`);
      lines.push(`- **Warnings:** ${fileResult.result.warnings.length}`);
      lines.push('');
      if (fileResult.result.errors.length > 0) {
        lines.push('**Errors:**');
        lines.push('');
        for (const error of fileResult.result.errors) {
          lines.push(`- **${error.type}** at \`${error.path || '/'}\`: ${error.message}`);
        }
        lines.push('');
      }
    }
  }

  // Passed Files (summary)
  const passedFiles = data.files.filter(f => f.result.isValid);
  if (passedFiles.length > 0) {
    lines.push('## Passed Files');
    lines.push('');
    for (const fileResult of passedFiles) {
      const warnings = fileResult.result.warnings.length;
      lines.push(`- ✓ ${fileResult.file}${warnings > 0 ? ` (${warnings} warnings)` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateHtmlReport(data: ReportData): string {
  const passRate = ((data.passedFiles / data.totalFiles) * 100).toFixed(1);
  const passRateColor = data.failedFiles === 0 ? '#22c55e' : data.passedFiles > data.failedFiles ? '#eab308' : '#ef4444';

  const errorsByTypeRows = Object.entries(data.errorsByType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `<tr><td>${type}</td><td>${count}</td></tr>`)
    .join('\n');

  const failedFilesHtml = data.files
    .filter(f => !f.result.isValid)
    .map(f => {
      const errorsHtml = f.result.errors
        .map(e => `<li><strong>${e.type}</strong> at <code>${e.path || '/'}</code>: ${escapeHtml(e.message)}</li>`)
        .join('\n');
      return `
        <div class="file-card failed">
          <h3>✗ ${escapeHtml(f.file)}</h3>
          <p><strong>Type:</strong> ${f.fileType} | <strong>Errors:</strong> ${f.result.errors.length} | <strong>Warnings:</strong> ${f.result.warnings.length}</p>
          <ul class="error-list">${errorsHtml}</ul>
        </div>
      `;
    })
    .join('\n');

  const passedFilesHtml = data.files
    .filter(f => f.result.isValid)
    .map(f => {
      const warnings = f.result.warnings.length;
      return `<div class="file-card passed"><span>✓</span> ${escapeHtml(f.file)}${warnings > 0 ? ` <span class="warning-badge">${warnings} warnings</span>` : ''}</div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CX Schema Validation Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1e40af; margin-bottom: 10px; }
    h2 { color: #374151; margin: 30px 0 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    h3 { color: #4b5563; margin-bottom: 10px; }
    .timestamp { color: #6b7280; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .stat-card .value { font-size: 2rem; font-weight: bold; }
    .stat-card .label { color: #6b7280; font-size: 0.9rem; }
    .stat-card.passed .value { color: #22c55e; }
    .stat-card.failed .value { color: #ef4444; }
    .stat-card.rate .value { color: ${passRateColor}; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    .file-card { background: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .file-card.failed { border-left: 4px solid #ef4444; }
    .file-card.passed { border-left: 4px solid #22c55e; }
    .file-card.passed span { color: #22c55e; font-weight: bold; }
    .error-list { margin-top: 10px; padding-left: 20px; }
    .error-list li { margin-bottom: 8px; font-size: 0.9rem; }
    .error-list code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; }
    .warning-badge { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-left: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>CX Schema Validation Report</h1>
    <p class="timestamp">Generated: ${data.timestamp}</p>

    <div class="summary-grid">
      <div class="stat-card">
        <div class="value">${data.totalFiles}</div>
        <div class="label">Total Files</div>
      </div>
      <div class="stat-card passed">
        <div class="value">${data.passedFiles}</div>
        <div class="label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="value">${data.failedFiles}</div>
        <div class="label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="value">${data.totalErrors}</div>
        <div class="label">Total Errors</div>
      </div>
      <div class="stat-card rate">
        <div class="value">${passRate}%</div>
        <div class="label">Pass Rate</div>
      </div>
    </div>

    ${Object.keys(data.errorsByType).length > 0 ? `
    <h2>Errors by Type</h2>
    <table>
      <thead><tr><th>Error Type</th><th>Count</th></tr></thead>
      <tbody>${errorsByTypeRows}</tbody>
    </table>
    ` : ''}

    ${data.failedFiles > 0 ? `
    <h2>Failed Files (${data.failedFiles})</h2>
    ${failedFilesHtml}
    ` : ''}

    ${data.passedFiles > 0 ? `
    <h2>Passed Files (${data.passedFiles})</h2>
    ${passedFilesHtml}
    ` : ''}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function detectReportFormat(filePath: string): ReportFormat {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
    case '.htm':
      return 'html';
    case '.md':
    case '.markdown':
      return 'markdown';
    case '.json':
    default:
      return 'json';
  }
}

function generateReport(data: ReportData, format: ReportFormat): string {
  switch (format) {
    case 'html':
      return generateHtmlReport(data);
    case 'markdown':
      return generateMarkdownReport(data);
    case 'json':
    default:
      return generateJsonReport(data);
  }
}

// ============================================================================
// Validation
// ============================================================================

async function validateFile(
  filePath: string,
  options: CLIOptions,
  schemasPath: string
): Promise<ValidationResult> {
  // Determine file type
  let fileType = options.type;
  if (fileType === 'auto') {
    fileType = detectFileType(filePath);
  }

  // Create appropriate validator
  if (fileType === 'workflow') {
    const validator = new WorkflowValidator({
      schemasPath: path.join(schemasPath, 'workflows')
    });
    return validator.validateWorkflow(filePath);
  } else {
    const validator = new ModuleValidator({ schemasPath });
    return validator.validateModule(filePath);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const { command, files, options } = parseArgs(args);

  // Handle help
  if (options.help) {
    if (command === 'schema') {
      console.log(SCHEMA_HELP);
    } else if (command === 'list') {
      console.log(LIST_HELP);
    } else if (command === 'init') {
      console.log(INIT_HELP);
    } else if (command === 'create') {
      console.log(CREATE_HELP);
    } else if (command === 'extract') {
      console.log(EXTRACT_HELP);
    } else {
      console.log(HELP_TEXT);
    }
    process.exit(0);
  }

  // Handle version
  if (options.version) {
    console.log(`cx-cli v${VERSION}`);
    process.exit(0);
  }

  // Find schemas path
  const schemasPath = options.schemasPath || findSchemasPath();
  if (!schemasPath) {
    console.error(chalk.red('Error: Could not find schemas directory.'));
    console.error(chalk.gray('Please run npm install first or specify --schemas <path>'));
    process.exit(2);
  }

  // Handle schema command
  if (options.showSchema) {
    showSchema(schemasPath, options.showSchema);
    process.exit(0);
  }

  // Handle example command
  if (options.showExample) {
    showExample(schemasPath, options.showExample);
    process.exit(0);
  }

  // Handle list command
  if (options.listSchemas) {
    listSchemas(schemasPath, options.type);
    process.exit(0);
  }

  // Handle init command
  if (command === 'init') {
    runInit(files[0]);
    process.exit(0);
  }

  // Handle create command
  if (command === 'create') {
    // For task-schema, pass --tasks (from options.createTasks) as the tasks argument
    if (files[0] === 'task-schema') {
      runCreate(files[0], files[1], options.template, options.feature, options.createTasks);
    } else {
      runCreate(files[0], files[1], options.template, options.feature, options.createOptions);
    }
    process.exit(0);
  }

  // Handle sync-schemas command
  if (command === 'sync-schemas') {
    runSyncSchemas();
    process.exit(0);
  }

  // Handle install-skills command
  if (command === 'install-skills') {
    runInstallSkills();
    process.exit(0);
  }

  // Handle update command
  if (command === 'update') {
    runUpdate();
    process.exit(0);
  }

  // Handle setup-claude command
  if (command === 'setup-claude') {
    runSetupClaude();
    process.exit(0);
  }

  // Handle extract command
  if (command === 'extract') {
    runExtract(files[0], files[1], options.extractTo, options.extractCopy);
    process.exit(0);
  }

  // Validate files
  if (files.length === 0) {
    console.error(chalk.red('Error: No input file specified'));
    console.error(chalk.gray(`Use '${PROGRAM_NAME} --help' for usage information`));
    process.exit(2);
  }

  let hasErrors = false;
  const allResults: FileValidationResult[] = [];
  const isReportMode = command === 'report' || options.report;

  for (const file of files) {
    // Check file exists
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`Error: File not found: ${file}`));
      hasErrors = true;
      continue;
    }

    try {
      const fileType = options.type === 'auto' ? detectFileType(file) : options.type;
      const result = await validateFile(file, options, schemasPath);

      // Collect results for report
      if (isReportMode) {
        allResults.push({ file, fileType, result });
      }

      // Output individual results (unless quiet mode for reports)
      if (!isReportMode || !options.quiet) {
        if (options.format === 'json' && !isReportMode) {
          printResultJson(result);
        } else if (options.format === 'compact' || isReportMode) {
          printResultCompact(result, file);
        } else {
          printResultPretty(result, fileType, schemasPath, options.verbose);
        }
      }

      if (!result.isValid) {
        hasErrors = true;
      }
    } catch (error: any) {
      console.error(chalk.red(`Error validating ${file}:`), error.message);
      if (options.verbose) {
        console.error(chalk.gray(error.stack));
      }
      hasErrors = true;
    }
  }

  // Generate report if requested
  if (isReportMode && allResults.length > 0) {
    const reportData = buildReportData(allResults);
    const reportPath = options.report || 'validation-report.json';

    // Determine report format (auto-detect from extension if not specified explicitly)
    let reportFormat = options.reportFormat;
    if (!options.reportFormat || options.reportFormat === 'json') {
      // If reportFormat wasn't explicitly set, auto-detect from file extension
      const detectedFormat = detectReportFormat(reportPath);
      if (detectedFormat !== 'json' || !options.reportFormat) {
        reportFormat = detectedFormat;
      }
    }

    const reportContent = generateReport(reportData, reportFormat);
    fs.writeFileSync(reportPath, reportContent, 'utf-8');

    // Print summary
    console.log('');
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                     VALIDATION SUMMARY'));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk.bold('  Total Files:  ') + reportData.totalFiles);
    console.log(chalk.bold('  Passed:       ') + chalk.green(reportData.passedFiles));
    console.log(chalk.bold('  Failed:       ') + (reportData.failedFiles > 0 ? chalk.red(reportData.failedFiles) : '0'));
    console.log(chalk.bold('  Pass Rate:    ') + chalk.cyan(`${((reportData.passedFiles / reportData.totalFiles) * 100).toFixed(1)}%`));
    console.log('');
    console.log(chalk.gray(`  Report saved to: ${chalk.white(reportPath)}`));
    console.log('');
  }

  process.exit(hasErrors ? 1 : 0);
}

main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error.message);
  process.exit(2);
});
