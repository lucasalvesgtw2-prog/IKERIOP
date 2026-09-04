'use client';

import { useEffect, useRef, useState } from 'react';
import { Mail, MessageCircle, Phone, X } from 'lucide-react';
import { contact, whatsappHref } from '@/lib/data4u';

/**
 * Schwebender Kontaktknopf.
 *
 * WhatsApp ist als Kanal vorgesehen und erscheint hier automatisch, sobald
 * in lib/data4u.ts eine offizielle Nummer hinterlegt ist. Solange keine
 * belegte Nummer vorliegt, führt der Knopf zu den Kanälen, die Data4U
 * tatsächlich veröffentlicht — Telefon und E-Mail. Es wird keine Nummer
 * erfunden.
 */
export function ContactDock() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onClick);
    };
  }, [open]);

  return (
    <div className="dock" ref={rootRef}>
      <div className="dock-panel" data-open={open ? 'true' : 'false'} role="group" aria-label="Canais de contato">
        {whatsappHref ? (
          <a
            href={whatsappHref}
            className="dock-item dock-item-wa"
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={open ? 0 : -1}
          >
            <MessageCircle size={16} strokeWidth={2.2} aria-hidden />
            WhatsApp
          </a>
        ) : null}
        <a href={contact.phoneHref} className="dock-item" tabIndex={open ? 0 : -1}>
          <Phone size={16} strokeWidth={2.2} aria-hidden />
          {contact.phone}
        </a>
        <a href={`mailto:${contact.email}`} className="dock-item" tabIndex={open ? 0 : -1}>
          <Mail size={16} strokeWidth={2.2} aria-hidden />
          E-mail
        </a>
      </div>

      <button
        type="button"
        className="dock-toggle"
        aria-expanded={open}
        aria-label={open ? 'Fechar canais de contato' : 'Abrir canais de contato'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <X size={20} strokeWidth={2.2} aria-hidden />
        ) : (
          <MessageCircle size={20} strokeWidth={2.2} aria-hidden />
        )}
      </button>
    </div>
  );
}
