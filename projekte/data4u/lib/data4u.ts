/**
 * Einzige Quelle für alle Geschäftsdaten der Data4U Technology.
 *
 * Grundregel für diese Datei: hier steht nur, was von Data4U selbst belegt ist.
 * Keine erfundenen Kundenzahlen, keine erfundenen Prozentwerte, keine
 * erfundenen Zertifizierungen, keine erfundenen Preise. Wo eine Angabe fehlt,
 * steht `null` — die Komponenten blenden den betroffenen Baustein dann aus,
 * statt ihn mit Platzhaltern zu füllen.
 */

export const company = {
  name: 'Data4U',
  fullName: 'Data4U Technology',
  legalName: 'Data4U Technology International Ltda',
  tagline: 'Sistemas de gestão e controle de acesso',
  /** Gegründet als PolySoft Informática. */
  foundedAs: { year: 1988, name: 'PolySoft Informática' },
  /** Umbenennung in Data4U Technology. */
  renamedTo: { year: 1996, name: 'Data4U Technology' },
  website: 'https://www.data4u.com.br',
} as const;

export const contact = {
  phone: '+55 (61) 3045-4777',
  phoneHref: 'tel:+556130454777',
  email: 'contato@data4u.com.br',
  address: {
    street: 'SCN Quadra 1, Bloco E, Sala 710',
    building: 'Ed. Central Park',
    district: 'Asa Norte',
    city: 'Brasília',
    state: 'DF',
    zip: '70711-903',
    country: 'BR',
  },
  /**
   * WhatsApp-Nummer ist auf data4u.com.br nicht öffentlich ausgewiesen.
   * Sobald die offizielle Nummer vorliegt, hier im Format `5561999999999`
   * eintragen — der schwebende Kontakt-Button und alle WhatsApp-CTAs
   * erscheinen dann automatisch. Bis dahin bleiben Telefon und E-Mail
   * die aktiven Kanäle.
   */
  whatsapp: null as string | null,
} as const;

export const addressLines = [
  contact.address.street,
  contact.address.building,
  `${contact.address.district} — ${contact.address.city}/${contact.address.state}`,
  `CEP ${contact.address.zip}`,
];

export const whatsappHref = contact.whatsapp
  ? `https://wa.me/${contact.whatsapp}`
  : null;

/* -------------------------------------------------------------------------
   Navigation
------------------------------------------------------------------------- */

export type NavChild = { label: string; href: string; hint: string };
export type NavItem = { label: string; href: string; children?: NavChild[] };

export const nav: NavItem[] = [
  {
    label: 'Produtos',
    href: '/#solucoes',
    children: [
      {
        label: 'Data4U Fit',
        href: '/data4u-fit',
        hint: 'Gestão e acesso para academias, clubes e studios',
      },
      {
        label: 'Data4U Access',
        href: '/data4u-access',
        hint: 'Controle de acesso e gestão para empresas',
      },
      {
        label: 'Data4U Condominium',
        href: '/data4u-condominium',
        hint: 'Segurança e portaria para condomínios',
      },
      {
        label: 'Data4U School',
        href: '/data4u-school',
        hint: 'Entrada e saída de alunos com aviso aos responsáveis',
      },
    ],
  },
  /* Bewusst ohne Untermenü: die Segmente führen auf dieselben vier Seiten wie
     „Produtos". Ein zweites Klappmenü mit denselben Zielen wäre nur doppelt —
     der Punkt führt deshalb direkt auf die Übersicht. */
  { label: 'Soluções', href: '/#solucoes' },
  {
    label: 'Equipamentos',
    href: '/equipamentos',
    children: [
      { label: 'Catracas', href: '/catracas', hint: 'Acesso controlado por giro' },
      { label: 'Leitores de digital', href: '/leitores-digitais', hint: 'Identificação biométrica' },
      { label: 'Controladoras', href: '/controladoras', hint: 'Portas, cancelas e fechaduras' },
      { label: 'Relógios de ponto', href: '/relogios-de-ponto', hint: 'Registro eletrônico de jornada' },
    ],
  },
  { label: 'Empresa', href: '/sobre-nos' },
  { label: 'Suporte', href: '/suporte' },
];

/* -------------------------------------------------------------------------
   Segmente / Trust-Bar
------------------------------------------------------------------------- */

export const segments = [
  { label: 'Academias', icon: 'dumbbell' },
  { label: 'Empresas', icon: 'building2' },
  { label: 'Condomínios', icon: 'home' },
  { label: 'Escolas', icon: 'graduation' },
  { label: 'Instituições', icon: 'landmark' },
] as const;

/* -------------------------------------------------------------------------
   Software-Lösungen
------------------------------------------------------------------------- */

export type Solution = {
  slug: string;
  name: string;
  href: string;
  eyebrow: string;
  short: string;
  /** Headline der Produktseite. */
  headline: string;
  /** Absatz unter der Headline auf der Produktseite. */
  intro: string;
  highlights: string[];
  cta: string;
  /** Welches Mockup die Produktseite zeigt. */
  visual: 'dashboard' | 'terminal' | 'gate' | 'roster';
  accent: 'blue' | 'cyan' | 'violet' | 'teal';
};

export const solutions: Solution[] = [
  {
    slug: 'data4u-fit',
    name: 'Data4U Fit',
    href: '/data4u-fit',
    eyebrow: 'Academias · Clubes · Studios',
    short:
      'Sistema de gestão e controle de acesso para academias, clubes e studios — do financeiro ao treino no celular do aluno.',
    headline: 'Gestão inteligente para academias.',
    intro:
      'Matrícula, cobrança, treino, avaliação física e catraca no mesmo sistema. O aluno entra por QR Code ou reconhecimento facial e acompanha o próprio treino pelo aplicativo.',
    highlights: [
      'Administrativo e financeiro',
      'Avaliação física',
      'Treinos',
      'App Mobile',
      'Reconhecimento facial',
      'CRM',
    ],
    cta: 'Conhecer o Data4U Fit',
    visual: 'dashboard',
    accent: 'blue',
  },
  {
    slug: 'data4u-access',
    name: 'Data4U Access',
    href: '/data4u-access',
    eyebrow: 'Empresas · Indústrias · Instituições',
    short:
      'Software robusto que une segurança de acesso e gestão empresarial — de visitantes e biometria a relatórios de indicadores.',
    headline: 'Controle o acesso da sua empresa com mais segurança e menos atrito.',
    intro:
      'O Data4U Access impede que pessoas não autorizadas cheguem a áreas restritas, organiza a entrada de visitantes e transforma cada registro de acesso em informação para a gestão.',
    highlights: [
      'Controle de visitantes',
      'Biometria',
      'Cartões e tags',
      'Monitoramento',
      'Controle de lotação',
      'Relatórios de indicadores',
    ],
    cta: 'Conhecer o Data4U Access',
    visual: 'terminal',
    accent: 'cyan',
  },
  {
    slug: 'data4u-condominium',
    name: 'Data4U Condominium',
    href: '/data4u-condominium',
    eyebrow: 'Condomínios residenciais e comerciais',
    short:
      'Portaria organizada: moradores, visitantes, prestadores e veículos em um único cadastro, com aviso automático por SMS e e-mail.',
    headline: 'A portaria do condomínio, organizada em um só lugar.',
    intro:
      'Moradores, dependentes, visitantes, funcionários, fornecedores e veículos ficam associados no mesmo cadastro. A comunicação com os moradores sai do papel e passa a ser automática.',
    highlights: [
      'Moradores e dependentes',
      'Visitantes e fornecedores',
      'Entrada e saída de veículos',
      'Funcionários',
      'Avisos por SMS e e-mail',
      'Backup em nuvem',
    ],
    cta: 'Conhecer a solução',
    visual: 'gate',
    accent: 'teal',
  },
  {
    slug: 'data4u-school',
    name: 'Data4U School',
    href: '/data4u-school',
    eyebrow: 'Escolas · Cursos · Faculdades',
    short:
      'Controle de entrada e saída de alunos e funcionários, com aviso aos pais e responsáveis por SMS.',
    headline: 'Os pais sabem que o aluno chegou. No mesmo minuto.',
    intro:
      'O Data4U School registra a entrada e a saída de alunos e funcionários e envia SMS aos pais de alunos menores de idade — informando, por exemplo, o horário de entrada e de saída dos filhos.',
    highlights: [
      'Entrada e saída',
      'Alunos',
      'Funcionários',
      'Alertas por SMS',
      'Comunicação com responsáveis',
      'Integração com outros sistemas escolares',
    ],
    cta: 'Conhecer a solução',
    visual: 'roster',
    accent: 'violet',
  },
];

export const solutionBySlug = (slug: string) =>
  solutions.find((s) => s.slug === slug)!;

/* -------------------------------------------------------------------------
   Hardware
------------------------------------------------------------------------- */

export type Hardware = {
  slug: string;
  name: string;
  href: string;
  eyebrow: string;
  short: string;
  headline: string;
  intro: string;
  features: string[];
  cta: string;
  art: 'turnstile' | 'reader' | 'controller' | 'clock';
};

export const hardware: Hardware[] = [
  {
    slug: 'catracas',
    name: 'Catracas',
    href: '/catracas',
    eyebrow: 'Acesso controlado por giro',
    short:
      'Equipamento completo para controle de acesso informatizado em clubes, escolas, academias e indústrias.',
    headline: 'Catracas para controlar o acesso com precisão.',
    intro:
      'A catraca é o ponto em que a regra do sistema vira acesso liberado ou bloqueado. Pode ser usada em clubes, escolas, academias, indústrias ou qualquer aplicação em que se deseje controlar a entrada de pessoas com precisão e segurança.',
    features: [
      'Identificação por cartão, tag ou biometria',
      'Mecanismo com braços em tubo de aço inox',
      'Integração direta com os sistemas Data4U',
      'Uso em clubes, escolas, academias e indústrias',
    ],
    cta: 'Solicitar orçamento',
    art: 'turnstile',
  },
  {
    slug: 'leitores-digitais',
    name: 'Leitores de digital',
    href: '/leitores-digitais',
    eyebrow: 'Identificação biométrica',
    short:
      'Biometria usa uma parte do corpo como senha pessoal: baixo custo e grau de segurança mais alto que cartões.',
    headline: 'A senha que ninguém empresta.',
    intro:
      'Biometria é a técnica que usa partes do corpo como senha pessoal. Comparada a cartões e tags, tem custo baixo e um grau de segurança mais alto — a credencial não é esquecida em casa nem emprestada a um colega.',
    features: [
      'Leitura de impressão digital de alto desempenho',
      'Dispensa cartões, tags e senhas digitadas',
      'Integração com catracas, portas e cancelas',
      'Registro de cada acesso no sistema de gestão',
    ],
    cta: 'Solicitar orçamento',
    art: 'reader',
  },
  {
    slug: 'controladoras',
    name: 'Controladoras',
    href: '/controladoras',
    eyebrow: 'Portas, cancelas e fechaduras',
    short:
      'Integração total em rede por protocolo TCP/IP, com controle centralizado de portas, cancelas e fechaduras.',
    headline: 'O cérebro do controle de acesso.',
    intro:
      'A controladora conecta leitores, fechaduras, cancelas e catracas ao sistema. Com integração total em rede pelo protocolo TCP/IP, o usuário passa a ter controle centralizado — com segurança e comodidade.',
    features: [
      'Integração total em rede por protocolo TCP/IP',
      'Controle centralizado de portas, cancelas e fechaduras',
      'Comunicação direta com os sistemas Data4U',
      'Instalação em ambientes com vários pontos de acesso',
    ],
    cta: 'Solicitar orçamento',
    art: 'controller',
  },
  {
    slug: 'relogios-de-ponto',
    name: 'Relógios de ponto',
    href: '/relogios-de-ponto',
    eyebrow: 'Registro eletrônico de jornada',
    short:
      'Equipamento de registro eletrônico de ponto desenvolvido para atender às normas da Portaria 1510 do MTE.',
    headline: 'Registro de ponto dentro da norma.',
    intro:
      'O relógio de ponto eletrônico foi desenvolvido para atender às normas da Portaria 1510 do Ministério do Trabalho e Emprego. O registro da jornada fica íntegro e disponível para conferência.',
    features: [
      'Desenvolvido conforme a Portaria 1510 do MTE',
      'Registro eletrônico da jornada de trabalho',
      'Identificação por biometria ou cartão',
      'Integração com a gestão de pessoas',
    ],
    cta: 'Solicitar orçamento',
    art: 'clock',
  },
];

export const hardwareBySlug = (slug: string) =>
  hardware.find((h) => h.slug === slug)!;

/* -------------------------------------------------------------------------
   Ablauf „Como funciona"
------------------------------------------------------------------------- */

export const flowSteps = [
  {
    n: '01',
    title: 'Identificação',
    text: 'A pessoa se identifica por reconhecimento facial, digital, cartão, tag ou QR Code.',
  },
  {
    n: '02',
    title: 'Validação',
    text: 'O sistema confere a regra de acesso: quem é, onde pode entrar, em que dia e em que horário.',
  },
  {
    n: '03',
    title: 'Acesso',
    text: 'A catraca, a porta ou a cancela libera — ou bloqueia — e o equipamento registra o evento.',
  },
  {
    n: '04',
    title: 'Gestão e relatórios',
    text: 'Cada registro alimenta os relatórios de indicadores que sustentam a decisão administrativa.',
  },
] as const;

/* -------------------------------------------------------------------------
   Qualitative Kennzeichen — bewusst ohne erfundene Zahlen
------------------------------------------------------------------------- */

export const trustMarkers = [
  {
    title: 'Décadas de experiência',
    text: `Software de gestão e controle de acesso desde ${company.foundedAs.year}.`,
  },
  {
    title: 'Software + hardware',
    text: 'O sistema e o equipamento vêm do mesmo fornecedor e conversam entre si.',
  },
  {
    title: 'Soluções integradas',
    text: 'Acesso, gestão, cobrança e comunicação em uma única base de dados.',
  },
  {
    title: 'Atendimento especializado',
    text: 'Suporte por chamado, acesso remoto e visita técnica em Brasília e entorno.',
  },
] as const;

/* -------------------------------------------------------------------------
   Kontaktformular — Interessen
------------------------------------------------------------------------- */

export const interests = [
  'Equipamentos para acesso',
  'Catracas biométricas',
  'Data4U Fit',
  'Data4U Access',
  'Data4U Condominium',
  'Data4U School',
  'Suporte técnico',
] as const;

/* -------------------------------------------------------------------------
   Support
------------------------------------------------------------------------- */

export const supportChannels = [
  {
    title: 'Chamado de suporte',
    text: 'O atendimento é organizado por sistema de chamados: cada solicitação recebe um registro e pode ser acompanhada até a solução.',
    icon: 'ticket',
  },
  {
    title: 'Acesso remoto',
    text: 'O suporte pode ser feito por acesso remoto, com o TeamViewer instalado no computador do cliente.',
    icon: 'monitor',
  },
  {
    title: 'Visita técnica',
    text: 'Visitas técnicas são realizadas em Brasília e entorno. Demais cidades são atendidas por telefone e acesso remoto.',
    icon: 'wrench',
  },
] as const;
