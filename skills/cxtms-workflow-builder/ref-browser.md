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

Inputs: required `actions`; optional `allowedDomains`, `provider`, `session` (`reuse` or `new`), and `timeout`. Actions support deterministic navigation/input/extraction, screenshots, upload/download, plus `llm/act`. Locator targets require a `css=`, `xpath=`, `text=`, `label=`, `placeholder=`, or `role=` prefix. Captures use `as`; the task also returns final `url` and an action audit list.
