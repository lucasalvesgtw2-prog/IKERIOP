import { ArrowRight, BadgeCheck, DoorOpen, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AccessTerminal } from '@/components/mockups/AccessTerminal';
import { revealDelay } from '@/lib/motion';

export function Hero() {
  return (
    <section className="hero act-dark" aria-labelledby="hero-title">
      {/* Ein einziger Lichtkegel und ein Punktraster — mehr Hintergrund
          braucht die Sektion nicht. */}
      <div className="hero-glow" aria-hidden />
      <div className="hero-dots bg-dots" aria-hidden />

      <div className="container-d4u grid-rules relative">
        <div className="hero-grid">
          {/* --- Text ---------------------------------------------------- */}
          <div className="hero-copy">
            <p className="eyebrow reveal">Tecnologia • Gestão • Segurança</p>

            <h1
              id="hero-title"
              className="t-display reveal mt-5"
              style={revealDelay(70)}
            >
              Controle de acesso inteligente para uma gestão mais eficiente.
            </h1>

            <p className="t-lead reveal mt-6 max-w-xl" style={revealDelay(140)}>
              Soluções completas em software, biometria e gestão para empresas,
              academias, condomínios e escolas.
            </p>

            <div className="hero-actions reveal" style={revealDelay(210)}>
              <Button href="/#solucoes" size="lg">
                Conheça nossas soluções
                <ArrowRight size={17} strokeWidth={2.2} aria-hidden />
              </Button>
              <Button href="/fale-conosco" variant="secondary" size="lg">
                Fale com um especialista
              </Button>
            </div>

            <p className="hero-note reveal" style={revealDelay(280)}>
              Software e equipamento do mesmo fornecedor — instalados,
              integrados e com suporte.
            </p>
          </div>

          {/* --- Visual --------------------------------------------------- */}
          <div className="hero-visual reveal" style={revealDelay(200)}>
            <div className="hero-stage">
              <AccessTerminal className="hero-terminal" />

              <FloatChip
                className="hero-chip hero-chip-1 anim-drift"
                icon={<ScanFace size={13} strokeWidth={2.2} aria-hidden />}
                label="Leitura sem contato"
              />
              <FloatChip
                className="hero-chip hero-chip-2 anim-drift"
                style={{ animationDelay: '1.4s' }}
                icon={<DoorOpen size={13} strokeWidth={2.2} aria-hidden />}
                label="Entrada autorizada"
                tone="ok"
              />
              <FloatChip
                className="hero-chip hero-chip-3 anim-drift"
                style={{ animationDelay: '2.6s' }}
                icon={<BadgeCheck size={13} strokeWidth={2.2} aria-hidden />}
                label="Registro na gestão"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FloatChip({
  icon,
  label,
  className,
  style,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  tone?: 'ok';
}) {
  return (
    <span
      className={['float-chip', className].filter(Boolean).join(' ')}
      data-tone={tone}
      style={style}
      aria-hidden
    >
      {icon}
      {label}
    </span>
  );
}
