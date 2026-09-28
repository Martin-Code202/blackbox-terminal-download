import { CheckCircle, Copy, DeviceMobile, DownloadSimple, Eye, EyeSlash, Lifebuoy, LockKey, WarningCircle } from '@phosphor-icons/react'
import { StrictMode, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiError, loadSodium, MIN_PASSWORD, register, resendCode, signOut, validEmail, verifyEmail, type Tokens } from './account'
import { Footer, Nav } from './chrome'
import { detect, downloadUrl, isAvailable, latestRelease, OS_NAMES, type ReleaseState, type Visitor } from './release'
import './styles.css'

type Step = 'account' | 'recovery' | 'verify' | 'done'
const STEPS: [Step, string][] = [
  ['account', 'Account'],
  ['recovery', 'Recovery key'],
  ['verify', 'Email']
]

interface Created {
  email: string
  recoveryKey: string
  tokens: Tokens
}

function App() {
  const [step, setStep] = useState<Step>('account')
  const [created, setCreated] = useState<Created | null>(null)
  const [verified, setVerified] = useState(false)
  const heading = useRef<HTMLDivElement>(null)

  // The website's session only exists to verify the address. If the tab closes early, sign it out
  // anyway, so the app's first sign-in doesn't wait for an approval nobody can give.
  const live = useRef<Tokens | null>(null)
  useEffect(() => {
    const leave = () => live.current && signOut(live.current, true)
    window.addEventListener('pagehide', leave)
    return () => window.removeEventListener('pagehide', leave)
  }, [])

  const go = (next: Step) => {
    setStep(next)
    requestAnimationFrame(() => heading.current?.querySelector<HTMLElement>('h1')?.focus())
  }

  const finish = async (didVerify: boolean) => {
    setVerified(didVerify)
    if (live.current) await signOut(live.current)
    live.current = null
    go('done')
  }

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav>
        <a className="btn btn-quiet btn-sm" href="/#download" style={{ marginLeft: 'auto' }}>
          Download
        </a>
      </Nav>
      <main id="main" className="signup-main">
        <div className="wrap signup-grid">
          <div ref={heading}>
            {step !== 'done' && <Steps current={step} />}
            {step === 'account' && (
              <AccountStep
                onCreated={(c) => {
                  live.current = c.tokens
                  setCreated(c)
                  go('recovery')
                }}
              />
            )}
            {step === 'recovery' && created && <RecoveryStep created={created} onNext={() => go('verify')} />}
            {step === 'verify' && created && <VerifyStep created={created} onDone={finish} />}
            {step === 'done' && created && <DoneStep email={created.email} verified={verified} />}
          </div>
          <aside className="signup-aside" aria-label="How your account is protected">
            <h2>How your account is protected</h2>
            <ul className="facts">
              <li>
                <LockKey size={24} aria-hidden="true" />
                <strong>Keys made in this tab</strong>
                <span>Your encryption keys are generated here, in your browser. Your password never reaches our server.</span>
              </li>
              <li>
                <Lifebuoy size={24} aria-hidden="true" />
                <strong>A recovery key you keep</strong>
                <span>If you forget your password, it is the only way back in. We can't reset it for you.</span>
              </li>
              <li>
                <DeviceMobile size={24} aria-hidden="true" />
                <strong>Then sign in from the app</strong>
                <span>This page signs itself out when you finish, so Blackbox on your computer becomes your first device.</span>
              </li>
            </ul>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  )
}

function Steps({ current }: { current: Step }) {
  const at = STEPS.findIndex(([s]) => s === current)
  return (
    <ol className="steps" aria-label="Sign-up progress">
      {STEPS.map(([s, label], i) => (
        <li key={s} data-state={i < at ? 'done' : i === at ? 'current' : 'todo'} aria-current={i === at ? 'step' : undefined}>
          {label}
        </li>
      ))}
    </ol>
  )
}

function Card({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <h1 tabIndex={-1} style={{ outline: 'none' }}>
        {title}
      </h1>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </div>
  )
}

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p className="error" id={id} role="alert">
      <WarningCircle size={16} weight="fill" aria-hidden="true" />
      {children}
    </p>
  )
}

/** 0 to 4. Length does most of the work; a long phrase beats a short tangle. */
function strength(p: string) {
  if (p.length < MIN_PASSWORD) return p ? 1 : 0
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length
  if (p.length >= 20 || (p.length >= 14 && kinds >= 3)) return 4
  if (p.length >= 14 || kinds >= 3) return 3
  return 2
}
const STRENGTH_WORDS = ['', 'Too short', 'Fair', 'Good', 'Strong']

function AccountStep({ onCreated }: { onCreated: (c: Created) => void }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Start fetching the crypto library while the form is being filled in.
  useEffect(() => {
    loadSodium().catch(() => {})
  }, [])

  const errors = {
    email: !email.trim() ? 'Enter your email address.' : !validEmail(email) ? 'That doesn\'t look like an email address.' : '',
    password: password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : '',
    confirm: confirm !== password ? "The passwords don't match." : ''
  }
  const shown = (k: keyof typeof errors) => (touched[k] || submitted ? errors[k] : '')
  const score = strength(password)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError('')
    const first = (Object.keys(errors) as (keyof typeof errors)[]).find((k) => errors[k])
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus()
      return
    }
    setBusy(true)
    try {
      // Let the button show its busy state before Argon2 takes the main thread for a moment.
      await new Promise((r) => setTimeout(r, 30))
      onCreated(await register(email, password))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong creating your keys. Reload the page and try again.')
      setBusy(false)
    }
  }

  return (
    <Card title="Create your Blackbox account" lead="One account keeps your hosts, keys and settings in sync on every computer, end-to-end encrypted.">
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-email`}>Email</label>
          <input
            id={`${id}-email`}
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={!!shown('email')}
            aria-describedby={shown('email') ? `${id}-email-err` : undefined}
            required
          />
          <FieldError id={`${id}-email-err`}>{shown('email')}</FieldError>
        </div>
        <div className="field">
          <label htmlFor={`${id}-password`}>Password</label>
          <div className="input-wrap">
            <input
              id={`${id}-password`}
              className="input"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={!!shown('password')}
              aria-describedby={`${id}-password-help${shown('password') ? ` ${id}-password-err` : ''}`}
              required
              minLength={MIN_PASSWORD}
            />
            <button type="button" className="reveal-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
              {show ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
          <div className="meter" data-score={score} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="help" id={`${id}-password-help`}>
            {password ? `${STRENGTH_WORDS[score]}. ` : ''}At least {MIN_PASSWORD} characters. A few unrelated words make a strong password that's easy to remember.
          </p>
          <FieldError id={`${id}-password-err`}>{shown('password')}</FieldError>
        </div>
        <div className="field">
          <label htmlFor={`${id}-confirm`}>Confirm password</label>
          <input
            id={`${id}-confirm`}
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
            aria-invalid={!!shown('confirm')}
            aria-describedby={shown('confirm') ? `${id}-confirm-err` : undefined}
            required
          />
          <FieldError id={`${id}-confirm-err`}>{shown('confirm')}</FieldError>
        </div>
        {error && (
          <p className="error form-error" role="alert">
            <WarningCircle size={16} weight="fill" aria-hidden="true" />
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Creating your keys
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
      <p className="fine">
        Already have an account? Sign in from the app, under Settings, then Account. No account needed to use Blackbox offline: <a href="/#download">just download it</a>.
      </p>
    </Card>
  )
}

function RecoveryStep({ created, onNext }: { created: Created; onNext: () => void }) {
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState('')
  const flash = (text: string) => {
    setToast(text)
    setTimeout(() => setToast(''), 2400)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.recoveryKey)
      flash('Recovery key copied')
    } catch {
      flash('Copy failed. Select the key and copy it by hand.')
    }
  }
  const download = () => {
    const text = `Blackbox recovery key\n\nAccount: ${created.email}\nRecovery key: ${created.recoveryKey}\n\nKeep this somewhere safe and offline, such as a password manager or on paper.\nIt is the only way back into your account if you forget your password.\n`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'blackbox-recovery-key.txt' })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    flash('Saved blackbox-recovery-key.txt')
  }
  return (
    <Card title="Save your recovery key" lead="If you forget your password, this key is the only way back into your account. It is shown once, and we can't show it again.">
      <p className="recovery" aria-label={`Recovery key: ${created.recoveryKey}`}>
        {created.recoveryKey.split('-').map((group, i) => (
          <span key={i}>
            {group}
            {/* Copies as the same key the app shows, dashes included. */}
            {i < 12 && <span className="sr-only">-</span>}{' '}
          </span>
        ))}
      </p>
      <div className="recovery-actions">
        <button className="btn btn-secondary btn-sm" type="button" onClick={copy}>
          <Copy size={16} aria-hidden="true" /> Copy
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={download}>
          <DownloadSimple size={16} aria-hidden="true" /> Save as file
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I've saved my recovery key somewhere safe, such as a password manager.</span>
      </label>
      <div className="form" style={{ marginTop: 20 }}>
        <button className="btn btn-primary" type="button" disabled={!saved} onClick={onNext}>
          Continue
        </button>
      </div>
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </Card>
  )
}

function VerifyStep({ created, onDone }: { created: Created; onDone: (verified: boolean) => void }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(clean)) {
      setError('Enter the 6-digit code from the email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await verifyEmail(created.tokens, clean)
      onDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check the code. Try again.')
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    setSent('')
    try {
      await resendCode(created.tokens)
      setSent('A new code is on its way.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a new code.')
    }
  }

  return (
    <Card
      title="Check your email"
      lead={
        <>
          We sent a 6-digit code to <strong>{created.email}</strong>. A verified address lets teammates find you and invite you to shared vaults.
        </>
      }
    >
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-code`}>Verification code</label>
          <input
            id={`${id}-code`}
            className="input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-code-err` : undefined}
          />
          <FieldError id={`${id}-code-err`}>{error}</FieldError>
          {sent && (
            <p className="help" role="status">
              {sent}
            </p>
          )}
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> Checking
            </>
          ) : (
            'Verify email'
          )}
        </button>
        <div className="row">
          <button className="btn btn-quiet" type="button" onClick={resend}>
            Send a new code
          </button>
          <button className="btn btn-quiet" type="button" onClick={() => onDone(false)}>
            Skip for now
          </button>
        </div>
      </form>
    </Card>
  )
}

function DoneStep({ email, verified }: { email: string; verified: boolean }) {
  const [visitor, setVisitor] = useState<Visitor>({})
  const [release, setRelease] = useState<ReleaseState>({ status: 'loading' })
  useEffect(() => {
    detect().then(setVisitor)
    latestRelease().then(setRelease)
  }, [])
  const best = visitor.best
  const direct = best && release.status !== 'loading' && isAvailable(best, release)
  return (
    <div className="card">
      <div className="success-icon">
        <CheckCircle size={30} weight="fill" aria-hidden="true" />
      </div>
      <h1 tabIndex={-1} style={{ outline: 'none' }}>
        Your account is ready
      </h1>
      <p className="lead">You're signed out of this page. Sign in from the app to start syncing.</p>
      <ol className="next-steps">
        <li>
          <span>
            <strong>Install Blackbox</strong> on your computer, if you haven't yet.
          </span>
        </li>
        <li>
          <span>
            <strong>Open Settings, then Account</strong>, and sign in as {email}.
          </span>
        </li>
        <li>
          <span>
            <strong>Your hosts upload encrypted.</strong> Anything already saved on that computer joins your account.
            {!verified && ' You can verify your email there too.'}
          </span>
        </li>
      </ol>
      <div className="row" style={{ marginTop: 28 }}>
        <a className="btn btn-primary" href={direct ? downloadUrl(best, release) : '/#download'}>
          <DownloadSimple size={18} aria-hidden="true" />
          {visitor.os ? `Download for ${OS_NAMES[visitor.os]}` : 'Download'}
        </a>
        {visitor.os && (
          <a className="btn btn-quiet" href="/#download">
            Other systems
          </a>
        )}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
