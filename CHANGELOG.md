# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-11-15

### Added

- The whole app in **English (US)** as well as Brazilian Portuguese: language choice in the installer and on first launch, and a switch under the gear › Idioma / Language that applies right away, without restarting.
- Bilingual installer (NSIS) with the license.
- Gear › About: version, license, links and the Mojang disclaimer.
- Numbers, dates and file sizes in each language's format.
- Lint check for hard-coded UI text and a test that both languages have the same keys and variables.
- Repository files for open source review: English README, privacy policy, security policy, third-party notices, code signing policy, contributing guide, architecture overview, CI workflow, issue and PR templates, SHA-256 checksums for releases.

### Changed

- Item, block and effect names (inventory and commands) follow the app language, from the game's own `en_us.json` or the official `pt_br.json`.

## [1.3.0] - 2026-11-14

### Added

- Seven new animated biome backgrounds and their particles.
- Pages (12/24/48/96 per page) in Browse, Installed/Content and the modpack search.
- Wider layouts for large windows.

## [1.2.0] - 2026-11-13

### Added

- Error report (`.zip` on the Desktop, secrets removed).
- Tabs to switch between ServSquare and PlaySquare, and visual polish.

## [1.1.0] - 2026-11-13

### Added

- Friend mode (PlaySquare only), connection diagnosis, join requests through invites, handing a server over to a friend (`.hubserver`).

## [1.0.0] - 2026-11-12

### Added

- First public version: ServSquare (servers with Paper, Vanilla, Fabric, Forge and NeoForge; mods, plugins and modpacks from Modrinth, CurseForge and Hangar; backups; automation; connection through playit.gg, Radmin VPN and local network; phone dashboard) and PlaySquare (installations, invites, player content, Play screen).

[Unreleased]: https://github.com/lipeventura777/hubsquare/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/lipeventura777/hubsquare/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/lipeventura777/hubsquare/releases/tag/v1.3.0
[1.2.0]: https://github.com/lipeventura777/hubsquare/releases/tag/v1.2.0
[1.1.0]: https://github.com/lipeventura777/hubsquare/releases/tag/v1.1.0
[1.0.0]: https://github.com/lipeventura777/hubsquare/releases/tag/v1.0.0
