# AxeAI Desktop Privacy Notice (Draft)

Last updated: August 23, 2026

This notice describes the current desktop build. The distributor must add its
legal identity, contact information, retention practices, and jurisdictional
disclosures before a public release.

## Local data

AxeAI runs a local server and stores application state, conversations,
settings, logs, and workspace metadata on the user's computer. Production data
is stored under `~/.axeai` by default. Workspaces and tools may read or modify
other files only with the permissions available to the app and user account.

## AI providers and connected services

When a user invokes an AI provider or connected service, AxeAI sends the
content required for that request to the provider selected by the user. That
provider processes the data under its own privacy policy and terms. Users
provide and control their own credentials. AxeAI does not bundle or resell
Anthropic usage.

## Analytics

Product analytics are disabled by default in the AxeAI build. AxeAI does not
ship with the upstream project's analytics key. If the distributor later adds
analytics, this notice and the in-app controls must be updated before the
change is released.

## Updates and network requests

The desktop app checks the AxeAI GitHub Releases feed for version information.
Plugins, provider APIs, linked servers, and web tools can make additional
network requests when configured or invoked by the user.

## Security and deletion

Users should protect provider keys and their operating-system account. Local
AxeAI data can be removed by quitting the app and deleting `~/.axeai`, subject
to any files or data separately created in user workspaces or third-party
services.
