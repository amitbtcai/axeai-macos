# AxeAI Third-Party Notices

AxeAI Desktop is based on the open-source `get-bb/bb` project and includes
software made available under the MIT License. The upstream copyright and MIT
license text are preserved in the `LICENSE.txt` file distributed with AxeAI.

Copyright (c) 2026 Michael Yong

AxeAI also includes third-party packages under their respective licenses. The
complete dependency inventory for a release can be generated from the locked
source tree with:

```sh
pnpm licenses list --prod --json
```

## Anthropic Claude Agent SDK and Claude Code

The bundled `@anthropic-ai/claude-agent-sdk` package and its platform binaries
are copyright Anthropic PBC, all rights reserved, and are subject to
Anthropic's legal agreements:

https://code.claude.com/docs/en/legal-and-compliance

Users must authenticate with and use their own eligible Anthropic account.
AxeAI does not sell, sublicense, or intermediate Anthropic usage. Anthropic,
Claude, and Claude Code are trademarks or products of Anthropic PBC. Their
presence does not imply endorsement of AxeAI.

## Other services

AxeAI can connect to independent model providers, plugins, developer tools,
and hosted services. Those services and their names, marks, data practices,
and terms belong to their respective owners. Users are responsible for their
own accounts, credentials, usage charges, and compliance with provider terms.

This notice is informational and is not legal advice. Before a public paid
release, the distributor should have counsel review the exact packaged
dependency inventory and all third-party service terms.
