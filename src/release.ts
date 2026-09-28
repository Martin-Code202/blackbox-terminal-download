/**
 * Which installer to offer, and where it is. Installers are GitHub release assets of this repo,
 * built by the app's release workflow with fixed names, so a link to "latest" always works even
 * when the GitHub API can't be reached.
 */

export const REPO = 'Martin-Code202/blackbox-terminal-download'
const LATEST = `https://github.com/${REPO}/releases/latest/download/`
export const RELEASES_URL = `https://github.com/${REPO}/releases`

export type Os = 'mac' | 'windows' | 'linux'

export interface Build {
  id: string
  os: Os
  /** What the button says, e.g. "Apple silicon". */
  label: string
  /** Smaller print, e.g. "M1 and later". */
  detail: string
  file: string
}

export const BUILDS: Build[] = [
  { id: 'mac-arm64', os: 'mac', label: 'Apple silicon', detail: 'M1 and later, .dmg', file: 'Blackbox-mac-arm64.dmg' },
  { id: 'mac-x64', os: 'mac', label: 'Intel', detail: 'Older Macs, .dmg', file: 'Blackbox-mac-x64.dmg' },
  { id: 'win-x64', os: 'windows', label: 'Windows x64', detail: 'Installer, .exe', file: 'Blackbox-windows-x64-setup.exe' },
  { id: 'win-arm64', os: 'windows', label: 'Windows on Arm', detail: 'Installer, .exe', file: 'Blackbox-windows-arm64-setup.exe' },
  { id: 'appimage-x64', os: 'linux', label: 'AppImage', detail: 'x86_64, any distribution', file: 'Blackbox-linux-x86_64.AppImage' },
  { id: 'deb-x64', os: 'linux', label: 'Debian, Ubuntu', detail: 'x86_64, .deb', file: 'Blackbox-linux-amd64.deb' },
  { id: 'rpm-x64', os: 'linux', label: 'Fedora, RHEL, openSUSE', detail: 'x86_64, .rpm', file: 'Blackbox-linux-x86_64.rpm' },
  { id: 'appimage-arm64', os: 'linux', label: 'AppImage', detail: 'arm64, any distribution', file: 'Blackbox-linux-arm64.AppImage' },
  { id: 'deb-arm64', os: 'linux', label: 'Debian, Ubuntu', detail: 'arm64, .deb', file: 'Blackbox-linux-arm64.deb' },
  { id: 'rpm-arm64', os: 'linux', label: 'Fedora, RHEL, openSUSE', detail: 'arm64, .rpm', file: 'Blackbox-linux-aarch64.rpm' }
]

export const OS_NAMES: Record<Os, string> = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }

export interface Visitor {
  /** Undefined on phones, tablets and anything else Blackbox doesn't run on. */
  os?: Os
  /** The build to put on the main button. */
  best?: Build
}

/** Best guess from the browser. Architecture is only known where the browser says (Chromium). */
export async function detect(): Promise<Visitor> {
  const ua = navigator.userAgent
  const uaData = (navigator as Navigator & { userAgentData?: { platform: string; mobile: boolean; getHighEntropyValues(h: string[]): Promise<{ architecture?: string }> } }).userAgentData
  if (uaData?.mobile || /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return {}

  const platform = uaData?.platform ?? navigator.platform ?? ''
  let os: Os | undefined
  if (/mac/i.test(platform) || /Mac OS X/.test(ua)) os = 'mac'
  else if (/win/i.test(platform) || /Windows/.test(ua)) os = 'windows'
  else if (/linux|x11|cros/i.test(platform) || /Linux|X11|CrOS/.test(ua)) os = 'linux'
  if (!os) return {}

  let arm = /aarch64|arm64|armv8/i.test(ua)
  try {
    const hints = await uaData?.getHighEntropyValues(['architecture'])
    if (hints?.architecture) arm = hints.architecture === 'arm'
  } catch {
    // no hints; keep the guess
  }
  // Safari and Firefox on a Mac don't say; nearly every Mac sold since 2021 is Apple silicon.
  // A package installs into the app menu and dock like any other app; the AppImage is the fallback
  // when the browser doesn't name the distribution (Firefox on Ubuntu and Fedora does).
  const linux = /Ubuntu|Debian|Mint|Pop!_OS/i.test(ua) ? 'deb' : /Fedora|Red Hat|openSUSE|SUSE/i.test(ua) ? 'rpm' : 'appimage'
  const id = os === 'mac' ? (uaData && !arm ? 'mac-x64' : 'mac-arm64') : os === 'windows' ? (arm ? 'win-arm64' : 'win-x64') : `${linux}-${arm ? 'arm64' : 'x64'}`
  return { os, best: BUILDS.find((b) => b.id === id) }
}

export interface Release {
  version: string
  date: Date
  /** Size in bytes by file name, for the files this release has. */
  sizes: Map<string, number>
  urls: Map<string, string>
}

/**
 * 'none': the repo has no published release yet. 'unknown': GitHub couldn't be asked (offline,
 * rate limited); the fixed "latest" links are shown anyway.
 */
export type ReleaseState = { status: 'loading' } | { status: 'ready'; release: Release } | { status: 'none' } | { status: 'unknown' }

export async function latestRelease(): Promise<ReleaseState> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: 'application/vnd.github+json' } })
    if (res.status === 404) return { status: 'none' }
    if (!res.ok) return { status: 'unknown' }
    const body = (await res.json()) as { tag_name: string; published_at: string; assets: { name: string; size: number; browser_download_url: string }[] }
    return {
      status: 'ready',
      release: {
        version: body.tag_name.replace(/^v/, ''),
        date: new Date(body.published_at),
        sizes: new Map(body.assets.map((a) => [a.name, a.size])),
        urls: new Map(body.assets.map((a) => [a.name, a.browser_download_url]))
      }
    }
  } catch {
    return { status: 'unknown' }
  }
}

export const downloadUrl = (build: Build, state: ReleaseState) => (state.status === 'ready' && state.release.urls.get(build.file)) || LATEST + build.file

/** False when we know the latest release doesn't include this file (a build that failed). */
export const isAvailable = (build: Build, state: ReleaseState) => state.status !== 'none' && (state.status !== 'ready' || state.release.sizes.has(build.file))

export const formatSize = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`

export const formatDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
