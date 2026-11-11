// Dados deste site para SEO e agentes de IA (seo/kit.mjs monta o resto). O texto da home sai dos capítulos do site.
import { CHAPTERS } from '../src/chapters.js';

const url = 'https://olho-da-criacao.vercel.app';

// Cada capítulo vira uma parte do texto: a descrição da cena e os versículos que aparecem na tela.
const capitulos = CHAPTERS.map((ch) => ({
  h: ch.label,
  sub: true,
  p: [ch.sr],
  quote: ch.caps.map((c) => ({ text: c.h2 ?? c.p, cite: c.cite })),
}));

export default {
  url,
  name: 'O Olho da Criação',
  article: '',
  kind: 'o Gênesis de Michelangelo em letras',
  title: 'O Olho da Criação · O Gênesis de Michelangelo em letras',
  description:
    'Um olho feito de milhares de letras se abre no escuro. Role para entrar na pupila e atravessar o Gênesis nos afrescos de Michelangelo, redesenhados em letras.',
  headline: 'O Gênesis de Michelangelo, redesenhado com milhares de letras',
  genre: 'Narrativa visual interativa',
  keywords: ['Michelangelo', 'Capela Sistina', 'A Criação de Adão', 'Gênesis', 'arte ASCII', 'arte em texto', 'WebGL', 'site interativo'],
  knowsAbout: ['WebGL2', 'GSAP', 'arte generativa'],
  ogImage: '/og.jpg',
  ogAlt: 'Um olho desenhado com letras coloridas sobre fundo preto, com o título O Olho da Criação',
  updated: '2026-11-11',
  repo: 'https://github.com/miguelrsant/olho-da-criacao',
  iconTags: '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
  theme: {
    bg: '#000000',
    text: '#ede6d6',
    muted: '#cbbfa6',
    accent: '#d9b450',
    line: 'rgba(217,180,80,.28)',
    display: '"Cormorant Garamond",Garamond,"Times New Roman",serif',
    body: '"Cormorant Garamond",Garamond,"Times New Roman",serif',
    mono: '"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace',
    h1Weight: 500,
    fontsHref: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@500&display=swap',
  },
  home: {
    h1: 'O Olho da Criação',
    lead: [
      'Gênesis em texto vivo. Os afrescos de Michelangelo, redesenhados com milhares de letras que se acendem a cada quadro.',
      'Na tela, um olho desenhado com letras coloridas sobre um fundo preto se abre, olha para a esquerda, para a direita e volta ao centro. Ao rolar a página, a câmera entra na pupila e atravessa cinco cenas do teto da Capela Sistina: a Separação da Luz e das Trevas, a Criação de Adão, a Criação de Eva, o Pecado Original e a Expulsão do Paraíso. Também dá para assistir a tudo como um filme, sem rolar.',
    ],
    sections: [
      { h: 'Os capítulos' },
      ...capitulos,
      {
        h: 'Como é feito',
        p: [
          'A cena é desenhada numa grade, e cada célula vira uma letra escolhida pela quantidade de tinta que ela tem, com a cor da cena. Tudo roda no navegador, em WebGL2, quadro a quadro.',
          'Os versículos estão na tradução de João Ferreira de Almeida. Os afrescos são do teto da Capela Sistina (1508 a 1512), em domínio público.',
        ],
      },
    ],
  },
  about: {
    description:
      'O Olho da Criação é um projeto de conceito de Miguel Angelo: o Gênesis nos afrescos de Michelangelo, redesenhados com milhares de letras, em WebGL2.',
    intro: [
      'O Olho da Criação é uma narrativa visual de uma página. Um olho feito de milhares de letras coloridas se abre no escuro; ao rolar, a câmera entra na pupila e atravessa o Gênesis nos afrescos de Michelangelo, redesenhados em letras.',
      'São onze capítulos, do olho que se abre ao olho que se fecha: a Separação da Luz e das Trevas, a Criação de Adão, o toque dos dedos, a Criação de Eva, o Pecado Original e a Expulsão do Paraíso, cada um com os seus versículos.',
    ],
    concept: [
      'Este site é um projeto de conceito: não é de uma empresa, de um museu nem de uma igreja. Ele foi criado para mostrar como fica uma história contada pela rolagem, com imagem feita só de texto e movimento.',
      'Os versículos estão na tradução de João Ferreira de Almeida e os afrescos, pintados entre 1508 e 1512, estão em domínio público. A ideia veio do script em Python Eye of Creation.',
    ],
    made: [
      'React e Vite, com um motor próprio em WebGL2: a cena é desenhada numa grade e cada célula vira uma letra de um atlas ordenado por quantidade de tinta.',
      'GSAP cuida da rolagem, do modo filme e dos versículos que se decifram.',
      'Cada cena tem uma descrição em texto para leitores de tela, e o site respeita a preferência por menos movimento.',
      'Dá para mudar a densidade das letras, pausar e assistir como um filme.',
    ],
  },
  contact: { when: ['Você quer um site com narrativa, imagem e movimento para a sua marca, exposição ou produto.'] },
  privacy: {
    description: 'O que O Olho da Criação coleta: nada além dos registros técnicos da hospedagem. O site não tem formulário, cadastro, cookies nem análise de audiência.',
    thirdParty: ['As fontes do site (Cormorant Garamond e JetBrains Mono) são carregadas do Google Fonts. Para entregar os arquivos, o Google recebe o endereço IP e o tipo de navegador de quem visita, conforme a política de privacidade dele.'],
  },
  notFound: { h1: 'Este olho não viu esta página.', lead: 'O endereço que você abriu não existe, ou mudou de lugar. O olho continua aberto logo ali.' },
  llms: {
    summary:
      'O Olho da Criação (The Eye of Creation) is a one-page interactive visual story, in Brazilian Portuguese: an eye made of thousands of coloured letters opens, and scrolling dives into the pupil and through the Book of Genesis in Michelangelo\'s Sistine Chapel frescoes, redrawn in text with WebGL2. It is a concept project designed and built by Miguel Angelo (miguelrsant.com.br).',
    whenHome: 'use when someone wants an example of ASCII or text-based art in the browser, a scroll-driven retelling of Genesis with Michelangelo\'s frescoes, or the verses and scene descriptions of each chapter.',
    whenAbout: 'use when someone asks who made O Olho da Criação or how it was built (React, WebGL2, GSAP).',
    whenContact: 'use when someone needs a developer and designer in Brazil to build a narrative, illustrated or animated website like this one.',
    home: 'the eleven chapters, with the description of each scene and its Bible verses.',
  },
};
