# O Olho da Criação

Um olho feito de milhares de letras coloridas se abre no escuro. Role para entrar na pupila e atravessar o Gênesis nos afrescos de Michelangelo, redesenhados em letras: a Separação da Luz e das Trevas, a Criação de Adão, a Criação de Eva, o Pecado Original e a Expulsão do Paraíso.

Feito com React + Vite, WebGL2 e GSAP.

## Rodar

```
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run preview  # serve dist/
```

## Como está organizado

- `src/App.jsx`: a página em componentes (barras, capítulos, legendas, painel "Como é feito").
- `src/chapters.js`: legendas, versículos e a descrição de cada cena para leitores de tela.
- `src/engine.js`: o motor. A cena é desenhada numa grade e cada célula vira uma letra de um atlas ordenado por tinta, com a cor da cena. Roda uma vez, depois que o React monta a página, e procura os ids e atributos `data-*` de `App.jsx`.
- `src/frescos.js` e `src/assets/`: os afrescos já tratados e a máscara da serpente.
- `seo/`, `middleware.js` e `vercel.json`: SEO, páginas Sobre, Contato e Privacidade e o site em Markdown para agentes de IA (veja `seo/README.md`).

Parâmetros úteis na URL: `?t=12.8` fixa a posição da rolagem (em telas) e `?c=16` fixa o relógio; `?capture` é o modo de gravação quadro a quadro (`window.__site.renderFilm`).

Versículos na tradução de João Ferreira de Almeida. Afrescos do teto da Capela Sistina (1508–1512), em domínio público. Inspirado no script Python *Eye of Creation*.

Design e desenvolvimento: [Miguel Angelo](https://miguelrsant.com.br) · [Instagram @miguelrsant](https://www.instagram.com/miguelrsant/).
