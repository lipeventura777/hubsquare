# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

> Status: HubSquare has **not** been accepted by SignPath Foundation yet. Until it is, releases are not code-signed. This page describes the policy the project follows once signing is in place.

## License

HubSquare is open source under the [GNU General Public License v3.0 or later](LICENSE) (`GPL-3.0-or-later`, an OSI-approved license). The HubSquare name and logo are not covered by the license.

## What gets signed

Only the Windows installer (`HubSquare-Setup-<version>.exe`) and the app executable built **from this repository's source** by the project's own build (`npm run dist`, the same steps as the [CI workflow](.github/workflows/ci.yml)). Nothing built elsewhere and no third-party binaries are signed. Product name is always `HubSquare` and the product version is the one in `package.json` for that release.

## Team roles

| Role | Members |
|---|---|
| Committers and reviewers | [lipeventura777](https://github.com/lipeventura777) |
| Approvers | [lipeventura777](https://github.com/lipeventura777) |

- **Committers** may change the source without extra review.
- **Reviewers**: every change from anyone who is not a committer (for example a pull request) is reviewed by a committer before it is merged.
- **Approvers**: every signing request is approved by hand, for each release.

All team members use multi-factor authentication on GitHub and SignPath.

## Privacy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. The details, including the official services the app talks to when you use a feature, are in the [privacy policy](PRIVACY.md).

## Install and uninstall

The installer only installs the app for the current user, registers the `hubsquare://` link and the `.hubsquare` file type, and creates the shortcuts you see during setup. It can be removed from Windows Settings › Apps (the uninstaller does not delete your servers and worlds in `Documents\HubSquare`).
