#!/usr/bin/env node

/**
 * CX Schema Validator CLI - Unified validation for YAML modules and workflows
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as yaml from 'js-yaml';
import { ModuleValidator } from './validator';
import { WorkflowValidator } from './workflowValidator';
import { ValidationResult, ValidationError } from './types';

// ============================================================================
// Types
// ============================================================================

type ValidationType = 'module' | 'workflow' | 'auto';
type OutputFormat = 'pretty' | 'json' | 'compact';

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
const PROGRAM_NAME = 'cx-validate';

// ============================================================================
// Help Text
// ============================================================================

const HELP_TEXT = `
${chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════════════════╗')}
${chalk.bold.cyan('║')}                     ${chalk.bold.white('CX SCHEMA VALIDATOR')}                              ${chalk.bold.cyan('║')}
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
  ${chalk.green('schema')}          Show JSON schema for a component or task
  ${chalk.green('example')}         Show example YAML for a component or task
  ${chalk.green('list')}            List available schemas (modules, workflows, tasks)
  ${chalk.green('help')}            Show this help message

${chalk.bold.yellow('OPTIONS:')}
  ${chalk.green('-h, --help')}              Show this help message
  ${chalk.green('-v, --version')}           Show version number
  ${chalk.green('-t, --type <type>')}       Validation type: ${chalk.cyan('module')}, ${chalk.cyan('workflow')}, or ${chalk.cyan('auto')} ${chalk.gray('(default: auto)')}
  ${chalk.green('-f, --format <format>')}   Output format: ${chalk.cyan('pretty')}, ${chalk.cyan('json')}, or ${chalk.cyan('compact')} ${chalk.gray('(default: pretty)')}
  ${chalk.green('-s, --schemas <path>')}    Path to schemas directory
  ${chalk.green('--verbose')}               Show detailed output with schema paths
  ${chalk.green('--quiet')}                 Only show errors, suppress other output

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
    setVariable, map, log, error, csv, export, template,
    order, contact, commodity, job, attachment,
    email-send, document-render, charge, workflow-execute

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
    quiet: false
  };

  // Check for commands
  const commands = ['validate', 'schema', 'example', 'list', 'help'];
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
    const data = yaml.load(content) as any;

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

function findSchemaFile(schemasPath: string, name: string, preferWorkflow: boolean = false): string | null {
  // Normalize name
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '');

  // Workflow schema names - these should match workflow schemas first
  const workflowCoreNames = ['workflow', 'activity', 'input', 'output', 'variable', 'trigger', 'schedule'];
  const workflowTaskNames = [
    'foreach', 'switch', 'while', 'validation', 'map', 'setvariable', 'httprequest',
    'log', 'error', 'csv', 'export', 'template', 'graphql', 'order', 'contact',
    'commodity', 'job', 'attachment', 'email-send', 'document-render', 'document-send',
    'charge', 'accounting-transaction', 'payment', 'workflow-execute', 'condition',
    'expression', 'mapping'
  ];
  const isWorkflowSchema = workflowCoreNames.includes(normalizedName) ||
                           workflowTaskNames.includes(normalizedName);

  // Search patterns in order of priority
  const searchPaths = preferWorkflow || isWorkflowSchema
    ? [
        // Workflow schemas first for workflow-related names
        path.join(schemasPath, 'workflows', `${name}.json`),
        path.join(schemasPath, 'workflows', 'tasks', `${name}.json`),
        path.join(schemasPath, 'workflows', 'common', `${name}.json`),
        // Then module schemas
        path.join(schemasPath, 'components', `${name}.json`),
        path.join(schemasPath, 'fields', `${name}.json`),
        path.join(schemasPath, 'actions', `${name}.json`)
      ]
    : [
        // Module schemas first
        path.join(schemasPath, 'components', `${name}.json`),
        path.join(schemasPath, 'fields', `${name}.json`),
        path.join(schemasPath, 'actions', `${name}.json`),
        // Then workflow schemas
        path.join(schemasPath, 'workflows', `${name}.json`),
        path.join(schemasPath, 'workflows', 'tasks', `${name}.json`),
        path.join(schemasPath, 'workflows', 'common', `${name}.json`)
      ];

  for (const schemaPath of searchPaths) {
    if (fs.existsSync(schemaPath)) {
      return schemaPath;
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
  console.log(yaml.dump(example, { indent: 2, lineWidth: 100 }));
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
        return 'Remove unrecognized properties. Use `cx-validate schema <type>` to see allowed properties.';
      }
      return 'Review the schema requirements for this property';

    case 'yaml_syntax_error':
      return 'Check YAML indentation and syntax. Use a YAML linter to identify issues.';

    case 'invalid_task_type':
      return `Use 'cx-validate list --type workflow' to see available task types`;

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
    } else {
      console.log(HELP_TEXT);
    }
    process.exit(0);
  }

  // Handle version
  if (options.version) {
    console.log(`cx-validate v${VERSION}`);
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

  // Validate files
  if (files.length === 0) {
    console.error(chalk.red('Error: No input file specified'));
    console.error(chalk.gray(`Use '${PROGRAM_NAME} --help' for usage information`));
    process.exit(2);
  }

  let hasErrors = false;

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

      if (options.format === 'json') {
        printResultJson(result);
      } else if (options.format === 'compact') {
        printResultCompact(result, file);
      } else {
        printResultPretty(result, fileType, schemasPath, options.verbose);
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

  process.exit(hasErrors ? 1 : 0);
}

main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error.message);
  process.exit(2);
});
