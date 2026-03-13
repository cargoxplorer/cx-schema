#!/usr/bin/env node

/**
 * CX Schema Validator CLI - Unified validation for YAML modules and workflows
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import * as os from 'os';
import chalk from 'chalk';
import YAML, { isSeq, isMap, YAMLSeq, Document as YAMLDocument } from 'yaml';
import { ModuleValidator } from './validator';
import { WorkflowValidator } from './workflowValidator';
import { ValidationResult, ValidationError } from './types';
import { computeExtractPriority } from './extractUtils';

// ============================================================================
// .env loader — load KEY=VALUE pairs from .env in CWD into process.env
// ============================================================================

function loadEnvFile(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

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
  orgId?: number;
  vars?: string;
  from?: string;
  to?: string;
  output?: string;
  console?: boolean;
  message?: string;
  branch?: string;
  force?: boolean;
  skipChanged?: boolean;
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

interface TokenFile {
  domain: string;
  client_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  organization_id?: number;
}

// ============================================================================
// Constants
// ============================================================================

const VERSION = require('../package.json').version;
const PROGRAM_NAME = 'cxtms';

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
  ${chalk.green('login')}           Login to a CX environment (OAuth2 + PKCE)
  ${chalk.green('logout')}          Logout from a CX environment
  ${chalk.green('pat')}             Manage personal access tokens (create, list, revoke)
  ${chalk.green('orgs')}            List, select, or set active organization
  ${chalk.green('appmodule')}       Manage app modules on a CX server (deploy, undeploy)
  ${chalk.green('workflow')}        Manage workflows on a CX server (deploy, undeploy, execute, logs, log)
  ${chalk.green('publish')}         Publish all modules and workflows to a CX server
  ${chalk.green('app')}             Manage app manifests (install/upgrade from git, publish to git, list)
  ${chalk.green('query')}           Run a GraphQL query against the CX server
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
  ${chalk.green('--org <id>')}             Organization ID for server commands
  ${chalk.green('--vars <json>')}          JSON variables for workflow execute
  ${chalk.green('--from <date>')}          Filter logs from date (YYYY-MM-DD)
  ${chalk.green('--to <date>')}            Filter logs to date (YYYY-MM-DD)
  ${chalk.green('--output <file>')}        Save workflow log to file (or -o)
  ${chalk.green('--console')}              Print workflow log to stdout
  ${chalk.green('--json')}                 Download JSON log instead of text
  ${chalk.green('-m, --message <msg>')}     Commit message for app publish
  ${chalk.green('-b, --branch <branch>')}   Branch override for app install/publish
  ${chalk.green('--force')}                Force install (even if same version) or publish all
  ${chalk.green('--skip-changed')}         Skip modules with unpublished changes during install

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

${chalk.bold.yellow('AUTH COMMANDS:')}
  ${chalk.gray('# Login to a CX environment')}
  ${chalk.cyan(`${PROGRAM_NAME} login https://qa.storevista.acuitive.net`)}

  ${chalk.gray('# Logout from current session')}
  ${chalk.cyan(`${PROGRAM_NAME} logout`)}

${chalk.bold.yellow('PAT COMMANDS:')}
  ${chalk.gray('# Check PAT token status and setup instructions')}
  ${chalk.cyan(`${PROGRAM_NAME} pat setup`)}

  ${chalk.gray('# Create a new PAT token')}
  ${chalk.cyan(`${PROGRAM_NAME} pat create "my-token-name"`)}

  ${chalk.gray('# List active PAT tokens')}
  ${chalk.cyan(`${PROGRAM_NAME} pat list`)}

  ${chalk.gray('# Revoke a PAT token by ID')}
  ${chalk.cyan(`${PROGRAM_NAME} pat revoke <tokenId>`)}

${chalk.bold.yellow('ORG COMMANDS:')}
  ${chalk.gray('# List organizations on the server')}
  ${chalk.cyan(`${PROGRAM_NAME} orgs list`)}

  ${chalk.gray('# Interactively select an organization')}
  ${chalk.cyan(`${PROGRAM_NAME} orgs select`)}

  ${chalk.gray('# Set active organization by ID')}
  ${chalk.cyan(`${PROGRAM_NAME} orgs use <orgId>`)}

  ${chalk.gray('# Show current context (server, org, app)')}
  ${chalk.cyan(`${PROGRAM_NAME} orgs use`)}

${chalk.bold.yellow('APPMODULE COMMANDS:')}
  ${chalk.gray('# Deploy a module YAML to the server (creates or updates)')}
  ${chalk.cyan(`${PROGRAM_NAME} appmodule deploy modules/my-module.yaml`)}

  ${chalk.gray('# Deploy with explicit org ID')}
  ${chalk.cyan(`${PROGRAM_NAME} appmodule deploy modules/my-module.yaml --org 42`)}

  ${chalk.gray('# Undeploy an app module by UUID')}
  ${chalk.cyan(`${PROGRAM_NAME} appmodule undeploy <appModuleId>`)}

${chalk.bold.yellow('WORKFLOW COMMANDS:')}
  ${chalk.gray('# Deploy a workflow YAML to the server (creates or updates)')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow deploy workflows/my-workflow.yaml`)}

  ${chalk.gray('# Undeploy a workflow by UUID')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow undeploy <workflowId>`)}

  ${chalk.gray('# Execute a workflow')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow execute <workflowId|file.yaml>`)}
  ${chalk.cyan(`${PROGRAM_NAME} workflow execute <workflowId> --vars '{"city":"London"}'`)}

  ${chalk.gray('# List execution logs for a workflow (sorted desc)')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow logs <workflowId|file.yaml>`)}
  ${chalk.cyan(`${PROGRAM_NAME} workflow logs <workflowId> --from 2026-01-01 --to 2026-01-31`)}

  ${chalk.gray('# Download a specific execution log')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow log <executionId>`)}                  ${chalk.gray('# save txt log to temp dir')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow log <executionId> --output log.txt`)}  ${chalk.gray('# save to file')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow log <executionId> --console`)}         ${chalk.gray('# print to stdout')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow log <executionId> --json`)}            ${chalk.gray('# download JSON log (more detail)')}
  ${chalk.cyan(`${PROGRAM_NAME} workflow log <executionId> --json --console`)}  ${chalk.gray('# JSON log to stdout')}

${chalk.bold.yellow('PUBLISH COMMANDS:')}
  ${chalk.gray('# Publish all modules and workflows from current project')}
  ${chalk.cyan(`${PROGRAM_NAME} publish`)}

  ${chalk.gray('# Publish only a specific feature directory')}
  ${chalk.cyan(`${PROGRAM_NAME} publish --feature billing`)}
  ${chalk.cyan(`${PROGRAM_NAME} publish billing`)}

  ${chalk.gray('# Publish with explicit org ID')}
  ${chalk.cyan(`${PROGRAM_NAME} publish --org 42`)}

${chalk.bold.yellow('APP COMMANDS:')}
  ${chalk.gray('# Install/refresh app from git repository into the CX server')}
  ${chalk.cyan(`${PROGRAM_NAME} app install`)}

  ${chalk.gray('# Force reinstall even if same version')}
  ${chalk.cyan(`${PROGRAM_NAME} app install --force`)}

  ${chalk.gray('# Install from a specific branch')}
  ${chalk.cyan(`${PROGRAM_NAME} app install --branch develop`)}

  ${chalk.gray('# Install but skip modules that have local changes')}
  ${chalk.cyan(`${PROGRAM_NAME} app install --skip-changed`)}

  ${chalk.gray('# Upgrade app from git (alias for install)')}
  ${chalk.cyan(`${PROGRAM_NAME} app upgrade`)}
  ${chalk.cyan(`${PROGRAM_NAME} app upgrade --force`)}

  ${chalk.gray('# Publish server changes to git (creates a PR)')}
  ${chalk.cyan(`${PROGRAM_NAME} app publish`)}

  ${chalk.gray('# Publish with a custom commit message')}
  ${chalk.cyan(`${PROGRAM_NAME} app publish --message "Add new shipping module"`)}

  ${chalk.gray('# Publish specific workflows and/or modules by YAML file')}
  ${chalk.cyan(`${PROGRAM_NAME} app publish workflows/my-workflow.yaml`)}
  ${chalk.cyan(`${PROGRAM_NAME} app publish workflows/a.yaml modules/b.yaml`)}

  ${chalk.gray('# Force publish all modules and workflows')}
  ${chalk.cyan(`${PROGRAM_NAME} app publish --force`)}

  ${chalk.gray('# List installed app manifests on the server')}
  ${chalk.cyan(`${PROGRAM_NAME} app list`)}

${chalk.bold.yellow('QUERY COMMANDS:')}
  ${chalk.gray('# Run an inline GraphQL query')}
  ${chalk.cyan(`${PROGRAM_NAME} query '{ organizations(take: 5) { items { organizationId companyName } } }'`)}

  ${chalk.gray('# Run a query from a .graphql file')}
  ${chalk.cyan(`${PROGRAM_NAME} query my-query.graphql`)}

  ${chalk.gray('# Pass variables as JSON')}
  ${chalk.cyan(`${PROGRAM_NAME} query my-query.graphql --vars '{"id": 42}'`)}

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
  ${chalk.green('CXTMS_AUTH')}         - PAT token for authentication (skips OAuth login)
  ${chalk.green('CXTMS_SERVER')}       - Server URL when using PAT auth (or set \`server\` in app.yaml)
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
npx cxtms modules/*.yaml

# Validate all workflows
npx cxtms workflows/*.yaml

# Validate with detailed output
npx cxtms --verbose modules/my-module.yaml

# Generate validation report
npx cxtms report modules/*.yaml workflows/*.yaml --report report.html
\`\`\`

### Create new files

\`\`\`bash
# Create a new module
npx cxtms create module my-module

# Create a new workflow
npx cxtms create workflow my-workflow
\`\`\`

### View schemas and examples

\`\`\`bash
# List available schemas
npx cxtms list

# View schema for a component
npx cxtms schema form

# View example YAML
npx cxtms example workflow
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
npx cxtms modules/<module-name>.yaml

# Validate a specific workflow file
npx cxtms workflows/<workflow-name>.yaml

# Validate all files with a report
npx cxtms report modules/*.yaml workflows/*.yaml --report validation-report.md
\`\`\`

## Schema Reference

Before editing components or tasks, check the schema:

\`\`\`bash
# View schema for components
npx cxtms schema form
npx cxtms schema dataGrid
npx cxtms schema layout

# View schema for workflow tasks
npx cxtms schema foreach
npx cxtms schema graphql
npx cxtms schema switch
\`\`\`

## Creating New Files

Use templates to create properly structured files:

\`\`\`bash
# Create a new module
npx cxtms create module <name>

# Create a new workflow
npx cxtms create workflow <name>

# Create from a specific template variant
npx cxtms create workflow <name> --template basic

# Create inside a feature folder (features/<name>/workflows/)
npx cxtms create workflow <name> --feature billing
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

function applyFieldsToConfiguration(layout: any, fields: CreateFieldOption[]): void {
  // Configuration fields are stored under customValues, so prefix all field names
  const configFields = fields.map(f => ({
    component: 'field',
    name: `customValues.${f.name}`,
    props: {
      type: f.type,
      label: { 'en-US': f.label || fieldNameToLabel(f.name) },
      ...(f.required ? { required: true } : {})
    }
  }));

  if (!layout.children) layout.children = [];
  layout.children.push(...configFields);

  // Update defaultValue in configurations if present
  // (handled separately since configurations is a top-level key)
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
  const isConfiguration = Array.isArray(doc.configurations);

  if (doc.components && Array.isArray(doc.components)) {
    for (const comp of doc.components) {
      // Apply to configuration templates (fields go directly into layout children)
      if (isConfiguration && comp.layout) {
        applyFieldsToConfiguration(comp.layout, fields);
        applied = true;
        continue;
      }

      // Apply to form components
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

  // Apply defaults to configuration defaultValue
  if (isConfiguration && doc.configurations) {
    for (const config of doc.configurations) {
      if (!config.defaultValue) config.defaultValue = {};
      for (const f of fields) {
        if (f.default !== undefined) {
          config.defaultValue[f.name] = f.default;
        }
      }
    }
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

### CLI — \`cxtms\`

**Always scaffold via CLI, never write YAML from scratch.**

| Command | Description |
|---------|-------------|
| \`npx cxtms create module <name>\` | Scaffold a UI module |
| \`npx cxtms create workflow <name>\` | Scaffold a workflow |
| \`npx cxtms create module <name> --template <t>\` | Use a specific template |
| \`npx cxtms create workflow <name> --template <t>\` | Use a specific template |
| \`npx cxtms create module <name> --feature <f>\` | Place under features/<f>/modules/ |
| \`npx cxtms <file.yaml>\` | Validate a YAML file |
| \`npx cxtms <file.yaml> --verbose\` | Validate with detailed errors |
| \`npx cxtms schema <name>\` | Show JSON schema for a component or task |
| \`npx cxtms example <name>\` | Show example YAML |
| \`npx cxtms list\` | List all available schemas |
| \`npx cxtms extract <src> <comp> --to <tgt>\` | Move component between modules |

**Module templates:** \`default\`, \`form\`, \`grid\`, \`select\`, \`configuration\`
**Workflow templates:** \`basic\`, \`entity-trigger\`, \`document\`, \`scheduled\`, \`utility\`, \`webhook\`, \`public-api\`, \`mcp-tool\`, \`ftp-tracking\`, \`ftp-edi\`, \`api-tracking\`

### Skills (slash commands)

| Skill | Purpose |
|-------|---------|
| \`/cx-module <description>\` | Generate a UI module (forms, grids, screens) |
| \`/cx-workflow <description>\` | Generate a workflow (automation, triggers, integrations) |
| \`/cx-core <entity or question>\` | Look up entity fields, enums, and domain reference |

### Workflow: Scaffold → Customize → Validate

1. **Scaffold** — \`npx cxtms create module|workflow <name> --template <t>\`
2. **Read** the generated file
3. **Customize** for the use case
4. **Validate** — \`npx cxtms <file.yaml>\` — run after every change, fix all errors
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
// Auth (Login / Logout)
// ============================================================================

const AUTH_CALLBACK_PORT = 9000;
const AUTH_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function getSessionDir(): string {
  const projectName = path.basename(process.cwd());
  return path.join(os.homedir(), '.cxtms', projectName);
}

function getSessionFilePath(): string {
  return path.join(getSessionDir(), '.session.json');
}

function readSessionFile(): TokenFile | null {
  const filePath = getSessionFilePath();
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeSessionFile(data: TokenFile): void {
  const dir = getSessionDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getSessionFilePath(), JSON.stringify(data, null, 2), 'utf-8');
}

function deleteSessionFile(): void {
  const filePath = getSessionFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}


function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function httpsPost(url: string, body: string, contentType: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function openBrowser(url: string): void {
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd);
}

function startCallbackServer(): Promise<{ code: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${AUTH_CALLBACK_PORT}`);
      if (reqUrl.pathname === '/callback') {
        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Login failed</h2><p>You can close this tab.</p></body></html>');
          reject(new Error(`OAuth error: ${error} - ${reqUrl.searchParams.get('error_description') || ''}`));
          server.close();
          return;
        }
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Login successful!</h2><p>You can close this tab and return to the terminal.</p></body></html>');
          resolve({ code, close: () => server.close() });
          return;
        }
      }
      res.writeHead(404);
      res.end();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${AUTH_CALLBACK_PORT} is already in use. Close the process using it and try again.`));
      } else {
        reject(err);
      }
    });

    server.listen(AUTH_CALLBACK_PORT, '127.0.0.1');
  });
}

async function registerOAuthClient(domain: string): Promise<string> {
  const res = await httpsPost(
    `${domain}/connect/register`,
    JSON.stringify({
      client_name: `cxtms-${crypto.randomBytes(4).toString('hex')}`,
      redirect_uris: [`http://localhost:${AUTH_CALLBACK_PORT}/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
    'application/json'
  );
  if (res.statusCode !== 200 && res.statusCode !== 201) {
    throw new Error(`Client registration failed (${res.statusCode}): ${res.body}`);
  }
  const data = JSON.parse(res.body);
  if (!data.client_id) {
    throw new Error('Client registration response missing client_id');
  }
  return data.client_id;
}

async function exchangeCodeForTokens(domain: string, clientId: string, code: string, codeVerifier: string): Promise<TokenFile> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: `http://localhost:${AUTH_CALLBACK_PORT}/callback`,
    code_verifier: codeVerifier,
  }).toString();

  const res = await httpsPost(`${domain}/connect/token`, body, 'application/x-www-form-urlencoded');
  if (res.statusCode !== 200) {
    throw new Error(`Token exchange failed (${res.statusCode}): ${res.body}`);
  }
  const data = JSON.parse(res.body);
  return {
    domain,
    client_id: clientId,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
  };
}

async function revokeToken(domain: string, clientId: string, token: string): Promise<void> {
  try {
    await httpsPost(
      `${domain}/connect/revoke`,
      new URLSearchParams({ client_id: clientId, token }).toString(),
      'application/x-www-form-urlencoded'
    );
  } catch {
    // Revocation failures are non-fatal
  }
}

async function refreshTokens(stored: TokenFile): Promise<TokenFile> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: stored.client_id,
    refresh_token: stored.refresh_token,
  }).toString();

  const res = await httpsPost(`${stored.domain}/connect/token`, body, 'application/x-www-form-urlencoded');
  if (res.statusCode !== 200) {
    throw new Error(`Token refresh failed (${res.statusCode}): ${res.body}`);
  }
  const data = JSON.parse(res.body);
  const updated: TokenFile = {
    ...stored,
    access_token: data.access_token,
    refresh_token: data.refresh_token || stored.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
  };
  writeSessionFile(updated);
  return updated;
}

async function runLogin(domain: string): Promise<void> {
  // Normalize URL
  if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
    domain = `https://${domain}`;
  }
  domain = domain.replace(/\/+$/, '');

  try {
    new URL(domain);
  } catch {
    console.error(chalk.red('Error: Invalid URL'));
    process.exit(2);
  }

  console.log(chalk.bold.cyan('\n  CX CLI Login\n'));

  // Step 1: Register client
  console.log(chalk.gray('  Registering OAuth client...'));
  const clientId = await registerOAuthClient(domain);
  console.log(chalk.green('  ✓ Client registered'));

  // Step 2: PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Step 3: Start callback server
  const callbackPromise = startCallbackServer();

  // Step 4: Open browser
  const authUrl = `${domain}/connect/authorize?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: `http://localhost:${AUTH_CALLBACK_PORT}/callback`,
    response_type: 'code',
    scope: 'openid offline_access TMS.ApiAPI',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();

  console.log(chalk.gray('  Opening browser for login...'));
  openBrowser(authUrl);
  console.log(chalk.gray(`  Waiting for login (timeout: 2 min)...`));

  // Step 5: Wait for callback with timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Login timed out after 2 minutes. Please try again.')), AUTH_TIMEOUT_MS)
  );

  const { code, close } = await Promise.race([callbackPromise, timeoutPromise]);

  // Step 6: Exchange code for tokens
  console.log(chalk.gray('  Exchanging authorization code...'));
  const tokens = await exchangeCodeForTokens(domain, clientId, code, codeVerifier);

  // Step 7: Store session locally
  writeSessionFile(tokens);
  close();

  console.log(chalk.green(`  ✓ Logged in to ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Session stored at: ${getSessionFilePath()}\n`));
}

async function runLogout(_domain: string | undefined): Promise<void> {
  const session = readSessionFile();
  if (!session) {
    console.log(chalk.gray('\n  No active session in this project.\n'));
    console.log(chalk.gray(`  Login first: ${PROGRAM_NAME} login <url>\n`));
    return;
  }

  console.log(chalk.bold.cyan('\n  CX CLI Logout\n'));
  console.log(chalk.gray(`  Server: ${new URL(session.domain).hostname}`));

  // Revoke tokens (non-fatal)
  if (session.client_id && session.refresh_token) {
    console.log(chalk.gray('  Revoking tokens...'));
    await revokeToken(session.domain, session.client_id, session.access_token);
    await revokeToken(session.domain, session.client_id, session.refresh_token);
  }

  // Delete local session file
  deleteSessionFile();

  console.log(chalk.green(`  ✓ Logged out from ${new URL(session.domain).hostname}\n`));
}

// ============================================================================
// AppModule Commands
// ============================================================================

async function graphqlRequest(domain: string, token: string, query: string, variables: Record<string, any>): Promise<any> {
  const body = JSON.stringify({ query, variables });

  let res = await graphqlPostWithAuth(domain, token, body);

  if (res.statusCode === 401) {
    // PAT tokens have no refresh — fail immediately
    if (process.env.CXTMS_AUTH) throw new Error('PAT token unauthorized (401). Check your CXTMS_AUTH token.');
    // Try refresh for OAuth sessions
    const stored = readSessionFile();
    if (!stored) throw new Error('Session expired. Run `cxtms login <url>` again.');
    try {
      const refreshed = await refreshTokens(stored);
      res = await graphqlPostWithAuth(domain, refreshed.access_token, body);
    } catch {
      throw new Error('Session expired. Run `cxtms login <url>` again.');
    }
  }

  // Try to parse GraphQL errors from 400 responses too
  let json: any;
  try {
    json = JSON.parse(res.body);
  } catch {
    if (res.statusCode !== 200) {
      throw new Error(`GraphQL request failed (${res.statusCode}): ${res.body}`);
    }
    throw new Error('Invalid JSON response from GraphQL endpoint');
  }

  if (json.errors && json.errors.length > 0) {
    const messages = json.errors.map((e: any) => {
      const parts: string[] = [e.message];
      const ext = e.extensions?.message;
      if (ext && ext !== e.message) parts.push(ext);
      if (e.path) parts.push(`path: ${e.path.join('.')}`);
      return parts.join(' — ');
    });
    throw new Error(`GraphQL error: ${messages.join('; ')}`);
  }

  if (res.statusCode !== 200) {
    throw new Error(`GraphQL request failed (${res.statusCode}): ${res.body}`);
  }

  return json.data;
}

function graphqlPostWithAuth(domain: string, token: string, body: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = `${domain}/api/graphql`;
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function resolveDomainFromAppYaml(): string | null {
  const appYamlPath = path.join(process.cwd(), 'app.yaml');
  if (!fs.existsSync(appYamlPath)) return null;
  const appYaml = YAML.parse(fs.readFileSync(appYamlPath, 'utf-8')) as any;
  const serverDomain = appYaml?.server || appYaml?.domain;
  if (!serverDomain) return null;
  let domain = serverDomain;
  if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
    domain = `https://${domain}`;
  }
  return domain.replace(/\/+$/, '');
}

function resolveSession(): TokenFile {
  // 0. Check for PAT token in env (CXTMS_AUTH) — skips OAuth entirely
  const patToken = process.env.CXTMS_AUTH;
  if (patToken) {
    const domain = process.env.CXTMS_SERVER ? process.env.CXTMS_SERVER.replace(/\/+$/, '') : resolveDomainFromAppYaml();
    if (!domain) {
      console.error(chalk.red('CXTMS_AUTH is set but no server domain found.'));
      console.error(chalk.gray('Add `server` to app.yaml or set CXTMS_SERVER in .env'));
      process.exit(2);
    }
    return {
      domain,
      client_id: '',
      access_token: patToken,
      refresh_token: '',
      expires_at: 0,
    };
  }

  // 1. Check local .cxtms/.session.json
  const session = readSessionFile();
  if (session) return session;

  // 2. Not logged in
  console.error(chalk.red('Not logged in. Run `cxtms login <url>` first.'));
  process.exit(2);
}

async function resolveOrgId(domain: string, token: string, override?: number): Promise<number> {
  // 1. Explicit override
  if (override !== undefined) return override;

  // 2. Cached in session file
  const stored = readSessionFile();
  if (stored?.organization_id) return stored.organization_id;

  // 3. Query server
  const data = await graphqlRequest(domain, token, `
    query { organizations(take: 100) { items { organizationId companyName } } }
  `, {});

  const orgs = data?.organizations?.items;
  if (!orgs || orgs.length === 0) {
    throw new Error('No organizations found for this account.');
  }

  if (orgs.length === 1) {
    const orgId = orgs[0].organizationId;
    // Cache it
    if (stored) {
      stored.organization_id = orgId;
      writeSessionFile(stored);
    }
    return orgId;
  }

  // Multiple orgs — list and exit
  console.error(chalk.yellow('\n  Multiple organizations found:\n'));
  for (const org of orgs) {
    console.error(chalk.white(`    ${org.organizationId}  ${org.companyName}`));
  }
  console.error(chalk.gray(`\n  Run \`cxtms orgs select\` to choose, or pass --org <id>.\n`));
  process.exit(2);
}

async function runAppModuleDeploy(file: string | undefined, orgOverride?: number): Promise<void> {
  if (!file) {
    console.error(chalk.red('Error: File path required'));
    console.error(chalk.gray(`Usage: ${PROGRAM_NAME} appmodule deploy <file.yaml> [--org <id>]`));
    process.exit(2);
  }

  if (!fs.existsSync(file)) {
    console.error(chalk.red(`Error: File not found: ${file}`));
    process.exit(2);
  }

  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  // Read and parse YAML
  const yamlContent = fs.readFileSync(file, 'utf-8');
  const parsed = YAML.parse(yamlContent) as any;
  const appModuleId = parsed?.module?.appModuleId;
  if (!appModuleId) {
    console.error(chalk.red('Error: Module YAML is missing module.appModuleId'));
    process.exit(2);
  }

  // Read app.yaml for appManifestId
  let appManifestId: string | undefined;
  const appYamlPath = path.join(process.cwd(), 'app.yaml');
  if (fs.existsSync(appYamlPath)) {
    const appYaml = YAML.parse(fs.readFileSync(appYamlPath, 'utf-8')) as any;
    appManifestId = appYaml?.id;
  }

  console.log(chalk.bold.cyan('\n  AppModule Deploy\n'));
  console.log(chalk.gray(`  Server:  ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:     ${orgId}`));
  console.log(chalk.gray(`  Module:  ${appModuleId}`));
  console.log('');

  // Check if module exists
  const checkData = await graphqlRequest(domain, token, `
    query ($organizationId: Int!, $appModuleId: UUID!) {
      appModule(organizationId: $organizationId, appModuleId: $appModuleId) {
        appModuleId
      }
    }
  `, { organizationId: orgId, appModuleId });

  if (checkData?.appModule) {
    // Update
    console.log(chalk.gray('  Updating existing module...'));
    const updateValues: Record<string, any> = { appModuleYamlDocument: yamlContent };
    if (appManifestId) updateValues.appManifestId = appManifestId;
    const result = await graphqlRequest(domain, token, `
      mutation ($input: UpdateAppModuleInput!) {
        updateAppModule(input: $input) {
          appModule { appModuleId name }
        }
      }
    `, {
      input: {
        organizationId: orgId,
        appModuleId,
        values: updateValues,
      },
    });
    const mod = result?.updateAppModule?.appModule;
    console.log(chalk.green(`  ✓ Updated: ${mod?.name || appModuleId}\n`));
  } else {
    // Create
    console.log(chalk.gray('  Creating new module...'));
    const values: Record<string, any> = { appModuleYamlDocument: yamlContent };
    if (appManifestId) values.appManifestId = appManifestId;
    const result = await graphqlRequest(domain, token, `
      mutation ($input: CreateAppModuleInput!) {
        createAppModule(input: $input) {
          appModule { appModuleId name }
        }
      }
    `, {
      input: {
        organizationId: orgId,
        values,
      },
    });
    const mod = result?.createAppModule?.appModule;
    console.log(chalk.green(`  ✓ Created: ${mod?.name || appModuleId}\n`));
  }
}

async function runAppModuleUndeploy(uuid: string | undefined, orgOverride?: number): Promise<void> {
  if (!uuid) {
    console.error(chalk.red('Error: AppModule ID required'));
    console.error(chalk.gray(`Usage: ${PROGRAM_NAME} appmodule undeploy <appModuleId> [--org <id>]`));
    process.exit(2);
  }

  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  console.log(chalk.bold.cyan('\n  AppModule Undeploy\n'));
  console.log(chalk.gray(`  Server:  ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:     ${orgId}`));
  console.log(chalk.gray(`  Module:  ${uuid}`));
  console.log('');

  await graphqlRequest(domain, token, `
    mutation ($input: DeleteAppModuleInput!) {
      deleteAppModule(input: $input) {
        deleteResult { __typename }
      }
    }
  `, {
    input: {
      organizationId: orgId,
      appModuleId: uuid,
    },
  });

  console.log(chalk.green(`  ✓ Deleted: ${uuid}\n`));
}

async function runOrgsList(): Promise<void> {
  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;

  const data = await graphqlRequest(domain, token, `
    query { organizations(take: 100) { items { organizationId companyName } } }
  `, {});

  const orgs = data?.organizations?.items;
  if (!orgs || orgs.length === 0) {
    console.log(chalk.gray('\n  No organizations found.\n'));
    return;
  }

  console.log(chalk.bold.cyan('\n  Organizations\n'));
  console.log(chalk.gray(`  Server: ${new URL(domain).hostname}\n`));

  for (const org of orgs) {
    const current = session.organization_id === org.organizationId;
    const marker = current ? chalk.green(' ← current') : '';
    console.log(chalk.white(`    ${org.organizationId}  ${org.companyName}${marker}`));
  }
  console.log('');
}

async function runOrgsUse(orgIdStr: string | undefined): Promise<void> {
  if (!orgIdStr) {
    // Show current context
    const session = resolveSession();
    const domain = session.domain;
    console.log(chalk.bold.cyan('\n  Current Context\n'));
    console.log(chalk.white(`  Server:  ${new URL(domain).hostname}`));
    if (session.organization_id) {
      console.log(chalk.white(`  Org:     ${session.organization_id}`));
    } else {
      console.log(chalk.gray(`  Org:     (not set)`));
    }
    const appYamlPath = path.join(process.cwd(), 'app.yaml');
    if (fs.existsSync(appYamlPath)) {
      const appYaml = YAML.parse(fs.readFileSync(appYamlPath, 'utf-8')) as any;
      if (appYaml?.id) {
        console.log(chalk.white(`  App:     ${appYaml.id} ${chalk.gray('(from app.yaml)')}`));
      } else {
        console.log(chalk.gray(`  App:     (not set)`));
      }
    } else {
      console.log(chalk.gray(`  App:     (not set)`));
    }
    console.log('');
    return;
  }

  const orgId = parseInt(orgIdStr, 10);
  if (isNaN(orgId)) {
    console.error(chalk.red(`Invalid organization ID: ${orgIdStr}. Must be a number.`));
    process.exit(2);
  }

  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;

  // Validate the org exists
  const data = await graphqlRequest(domain, token, `
    query { organizations(take: 100) { items { organizationId companyName } } }
  `, {});

  const orgs = data?.organizations?.items;
  const match = orgs?.find((o: any) => o.organizationId === orgId);
  if (!match) {
    console.error(chalk.red(`Organization ${orgId} not found.`));
    if (orgs?.length) {
      console.error(chalk.gray('\n  Available organizations:'));
      for (const org of orgs) {
        console.error(chalk.white(`    ${org.organizationId}  ${org.companyName}`));
      }
    }
    console.error('');
    process.exit(2);
  }

  // Save to session file
  session.organization_id = orgId;
  writeSessionFile(session);

  console.log(chalk.green(`\n  ✓ Context set to: ${match.companyName} (${orgId})\n`));
}

async function runOrgsSelect(): Promise<void> {
  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;

  const data = await graphqlRequest(domain, token, `
    query { organizations(take: 100) { items { organizationId companyName } } }
  `, {});

  const orgs = data?.organizations?.items;
  if (!orgs || orgs.length === 0) {
    console.log(chalk.gray('\n  No organizations found.\n'));
    return;
  }

  console.log(chalk.bold.cyan('\n  Select Organization\n'));
  console.log(chalk.gray(`  Server: ${new URL(domain).hostname}\n`));

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    const current = session.organization_id === org.organizationId;
    const marker = current ? chalk.green(' ← current') : '';
    console.log(chalk.white(`    ${i + 1}) ${org.organizationId}  ${org.companyName}${marker}`));
  }
  console.log('');

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise<string>((resolve) => {
    rl.question(chalk.yellow('  Enter number: '), (ans: string) => {
      rl.close();
      resolve(ans.trim());
    });
  });

  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= orgs.length) {
    console.error(chalk.red('\n  Invalid selection.\n'));
    process.exit(2);
  }

  const selected = orgs[idx];
  session.organization_id = selected.organizationId;
  writeSessionFile(session);

  console.log(chalk.green(`\n  ✓ Context set to: ${selected.companyName} (${selected.organizationId})\n`));
}

// ============================================================================
// Workflow Commands
// ============================================================================

async function runWorkflowDeploy(file: string | undefined, orgOverride?: number): Promise<void> {
  if (!file) {
    console.error(chalk.red('Error: File path required'));
    console.error(chalk.gray(`Usage: ${PROGRAM_NAME} workflow deploy <file.yaml> [--org <id>]`));
    process.exit(2);
  }

  if (!fs.existsSync(file)) {
    console.error(chalk.red(`Error: File not found: ${file}`));
    process.exit(2);
  }

  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  const yamlContent = fs.readFileSync(file, 'utf-8');
  const parsed = YAML.parse(yamlContent) as any;
  const workflowId = parsed?.workflow?.workflowId;
  if (!workflowId) {
    console.error(chalk.red('Error: Workflow YAML is missing workflow.workflowId'));
    process.exit(2);
  }

  const workflowName = parsed?.workflow?.name || workflowId;

  // Read app.yaml for appManifestId
  let appManifestId: string | undefined;
  const appYamlPath = path.join(process.cwd(), 'app.yaml');
  if (fs.existsSync(appYamlPath)) {
    const appYaml = YAML.parse(fs.readFileSync(appYamlPath, 'utf-8')) as any;
    appManifestId = appYaml?.id;
  }

  console.log(chalk.bold.cyan('\n  Workflow Deploy\n'));
  console.log(chalk.gray(`  Server:    ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:       ${orgId}`));
  console.log(chalk.gray(`  Workflow:  ${workflowName}`));
  console.log('');

  // Check if workflow exists
  const checkData = await graphqlRequest(domain, token, `
    query ($organizationId: Int!, $workflowId: UUID!) {
      workflow(organizationId: $organizationId, workflowId: $workflowId) {
        workflowId
      }
    }
  `, { organizationId: orgId, workflowId });

  if (checkData?.workflow) {
    console.log(chalk.gray('  Updating existing workflow...'));
    const updateInput: Record<string, any> = {
      organizationId: orgId,
      workflowId,
      workflowYamlDocument: yamlContent,
    };
    if (appManifestId) updateInput.appManifestId = appManifestId;
    const result = await graphqlRequest(domain, token, `
      mutation ($input: UpdateWorkflowInput!) {
        updateWorkflow(input: $input) {
          workflow { workflowId }
        }
      }
    `, {
      input: updateInput,
    });
    console.log(chalk.green(`  ✓ Updated: ${workflowName}\n`));
  } else {
    console.log(chalk.gray('  Creating new workflow...'));
    const createInput: Record<string, any> = {
      organizationId: orgId,
      workflowYamlDocument: yamlContent,
    };
    if (appManifestId) createInput.appManifestId = appManifestId;
    const result = await graphqlRequest(domain, token, `
      mutation ($input: CreateWorkflowInput!) {
        createWorkflow(input: $input) {
          workflow { workflowId }
        }
      }
    `, {
      input: createInput,
    });
    console.log(chalk.green(`  ✓ Created: ${workflowName}\n`));
  }
}

async function runWorkflowUndeploy(uuid: string | undefined, orgOverride?: number): Promise<void> {
  if (!uuid) {
    console.error(chalk.red('Error: Workflow ID required'));
    console.error(chalk.gray(`Usage: ${PROGRAM_NAME} workflow undeploy <workflowId> [--org <id>]`));
    process.exit(2);
  }

  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  console.log(chalk.bold.cyan('\n  Workflow Undeploy\n'));
  console.log(chalk.gray(`  Server:    ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:       ${orgId}`));
  console.log(chalk.gray(`  Workflow:  ${uuid}`));
  console.log('');

  await graphqlRequest(domain, token, `
    mutation ($input: DeleteWorkflowInput!) {
      deleteWorkflow(input: $input) {
        deleteResult { __typename }
      }
    }
  `, {
    input: {
      organizationId: orgId,
      workflowId: uuid,
    },
  });

  console.log(chalk.green(`  ✓ Deleted: ${uuid}\n`));
}

async function runWorkflowExecute(workflowIdOrFile: string | undefined, orgOverride?: number, variables?: string): Promise<void> {
  if (!workflowIdOrFile) {
    console.error(chalk.red('Error: Workflow ID or YAML file required'));
    console.error(chalk.gray(`Usage: ${PROGRAM_NAME} workflow execute <workflowId|file.yaml> [--org <id>] [--vars '{"key":"value"}']`));
    process.exit(2);
  }

  const session = resolveSession();
  const { domain, access_token: token } = session;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  // Resolve workflowId
  let workflowId = workflowIdOrFile;
  let workflowName = workflowIdOrFile;
  if (workflowIdOrFile.endsWith('.yaml') || workflowIdOrFile.endsWith('.yml')) {
    if (!fs.existsSync(workflowIdOrFile)) {
      console.error(chalk.red(`Error: File not found: ${workflowIdOrFile}`));
      process.exit(2);
    }
    const parsed = YAML.parse(fs.readFileSync(workflowIdOrFile, 'utf-8')) as any;
    workflowId = parsed?.workflow?.workflowId;
    workflowName = parsed?.workflow?.name || path.basename(workflowIdOrFile);
    if (!workflowId) {
      console.error(chalk.red('Error: Workflow YAML is missing workflow.workflowId'));
      process.exit(2);
    }
  }

  // Parse variables if provided
  let vars: Record<string, any> | undefined;
  if (variables) {
    try {
      vars = JSON.parse(variables);
    } catch {
      console.error(chalk.red('Error: --vars must be valid JSON'));
      process.exit(2);
    }
  }

  console.log(chalk.bold.cyan('\n  Workflow Execute\n'));
  console.log(chalk.gray(`  Server:    ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:       ${orgId}`));
  console.log(chalk.gray(`  Workflow:  ${workflowName}`));
  if (vars) console.log(chalk.gray(`  Variables: ${JSON.stringify(vars)}`));
  console.log('');

  const input: Record<string, any> = { organizationId: orgId, workflowId };
  if (vars) input.variables = vars;

  const data = await graphqlRequest(domain, token, `
    mutation ($input: ExecuteWorkflowInput!) {
      executeWorkflow(input: $input) {
        workflowExecutionResult {
          executionId workflowId isAsync outputs
        }
      }
    }
  `, { input });

  const result = data?.executeWorkflow?.workflowExecutionResult;
  if (!result) {
    console.error(chalk.red('  No execution result returned.\n'));
    process.exit(2);
  }

  console.log(chalk.green(`  ✓ Executed: ${workflowName}`));
  console.log(chalk.white(`  Execution ID: ${result.executionId}`));
  console.log(chalk.white(`  Async:        ${result.isAsync}`));
  if (result.outputs && Object.keys(result.outputs).length > 0) {
    console.log(chalk.white(`  Outputs:`));
    console.log(chalk.gray(`    ${JSON.stringify(result.outputs, null, 2).split('\n').join('\n    ')}`));
  }
  console.log('');
}

function resolveWorkflowId(workflowIdOrFile: string): string {
  if (workflowIdOrFile.endsWith('.yaml') || workflowIdOrFile.endsWith('.yml')) {
    if (!fs.existsSync(workflowIdOrFile)) {
      console.error(chalk.red(`Error: File not found: ${workflowIdOrFile}`));
      process.exit(2);
    }
    const parsed = YAML.parse(fs.readFileSync(workflowIdOrFile, 'utf-8')) as any;
    const id = parsed?.workflow?.workflowId;
    if (!id) {
      console.error(chalk.red('Error: Workflow YAML is missing workflow.workflowId'));
      process.exit(2);
    }
    return id;
  }
  return workflowIdOrFile;
}

async function runWorkflowLogs(workflowIdOrFile: string | undefined, orgOverride?: number, fromDate?: string, toDate?: string): Promise<void> {
  if (!workflowIdOrFile) {
    console.error(chalk.red('Error: Workflow ID or YAML file required'));
    console.error(chalk.gray(`Usage: ${PROGRAM_NAME} workflow logs <workflowId|file.yaml> [--from <date>] [--to <date>]`));
    process.exit(2);
  }

  const session = resolveSession();
  const { domain, access_token: token } = session;
  const orgId = await resolveOrgId(domain, token, orgOverride);
  const workflowId = resolveWorkflowId(workflowIdOrFile);

  // Parse date filters
  const fromTs = fromDate ? new Date(fromDate).getTime() : 0;
  const toTs = toDate ? new Date(toDate + 'T23:59:59').getTime() : Infinity;
  if (fromDate && isNaN(fromTs)) {
    console.error(chalk.red(`Invalid --from date: ${fromDate}. Use YYYY-MM-DD format.`));
    process.exit(2);
  }
  if (toDate && isNaN(toTs)) {
    console.error(chalk.red(`Invalid --to date: ${toDate}. Use YYYY-MM-DD format.`));
    process.exit(2);
  }

  const data = await graphqlRequest(domain, token, `
    query ($organizationId: Int!, $workflowId: UUID!) {
      workflowExecutions(organizationId: $organizationId, workflowId: $workflowId, take: 100) {
        totalCount
        items { executionId executionStatus executedAt durationMs txtLogUrl user { fullName email } }
      }
    }
  `, { organizationId: orgId, workflowId });

  let items = data?.workflowExecutions?.items || [];
  const total = data?.workflowExecutions?.totalCount || 0;

  // Filter by date range
  if (fromDate || toDate) {
    items = items.filter((ex: any) => {
      const t = new Date(ex.executedAt).getTime();
      return t >= fromTs && t <= toTs;
    });
  }

  // Sort descending
  items.sort((a: any, b: any) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

  console.log(chalk.bold.cyan('\n  Workflow Logs\n'));
  console.log(chalk.gray(`  Server:    ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Workflow:  ${workflowId}`));
  console.log(chalk.gray(`  Total:     ${total}`));
  if (fromDate || toDate) {
    console.log(chalk.gray(`  Filter:    ${fromDate || '...'} → ${toDate || '...'}`));
  }
  console.log(chalk.gray(`  Showing:   ${items.length}\n`));

  if (items.length === 0) {
    console.log(chalk.gray('  No executions found.\n'));
    return;
  }

  for (const ex of items) {
    const date = new Date(ex.executedAt).toLocaleString();
    const duration = ex.durationMs != null ? `${(ex.durationMs / 1000).toFixed(1)}s` : '?';
    const statusColor = ex.executionStatus === 'Success' ? chalk.green : ex.executionStatus === 'Failed' ? chalk.red : chalk.yellow;
    const logIcon = ex.txtLogUrl ? chalk.green('●') : chalk.gray('○');
    const user = ex.user?.fullName || ex.user?.email || '';
    console.log(`  ${logIcon} ${chalk.white(ex.executionId)}  ${statusColor(ex.executionStatus.padEnd(10))}  ${date}  ${chalk.gray(duration)}${user ? '  ' + chalk.gray(user) : ''}`);
  }
  console.log();
  console.log(chalk.gray(`  ${chalk.green('●')} log available  ${chalk.gray('○')} no log`));
  console.log(chalk.gray(`  Download: ${PROGRAM_NAME} workflow log <executionId> [--output <file>] [--console]\n`));
}

function fetchGzipText(url: string): Promise<string> {
  const zlib = require('zlib');
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res: any) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const rawChunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => rawChunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(rawChunks);
        if (raw.length === 0) { resolve('(empty log)'); return; }
        zlib.gunzip(raw, (err: any, result: Buffer) => {
          if (err) { resolve(raw.toString('utf-8')); return; }
          resolve(result.toString('utf-8'));
        });
      });
    }).on('error', reject);
  });
}

async function runWorkflowLog(executionId: string | undefined, orgOverride?: number, outputFile?: string, toConsole?: boolean, useJson?: boolean): Promise<void> {
  if (!executionId) {
    console.error(chalk.red('Error: Execution ID required'));
    console.error(chalk.gray(`Usage: ${PROGRAM_NAME} workflow log <executionId> [--output <file>] [--console] [--json]`));
    process.exit(2);
  }

  const session = resolveSession();
  const { domain, access_token: token } = session;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  const data = await graphqlRequest(domain, token, `
    query ($organizationId: Int!, $executionId: UUID!) {
      workflowExecution(organizationId: $organizationId, executionId: $executionId) {
        executionId workflowId executionStatus executedAt durationMs
        txtLogUrl jsonLogUrl
        user { fullName email }
      }
    }
  `, { organizationId: orgId, executionId });

  const ex = data?.workflowExecution;
  if (!ex) {
    console.error(chalk.red(`Execution not found: ${executionId}`));
    process.exit(2);
  }

  const logUrl = useJson ? ex.jsonLogUrl : ex.txtLogUrl;
  const logType = useJson ? 'json' : 'txt';
  const ext = useJson ? '.json' : '.log';

  if (!logUrl) {
    console.error(chalk.yellow(`No ${logType} log available for this execution.`));
    process.exit(0);
  }

  const date = new Date(ex.executedAt).toLocaleString();
  const duration = ex.durationMs != null ? `${(ex.durationMs / 1000).toFixed(1)}s` : '?';
  const statusColor = ex.executionStatus === 'Success' ? chalk.green : ex.executionStatus === 'Failed' ? chalk.red : chalk.yellow;
  const userName = ex.user?.fullName || ex.user?.email || '';

  // Download log
  let logText: string;
  try {
    logText = await fetchGzipText(logUrl);
  } catch (e: any) {
    console.error(chalk.red(`Failed to download log: ${e.message}`));
    process.exit(2);
  }

  // Pretty-print JSON if it's valid JSON
  if (useJson) {
    try {
      const parsed = JSON.parse(logText);
      logText = JSON.stringify(parsed, null, 2);
    } catch { /* keep as-is */ }
  }

  if (toConsole) {
    console.log(chalk.bold.cyan('\n  Workflow Execution\n'));
    console.log(chalk.white(`  ID:        ${ex.executionId}`));
    console.log(chalk.white(`  Workflow:  ${ex.workflowId}`));
    console.log(chalk.white(`  Status:    ${statusColor(ex.executionStatus)}`));
    console.log(chalk.white(`  Executed:  ${date}`));
    console.log(chalk.white(`  Duration:  ${duration}`));
    if (userName) console.log(chalk.white(`  User:      ${userName}`));
    console.log(chalk.gray(`\n  --- ${logType.toUpperCase()} Log ---\n`));
    console.log(logText);
    return;
  }

  // Save to file
  let filePath: string;
  if (outputFile) {
    filePath = path.resolve(outputFile);
  } else {
    const tmpDir = os.tmpdir();
    const dateStr = new Date(ex.executedAt).toISOString().slice(0, 10);
    filePath = path.join(tmpDir, `workflow-${ex.workflowId}-${dateStr}-${executionId}${ext}`);
  }

  fs.writeFileSync(filePath, logText, 'utf-8');
  console.log(chalk.green(`  ✓ ${logType.toUpperCase()} log saved: ${filePath}`));
  console.log(chalk.gray(`    Execution: ${executionId}  ${statusColor(ex.executionStatus)}  ${date}  ${duration}`));
}

// ============================================================================
// Publish Command
// ============================================================================

async function pushWorkflowQuiet(domain: string, token: string, orgId: number, file: string, appManifestId?: string): Promise<{ ok: boolean; name: string; error?: string }> {
  let name = path.basename(file);
  try {
    const yamlContent = fs.readFileSync(file, 'utf-8');
    const parsed = YAML.parse(yamlContent) as any;
    const workflowId = parsed?.workflow?.workflowId;
    name = parsed?.workflow?.name || name;
    if (!workflowId) return { ok: false, name, error: 'Missing workflow.workflowId' };
    const checkData = await graphqlRequest(domain, token, `
      query ($organizationId: Int!, $workflowId: UUID!) {
        workflow(organizationId: $organizationId, workflowId: $workflowId) { workflowId }
      }
    `, { organizationId: orgId, workflowId });

    if (checkData?.workflow) {
      const updateInput: Record<string, any> = { organizationId: orgId, workflowId, workflowYamlDocument: yamlContent };
      if (appManifestId) updateInput.appManifestId = appManifestId;
      await graphqlRequest(domain, token, `
        mutation ($input: UpdateWorkflowInput!) {
          updateWorkflow(input: $input) { workflow { workflowId } }
        }
      `, { input: updateInput });
    } else {
      const createInput: Record<string, any> = { organizationId: orgId, workflowYamlDocument: yamlContent };
      if (appManifestId) createInput.appManifestId = appManifestId;
      await graphqlRequest(domain, token, `
        mutation ($input: CreateWorkflowInput!) {
          createWorkflow(input: $input) { workflow { workflowId } }
        }
      `, { input: createInput });
    }
    return { ok: true, name };
  } catch (e: any) {
    return { ok: false, name, error: e.message };
  }
}

async function pushModuleQuiet(domain: string, token: string, orgId: number, file: string, appManifestId?: string): Promise<{ ok: boolean; name: string; error?: string }> {
  let name = path.basename(file);
  try {
    const yamlContent = fs.readFileSync(file, 'utf-8');
    const parsed = YAML.parse(yamlContent) as any;
    const appModuleId = parsed?.module?.appModuleId;
    name = parsed?.module?.name || name;
    if (!appModuleId) return { ok: false, name, error: 'Missing module.appModuleId' };

    const checkData = await graphqlRequest(domain, token, `
      query ($organizationId: Int!, $appModuleId: UUID!) {
        appModule(organizationId: $organizationId, appModuleId: $appModuleId) { appModuleId }
      }
    `, { organizationId: orgId, appModuleId });

    if (checkData?.appModule) {
      const updateValues: Record<string, any> = { appModuleYamlDocument: yamlContent };
      if (appManifestId) updateValues.appManifestId = appManifestId;
      await graphqlRequest(domain, token, `
        mutation ($input: UpdateAppModuleInput!) {
          updateAppModule(input: $input) { appModule { appModuleId name } }
        }
      `, { input: { organizationId: orgId, appModuleId, values: updateValues } });
    } else {
      const values: Record<string, any> = { appModuleYamlDocument: yamlContent };
      if (appManifestId) values.appManifestId = appManifestId;
      await graphqlRequest(domain, token, `
        mutation ($input: CreateAppModuleInput!) {
          createAppModule(input: $input) { appModule { appModuleId name } }
        }
      `, { input: { organizationId: orgId, values } });
    }
    return { ok: true, name };
  } catch (e: any) {
    return { ok: false, name, error: e.message };
  }
}

// ============================================================================
// PAT Token Commands
// ============================================================================

async function runPatCreate(name: string): Promise<void> {
  const session = resolveSession();
  const { domain, access_token: token } = session;

  const data = await graphqlRequest(domain, token, `
    mutation ($input: CreatePersonalAccessTokenInput!) {
      createPersonalAccessToken(input: $input) {
        createPatPayload {
          token
          personalAccessToken { id name scopes }
        }
      }
    }
  `, { input: { input: { name, scopes: ['TMS.ApiAPI'] } } });

  const payload = data?.createPersonalAccessToken?.createPatPayload;
  const patToken = payload?.token;
  const pat = payload?.personalAccessToken;

  if (!patToken) {
    console.error(chalk.red('Failed to create PAT token — no token returned.'));
    process.exit(2);
  }

  console.log(chalk.green('PAT token created successfully!'));
  console.log();
  console.log(chalk.bold('  Token:'), chalk.cyan(patToken));
  console.log(chalk.bold('  ID:   '), chalk.gray(pat?.id || 'unknown'));
  console.log(chalk.bold('  Name: '), pat?.name || name);
  console.log();
  console.log(chalk.yellow('⚠  Copy the token now — it will not be shown again.'));
  console.log();
  console.log(chalk.bold('To use PAT authentication, add to your project .env file:'));
  console.log();
  console.log(chalk.cyan(`  CXTMS_AUTH=${patToken}`));
  console.log(chalk.cyan(`  CXTMS_SERVER=${domain}`));
  console.log();
  console.log(chalk.gray('When CXTMS_AUTH is set, cxtms will skip OAuth login and use the PAT token directly.'));
  console.log(chalk.gray('You can also export these as environment variables instead of using .env.'));
}

async function runPatList(): Promise<void> {
  const session = resolveSession();
  const { domain, access_token: token } = session;

  const data = await graphqlRequest(domain, token, `
    {
      personalAccessTokens(skip: 0, take: 50) {
        items { id name createdAt expiresAt lastUsedAt scopes }
        totalCount
      }
    }
  `, {});

  const items = data?.personalAccessTokens?.items || [];
  const total = data?.personalAccessTokens?.totalCount ?? items.length;

  if (items.length === 0) {
    console.log(chalk.gray('No active PAT tokens found.'));
    return;
  }

  console.log(chalk.bold(`PAT tokens (${total}):\n`));
  for (const t of items) {
    const expires = t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : 'never';
    const lastUsed = t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'never';
    console.log(`  ${chalk.cyan(t.name || '(unnamed)')}`);
    console.log(`    ID:        ${chalk.gray(t.id)}`);
    console.log(`    Created:   ${new Date(t.createdAt).toLocaleDateString()}`);
    console.log(`    Expires:   ${expires}`);
    console.log(`    Last used: ${lastUsed}`);
    console.log(`    Scopes:    ${(t.scopes || []).join(', ') || 'none'}`);
    console.log();
  }
}

async function runPatRevoke(id: string): Promise<void> {
  const session = resolveSession();
  const { domain, access_token: token } = session;

  const data = await graphqlRequest(domain, token, `
    mutation ($input: RevokePersonalAccessTokenInput!) {
      revokePersonalAccessToken(input: $input) {
        personalAccessToken { id name revokedAt }
      }
    }
  `, { input: { id } });

  const revoked = data?.revokePersonalAccessToken?.personalAccessToken;
  if (revoked) {
    console.log(chalk.green(`PAT token revoked: ${revoked.name || revoked.id}`));
  } else {
    console.log(chalk.green('PAT token revoked.'));
  }
}

async function runPatSetup(): Promise<void> {
  const patToken = process.env.CXTMS_AUTH;
  const server = process.env.CXTMS_SERVER || resolveDomainFromAppYaml();

  console.log(chalk.bold('PAT Token Status:\n'));

  if (patToken) {
    const masked = patToken.slice(0, 8) + '...' + patToken.slice(-4);
    console.log(chalk.green(`  CXTMS_AUTH is set: ${masked}`));
  } else {
    console.log(chalk.yellow('  CXTMS_AUTH is not set'));
  }

  if (server) {
    console.log(chalk.green(`  Server:           ${server}`));
  } else {
    console.log(chalk.yellow('  Server:           not configured (add `server` to app.yaml or set CXTMS_SERVER)'));
  }

  console.log();

  if (patToken && server) {
    console.log(chalk.green('PAT authentication is active. OAuth login will be skipped.'));
  } else {
    console.log(chalk.bold('To set up PAT authentication:'));
    console.log();
    console.log(chalk.white('  1. Create a token:'));
    console.log(chalk.cyan('     cxtms pat create "my-token-name"'));
    console.log();
    console.log(chalk.white('  2. Add to your project .env file:'));
    console.log(chalk.cyan('     CXTMS_AUTH=pat_xxxxx'));
    console.log(chalk.cyan('     CXTMS_SERVER=https://your-server.com'));
    console.log();
    console.log(chalk.gray('  Or set `server` in app.yaml instead of CXTMS_SERVER.'));
  }
}

async function runPublish(featureDir: string | undefined, orgOverride?: number): Promise<void> {
  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  // Read app.yaml
  const appYamlPath = path.join(process.cwd(), 'app.yaml');
  if (!fs.existsSync(appYamlPath)) {
    console.error(chalk.red('Error: app.yaml not found in current directory'));
    process.exit(2);
  }
  const appYaml = YAML.parse(fs.readFileSync(appYamlPath, 'utf-8')) as any;
  const appManifestId = appYaml?.id;
  const appName = appYaml?.name || 'unknown';

  console.log(chalk.bold.cyan('\n  Publish\n'));
  console.log(chalk.gray(`  Server:  ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:     ${orgId}`));
  console.log(chalk.gray(`  App:     ${appName}`));
  if (featureDir) {
    console.log(chalk.gray(`  Feature: ${featureDir}`));
  }
  console.log('');

  // Step 1: Create or update app manifest
  if (appManifestId) {
    console.log(chalk.gray('  Publishing app manifest...'));
    try {
      const checkData = await graphqlRequest(domain, token, `
        query ($organizationId: Int!, $appManifestId: UUID!) {
          appManifest(organizationId: $organizationId, appManifestId: $appManifestId) { appManifestId }
        }
      `, { organizationId: orgId, appManifestId });

      if (checkData?.appManifest) {
        await graphqlRequest(domain, token, `
          mutation ($input: UpdateAppManifestInput!) {
            updateAppManifest(input: $input) { appManifest { appManifestId name } }
          }
        `, { input: { organizationId: orgId, appManifestId, values: { name: appName, description: appYaml?.description || '' } } });
        console.log(chalk.green('  ✓ App manifest updated'));
      } else {
        await graphqlRequest(domain, token, `
          mutation ($input: CreateAppManifestInput!) {
            createAppManifest(input: $input) { appManifest { appManifestId name } }
          }
        `, { input: { organizationId: orgId, values: { appManifestId, name: appName, description: appYaml?.description || '' } } });
        console.log(chalk.green('  ✓ App manifest created'));
      }
    } catch (e: any) {
      console.log(chalk.red(`  ✗ App manifest failed: ${e.message}`));
    }
  }

  // Step 2: Discover files
  const baseDir = featureDir ? path.join(process.cwd(), 'features', featureDir) : process.cwd();
  if (featureDir && !fs.existsSync(baseDir)) {
    console.error(chalk.red(`Error: Feature directory not found: features/${featureDir}`));
    process.exit(2);
  }

  const workflowDirs = [path.join(baseDir, 'workflows')];
  const moduleDirs = [path.join(baseDir, 'modules')];

  // Collect YAML files
  const workflowFiles: string[] = [];
  const moduleFiles: string[] = [];

  for (const dir of workflowDirs) {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.yaml') || f.endsWith('.yml')) {
          workflowFiles.push(path.join(dir, f));
        }
      }
    }
  }

  for (const dir of moduleDirs) {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.yaml') || f.endsWith('.yml')) {
          moduleFiles.push(path.join(dir, f));
        }
      }
    }
  }

  console.log(chalk.gray(`\n  Found ${workflowFiles.length} workflow(s), ${moduleFiles.length} module(s)\n`));

  let succeeded = 0;
  let failed = 0;

  // Step 3: Deploy workflows
  for (const file of workflowFiles) {
    const relPath = path.relative(process.cwd(), file);
    const result = await pushWorkflowQuiet(domain, token, orgId, file, appManifestId);
    if (result.ok) {
      console.log(chalk.green(`  ✓ ${relPath}`));
      succeeded++;
    } else {
      console.log(chalk.red(`  ✗ ${relPath}: ${result.error}`));
      failed++;
    }
  }

  // Step 4: Deploy modules
  for (const file of moduleFiles) {
    const relPath = path.relative(process.cwd(), file);
    const result = await pushModuleQuiet(domain, token, orgId, file, appManifestId);
    if (result.ok) {
      console.log(chalk.green(`  ✓ ${relPath}`));
      succeeded++;
    } else {
      console.log(chalk.red(`  ✗ ${relPath}: ${result.error}`));
      failed++;
    }
  }

  // Summary
  console.log('');
  if (failed === 0) {
    console.log(chalk.green(`  ✓ Published ${succeeded} file(s) successfully\n`));
  } else {
    console.log(chalk.yellow(`  Published ${succeeded} file(s), ${failed} failed\n`));
  }
}

// ============================================================================
// App Manifest Commands (install from git, publish to git, list)
// ============================================================================

function readAppYaml(): { id?: string; name?: string; description?: string; repository?: string; branch?: string } {
  const appYamlPath = path.join(process.cwd(), 'app.yaml');
  if (!fs.existsSync(appYamlPath)) {
    console.error(chalk.red('Error: app.yaml not found in current directory'));
    process.exit(2);
  }
  return YAML.parse(fs.readFileSync(appYamlPath, 'utf-8')) as any;
}

async function runAppInstall(orgOverride?: number, branch?: string, force?: boolean, skipChanged?: boolean): Promise<void> {
  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  const appYaml = readAppYaml();
  const repository = appYaml.repository;
  if (!repository) {
    console.error(chalk.red('Error: app.yaml must have a `repository` field'));
    process.exit(2);
  }

  const repositoryBranch = branch || appYaml.branch || 'main';

  console.log(chalk.bold.cyan('\n  App Install\n'));
  console.log(chalk.gray(`  Server:     ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:        ${orgId}`));
  console.log(chalk.gray(`  Repository: ${repository}`));
  console.log(chalk.gray(`  Branch:     ${repositoryBranch}`));
  if (force) console.log(chalk.gray(`  Force:      yes`));
  if (skipChanged) console.log(chalk.gray(`  Skip changed: yes`));
  console.log('');

  try {
    const data = await graphqlRequest(domain, token, `
      mutation ($input: InstallAppManifestInput!) {
        installAppManifest(input: $input) {
          appManifest {
            appManifestId
            name
            currentVersion
            isEnabled
            hasUnpublishedChanges
            isUpdateAvailable
          }
        }
      }
    `, {
      input: {
        organizationId: orgId,
        values: {
          repository,
          repositoryBranch,
          force: force || false,
          skipModulesWithChanges: skipChanged || false,
        }
      }
    });

    const manifest = data?.installAppManifest?.appManifest;
    if (manifest) {
      console.log(chalk.green(`  ✓ Installed ${manifest.name} v${manifest.currentVersion}`));
      if (manifest.hasUnpublishedChanges) {
        console.log(chalk.yellow(`    Has unpublished changes`));
      }
    } else {
      console.log(chalk.green('  ✓ Install completed'));
    }
  } catch (e: any) {
    console.error(chalk.red(`  ✗ Install failed: ${e.message}`));
    process.exit(1);
  }
  console.log('');
}

async function runAppPublish(orgOverride?: number, message?: string, branch?: string, force?: boolean, targetFiles?: string[]): Promise<void> {
  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  const appYaml = readAppYaml();
  const appManifestId = appYaml.id;
  if (!appManifestId) {
    console.error(chalk.red('Error: app.yaml must have an `id` field'));
    process.exit(2);
  }

  console.log(chalk.bold.cyan('\n  App Publish\n'));
  console.log(chalk.gray(`  Server:  ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:     ${orgId}`));
  console.log(chalk.gray(`  App:     ${appYaml.name || appManifestId}`));
  if (message) console.log(chalk.gray(`  Message: ${message}`));
  if (branch) console.log(chalk.gray(`  Branch:  ${branch}`));
  if (force) console.log(chalk.gray(`  Force:   yes`));

  // Extract workflow/module IDs from target files
  const workflowIds: string[] = [];
  const moduleIds: string[] = [];
  if (targetFiles && targetFiles.length > 0) {
    for (const file of targetFiles) {
      if (!fs.existsSync(file)) {
        console.error(chalk.red(`  Error: File not found: ${file}`));
        process.exit(2);
      }
      const parsed = YAML.parse(fs.readFileSync(file, 'utf-8')) as any;
      if (parsed?.workflow?.workflowId) {
        workflowIds.push(parsed.workflow.workflowId);
        console.log(chalk.gray(`  Workflow: ${parsed.workflow.name || parsed.workflow.workflowId}`));
      } else if (parsed?.module?.appModuleId) {
        moduleIds.push(parsed.module.appModuleId);
        console.log(chalk.gray(`  Module:   ${parsed.module.name || parsed.module.appModuleId}`));
      } else {
        console.error(chalk.red(`  Error: Cannot identify file type: ${file}`));
        process.exit(2);
      }
    }
  }
  console.log('');

  try {
    const publishValues: Record<string, any> = {
      message: message || undefined,
      branch: branch || undefined,
      force: force || false,
    };
    if (workflowIds.length > 0) publishValues.workflowIds = workflowIds;
    if (moduleIds.length > 0) publishValues.moduleIds = moduleIds;

    const data = await graphqlRequest(domain, token, `
      mutation ($input: PublishAppManifestInput!) {
        publishAppManifest(input: $input) {
          appManifest {
            appManifestId
            name
            currentVersion
            hasUnpublishedChanges
          }
        }
      }
    `, {
      input: {
        organizationId: orgId,
        appManifestId,
        values: publishValues,
      }
    });

    const manifest = data?.publishAppManifest?.appManifest;
    if (manifest) {
      console.log(chalk.green(`  ✓ Published ${manifest.name} v${manifest.currentVersion}`));
    } else {
      console.log(chalk.green('  ✓ Publish completed'));
    }
  } catch (e: any) {
    console.error(chalk.red(`  ✗ Publish failed: ${e.message}`));
    process.exit(1);
  }
  console.log('');
}

async function runAppList(orgOverride?: number): Promise<void> {
  const session = resolveSession();
  const domain = session.domain;
  const token = session.access_token;
  const orgId = await resolveOrgId(domain, token, orgOverride);

  console.log(chalk.bold.cyan('\n  App Manifests\n'));
  console.log(chalk.gray(`  Server: ${new URL(domain).hostname}`));
  console.log(chalk.gray(`  Org:    ${orgId}\n`));

  try {
    const data = await graphqlRequest(domain, token, `
      query ($organizationId: Int!) {
        appManifests(organizationId: $organizationId) {
          items {
            appManifestId
            name
            currentVersion
            isEnabled
            hasUnpublishedChanges
            isUpdateAvailable
            repository
            repositoryBranch
          }
        }
      }
    `, { organizationId: orgId });

    const items = data?.appManifests?.items || [];
    if (items.length === 0) {
      console.log(chalk.gray('  No app manifests installed\n'));
      return;
    }

    for (const app of items) {
      const flags: string[] = [];
      if (!app.isEnabled) flags.push(chalk.red('disabled'));
      if (app.hasUnpublishedChanges) flags.push(chalk.yellow('unpublished'));
      if (app.isUpdateAvailable) flags.push(chalk.cyan('update available'));
      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';

      console.log(`  ${chalk.bold(app.name)} ${chalk.gray(`v${app.currentVersion}`)}${flagStr}`);
      console.log(chalk.gray(`    ID:   ${app.appManifestId}`));
      if (app.repository) {
        console.log(chalk.gray(`    Repo: ${app.repository} (${app.repositoryBranch || 'main'})`));
      }
    }
    console.log('');
  } catch (e: any) {
    console.error(chalk.red(`  ✗ Failed to list apps: ${e.message}`));
    process.exit(1);
  }
}

// ============================================================================
// Query Command
// ============================================================================

async function runQuery(queryArg: string | undefined, variables?: string): Promise<void> {
  if (!queryArg) {
    console.error(chalk.red('Error: query argument required (inline GraphQL string or .graphql/.gql file path)'));
    process.exit(2);
  }

  // Resolve query: file path or inline string
  let query: string;
  if (queryArg.endsWith('.graphql') || queryArg.endsWith('.gql')) {
    if (!fs.existsSync(queryArg)) {
      console.error(chalk.red(`Error: file not found: ${queryArg}`));
      process.exit(2);
    }
    query = fs.readFileSync(queryArg, 'utf-8');
  } else {
    query = queryArg;
  }

  // Parse variables if provided
  let vars: Record<string, any> = {};
  if (variables) {
    try {
      vars = JSON.parse(variables);
    } catch {
      console.error(chalk.red('Error: --vars must be valid JSON'));
      process.exit(2);
    }
  }

  const session = resolveSession();
  const data = await graphqlRequest(session.domain, session.access_token, query, vars);
  console.log(JSON.stringify(data, null, 2));
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
      application: 'System',
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
  const commands = ['validate', 'schema', 'example', 'list', 'help', 'version', 'report', 'init', 'create', 'extract', 'sync-schemas', 'install-skills', 'update', 'setup-claude', 'login', 'logout', 'pat', 'appmodule', 'orgs', 'workflow', 'publish', 'query', 'app'];
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
    } else if (arg === '--org') {
      const orgArg = args[++i];
      const parsed = parseInt(orgArg, 10);
      if (isNaN(parsed)) {
        console.error(chalk.red(`Invalid --org value: ${orgArg}. Must be a number.`));
        process.exit(2);
      }
      options.orgId = parsed;
    } else if (arg === '--vars') {
      options.vars = args[++i];
    } else if (arg === '--from') {
      options.from = args[++i];
    } else if (arg === '--to') {
      options.to = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--console') {
      options.console = true;
    } else if (arg === '--message' || arg === '-m') {
      options.message = args[++i];
    } else if (arg === '--branch' || arg === '-b') {
      options.branch = args[++i];
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--skip-changed') {
      options.skipChanged = true;
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
        return 'Remove unrecognized properties. Use `cxtms schema <type>` to see allowed properties.';
      }
      return 'Review the schema requirements for this property';

    case 'yaml_syntax_error':
      return 'Check YAML indentation and syntax. Use a YAML linter to identify issues.';

    case 'invalid_task_type':
      return `Use 'cxtms list --type workflow' to see available task types`;

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
    console.log(`cxtms v${VERSION}`);
    process.exit(0);
  }

  // Handle login command (no schemas needed)
  if (command === 'login') {
    if (!files[0]) {
      console.error(chalk.red('Error: URL required'));
      console.error(chalk.gray(`Usage: ${PROGRAM_NAME} login <url>`));
      process.exit(2);
    }
    await runLogin(files[0]);
    process.exit(0);
  }

  // Handle logout command (no schemas needed)
  if (command === 'logout') {
    await runLogout(files[0]);
    process.exit(0);
  }

  // Handle pat command (no schemas needed)
  if (command === 'pat') {
    const sub = files[0];
    if (sub === 'create') {
      if (!files[1]) {
        console.error(chalk.red('Error: Token name required'));
        console.error(chalk.gray(`Usage: ${PROGRAM_NAME} pat create <name>`));
        process.exit(2);
      }
      await runPatCreate(files[1]);
    } else if (sub === 'list' || !sub) {
      await runPatList();
    } else if (sub === 'revoke') {
      if (!files[1]) {
        console.error(chalk.red('Error: Token ID required'));
        console.error(chalk.gray(`Usage: ${PROGRAM_NAME} pat revoke <tokenId>`));
        process.exit(2);
      }
      await runPatRevoke(files[1]);
    } else if (sub === 'setup') {
      await runPatSetup();
    } else {
      console.error(chalk.red(`Unknown pat subcommand: ${sub}`));
      console.error(chalk.gray(`Usage: ${PROGRAM_NAME} pat <create|list|revoke|setup>`));
      process.exit(2);
    }
    process.exit(0);
  }

  // Handle orgs command (no schemas needed)
  if (command === 'orgs') {
    const sub = files[0];
    if (sub === 'list' || !sub) {
      await runOrgsList();
    } else if (sub === 'use') {
      await runOrgsUse(files[1]);
    } else if (sub === 'select') {
      await runOrgsSelect();
    } else {
      console.error(chalk.red(`Unknown orgs subcommand: ${sub}`));
      console.error(chalk.gray(`Usage: ${PROGRAM_NAME} orgs <list|use|select>`));
      process.exit(2);
    }
    process.exit(0);
  }

  // Handle appmodule command (no schemas needed)
  if (command === 'appmodule') {
    const sub = files[0];
    if (sub === 'deploy') {
      await runAppModuleDeploy(files[1], options.orgId);
    } else if (sub === 'undeploy') {
      await runAppModuleUndeploy(files[1], options.orgId);
    } else {
      console.error(chalk.red(`Unknown appmodule subcommand: ${sub || '(none)'}`));
      console.error(chalk.gray(`Usage: ${PROGRAM_NAME} appmodule <deploy|undeploy> ...`));
      process.exit(2);
    }
    process.exit(0);
  }

  // Handle workflow command (no schemas needed)
  if (command === 'workflow') {
    const sub = files[0];
    if (sub === 'deploy') {
      await runWorkflowDeploy(files[1], options.orgId);
    } else if (sub === 'undeploy') {
      await runWorkflowUndeploy(files[1], options.orgId);
    } else if (sub === 'execute') {
      await runWorkflowExecute(files[1], options.orgId, options.vars);
    } else if (sub === 'logs') {
      await runWorkflowLogs(files[1], options.orgId, options.from, options.to);
    } else if (sub === 'log') {
      await runWorkflowLog(files[1], options.orgId, options.output, options.console, options.format === 'json');
    } else {
      console.error(chalk.red(`Unknown workflow subcommand: ${sub || '(none)'}`));
      console.error(chalk.gray(`Usage: ${PROGRAM_NAME} workflow <deploy|undeploy|execute|logs|log> ...`));
      process.exit(2);
    }
    process.exit(0);
  }

  // Handle publish command (no schemas needed)
  if (command === 'publish') {
    await runPublish(files[0] || options.feature, options.orgId);
    process.exit(0);
  }

  // Handle app command (no schemas needed)
  if (command === 'app') {
    const sub = files[0];
    if (sub === 'install' || sub === 'upgrade') {
      await runAppInstall(options.orgId, options.branch, options.force, options.skipChanged);
    } else if (sub === 'publish') {
      await runAppPublish(options.orgId, options.message, options.branch, options.force, files.slice(1));
    } else if (sub === 'list' || !sub) {
      await runAppList(options.orgId);
    } else {
      console.error(chalk.red(`Unknown app subcommand: ${sub}`));
      console.error(chalk.gray(`Usage: ${PROGRAM_NAME} app <install|upgrade|publish|list>`));
      process.exit(2);
    }
    process.exit(0);
  }

  // Handle query command (no schemas needed)
  if (command === 'query') {
    await runQuery(files[0], options.vars);
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
