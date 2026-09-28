import { useEffect, useRef, useState, type ReactNode } from 'react'

export const SIGNUP_URL = '/signup'

/** A screenshot of the app, in whichever theme the visitor's system uses. */
export function Shot({ name, alt, width, height, sizes, eager = false, small = false }: { name: string; alt: string; width: number; height: number; sizes: string; eager?: boolean; small?: boolean }) {
  const set = (theme: string) => (small ? `/screens/${name}-${theme}-1000.webp 1000w, /screens/${name}-${theme}.webp 2000w` : `/screens/${name}-${theme}.webp`)
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={set('dark')} sizes={sizes} />
      <img
        src={`/screens/${name}-light.webp`}
        srcSet={set('light')}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        decoding="async"
      />
    </picture>
  )
}

export function Nav({ children }: { children?: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <>
      <div ref={sentinel} aria-hidden="true" style={{ position: 'absolute', top: 0, height: 1, width: 1 }} />
      <header className="nav" data-scrolled={scrolled}>
        <div className="wrap nav-inner">
          <a className="brand" href="/">
            <img src="/icon.svg" alt="" width={30} height={30} />
            Blackbox
          </a>
          {children}
        </div>
      </header>
    </>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <a className="brand" href="/">
          <img src="/icon.svg" alt="" width={24} height={24} />
          Blackbox
        </a>
        <span>© {new Date().getFullYear()} Martin Mwangi</span>
        <nav aria-label="Footer">
          <a href="/#download">Download</a>
          <a href={SIGNUP_URL}>Create account</a>
          <a href="https://github.com/Martin-Code202/blackbox-terminal-download/releases">All releases</a>
        </nav>
      </div>
    </footer>
  )
}

/** Fades sections in the first time they scroll into view. CSS skips it under reduced motion. */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          ;(e.target as HTMLElement).dataset.shown = 'true'
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}
