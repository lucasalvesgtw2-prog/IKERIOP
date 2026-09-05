/**
 * Inhalte der Produkt- und Equipmentseiten.
 *
 * Alles hier stammt aus dem Bestand von Data4U. Umformuliert und gekürzt —
 * aber inhaltlich nicht erweitert. Wo eine Funktion nicht belegt ist, steht
 * sie nicht drin, auch wenn sie naheliegend wäre.
 */

import type { FaqItem } from '@/components/Faq';

export type ProductContent = {
  /** Problemlage, aus der Sicht des Kunden. */
  problem: { title: string; text: string; points: string[] };
  /** Antwort darauf. */
  solution: { title: string; text: string };
  /** Ausführliche Funktionsliste. */
  capabilities: { title: string; text: string }[];
  /** Nutzen in einem Satz je Punkt. */
  benefits: { title: string; text: string }[];
  /** Wo es eingesetzt wird. */
  useCases: string[];
  faq: FaqItem[];
};

export const productContent: Record<string, ProductContent> = {
  /* ------------------------------------------------------------- Fit -- */
  'data4u-fit': {
    problem: {
      title: 'A academia cresce. O controle manual, não.',
      text: 'Recepção conferindo nome em lista, mensalidade em planilha, ficha de treino em papel e ninguém sabe ao certo quantas pessoas estão dentro do salão agora.',
      points: [
        'Fila na recepção em horário de pico',
        'Inadimplência descoberta tarde demais',
        'Ficha de treino desatualizada ou perdida',
        'Avaliação física guardada fora do sistema',
      ],
    },
    solution: {
      title: 'Um cadastro só, do primeiro contato à catraca.',
      text: 'O Data4U Fit reúne matrícula, cobrança, treino, avaliação física e controle de acesso na mesma base. O aluno entra por QR Code ou reconhecimento facial e a passagem já aparece na gestão.',
    },
    capabilities: [
      {
        title: 'Administrativo e financeiro',
        text: 'Mensalidades, nota fiscal eletrônica, cobrança recorrente e relatórios do movimento da academia.',
      },
      {
        title: 'Controle de acesso',
        text: 'Integração com catraca: entrada liberada por QR Code do aplicativo ou por identificação facial.',
      },
      {
        title: 'Treinos',
        text: 'Fichas de treino personalizadas, disponíveis no aplicativo, com banco de exercícios e vídeos demonstrativos.',
      },
      {
        title: 'Avaliação física',
        text: 'Módulo de avaliação física do aluno, com o histórico guardado no mesmo cadastro.',
      },
      {
        title: 'CRM',
        text: 'Acompanhamento de contatos e relacionamento com alunos e interessados.',
      },
      {
        title: 'Backup em nuvem',
        text: 'A base fica copiada fora da academia — o dado não depende do computador da recepção.',
      },
    ],
    benefits: [
      {
        title: 'Recepção livre',
        text: 'Quem está em dia entra sozinho. A equipe atende quem realmente precisa.',
      },
      {
        title: 'Cobrança previsível',
        text: 'Cobrança recorrente e nota fiscal saem do mesmo lugar em que o aluno é cadastrado.',
      },
      {
        title: 'Treino sempre à mão',
        text: 'A ficha vive no celular do aluno, com vídeo para conferir a execução.',
      },
      {
        title: 'Decisão com dado',
        text: 'Frequência, acessos e movimento financeiro saem em relatório, não em achismo.',
      },
    ],
    useCases: ['Academias', 'Clubes', 'Studios', 'Centros de treinamento'],
    faq: [
      {
        q: 'O aluno consegue entrar sem cartão?',
        a: 'Sim. O acesso pode ser feito pelo QR Code do aplicativo ou por identificação facial, além das formas tradicionais de identificação.',
      },
      {
        q: 'O sistema emite nota fiscal?',
        a: 'Sim. O módulo administrativo e financeiro contempla nota fiscal eletrônica e cobrança recorrente.',
      },
      {
        q: 'A ficha de treino fica disponível no celular?',
        a: 'Sim. As fichas de treino personalizadas ficam disponíveis pelo aplicativo, com banco de exercícios e vídeos demonstrativos.',
      },
      {
        q: 'Existe avaliação física dentro do sistema?',
        a: 'Sim. O Data4U Fit tem módulo de avaliação física do aluno, com o histórico no mesmo cadastro.',
      },
      {
        q: 'A catraca é integrada ao sistema?',
        a: 'Sim. O controle de acesso por catraca faz parte da solução: a liberação segue a regra cadastrada e a passagem é registrada.',
      },
      {
        q: 'Os dados ficam guardados fora da academia?',
        a: 'O sistema contempla backup em nuvem, além da base local.',
      },
    ],
  },

  /* ---------------------------------------------------------- Access -- */
  'data4u-access': {
    problem: {
      title: 'Quem está dentro da empresa agora?',
      text: 'Sem um controle único, visitante entra sem registro, área restrita fica acessível a quem não deveria e o estacionamento vira improviso.',
      points: [
        'Pessoas não autorizadas em áreas restritas',
        'Visitantes sem registro nem hora de saída',
        'Vagas de estacionamento sem controle',
        'Nenhum relatório para embasar decisão',
      ],
    },
    solution: {
      title: 'Segurança de acesso e gestão no mesmo software.',
      text: 'O Data4U Access controla quem entra, onde pode entrar e por quanto tempo permanece — e transforma cada registro em relatório de indicadores para a administração.',
    },
    capabilities: [
      {
        title: 'Controle de acesso de pessoas',
        text: 'Impede que pessoas não autorizadas acessem áreas restritas da empresa.',
      },
      {
        title: 'Gestão de visitantes',
        text: 'Registro de acesso, agendamento de visitas e controle do tempo de permanência de visitantes e funcionários.',
      },
      {
        title: 'Biometria de alto desempenho',
        text: 'Acesso por impressão digital, além de cartões de acesso e demais formas de identificação.',
      },
      {
        title: 'Botão de pânico',
        text: 'Dispara alerta por e-mail ou SMS aos responsáveis pela segurança.',
      },
      {
        title: 'Estacionamento e lotação',
        text: 'Controle de vagas e monitoramento do acesso de visitantes, para gerir melhor veículos e pessoas.',
      },
      {
        title: 'Relatórios de indicadores',
        text: 'Administração por departamentos e relatórios de análise que apoiam o planejamento de segurança, administrativo e financeiro.',
      },
    ],
    benefits: [
      {
        title: 'Área restrita é restrita',
        text: 'A regra de acesso vale para todo mundo, sem exceção combinada na portaria.',
      },
      {
        title: 'Visita com hora marcada',
        text: 'Agendamento, registro de entrada e controle de permanência no mesmo fluxo.',
      },
      {
        title: 'Estacionamento sob controle',
        text: 'Vagas e circulação de veículos deixam de ser resolvidas no olho.',
      },
      {
        title: 'Planejamento com base em dado',
        text: 'Os indicadores de acesso sustentam decisões de segurança e de operação.',
      },
    ],
    useCases: ['Empresas', 'Indústrias', 'Instituições', 'Órgãos públicos'],
    faq: [
      {
        q: 'O Data4U Access funciona com diferentes equipamentos?',
        a: 'Sim. O sistema opera com catracas, leitores biométricos, leitores de cartão e controladoras de acesso, conforme a estrutura de cada local.',
      },
      {
        q: 'É possível controlar visitantes?',
        a: 'Sim. O sistema faz o cadastro e o registro de acesso de visitantes, permite agendar visitas e controla o tempo de permanência na empresa.',
      },
      {
        q: 'Existe controle de vagas de estacionamento?',
        a: 'Sim. O Data4U Access controla vagas de estacionamento e monitora o acesso de visitantes, permitindo gerir veículos e pessoas.',
      },
      {
        q: 'É possível acompanhar os acessos remotamente?',
        a: 'Sim. Os acessos ficam registrados no sistema e podem ser acompanhados pelos operadores autorizados, com relatórios de indicadores.',
      },
      {
        q: 'Existe biometria?',
        a: 'Sim. O acesso por impressão digital é uma das formas de identificação previstas, ao lado de cartões, tags e reconhecimento facial.',
      },
      {
        q: 'O sistema avisa em caso de emergência?',
        a: 'O sistema conta com botão de pânico, que envia alerta por e-mail ou SMS aos responsáveis pela segurança.',
      },
    ],
  },

  /* ----------------------------------------------------- Condominium -- */
  'data4u-condominium': {
    problem: {
      title: 'A portaria guarda tudo. Menos o registro.',
      text: 'Caderno na guarita, visitante anotado à mão, veículo sem vínculo com o morador e aviso importante que ninguém leu no mural.',
      points: [
        'Entrada de visitante sem registro confiável',
        'Veículos sem vínculo com a unidade',
        'Prestadores de serviço sem controle de permanência',
        'Comunicação com o morador presa ao mural',
      ],
    },
    solution: {
      title: 'Segurança, organização e comunicação em um sistema só.',
      text: 'O Data4U Condominium controla o acesso de moradores, visitantes, funcionários, fornecedores e veículos — e associa cada morador aos seus dependentes e aos veículos que utiliza.',
    },
    capabilities: [
      {
        title: 'Moradores e dependentes',
        text: 'Cadastro que associa o morador aos dependentes e aos veículos utilizados por eles.',
      },
      {
        title: 'Visitantes e fornecedores',
        text: 'Registro de entrada e saída de visitantes, funcionários e prestadores de serviço.',
      },
      {
        title: 'Entrada e saída de veículos',
        text: 'Controle da circulação de veículos no condomínio, vinculada à unidade responsável.',
      },
      {
        title: 'Integração com a portaria',
        text: 'Integração com portões, catracas, leitores biométricos e leitores de proximidade.',
      },
      {
        title: 'Avisos automáticos',
        text: 'Mensageria automatizada e personalizável por e-mail e SMS, com alertas e informações aos moradores.',
      },
      {
        title: 'Privacidade por nível de acesso',
        text: 'A visibilidade dos dados fica restrita aos operadores conforme o nível de acesso de cada usuário.',
      },
    ],
    benefits: [
      {
        title: 'Portaria com registro',
        text: 'Toda entrada fica documentada — sem depender da memória de quem estava de plantão.',
      },
      {
        title: 'Morador informado',
        text: 'Avisos saem por SMS e e-mail, no momento em que acontecem.',
      },
      {
        title: 'Veículo ligado à unidade',
        text: 'Cada carro tem dono conhecido dentro do sistema.',
      },
      {
        title: 'Dado protegido',
        text: 'Cada operador vê apenas o que o seu nível de acesso permite.',
      },
    ],
    useCases: ['Condomínios residenciais', 'Condomínios comerciais', 'Centros empresariais'],
    faq: [
      {
        q: 'O sistema controla a entrada de veículos?',
        a: 'Sim. O Data4U Condominium controla a entrada e a saída de veículos e associa cada veículo ao morador responsável.',
      },
      {
        q: 'Dá para integrar com o portão e a catraca que já existem?',
        a: 'O sistema prevê integração com portões, catracas, leitores biométricos e leitores de proximidade.',
      },
      {
        q: 'Como o morador é avisado?',
        a: 'Por mensageria automatizada e personalizável: alertas e informações são enviados por e-mail e SMS.',
      },
      {
        q: 'Quem pode ver os dados dos moradores?',
        a: 'A visibilidade é restrita aos operadores do sistema, conforme o nível de acesso definido para cada usuário.',
      },
      {
        q: 'Serve para condomínio comercial?',
        a: 'Sim. A solução é indicada para condomínios residenciais e comerciais.',
      },
    ],
  },

  /* ---------------------------------------------------------- School -- */
  'data4u-school': {
    problem: {
      title: 'O aluno chegou. Alguém precisa saber.',
      text: 'Entrada e saída anotadas no papel, responsável sem informação e nenhum registro confiável de quem estava na escola em cada horário.',
      points: [
        'Entrada e saída sem registro eletrônico',
        'Responsável sem aviso do horário do aluno',
        'Controle de funcionários em outro sistema',
        'Nenhum histórico para consultar depois',
      ],
    },
    solution: {
      title: 'Registro na porta, aviso no celular do responsável.',
      text: 'O Data4U School controla a entrada e a saída de alunos e funcionários e envia SMS aos pais de alunos menores de idade, informando os horários registrados.',
    },
    capabilities: [
      {
        title: 'Entrada e saída de alunos',
        text: 'Registro eletrônico de cada passagem, com identificação por cartão, tag ou biometria.',
      },
      {
        title: 'Controle de funcionários',
        text: 'O mesmo sistema registra a movimentação da equipe da escola.',
      },
      {
        title: 'Aviso aos responsáveis',
        text: 'Envio de SMS aos pais de alunos menores de idade, informando os horários de entrada e de saída.',
      },
      {
        title: 'Alertas',
        text: 'O software emite SMS e alertas para que pais ou responsáveis acompanhem a movimentação do aluno.',
      },
      {
        title: 'Integração escolar',
        text: 'Possibilidade de integração com outros sistemas já utilizados pela instituição.',
      },
      {
        title: 'Histórico consultável',
        text: 'Os registros ficam guardados e podem ser consultados quando necessário.',
      },
    ],
    benefits: [
      {
        title: 'Tranquilidade para a família',
        text: 'O responsável recebe o horário no celular, sem precisar ligar para a secretaria.',
      },
      {
        title: 'Portaria organizada',
        text: 'A identificação acontece na catraca ou no leitor, não na conversa.',
      },
      {
        title: 'Um sistema para toda a escola',
        text: 'Alunos e funcionários no mesmo controle de acesso.',
      },
      {
        title: 'Registro para consultar',
        text: 'O histórico de entradas e saídas fica disponível para a coordenação.',
      },
    ],
    useCases: ['Escolas', 'Cursos', 'Faculdades', 'Instituições de ensino'],
    faq: [
      {
        q: 'Os pais são avisados quando o aluno entra?',
        a: 'Sim. O sistema envia SMS aos pais de alunos menores de idade informando, por exemplo, o horário de entrada e de saída.',
      },
      {
        q: 'Como o aluno é identificado?',
        a: 'A identificação pode ser feita por cartão, tag ou biometria, conforme o equipamento instalado.',
      },
      {
        q: 'O sistema também registra funcionários?',
        a: 'Sim. O Data4U School controla a entrada e a saída de alunos e de funcionários.',
      },
      {
        q: 'É possível integrar com o sistema que a escola já usa?',
        a: 'Sim. Existe a possibilidade de integração com outros sistemas escolares.',
      },
    ],
  },
};

/* ---------------------------------------------------------------------
   FAQ der Equipmentseiten
--------------------------------------------------------------------- */

export const hardwareFaq: Record<string, FaqItem[]> = {
  catracas: [
    {
      q: 'Onde a catraca pode ser instalada?',
      a: 'Em clubes, escolas, academias, indústrias ou qualquer aplicação em que se deseje controlar o acesso de pessoas com precisão e segurança.',
    },
    {
      q: 'Quais formas de identificação a catraca aceita?',
      a: 'Estão disponíveis diversas opções de identificação: cartões, tags ou biometria.',
    },
    {
      q: 'A catraca funciona junto com o sistema de gestão?',
      a: 'Sim. A catraca é o ponto de execução da regra cadastrada no sistema Data4U: ela libera ou bloqueia e devolve o registro da passagem.',
    },
    {
      q: 'Do que é feito o mecanismo?',
      a: 'O mecanismo trabalha com braços em tubo de aço inox.',
    },
  ],
  'leitores-digitais': [
    {
      q: 'Por que usar biometria em vez de cartão?',
      a: 'A biometria usa uma parte do corpo como senha pessoal. Comparada ao cartão, tem custo baixo e um grau de segurança mais alto, porque a credencial não é esquecida nem emprestada.',
    },
    {
      q: 'O leitor pode ser usado junto com cartão?',
      a: 'Sim. As formas de identificação convivem: o mesmo controle de acesso pode aceitar biometria, cartão e tag.',
    },
    {
      q: 'O acesso por digital fica registrado?',
      a: 'Sim. Cada leitura autorizada gera um registro no sistema de gestão.',
    },
  ],
  controladoras: [
    {
      q: 'Como a controladora se conecta à rede?',
      a: 'Com integração total em rede pelo protocolo TCP/IP, oferecendo ao usuário controle centralizado com segurança e comodidade.',
    },
    {
      q: 'O que a controladora comanda?',
      a: 'Portas, cancelas, fechaduras e demais pontos de acesso ligados ao sistema.',
    },
    {
      q: 'Serve para locais com vários pontos de acesso?',
      a: 'Sim. É justamente o caso em que o controle centralizado em rede faz mais diferença.',
    },
  ],
  'relogios-de-ponto': [
    {
      q: 'O equipamento atende à legislação?',
      a: 'O relógio de ponto eletrônico foi desenvolvido para atender às normas da Portaria 1510 do Ministério do Trabalho e Emprego.',
    },
    {
      q: 'Como o funcionário registra o ponto?',
      a: 'Por biometria ou cartão, conforme a configuração escolhida para o equipamento.',
    },
    {
      q: 'O registro de ponto conversa com o controle de acesso?',
      a: 'Sim. Ponto e acesso podem operar sobre a mesma estrutura de identificação da Data4U.',
    },
  ],
};

/* ---------------------------------------------------------------------
   FAQ der Supportseite — nur aus den belegten Supportwegen abgeleitet
--------------------------------------------------------------------- */

export const supportFaq: FaqItem[] = [
  {
    q: 'Como abro um chamado de suporte?',
    a: 'Pelo telefone ou pelo e-mail da Data4U. O atendimento é organizado por sistema de chamados: cada solicitação recebe um registro e pode ser acompanhada até a solução.',
  },
  {
    q: 'O suporte consegue acessar o sistema remotamente?',
    a: 'Sim. O atendimento remoto é feito com o TeamViewer instalado no computador do cliente.',
  },
  {
    q: 'Vocês fazem visita técnica?',
    a: 'Visitas técnicas são realizadas em Brasília e entorno. As demais cidades são atendidas por telefone e acesso remoto.',
  },
  {
    q: 'O suporte atende também o equipamento?',
    a: 'A Data4U trabalha com software e equipamento — catracas, leitores biométricos, controladoras e relógios de ponto —, de modo que o atendimento cobre a solução instalada como um todo.',
  },
  {
    q: 'Sou cliente novo. Por onde começo?',
    a: 'Use a página Fale conosco descrevendo a sua operação. Para dúvidas sobre um sistema já instalado, o caminho mais rápido é o telefone.',
  },
];
