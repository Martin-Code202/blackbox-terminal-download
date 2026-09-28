# Blackbox downloads

This repo holds two things for [Blackbox](https://blackbox-terminal-download.vercel.app), a fast
terminal for local shells and SSH:

- **Releases.** Installers for macOS, Windows and Linux are published to
  [Releases](https://github.com/Martin-Code202/blackbox-terminal-download/releases) by the app's
  release workflow (the app's source is in a private repo). File names are fixed, so
  `releases/latest/download/<name>` always points at the newest build:

  | System | Files |
  | --- | --- |
  | macOS | `Blackbox-mac-arm64.dmg`, `Blackbox-mac-x64.dmg` |
  | Windows | `Blackbox-windows-x64-setup.exe`, `Blackbox-windows-arm64-setup.exe` |
  | Linux | `Blackbox-linux-x86_64.AppImage`, `Blackbox-linux-amd64.deb`, `Blackbox-linux-x86_64.rpm`, and the arm64 builds: `Blackbox-linux-arm64.AppImage`, `Blackbox-linux-arm64.deb`, `Blackbox-linux-aarch64.rpm` |

- **The website** (this directory): the landing page with downloads, and `/signup`, which creates
  an account in the browser. Vite + React, deployed on Vercel.

## The website

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
```

`VITE_API_URL` points sign-up at another API (default: the production server). The API only
accepts browser calls from origins in its `WEB_ORIGINS` setting.

Sign-up is end-to-end encrypted like the app: `src/account.ts` makes the account's keys in the
browser with libsodium (Argon2id, X25519, Ed25519, XChaCha20-Poly1305) and sends the server only
public keys, sealed private keys and a derived auth key. It is a copy of the registration code in
the app, and the formats must match it exactly. The page signs its session out when it finishes,
so the desktop app becomes the account's first device.

Screenshots in `public/screens/` are real, taken from the app with demo data, in light and dark.
