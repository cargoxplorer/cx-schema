# Browser Automation

## Browser/Run@1

Automates a web portal through a configured remote Chromium provider. Always restrict navigation with `allowedDomains`; use `$` inputs or `fromConfig` variables for credentials and mark credential fills `sensitive: true`.

```yaml
- task: Browser/Run@1
  name: Portal
  inputs:
    allowedDomains: [portal.example.com]
    actions:
      - { do: goto, url: "https://portal.example.com" }
      - { do: extractText, target: "css=.status", as: status }
```

Inputs: required `actions`; optional `allowedDomains`, `provider`, `session` (`reuse` or `new`), `timeout`, and `proxy` (`true` routes through the provider's proxy; Browserbase only). Actions support deterministic navigation/input/extraction, screenshots, upload/download, plus `llm/act`. Locator targets require a `css=`, `xpath=`, `text=`, `label=`, `placeholder=`, or `role=` prefix. Captures use `as`; the task also returns final `url` and an action audit list.

### Browser providers

The browser comes from the organization first, then the server:

| `provider` input | Uses |
|---|---|
| omitted | Organization config `tms.browser.default` if it has an `apiKey`, else the server's providers by priority |
| `X` | Organization config `tms.browser.X` if it has an `apiKey`, else the server provider named `X`; otherwise the step fails |

An organization config is a Browserbase account and never falls back to the server's browsers:

```yaml
# Organization config "tms.browser.default" (Browser Automation screen in cx-app-core)
type: browserbase                 # the only type allowed in organization config
apiKey: "${secret:org/<organizationId>/tms.browser.default.apiKey}"
projectId: "<optional>"
region: "<optional>"
```

Self-hosted (`browserHost`) and raw CDP browsers are configured on the server only. Leave `provider` out unless the organization keeps several named profiles.
