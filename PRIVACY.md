# Privacy Policy

[Português (Brasil)](PRIVACY.pt-BR.md) · **English**

Last updated: 2026-11-21

HubSquare is a desktop app that runs on your PC. It has **no account of its own, no analytics, no telemetry and no ads**. HubSquare does not send personal data to its developer or to anyone else.

## What the app stores on your PC

Everything stays on your computer, in these folders:

- `%APPDATA%\HubSquare` — app settings (language, appearance, app mode, installations index), the downloaded Java, caches, logs (`logs\erros.log`), the phone dashboard settings (the PIN is stored only as a salted scrypt hash) and the downloaded update of the app (in `%LOCALAPPDATA%\hubsquare-updater`, until it is installed).
- `Documents\HubSquare` — your servers, worlds, backups and game installations.
- `.minecraft\launcher_profiles.json` — only a `hubsquare-<id>` profile, with a backup made first.

Uninstalling the app does not delete your servers or worlds. You can delete these folders yourself at any time.

## Services the app talks to

HubSquare only connects to the internet to do what you ask, and only to these official services. Each one has its own privacy policy.

| Service | What for |
|---|---|
| Mojang / Minecraft (`piston-meta.mojang.com`, `piston-data.mojang.com`, `resources.download.minecraft.net`, `api.mojang.com`, `sessionserver.mojang.com`, `textures.minecraft.net`) | game version list, official server, item icons and names, checking a player name, player skins |
| PaperMC (`fill.papermc.io`) and Hangar (`hangar.papermc.io`, `hangarcdn.papermc.io`) | Paper server builds and plugins |
| FabricMC (`meta.fabricmc.net`) | Fabric loader |
| MinecraftForge (`maven.minecraftforge.net`, `files.minecraftforge.net`) and NeoForged (`maven.neoforged.net`) | Forge and NeoForge loaders |
| Eclipse Adoptium (`api.adoptium.net`, `github.com`) | Java (Eclipse Temurin) |
| Modrinth (`api.modrinth.com`, `cdn.modrinth.com`) | searching and downloading mods, plugins, modpacks, packs |
| CurseForge (`api.curseforge.com`, `edge.forgecdn.net`, `mediafilez.forgecdn.net`, `media.forgecdn.net`) | only in builds that carry HubSquare's official API key (until then CurseForge shows as "coming soon") |
| playit.gg | only if you use the playit.gg tunnel (the app downloads the official agent; you sign in on their website) |
| GitHub (`api.github.com`, `github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com`, `raw.githubusercontent.com`, `gitlab.com`) | checking for a new HubSquare version (when the app opens and every 6 hours, if automatic updates are on) and downloading it from the project's releases (`latest.yml` and the installer, with the sha512 checked); modpack files hosted there. Nothing about you is sent: only the app's User-Agent |
| ipify (`api.ipify.org`) | only to find your public IP when you test or show the open-port connection |
| spark (`spark.lucko.me`, `spark-usercontent.lucko.me`) | only when you run a lag diagnosis: the spark plugin on your server uploads its report there and the app reads it back |

Every request identifies itself with the User-Agent `HubSquare/<version> (github.com/lipeventura777/hubsquare)`. No e-mail, name or other personal data is sent in it.

## Between you and your friends

- **Invites** and the **phone dashboard** only listen on your local network, Radmin VPN and Tailscale addresses (never on the open internet, unless you set up a playit.gg tunnel yourself). An invite shares your mod list and your connection addresses with whoever has the code.
- **Join requests** carry the friend's Minecraft name, UUID and an optional short message, stored only on the host's PC.
- **Error reports** are saved as a `.zip` on your Desktop. Passwords, tokens, PINs, keys and your Windows user name are removed before saving. The report has: a summary (READ-ME), the app's error log, the end of the server and game logs, the latest crash reports, system info (app and Windows version, memory, installed Javas), server and installation settings, the mod list (name, version and hash, never the files), the invite version and the last connection diagnosis. It never has worlds, mod files or keys.
- **Report a problem** (Gear › About, the tray menu or "See details" on an error) only opens your own email app (a `mailto:` link to suporte.hubsquare@gmail.com) or a new GitHub issue in your browser, both already filled in with your description, the app version, Windows and language. Nothing leaves your PC until **you** press send in your email app or submit the issue; the app never sends anything by itself and has no sending server. The `.zip` only goes if you attach it. Secrets and your Windows user name are also removed from the description before the link is opened.

## Children

HubSquare does not knowingly collect any data from anyone, including children.

## Contact

Questions or concerns: open an issue at <https://github.com/lipeventura777/hubsquare/issues>.

---

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
