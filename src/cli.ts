#!/usr/bin/env node

/**
 * CX Schema Validator CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ModuleValidator } from './validator';

interface CLIOptions {
  help: boolean;
  version: boolean;
  schemasPath?: string;
  json: boolean;
}

function parseArgs(args: string[]): { files: string[]; options: CLIOptions } {
  const files: string[] = [];
  const options: CLIOptions = {
    help: false,
    version: false,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg === '--schemas') {
      options.schemasPath = args[++i];
    } else if (arg === '--json') {
      options.json = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  return { files, options };
}

function printHelp(): void {
  console.log(`
${chalk.bold('CX Schema Validator')}

${chalk.bold('USAGE:')}
  npx cx-validate [OPTIONS] <file>

${chalk.bold('OPTIONS:')}
  -h, --help              Show this help message
  -v, --version           Show version number
  --schemas <path>        Path to schemas directory (default: .cx-schema or node_modules)
  --json                  Output results in JSON format

${chalk.bold('EXAMPLES:')}
  npx cx-validate modules/countries-module.yaml
  npx cx-validate --schemas ./custom-schemas modules/test-module.yaml
  npx cx-validate --json modules/test-module.yaml > result.json
`);
}

function printVersion(): void {
  const packageJson = require('../package.json');
  console.log(`v${packageJson.version}`);
}

function findSchemasPath(): string | undefined {
  // Check for .cx-schema in current directory
  const localSchemas = path.join(process.cwd(), '.cx-schema');
  if (fs.existsSync(localSchemas)) {
    return localSchemas;
  }

  // Check for schemas in node_modules
  const nodeModulesSchemas = path.join(
    process.cwd(),
    'node_modules',
    'cx-schema-validator',
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

function formatError(error: any, index: number): string {
  const lines: string[] = [];
  lines.push(chalk.red(`\n[${index + 1}] ${error.type.toUpperCase()}`));
  lines.push(chalk.gray(`  Path: ${error.path}`));
  lines.push(`  ${error.message}`);

  if (error.schemaPath) {
    lines.push(chalk.gray(`  Schema: ${error.schemaPath}`));
  }

  if (error.example !== undefined) {
    lines.push(chalk.gray(`  Example: ${JSON.stringify(error.example)}`));
  }

  return lines.join('\n');
}

function formatWarning(warning: any, index: number): string {
  const lines: string[] = [];
  lines.push(chalk.yellow(`\n[${index + 1}] ${warning.type.toUpperCase()}`));
  lines.push(chalk.gray(`  Path: ${warning.path}`));
  lines.push(`  ${warning.message}`);
  return lines.join('\n');
}

function printResult(result: any): void {
  const { summary, errors, warnings } = result;

  console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════'));
  console.log(chalk.bold('  CX SCHEMA VALIDATION REPORT'));
  console.log(chalk.bold('═══════════════════════════════════════════════════════\n'));

  console.log(chalk.bold('File:'), summary.file);
  console.log(chalk.bold('Time:'), summary.timestamp);
  console.log(
    chalk.bold('Status:'),
    summary.status === 'PASSED'
      ? chalk.green('✓ PASSED')
      : chalk.red('✗ FAILED')
  );
  console.log(chalk.bold('Errors:'), summary.errorCount);
  console.log(chalk.bold('Warnings:'), summary.warningCount);

  if (summary.errorCount > 0) {
    console.log('\n' + chalk.bold('Errors by Type:'));
    for (const [type, count] of Object.entries(summary.errorsByType)) {
      console.log(`  ${type}: ${count}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n' + chalk.bold.red('ERRORS:'));
    errors.forEach((error: any, index: number) => {
      console.log(formatError(error, index));
    });
  }

  if (warnings.length > 0) {
    console.log('\n' + chalk.bold.yellow('WARNINGS:'));
    warnings.forEach((warning: any, index: number) => {
      console.log(formatWarning(warning, index));
    });
  }

  console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════\n'));
}

async function main() {
  const args = process.argv.slice(2);
  const { files, options } = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    printVersion();
    process.exit(0);
  }

  if (files.length === 0) {
    console.error(chalk.red('Error: No input file specified'));
    console.error('Use --help for usage information');
    process.exit(1);
  }

  // Find schemas path
  const schemasPath = options.schemasPath || findSchemasPath();
  if (!schemasPath) {
    console.error(
      chalk.red(
        'Error: Could not find schemas directory. Please run npm install first.'
      )
    );
    process.exit(1);
  }

  // Validate each file
  let hasErrors = false;
  for (const file of files) {
    try {
      const validator = new ModuleValidator({ schemasPath });
      const result = await validator.validateModule(file);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printResult(result);
      }

      if (!result.isValid) {
        hasErrors = true;
      }
    } catch (error: any) {
      console.error(chalk.red(`Error validating ${file}:`), error.message);
      hasErrors = true;
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});
