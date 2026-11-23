# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.2] - 2026-11-23

### Added

- Support the project (Gear › About): a small card that opens, only when you click it, a dialog with the Pix QR code (made by the app itself, no internet needed) and a "Copy Pix code" button. In English the card only appears once GitHub Sponsors is set up. Donating is entirely optional and unlocks nothing new in the app. HubSquare is and will stay free.

### Fixed

- Explore: the page bar stays on screen while the next page loads, so you can jump again (the slower page is cancelled), and "Go" with an empty box no longer sends you back to page 1.
- Saving the app's files waits a moment and tries again when Windows briefly locks the file (for example, while the antivirus checks it). This could make deleting a background image fail with an error.
- Two saves of the same file at the same time (such as the installations list) no longer fail, and syncing installations with your servers no longer runs twice at once.
- When a friend's app can't reach the invite server, `erros.log` now says which address, at which step and how long it took (never the invite token).

## [1.5.1] - 2026-11-22

### Fixed

- The first-run server wizard header showed the old icon and "Welcome to ServSquare"; it now shows the new HubSquare logo and "Welcome to HubSquare".

## [1.5.0] - 2026-11-22

### Added

- New HubSquare logo (the chunk cube) in the sidebar, welcome screen, About, icons and installer. Inside the app it can be hidden from the sidebar and can follow the colors of each of the 12 backgrounds (Appearance › Theme › Logo), always with readable contrast.
- Showcase mode on Play and Dashboard ("Hide panel"): only the animated background, the sidebar (which you can still collapse) and a glass block with the name, the main button and the eye that brings the panel back. Esc also leaves it.
- Automatic updates: the app downloads a new version from the project's GitHub releases in the background and shows "Version X ready" inside the app, with **Restart and update**, **When I close**, **See what's new** and **Skip this version**. It never installs while a server is running, a backup is being made, a modpack is installing or PLAY is getting the game ready; it waits, says why, and installs right after. Turn it off under Options › General › Updates.
- Release workflow: each `vX.Y.Z` tag builds the installer on GitHub Actions and creates a draft release with the installer, `latest.yml`, `.blockmap` and `SHA256SUMS.txt`, with the notes taken from this changelog. SignPath signing is prepared but off (`docs/assinatura.md`).
- Report a problem (Gear › About, the tray menu or "See details" on an error): opens your email app or a new GitHub issue already filled in, with the error report ready to attach. Nothing is sent by the app.

### Changed

- About no longer mentions CurseForge.
- CurseForge now uses HubSquare's official API key, added only when the release is built; until it exists, CurseForge shows as "coming soon" and the screen to paste your own key is gone.
- Errors that the app used to ignore silently are now written to `erros.log` with where they happened and what was being done.

- The app is now called HubSquare everywhere: app ID `com.hubsquare.app`, data in `%APPDATA%\HubSquare`, servers, backups and installations in `Documents\HubSquare`, and the app's own files named `hubsquare*` (ServSquare and PlaySquare stay as the names of the two areas).
- License changed from MIT to GPL-3.0-or-later; the HubSquare name and logo are not covered by it.

### Added

- Upgrade from 1.4.0: on first launch the old `ServSquare` folders are moved to the new names, saved paths are rewritten (indexes, server and installation folders, backups and the launcher profiles' `gameDir`). If a move fails, nothing is deleted, the app keeps the old folders for that session, shows a notice and tries again next time.
- The installer removes the old 1.4.0 entry (programs list and shortcuts) without touching your data, and suggests the same install folder.

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
