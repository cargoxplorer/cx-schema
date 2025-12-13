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
  ${chalk.green('report')}          Generate validation report for multiple files
  ${chalk.green('init')}            Initialize a new CX project with app.yaml, README.md, AGENTS.md
  ${chalk.green('create')}          Create a new module or workflow from template
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
  ${chalk.green('-r, --report <file>')}     Generate report to file (html, md, or json)
  ${chalk.green('--report-format <fmt>')}   Report format: ${chalk.cyan('html')}, ${chalk.cyan('markdown')}, or ${chalk.cyan('json')} ${chalk.gray('(default: auto from extension)')}

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

const INIT_HELP = `
${chalk.bold.yellow('INIT COMMAND')}

Initialize a new CX project with configuration files.

${chalk.bold.yellow('USAGE:')}
  ${chalk.cyan(`${PROGRAM_NAME} init`)}

${chalk.bold.yellow('FILES CREATED:')}
  ${chalk.green('app.yaml')}      - Project configuration
  ${chalk.green('README.md')}     - Project documentation
  ${chalk.green('AGENTS.md')}     - AI assistant instructions for validation
`;

const CREATE_HELP = `
${chalk.bold.yellow('CREATE COMMAND')}

Create a new module or workflow from template.

${chalk.bold.yellow('USAGE:')}
  ${chalk.cyan(`${PROGRAM_NAME} create <type> <name>`)}

${chalk.bold.yellow('TYPES:')}
  ${chalk.green('module')}    - Create a new UI module YAML file
  ${chalk.green('workflow')}  - Create a new workflow YAML file

${chalk.bold.yellow('EXAMPLES:')}
  ${chalk.cyan(`${PROGRAM_NAME} create module orders`)}
  ${chalk.cyan(`${PROGRAM_NAME} create workflow invoice-generator`)}
`;

// ============================================================================
// Templates
// ============================================================================

function generateAppYaml(): string {
  return `# CargoXplorer Application Configuration
# Generated by cx-validate init

app:
  name: "My CX Application"
  version: "1.0.0"
  description: "CargoXplorer application"

# Module directories
modules:
  - path: "./modules"
    pattern: "*.yaml"

# Workflow directories
workflows:
  - path: "./workflows"
    pattern: "*.yaml"

# Validation settings
validation:
  strict: true
  failOnWarnings: false
`;
}

function generateReadme(): string {
  return `# CargoXplorer Application

This project contains CargoXplorer modules and workflows.

## Project Structure

\`\`\`
├── app.yaml           # Application configuration
├── modules/           # UI module definitions
│   └── *.yaml
├── workflows/         # Workflow definitions
│   └── *.yaml
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
npx cx-validate modules/*.yaml

# Validate all workflows
npx cx-validate workflows/*.yaml

# Validate with detailed output
npx cx-validate --verbose modules/my-module.yaml

# Generate validation report
npx cx-validate report modules/*.yaml workflows/*.yaml --report report.html
\`\`\`

### Create new files

\`\`\`bash
# Create a new module
npx cx-validate create module my-module

# Create a new workflow
npx cx-validate create workflow my-workflow
\`\`\`

### View schemas and examples

\`\`\`bash
# List available schemas
npx cx-validate list

# View schema for a component
npx cx-validate schema form

# View example YAML
npx cx-validate example workflow
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
npx cx-validate modules/<module-name>.yaml

# Validate a specific workflow file
npx cx-validate workflows/<workflow-name>.yaml

# Validate all files with a report
npx cx-validate report modules/*.yaml workflows/*.yaml --report validation-report.md
\`\`\`

## Schema Reference

Before editing components or tasks, check the schema:

\`\`\`bash
# View schema for components
npx cx-validate schema form
npx cx-validate schema dataGrid
npx cx-validate schema layout

# View schema for workflow tasks
npx cx-validate schema foreach
npx cx-validate schema graphql
npx cx-validate schema switch
\`\`\`

## Creating New Files

Use templates to create properly structured files:

\`\`\`bash
# Create a new module
npx cx-validate create module <name>

# Create a new workflow
npx cx-validate create workflow <name>
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

function loadTemplate(templateName: string): string {
  const templatesPath = findTemplatesPath();
  if (!templatesPath) {
    throw new Error('Could not find templates directory');
  }

  const templateFile = path.join(templatesPath, `${templateName}.yaml`);
  if (!fs.existsSync(templateFile)) {
    throw new Error(`Template not found: ${templateName}`);
  }

  return fs.readFileSync(templateFile, 'utf-8');
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

function generateTemplateContent(type: 'module' | 'workflow', name: string, fileName: string): string {
  const template = loadTemplate(type);

  const displayName = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const variables: Record<string, string> = {
    name,
    displayName,
    displayNameNoSpaces: displayName.replace(/\s/g, ''),
    uuid: generateUUID(),
    fileName
  };

  return processTemplate(template, variables);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// Init and Create Commands
// ============================================================================

function runInit(): void {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                  CX PROJECT INITIALIZATION                        ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝\n'));

  const files = [
    { name: 'app.yaml', content: generateAppYaml() },
    { name: 'README.md', content: generateReadme() },
    { name: 'AGENTS.md', content: generateAgentsMd() }
  ];

  const createdDirs: string[] = [];
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];

  // Create directories
  for (const dir of ['modules', 'workflows']) {
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

  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.gray(`    1. Edit ${chalk.white('app.yaml')} to configure your project`));
  console.log(chalk.gray(`    2. Create modules: ${chalk.white(`${PROGRAM_NAME} create module <name>`)}`));
  console.log(chalk.gray(`    3. Create workflows: ${chalk.white(`${PROGRAM_NAME} create workflow <name>`)}`));
  console.log(chalk.gray(`    4. Validate files: ${chalk.white(`${PROGRAM_NAME} modules/*.yaml`)}`));
  console.log('');
}

function runCreate(type: string | undefined, name: string | undefined): void {
  if (!type || !['module', 'workflow'].includes(type)) {
    console.error(chalk.red('Error: Invalid or missing type. Use: module or workflow'));
    console.error(chalk.gray(`Example: ${PROGRAM_NAME} create module my-module`));
    process.exit(2);
  }

  if (!name) {
    console.error(chalk.red(`Error: Missing name for ${type}`));
    console.error(chalk.gray(`Example: ${PROGRAM_NAME} create ${type} my-${type}`));
    process.exit(2);
  }

  // Sanitize name
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Determine output directory and file
  const dir = type === 'module' ? 'modules' : 'workflows';
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
    content = generateTemplateContent(type as 'module' | 'workflow', safeName, relativeFileName);
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
  const commands = ['validate', 'schema', 'example', 'list', 'help', 'report', 'init', 'create'];
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

  // Handle init command
  if (command === 'init') {
    runInit();
    process.exit(0);
  }

  // Handle create command
  if (command === 'create') {
    runCreate(files[0], files[1]);
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
