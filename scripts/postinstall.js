#!/usr/bin/env node

/**
 * Postinstall script to create .cx-schema folder in the project root
 */

const fs = require('fs');
const path = require('path');

function findProjectRoot() {
  let currentDir = process.cwd();

  // Walk up the directory tree to find package.json
  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      // Check if this is not the cx-schema-validator package itself
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.name !== 'cx-schema-validator') {
          return currentDir;
        }
      } catch (error) {
        // Continue searching
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

function copyDirectory(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read directory contents
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createValidationScript(projectRoot) {
  const scriptContent = `#!/usr/bin/env node

/**
 * Local validation script
 * This script uses the schemas in .cx-schema to validate modules
 */

const { ModuleValidator } = require('cx-schema-validator');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node .cx-schema/validate.js <module-file>');
    process.exit(1);
  }

  const schemasPath = path.join(__dirname);
  const validator = new ModuleValidator({ schemasPath });

  for (const file of args) {
    const result = await validator.validateModule(file);

    console.log(\`\\nValidation result for \${file}:\`);
    console.log(\`  Status: \${result.summary.status}\`);
    console.log(\`  Errors: \${result.summary.errorCount}\`);
    console.log(\`  Warnings: \${result.summary.warningCount}\`);

    if (!result.isValid) {
      console.log('\\nErrors:');
      result.errors.forEach((error, index) => {
        console.log(\`  [\${index + 1}] \${error.type}: \${error.message}\`);
        console.log(\`      Path: \${error.path}\`);
      });
      process.exit(1);
    }
  }

  console.log('\\nAll validations passed!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
`;

  const scriptPath = path.join(projectRoot, '.cx-schema', 'validate.js');
  fs.writeFileSync(scriptPath, scriptContent, 'utf-8');

  // Make it executable on Unix-like systems
  try {
    fs.chmodSync(scriptPath, '755');
  } catch (error) {
    // Ignore chmod errors on Windows
  }
}

function main() {
  console.log('CX Schema Validator: Running postinstall...');

  // Find project root
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    console.log('Warning: Could not find project root. Skipping .cx-schema creation.');
    return;
  }

  console.log(`Project root: ${projectRoot}`);

  // Create .cx-schema directory
  const cxSchemaDir = path.join(projectRoot, '.cx-schema');

  if (fs.existsSync(cxSchemaDir)) {
    console.log('.cx-schema directory already exists. Updating schemas...');
  } else {
    console.log('Creating .cx-schema directory...');
    fs.mkdirSync(cxSchemaDir, { recursive: true });
  }

  // Copy schemas
  const schemasSource = path.join(__dirname, '..', 'schemas');
  console.log(`Copying schemas from ${schemasSource}...`);

  try {
    copyDirectory(schemasSource, cxSchemaDir);
    console.log('Schemas copied successfully!');
  } catch (error) {
    console.error('Error copying schemas:', error.message);
    process.exit(1);
  }

  // Create validation script
  console.log('Creating validation script...');
  createValidationScript(projectRoot);

  console.log('✓ CX Schema Validator installed successfully!');
  console.log('\nUsage:');
  console.log('  npx cx-validate modules/your-module.yaml');
  console.log('  node .cx-schema/validate.js modules/your-module.yaml');
}

// Only run if this is not being installed as a dependency of cx-schema-validator itself
if (!process.env.npm_package_name || process.env.npm_package_name !== 'cx-schema-validator') {
  main();
}
