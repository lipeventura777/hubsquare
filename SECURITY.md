# Security Policy

## Supported versions

Only the latest release on the [Releases](https://github.com/lipeventura777/hubsquare/releases/latest) page gets security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting instead: **Security › Report a vulnerability** on <https://github.com/lipeventura777/hubsquare/security/advisories/new>.

Include what you found, how to reproduce it and which version you used. You should get an answer within 7 days. Once a fix is released, the advisory is published with credit to you (unless you prefer not).

Things that are especially relevant: anything that lets someone on the network reach the invite server (port 8788) or the phone dashboard (port 8787) beyond what they're meant to do, path traversal in zip/modpack/.hubserver imports, downloads that skip hash checks, or secrets ending up in error reports.

## Dependency audit

`npm audit` is checked before every release. Known advisories without a fix:

Checked on 2026-11-15: **no high or critical** advisories. There are 12 moderate ones, all from the same issue: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (`minimatch`, denial of service through crafted glob patterns). `minimatch` only comes in through **development tools** (`electron-builder` and `typescript-eslint`), which only run on the developer's machine with the project's own patterns; it is not part of the installed app. The only fix npm offers is a major-version change of electron-builder (`npm audit fix --force`), which would break the build, so it waits for the upstream packages to update.

---

## Política de segurança (pt-BR)

Só a última versão em [Releases](https://github.com/lipeventura777/hubsquare/releases/latest) recebe correções. Para relatar uma falha, **não abra uma issue pública**: use **Security › Report a vulnerability** em <https://github.com/lipeventura777/hubsquare/security/advisories/new>, com o que achou, como reproduzir e a versão. A resposta vem em até 7 dias.
