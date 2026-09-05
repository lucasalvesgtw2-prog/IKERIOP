import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { hardware, solutions } from '@/lib/data4u';

export default function NotFound() {
  return (
    <section className="page-hero act-dark" style={{ minHeight: '72vh' }}>
      <div className="container-d4u grid-rules relative">
        <p className="eyebrow">Erro 404</p>
        <h1 className="t-h1 mt-4 max-w-2xl">Esta página não foi encontrada.</h1>
        <p className="t-lead mt-5 max-w-xl">
          O endereço pode ter mudado. Comece pelo início ou vá direto para o
          sistema que você procura.
        </p>

        <div className="feature-actions">
          <Button href="/" size="lg">
            Voltar ao início
            <ArrowRight size={17} strokeWidth={2.2} aria-hidden />
          </Button>
          <Button href="/fale-conosco" variant="secondary" size="lg">
            Falar com a Data4U
          </Button>
        </div>

        <nav aria-label="Atalhos" className="notfound-links">
          {[...solutions, ...hardware].map((item) => (
            <Link key={item.href} href={item.href} className="notfound-link">
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
