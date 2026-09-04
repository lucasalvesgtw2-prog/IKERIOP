import type { Metadata } from 'next';
import { RevealProvider } from '@/components/ui/Reveal';
import { PageHero } from '@/components/PageHero';
import { addressLines, company, contact } from '@/lib/data4u';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: `Como a ${company.legalName} trata os dados enviados pelo site.`,
  alternates: { canonical: '/politica-de-privacidade' },
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <>
      <RevealProvider />

      <PageHero
        eyebrow="Documento legal"
        title="Política de privacidade"
        lead="Como os dados enviados por este site são tratados."
        crumbs={[{ label: 'Política de privacidade' }]}
      />

      <section className="section">
        <div className="container-narrow prose-d4u">
          <p className="callout">
            <strong>Texto de base a ser revisado pelo jurídico da Data4U.</strong>{' '}
            O conteúdo abaixo descreve apenas o que este site faz tecnicamente.
            Antes da publicação, a política precisa ser complementada com o
            provedor de hospedagem contratado, o prazo de retenção dos registros
            de servidor e o encarregado pelo tratamento de dados (DPO), conforme
            a Lei Geral de Proteção de Dados (Lei 13.709/2018).
          </p>

          <h2>Quem trata os dados</h2>
          <p>
            {company.legalName}, com endereço em {addressLines.join(', ')}.
            Contato: <a href={`mailto:${contact.email}`}>{contact.email}</a> ·{' '}
            <a href={contact.phoneHref}>{contact.phone}</a>.
          </p>

          <h2>Quais dados são coletados</h2>
          <p>
            Este site não utiliza cookies de publicidade nem ferramentas de
            rastreamento de terceiros. As fontes tipográficas são entregues pelo
            próprio servidor do site — nenhuma requisição é feita a serviços
            externos durante a navegação.
          </p>
          <p>
            No formulário de contato são coletados apenas os dados que você
            digita: nome, e-mail, telefone, assunto de interesse e mensagem.
            Eles são usados exclusivamente para responder à sua solicitação.
          </p>

          <h2>Registros de servidor</h2>
          <p>
            Como em qualquer site, o servidor de hospedagem registra dados
            técnicos de acesso (endereço IP, data e hora, página solicitada e
            navegador utilizado). Esses registros servem à segurança e ao
            funcionamento do serviço.
          </p>

          <h2>Seus direitos</h2>
          <p>
            Você pode solicitar a confirmação da existência de tratamento, o
            acesso, a correção, a anonimização, a portabilidade ou a exclusão
            dos seus dados, bem como revogar o consentimento. Para isso, escreva
            para <a href={`mailto:${contact.email}`}>{contact.email}</a>.
          </p>

          <h2>Alterações</h2>
          <p>
            Esta política pode ser atualizada. A versão vigente é sempre a
            publicada nesta página.
          </p>
        </div>
      </section>
    </>
  );
}
