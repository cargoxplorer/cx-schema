#!/usr/bin/env node

/**
 * VS Code integration setup script
 * Creates .vscode/settings.json with YAML schema associations
 */

const fs = require('fs');
const path = require('path');

function setupVSCode(projectRoot) {
  const vscodeDir = path.join(projectRoot, '.vscode');
  const settingsPath = path.join(vscodeDir, 'settings.json');

  // Create .vscode directory if it doesn't exist
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
    console.log('Created .vscode directory');
  }

  // Read existing settings or create new
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(content);
      console.log('Loaded existing VS Code settings');
    } catch (error) {
      console.warn('Could not parse existing settings.json, creating new one');
    }
  }

  // Add or update YAML schema associations
  if (!settings['yaml.schemas']) {
    settings['yaml.schemas'] = {};
  }

  // Add schema mapping for module files
  const schemaPath = path.join(projectRoot, '.cx-schema', 'schemas.json');
  settings['yaml.schemas'][schemaPath] = [
    'modules/*-module.yaml',
    'modules/**/*-module.yaml'
  ];

  // Write updated settings
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  console.log('Updated .vscode/settings.json with schema associations');

  return true;
}

function main() {
  const projectRoot = process.cwd();

  console.log('Setting up VS Code integration...');
  console.log(`Project root: ${projectRoot}`);

  if (!fs.existsSync(path.join(projectRoot, '.cx-schema'))) {
    console.error('Error: .cx-schema directory not found.');
    console.error('Please run npm install first to create the schema directory.');
    process.exit(1);
  }

  try {
    setupVSCode(projectRoot);
    console.log('\n✓ VS Code integration setup complete!');
    console.log('\nYour YAML module files will now have schema validation and autocomplete in VS Code.');
    console.log('Restart VS Code for changes to take effect.');
  } catch (error) {
    console.error('Error setting up VS Code integration:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { setupVSCode };
