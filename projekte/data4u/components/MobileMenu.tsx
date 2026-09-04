'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Mail, Phone, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { contact, nav } from '@/lib/data4u';

/**
 * Vollflächige Schublade. Sie hängt immer im DOM, damit der Auf- und Zubau
 * animiert werden kann; `inert` nimmt sie im geschlossenen Zustand komplett
 * aus Tastatur- und Screenreader-Reihenfolge heraus.
 */
export function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      /* Fokus bleibt in der Schublade, solange sie offen ist. */
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      className="drawer"
      data-open={open ? 'true' : 'false'}
      // @ts-expect-error – inert ist in React 19 typisiert, in TS aber noch als string
      inert={open ? undefined : ''}
      aria-hidden={!open}
    >
      <div ref={panelRef} className="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="flex h-[var(--nav-h)] items-center justify-between px-5">
          <Logo />
          <button
            ref={closeRef}
            type="button"
            className="nav-burger"
            aria-label="Fechar menu"
            onClick={onClose}
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <nav aria-label="Navegação móvel" className="drawer-scroll">
          {nav.map((item) => (
            <section key={item.label} className="drawer-group">
              {item.children ? (
                <>
                  <p className="drawer-group-label">{item.label}</p>
                  <ul>
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link href={child.href} className="drawer-item" onClick={onClose}>
                          <span className="drawer-item-title">{child.label}</span>
                          <span className="drawer-item-hint">{child.hint}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <Link href={item.href} className="drawer-item" onClick={onClose}>
                  <span className="drawer-item-title">{item.label}</span>
                </Link>
              )}
            </section>
          ))}
        </nav>

        <div className="drawer-foot">
          <Link href="/fale-conosco" className="btn btn-primary w-full" onClick={onClose}>
            Fale conosco
          </Link>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={contact.phoneHref} className="btn btn-secondary btn-sm">
              <Phone size={15} strokeWidth={2} aria-hidden />
              Ligar
            </a>
            <a href={`mailto:${contact.email}`} className="btn btn-secondary btn-sm">
              <Mail size={15} strokeWidth={2} aria-hidden />
              E-mail
            </a>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="drawer-scrim"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
      />
    </div>
  );
}
