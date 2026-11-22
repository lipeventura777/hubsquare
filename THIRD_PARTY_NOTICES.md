# Third-Party Notices

HubSquare itself is licensed under the [GNU General Public License v3.0 or later](LICENSE) (`GPL-3.0-or-later`); the HubSquare name and logo are not covered by it. It includes or is built with the following third-party components. Each keeps its own license and copyright.

## Bundled in the installed app

| Component | License | Copyright |
|---|---|---|
| [Electron](https://github.com/electron/electron) (includes Chromium and Node.js, with their own notices in `LICENSES.chromium.html` next to the app) | MIT | © Electron contributors, © GitHub Inc. |
| [React](https://github.com/facebook/react) and React DOM | MIT | © Meta Platforms, Inc. and affiliates |
| [marked](https://github.com/markedjs/marked) | MIT | © MarkedJS, © Christopher Jeffrey |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Apache-2.0 or MPL-2.0 (used under Apache-2.0) | © Cure53 and other contributors |
| [uqr](https://github.com/unjs/uqr) | MIT | © UnJS, © Project Nayuki (QR code generator) |
| [@electron-toolkit/utils](https://github.com/alex8088/electron-toolkit) | MIT | © alex8088 |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) (only the generated CSS) | MIT | © Tailwind Labs, Inc. |

## Fonts

| Font | License | Copyright |
|---|---|---|
| [Inter](https://github.com/rsms/inter) (`InterVariable.woff2`) | SIL Open Font License 1.1 | © 2016 The Inter Project Authors |
| [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) (`PixelifySans-latin.woff2`) | SIL Open Font License 1.1 | © 2021 The Pixelify Sans Project Authors |

The SIL Open Font License 1.1 is available at <https://openfontlicense.org>.

## Used only to build and test (not shipped)

TypeScript, Vite, electron-vite, electron-builder, ESLint, Prettier, Playwright and their dependencies, under their own licenses (mostly MIT, Apache-2.0 and ISC). The full list with versions is in `package-lock.json`.

## Downloaded at run time, never shipped

Minecraft server and client files, Java (Eclipse Temurin, GPLv2 with Classpath Exception), Paper, Fabric, Forge, NeoForge, the playit.gg agent, mods, plugins and modpacks are **not** part of HubSquare. The app downloads them, when you ask, from their official sources, under their own licenses and terms (including the [Minecraft EULA](https://www.minecraft.net/eula), which you accept yourself in the app).

Minecraft is a trademark of Mojang Synergies AB / Microsoft. NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
