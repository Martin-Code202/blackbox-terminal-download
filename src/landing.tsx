import { AppleLogo, ArrowsClockwise, DownloadSimple, Key, Lightning, LinuxLogo, Palette, Password, SquareSplitHorizontal, Stack, UsersThree, WindowsLogo, type Icon } from '@phosphor-icons/react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Footer, Nav, Shot, SIGNUP_URL, useReveal } from './chrome'
import { BUILDS, detect, downloadUrl, formatDate, formatSize, isAvailable, latestRelease, OS_NAMES, RELEASES_URL, type Build, type Os, type ReleaseState, type Visitor } from './release'
import './styles.css'

const OS_ICONS: Record<Os, Icon> = { mac: AppleLogo, windows: WindowsLogo, linux: LinuxLogo }

// Real Blackbox terminal themes: background, then foreground.
const THEMES: [string, string, string][] = [
  ['Blackbox Dark', '#0b0c0e', '#dcdee2'],
  ['Kanagawa Wave', '#1f1f28', '#dcd7ba'],
  ['Tokyo Night', '#1a1b26', '#c0caf5'],
  ['Catppuccin Mocha', '#1e1e2e', '#cdd6f4'],
  ['Solarized Dark', '#002b36', '#839496'],
  ['Gruvbox Dark', '#282828', '#ebdbb2'],
  ['Everforest Light', '#fdf6e3', '#5c6a72'],
  ['Flexoki Light', '#fffcf0', '#100f0f']
]

function App() {
  const [visitor, setVisitor] = useState<Visitor>({})
  const [release, setRelease] = useState<ReleaseState>({ status: 'loading' })
  useEffect(() => {
    detect().then(setVisitor)
    latestRelease().then(setRelease)
  }, [])
  useReveal()

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav>
        <nav className="nav-links" aria-label="Main">
          <a href="#features">Features</a>
          <a href="#security">Security</a>
          <a href="#download">Download</a>
        </nav>
        <a className="btn btn-secondary btn-sm" href={SIGNUP_URL}>
          Create account
        </a>
      </Nav>
      <main id="main">
        <Hero visitor={visitor} release={release} />
        <Sessions />
        <Features />
        <Security />
        <Downloads visitor={visitor} release={release} />
      </main>
      <Footer />
    </>
  )
}

function Hero({ visitor, release }: { visitor: Visitor; release: ReleaseState }) {
  const best = visitor.best
  const direct = best && release.status !== 'loading' && isAvailable(best, release)
  const OsIcon = visitor.os ? OS_ICONS[visitor.os] : DownloadSimple
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <h1 className="hero-enter">SSH sessions that don't drop.</h1>
          <p className="hero-sub hero-enter" style={{ '--delay': '80ms' } as React.CSSProperties}>
            A fast terminal for local shells and SSH, with SFTP, a keychain, port forwarding and encrypted sync.
          </p>
          <div className="hero-ctas hero-enter" style={{ '--delay': '160ms' } as React.CSSProperties}>
            <a className="btn btn-primary" href={direct ? downloadUrl(best, release) : '#download'}>
              <OsIcon size={20} weight="fill" aria-hidden="true" />
              {visitor.os ? `Download for ${OS_NAMES[visitor.os]}` : 'Download'}
            </a>
            <a className="btn btn-secondary" href={SIGNUP_URL}>
              Create account
            </a>
          </div>
        </div>
        <div className="hero-shot hero-enter" style={{ '--delay': '240ms' } as React.CSSProperties}>
          <div className="shot">
            <Shot name="vaults" small eager width={2000} height={1250} sizes="(max-width: 900px) 100vw, 50vw" alt="Blackbox showing saved hosts grouped into Home, Production and Staging, with a search bar to connect." />
          </div>
        </div>
      </div>
    </section>
  )
}

function Sessions() {
  const facts: [Icon, string, string][] = [
    [ArrowsClockwise, 'Reconnects by itself', 'Keepalives notice a dead link within seconds. Blackbox retries with backoff, and again the moment your machine wakes.'],
    [Stack, 'Resumes with tmux', 'Turn it on for a host and a reconnect puts you back in the same shell, with programs still running.'],
    [Password, 'Asks for a password once', 'A missing password or passphrase is asked for once and kept for the session, so reconnects never stop to ask.'],
    [SquareSplitHorizontal, 'Splits and broadcasts', 'Up to four panes in a tab, and one keystroke can go to all of them.']
  ]
  return (
    <section className="section" aria-labelledby="sessions-title">
      <div className="wrap">
        <div className="section-head reveal">
          <h2 id="sessions-title">Close the laptop. Your shell is still there.</h2>
          <p>Sessions live outside the window, so switching tabs or reloading never touches a connection. When the network drops, Blackbox reconnects on its own.</p>
        </div>
        <div className="sessions-grid">
          <div className="sessions-shot reveal">
            <div className="shot">
              <Shot name="split" small width={2000} height={1016} sizes="(max-width: 900px) 100vw, 64vw" alt="A Blackbox tab split into two terminal panes, one showing a git log and the other a file listing." />
            </div>
          </div>
          <ul className="facts">
            {facts.map(([I, title, body], i) => (
              <li key={title} className="reveal" style={{ '--delay': `${i * 60}ms` } as React.CSSProperties}>
                <I size={24} aria-hidden="true" />
                <strong>{title}</strong>
                <span>{body}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section className="section" id="features" aria-labelledby="features-title" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="section-head reveal">
          <h2 id="features-title">Everything around the shell.</h2>
          <p>Files, keys, tunnels and teammates, in the same window as your sessions.</p>
        </div>
        <div className="bento">
          <article className="tile tile-wide tile-media reveal">
            <h3>SFTP, side by side</h3>
            <p>Two panels, each local or any saved host. Drag files between them, or in from your file manager.</p>
            <div className="tile-img">
              <Shot name="sftp" width={1600} height={440} sizes="(max-width: 900px) 100vw, 800px" alt="The SFTP view with two file panels next to each other." />
            </div>
          </article>
          <article className="tile tile-narrow reveal" style={{ '--delay': '60ms' } as React.CSSProperties}>
            <Key size={26} aria-hidden="true" />
            <h3>A keychain for SSH keys</h3>
            <p>Generate Ed25519 or RSA keys, or import your own. Private keys are sealed with your system's keyring.</p>
          </article>
          <article className="tile tile-narrow reveal">
            <Lightning size={26} aria-hidden="true" />
            <h3>Connect without saving</h3>
            <p>Type an address or a whole ssh command into the search bar and press Enter.</p>
            <div className="kbd-row" aria-label="Examples">
              <code>deploy@10.20.0.11</code>
              <code>ssh ops@edge -p 2222</code>
            </div>
          </article>
          <article className="tile tile-wide tile-media reveal" style={{ '--delay': '60ms' } as React.CSSProperties}>
            <h3>Tunnels that stay up</h3>
            <p>Local and remote port forwarding rules. Switch one on and it reconnects whenever its host does.</p>
            <div className="tile-img">
              <Shot name="forwards" width={1400} height={449} sizes="(max-width: 900px) 100vw, 800px" alt="Port forwarding rules for Postgres, Grafana, a staging API and a webhook receiver." />
            </div>
          </article>
          <article className="tile tile-half tile-accent reveal">
            <UsersThree size={26} aria-hidden="true" />
            <h3>Share hosts with your team</h3>
            <p>Invite people to a shared vault as editors or viewers, with or without passwords. Removing someone rotates the vault's key, and organisations get an offboarding checklist.</p>
          </article>
          <article className="tile tile-half reveal" style={{ '--delay': '60ms' } as React.CSSProperties}>
            <Palette size={26} aria-hidden="true" />
            <h3>24 colour schemes, 12 fonts</h3>
            <p>Light and dark themes for the app and the terminal, with the fonts you'd expect already bundled.</p>
            <div className="swatches" role="list" aria-label="Some of the included colour schemes">
              {THEMES.map(([name, bg, fg]) => (
                <span key={name} role="listitem" title={name} aria-label={name} style={{ background: `linear-gradient(${bg} 70%, ${fg} 70%)` }} />
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function Security() {
  const points: [string, string][] = [
    ['Your password stays with you', 'It is stretched with Argon2id on your device. The server gets a derived key it can check, never the password.'],
    ['Sealed before it leaves', 'Hosts, keys and settings are encrypted with XChaCha20-Poly1305 under keys that only your devices hold.'],
    ['A recovery key only you have', "It is shown once, when you sign up. If you forget your password it is the only way back in, because we can't reset it."],
    ['New devices ask first', 'A new sign-in waits for approval from a device you already use. Add an authenticator app for two-factor sign-in.']
  ]
  return (
    <section className="section security" id="security" aria-labelledby="security-title">
      <div className="wrap">
        <div className="section-head reveal">
          <h2 id="security-title">Sync that we can't read.</h2>
          <p>An account keeps your hosts, keys and settings the same on every device. Everything is encrypted on your device first, so our server only ever stores ciphertext.</p>
        </div>
        <div className="promise">
          {points.map(([title, body], i) => (
            <div key={title} className="reveal" style={{ '--delay': `${(i % 2) * 60}ms` } as React.CSSProperties}>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
        <div className="aside-note reveal">
          <p>Accounts are optional. Without one, Blackbox is a fully offline terminal and nothing leaves your machine.</p>
          <a className="btn btn-secondary" href={SIGNUP_URL}>
            Create account
          </a>
        </div>
      </div>
    </section>
  )
}

const FIRST_RUN: Record<Os, { summary: string; body: React.ReactNode }> = {
  mac: {
    summary: 'Opening it the first time',
    body: (
      <>
        <p>Open the .zip and drag Blackbox to Applications. This build isn't notarised by Apple yet, so macOS blocks the first launch. Open System Settings, then Privacy & Security, and choose Open Anyway. Or run:</p>
        <code>xattr -dr com.apple.quarantine /Applications/Blackbox.app</code>
        <p>Blackbox tells you when a new version is out.</p>
      </>
    )
  },
  windows: {
    summary: 'Opening it the first time',
    body: <p>This build isn't code-signed yet, so Windows SmartScreen may warn you. Choose More info, then Run anyway. You only do this once: Blackbox updates itself after that.</p>
  },
  linux: {
    summary: 'Installing',
    body: (
      <>
        <p>Install the package for your distribution. Blackbox then appears in your app search and can be pinned to the dock, and it updates itself (asking for your password to install each update):</p>
        <code>{'sudo apt install ./Blackbox-linux-amd64.deb\nsudo dnf install ./Blackbox-linux-x86_64.rpm'}</code>
        <p>Or make the AppImage executable and run it (it needs FUSE 2, which Ubuntu calls libfuse2t64). On first launch it adds itself to your app menu, and it updates in place:</p>
        <code>chmod +x Blackbox-linux-x86_64.AppImage</code>
      </>
    )
  }
}

function Downloads({ visitor, release }: { visitor: Visitor; release: ReleaseState }) {
  const order: Os[] = ['mac', 'windows', 'linux']
  if (visitor.os) order.sort((a, b) => Number(b === visitor.os) - Number(a === visitor.os))
  const r = release.status === 'ready' ? release.release : null
  return (
    <section className="section download" id="download" aria-labelledby="download-title">
      <div className="wrap">
        <div className="section-head reveal">
          <h2 id="download-title">Download Blackbox</h2>
          <p className="release-line" aria-live="polite">
            {release.status === 'loading' && <span className="skeleton" aria-label="Checking the latest version" />}
            {r && `Version ${r.version}, released ${formatDate(r.date)}. Free, for macOS, Windows and Linux.`}
            {release.status === 'unknown' && 'Free, for macOS, Windows and Linux.'}
            {release.status === 'none' && 'Free, for macOS, Windows and Linux.'}
          </p>
        </div>
        {release.status === 'none' && (
          <p className="notice" role="status">
            The first release is still being built. The buttons below will start working as soon as it's out; <a href={RELEASES_URL}>the releases page</a> will have it first.
          </p>
        )}
        {!visitor.os && visitor.best === undefined && isHandheld() && (
          <p className="notice">Blackbox is a desktop app. Open this page on your Mac, Windows or Linux computer to download it, or create your account now and sign in later.</p>
        )}
        <div className="platforms">
          {order.map((os, i) => (
            <Platform key={os} os={os} mine={os === visitor.os} best={visitor.best} release={release} delay={i * 60} />
          ))}
        </div>
      </div>
    </section>
  )
}

const isHandheld = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

function Platform({ os, mine, best, release, delay }: { os: Os; mine: boolean; best?: Build; release: ReleaseState; delay: number }) {
  const OsIcon = OS_ICONS[os]
  const builds = BUILDS.filter((b) => b.os === os)
  // Your architecture first.
  if (mine && best) builds.sort((a, b) => Number(b.id === best.id) - Number(a.id === best.id))
  const note = FIRST_RUN[os]
  return (
    <div className="platform reveal" data-mine={mine} style={{ '--delay': `${delay}ms` } as React.CSSProperties}>
      <div className="platform-head">
        <OsIcon size={28} weight="fill" aria-hidden="true" />
        <h3>{OS_NAMES[os]}</h3>
        {mine && <span className="mine">Your system</span>}
      </div>
      <ul className="files">
        {builds.map((b) => (
          <li key={b.id}>
            <FileLink build={b} release={release} />
          </li>
        ))}
      </ul>
      <details className="first-run">
        <summary>{note.summary}</summary>
        {note.body}
      </details>
    </div>
  )
}

function FileLink({ build, release }: { build: Build; release: ReleaseState }) {
  const size = release.status === 'ready' ? release.release.sizes.get(build.file) : undefined
  const content = (
    <>
      <span className="file-text">
        <strong>{build.label}</strong>
        <span>{build.detail}</span>
      </span>
      <span className="size">{size ? formatSize(size) : ''}</span>
      <DownloadSimple size={18} aria-hidden="true" />
    </>
  )
  if (!isAvailable(build, release)) {
    return (
      <span className="file" aria-disabled="true" title="Not in the latest release">
        {content}
      </span>
    )
  }
  return (
    <a className="file" href={downloadUrl(build, release)} aria-label={`Download ${OS_NAMES[build.os]} ${build.label}, ${build.detail}`}>
      {content}
    </a>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
