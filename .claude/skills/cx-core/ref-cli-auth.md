# CX Server Authentication & Management

## Contents
- Authentication (OAuth2 login/logout)
- PAT Tokens (CI/CD alternative to OAuth)
- Organization Management
- Session Resolution
- Publish (push modules and workflows to server)

## Authentication

```bash
# Login to a CX environment (OAuth2 + PKCE — opens browser)
npx cxtms login https://tms-v3-dev.usatrt.com

# Logout from current session
npx cxtms logout
```

The session is stored at `~/.cxtms/<project-dir>/.session.json`, scoped by project directory name. Each project gets its own server session. The CLI auto-refreshes expired tokens.

## PAT Tokens (alternative to OAuth)

For CI/CD or headless environments, use Personal Access Tokens instead of interactive OAuth:

```bash
# Check PAT status and setup instructions
npx cxtms pat setup

# Create a new PAT token (requires OAuth login first)
npx cxtms pat create "my-ci-token"

# List active PAT tokens
npx cxtms pat list

# Revoke a PAT token
npx cxtms pat revoke <tokenId>
```

After creating a PAT, add to `.env` in your project root:
```
CXTMS_AUTH=pat_xxxxx...
CXTMS_SERVER=https://tms-v3-dev.usatrt.com
```

When `CXTMS_AUTH` is set, the CLI skips OAuth and uses the PAT token directly. `CXTMS_SERVER` provides the server URL (or set `server` in `app.yaml`).

## Organization Management

```bash
# List organizations on the server
npx cxtms orgs list

# Select an organization interactively
npx cxtms orgs select

# Set active organization by ID
npx cxtms orgs use <orgId>

# Show current context (server, org, app)
npx cxtms orgs use
```

The active org is cached in the session file and used by all server commands. **Always pass `--org <id>` on deploy/undeploy/publish/execute/logs commands** to avoid the interactive org picker blocking automation.

## Session Resolution

Server commands resolve the target session in this order:
1. `CXTMS_AUTH` env var → PAT token auth (with `CXTMS_SERVER` or `app.yaml` server field)
2. `~/.cxtms/<project-dir>/.session.json` → project-scoped OAuth session
3. Not logged in → error

## Publish

```bash
# Publish all modules and workflows from current project
npx cxtms publish

# Publish only a specific feature directory
npx cxtms publish --feature billing
npx cxtms publish billing

# Publish with explicit org ID
npx cxtms publish --org 42
```

Validates all YAML files first, then pushes modules and workflows to the server. Skips files with validation errors and reports results.

## App Manifest Management

Server-side app manifest operations — install from git, publish changes to git, and list installed apps.

```bash
# Install/refresh app from its git repository into the CX server
npx cxtms app install

# Force reinstall even if same version is already installed
npx cxtms app install --force

# Install from a specific branch
npx cxtms app install --branch develop

# Install but skip modules that have unpublished local changes
npx cxtms app install --skip-changed

# Publish server changes to git (creates a PR)
npx cxtms app publish

# Publish with a custom commit message
npx cxtms app publish --message "Add new shipping module"

# Force publish all modules and workflows (not just changed ones)
npx cxtms app publish --force

# List installed app manifests on the server
npx cxtms app list
```

**`app install`** reads `repository` and `branch` from `app.yaml`, downloads the repo on the server side, and installs/updates all modules and workflows. Use `--force` to reinstall even if the version hasn't changed. Use `--skip-changed` to preserve modules with unpublished changes.

**`app publish`** takes the current server state and publishes it to git by creating a PR. The server increments the version, creates a publish branch, commits all module/workflow YAML files, and opens a pull request to the target branch.

**`app list`** shows all installed app manifests with their version, status flags (disabled, unpublished changes, update available), and repository info.
