'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, Phone } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { MobileMenu } from '@/components/MobileMenu';
import { contact, nav } from '@/lib/data4u';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const closeTimer = useRef<number | null>(null);

  /* Der Zustandswechsel passiert einmal bei 12px — kein Listener, der bei
     jedem Pixel neu rendert. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Beim Seitenwechsel schließt sich alles. */
  useEffect(() => {
    setOpenMenu(null);
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Kleine Verzögerung beim Verlassen, damit die Maus die Lücke zwischen
     Auslöser und Panel überqueren kann. */
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 140);
  };

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  const isActive = (href: string) => {
    const base = href.split('#')[0];
    if (base === '/' || base === '') return false;
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <>
      <header
        data-scrolled={scrolled ? 'true' : 'false'}
        className="nav-shell"
      >
        <div className="container-d4u flex h-[var(--nav-h)] items-center justify-between gap-6">
          <Link
            href="/"
            className="nav-brand"
            aria-label="Data4U Technology — página inicial"
          >
            <Logo />
          </Link>

          {/* --- Desktop-Navigation ---------------------------------------- */}
          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-1"
            onMouseLeave={scheduleClose}
          >
            {nav.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => {
                    cancelClose();
                    setOpenMenu(item.label);
                  }}
                >
                  <button
                    type="button"
                    className="nav-link"
                    aria-expanded={openMenu === item.label}
                    aria-haspopup="true"
                    data-active={isActive(item.href) ? 'true' : undefined}
                    onClick={() =>
                      setOpenMenu(openMenu === item.label ? null : item.label)
                    }
                  >
                    {item.label}
                    <ChevronDown
                      size={14}
                      strokeWidth={2.2}
                      className="nav-chevron"
                      aria-hidden
                    />
                  </button>

                  <div
                    className="nav-panel"
                    data-open={openMenu === item.label ? 'true' : 'false'}
                    onMouseEnter={cancelClose}
                  >
                    <ul className="nav-panel-list">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="nav-panel-item"
                            tabIndex={openMenu === item.label ? 0 : -1}
                          >
                            <span className="nav-panel-title">{child.label}</span>
                            <span className="nav-panel-hint">{child.hint}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  data-active={isActive(item.href) ? 'true' : undefined}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          {/* --- Aktionen -------------------------------------------------- */}
          <div className="flex items-center gap-2">
            <a
              href={contact.phoneHref}
              className="nav-phone"
              aria-label={`Ligar para ${contact.phone}`}
            >
              <Phone size={15} strokeWidth={2} aria-hidden />
              <span>{contact.phone}</span>
            </a>

            <Link href="/fale-conosco" className="btn btn-primary btn-sm">
              Fale conosco
            </Link>

            <button
              type="button"
              className="nav-burger lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
