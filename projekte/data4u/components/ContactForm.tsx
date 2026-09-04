'use client';

import { useState } from 'react';
import { AlertCircle, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { contact, interests } from '@/lib/data4u';

/**
 * Endpunkt für den Formularversand.
 *
 * Die Seite wird statisch ausgeliefert und hat deshalb keinen eigenen
 * Server. Solange hier `null` steht, stellt das Formular die Nachricht
 * zusammen und öffnet das E-Mail-Programm des Nutzers — der Text ist also
 * nie verloren. Sobald ein Endpunkt existiert (eigene Funktion, Formspree,
 * Netlify Forms), genügt es, hier die URL einzutragen: das Formular sendet
 * dann per POST und zeigt dieselbe Bestätigung.
 */
const FORM_ENDPOINT: string | null = null;

type Status = 'idle' | 'sending' | 'sent' | 'error';

const initial = {
  nome: '',
  email: '',
  telefone: '',
  interesse: '',
  mensagem: '',
};

export function ContactForm({ defaultInterest }: { defaultInterest?: string }) {
  const [values, setValues] = useState({
    ...initial,
    interesse: defaultInterest ?? '',
  });
  const [status, setStatus] = useState<Status>('idle');

  const set = (key: keyof typeof initial) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');

    if (FORM_ENDPOINT) {
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        setStatus(res.ok ? 'sent' : 'error');
      } catch {
        setStatus('error');
      }
      return;
    }

    const body = [
      `Nome: ${values.nome}`,
      `E-mail: ${values.email}`,
      `Telefone: ${values.telefone}`,
      `Interesse: ${values.interesse}`,
      '',
      values.mensagem,
    ].join('\n');

    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(
      `Contato pelo site — ${values.interesse || 'Informações'}`,
    )}&body=${encodeURIComponent(body)}`;
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="form-done" role="status">
        <span className="form-done-icon" aria-hidden>
          <Check size={20} strokeWidth={2.6} />
        </span>
        <h3 className="t-h3">Mensagem pronta para envio.</h3>
        <p className="t-body mt-3">
          {FORM_ENDPOINT
            ? 'Recebemos seu contato. Um especialista da Data4U responde em seguida.'
            : 'Seu programa de e-mail foi aberto com a mensagem preenchida. Se nada abrir, escreva para '}
          {!FORM_ENDPOINT ? (
            <a href={`mailto:${contact.email}`} className="link-arrow">
              {contact.email}
            </a>
          ) : null}
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setValues({ ...initial, interesse: defaultInterest ?? '' });
            setStatus('idle');
          }}
        >
          Enviar outra mensagem
        </Button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate={false}>
      <div className="form-row">
        <div className="form-field">
          <label className="field-label" htmlFor="cf-nome">
            Nome
          </label>
          <input
            id="cf-nome"
            name="nome"
            className="field"
            type="text"
            autoComplete="name"
            required
            value={values.nome}
            onChange={set('nome')}
            placeholder="Como podemos chamar você"
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="cf-email">
            E-mail
          </label>
          <input
            id="cf-email"
            name="email"
            className="field"
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={set('email')}
            placeholder="voce@empresa.com.br"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="field-label" htmlFor="cf-telefone">
            Telefone
          </label>
          <input
            id="cf-telefone"
            name="telefone"
            className="field"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.telefone}
            onChange={set('telefone')}
            placeholder="(00) 00000-0000"
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="cf-interesse">
            Interesse
          </label>
          <select
            id="cf-interesse"
            name="interesse"
            className="field field-select"
            required
            value={values.interesse}
            onChange={set('interesse')}
          >
            <option value="" disabled>
              Selecione um assunto
            </option>
            {interests.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="cf-mensagem">
          Mensagem
        </label>
        <textarea
          id="cf-mensagem"
          name="mensagem"
          className="field"
          required
          value={values.mensagem}
          onChange={set('mensagem')}
          placeholder="Conte o que você precisa: quantos acessos, qual estrutura, qual prazo."
        />
      </div>

      {status === 'error' ? (
        <p className="form-error" role="alert">
          <AlertCircle size={16} strokeWidth={2.2} aria-hidden />
          Não foi possível enviar agora. Escreva para{' '}
          <a href={`mailto:${contact.email}`}>{contact.email}</a> ou ligue para{' '}
          <a href={contact.phoneHref}>{contact.phone}</a>.
        </p>
      ) : null}

      <div className="form-foot">
        <Button size="lg" type="submit" disabled={status === 'sending'}>
          <Send size={16} strokeWidth={2.2} aria-hidden />
          {status === 'sending' ? 'Enviando…' : 'Enviar mensagem'}
        </Button>
        <p className="form-hint">
          Retornamos pelo canal que você preferir: e-mail ou telefone.
        </p>
      </div>
    </form>
  );
}
