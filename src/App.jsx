import { useEffect } from 'react';
import { CHAPTERS } from './chapters.js';
import { FRESCOS } from './frescos.js';
import { startSite } from './engine.js';

const TABS = [
  ['olho', 'Olho'], ['pupila', 'Pupila'], ['verbo', 'Verbo'], ['criacao', 'Criação'], ['toque', 'Toque'], ['eva', 'Eva'],
  ['eden', 'Éden'], ['fruto', 'Fruto'], ['espada', 'Espada'], ['queda', 'Queda'], ['fim', 'Fim'],
];
const RAMP = `.'\`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$`;

function Win({ name }) {
  return <span className="win"><span className="dot" aria-hidden="true" />{name && <span className="name">{name}</span>}</span>;
}

function TopBar() {
  return (
    <header className="bar bar-top">
      <Win name="o_olho_da_criacao.py" />
      <nav className="tabs" aria-label="Capítulos">
        {TABS.map(([id, label], i) => (
          <a key={id} href={`#${id}`} data-ch={id} aria-current={i === 0 ? 'step' : undefined}>{label}</a>
        ))}
      </nav>
    </header>
  );
}

/** Versículo que se decifra (GSAP ScrambleText); o texto lido em voz alta fica no aria-label. */
function Scramble({ text, long }) {
  return <h2 className={long ? 'long' : undefined} aria-label={text}><span aria-hidden="true" data-scramble>{text}</span></h2>;
}

function Caption({ cap }) {
  return (
    <div className={['cap', cap.cls].filter(Boolean).join(' ')} style={{ '--at': `${cap.at}svh` }}>
      <div className="txt">
        {cap.eyebrow && <p className="eyebrow">{cap.eyebrow}</p>}
        {cap.h2 ? <Scramble text={cap.h2} long={cap.long} /> : <p>{cap.p}</p>}
        {cap.cite && <span className="cite">{cap.cite}</span>}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="olho" className="ch" aria-labelledby="t-olho">
      <div className="hero-copy txt">
        <p className="eyebrow">Gênesis em texto vivo</p>
        <h1 id="t-olho">O Olho da <em>Criação</em></h1>
        <p className="lede">Cada ponto desta imagem é uma letra. O brilho escolhe a letra, a cor vem da cena, e tudo é redesenhado a cada quadro.</p>
        <div className="hero-act">
          <a className="cue" href="#pupila"><i aria-hidden="true" />Role para entrar na pupila</a>
          <button className="btn btn-film" type="button" data-film>Assistir como filme</button>
        </div>
      </div>
      <p className="sr-only">Na tela, um olho desenhado com letras coloridas sobre um fundo preto se abre, olha para a esquerda, para a direita e volta ao centro. Só a íris se move.</p>
    </section>
  );
}

function Chapter({ ch, children }) {
  return (
    <section id={ch.id} className="ch" aria-label={ch.label}>
      <p className="sr-only">{ch.sr}</p>
      {ch.caps.map((c, i) => <Caption key={i} cap={c} />)}
      {children}
    </section>
  );
}

function HowItsMade() {
  return (
    <div className="panel">
      <div className="panel-head"><Win />como_e_feito.txt</div>
      <div className="panel-body">
        <h2 id="t-fim">Como é feito</h2>
        <p>Cada cena é desenhada numa grade de <code data-grid>160 × 52</code> células. O brilho de cada célula escolhe uma entre <code data-rampn>56</code> letras, ordenadas pela quantidade de tinta que cada uma usa, e a letra ganha a cor da cena naquele ponto.</p>
        <span className="ramp" data-ramp role="img" aria-label="Escala de letras, da mais leve à mais densa">{RAMP}</span>
        <p>As pinturas são afrescos de Michelangelo no teto da Capela Sistina (1508–1512), em domínio público: <em data-list>A Criação de Adão, A Criação de Eva e O Pecado Original e a Expulsão do Paraíso</em>. O olho é desenhado por equações, direto no navegador. O corpo da serpente é escrito com as palavras dela (Gênesis 3:5) e a espada ganha fogo no fim.</p>
        <p>Versículos de Gênesis 1 a 3, João 1 e Provérbios 15, na tradução de João Ferreira de Almeida. Inspirado no script Python <em>Eye of Creation</em>. Feito com WebGL2 e GSAP.</p>
        <div className="row">
          <a className="btn" href="#olho">Voltar ao olho</a>
          <button className="btn" type="button" data-film>Assistir como filme</button>
          <button className="btn" type="button" data-pause>Pausar animação</button>
        </div>
      </div>
    </div>
  );
}

function BottomBar() {
  return (
    <footer className="bar bar-bottom">
      <span className="stat"><span id="st-zoom">zoom ×1.0</span><span id="st-grid">— letras</span><span id="st-fps" className="hide-sm">— fps</span></span>
      <span className="ctrls">
        <button className="btn" type="button" id="b-less" aria-label="Menos letras, células maiores">−</button>
        <span className="lbl hide-sm">densidade</span>
        <button className="btn" type="button" id="b-more" aria-label="Mais letras, células menores">+</button>
        <button className="btn" type="button" data-film data-short>Filme</button>
        <button className="btn" type="button" data-pause>Pausar</button>
      </span>
    </footer>
  );
}

export default function App() {
  // o motor lê o DOM (seções, legendas, botões) e passa a cuidar do canvas e da rolagem
  useEffect(() => { startSite(FRESCOS); }, []);
  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <canvas id="stage" aria-hidden="true" />
      <TopBar />
      <main>
        <Hero />
        {CHAPTERS.map(ch => (
          <Chapter key={ch.id} ch={ch}>{ch.id === 'fim' && <HowItsMade />}</Chapter>
        ))}
      </main>
      <BottomBar />
    </>
  );
}
