import { useEffect, useRef, useState } from 'react';
import Intro from './Intro.jsx';
import Rail from './Rail.jsx';
import { CHAPTERS } from './chapters.js';
import { FRESCOS } from './frescos.js';
import { startSite } from './engine.js';
import logo from './assets/logo-miguelrsant.png';

const TABS = [
  ['olho', 'Olho'], ['pupila', 'Pupila'], ['verbo', 'Verbo'], ['criacao', 'Criação'], ['toque', 'Toque'], ['eva', 'Eva'],
  ['eden', 'Éden'], ['fruto', 'Fruto'], ['espada', 'Espada'], ['queda', 'Queda'], ['fim', 'Fim'],
];

function Win({ name }) {
  return <span className="win"><span className="dot" aria-hidden="true" />{name && <span className="name">{name}</span>}</span>;
}

function TopBar() {
  return (
    <header className="bar bar-top">
      <Win />
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
        <p className="lede">Os afrescos de Michelangelo, redesenhados com milhares de letras que se acendem a cada quadro.</p>
        <div className="hero-act">
          <button className="btn btn-film" type="button" data-film>Assistir como filme</button>
          <a className="cue" href="#pupila">Role para entrar na pupila<i aria-hidden="true" /></a>
        </div>
      </div>
      <p className="sr-only">Na tela, um olho desenhado com letras coloridas sobre um fundo preto se abre, olha para a esquerda, para a direita e volta ao centro. Só a íris se move.</p>
    </section>
  );
}

/** Créditos: aparecem no preto, depois que o olho se fecha (fim da rolagem e do modo filme). */
function Credits() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => el.classList.toggle('is-in', e.intersectionRatio > .35), { threshold: [0, .35, .7] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <footer className="credits" ref={ref}>
      <p className="credits-k">Desenvolvimento e design</p>
      <a className="credits-logo" href="https://miguelrsant.com.br" target="_blank" rel="noopener" aria-label="Miguel Angelo, miguelrsant.com.br (abre em nova aba)">
        <img src={logo} alt="" width="417" height="376" />
      </a>
      <p className="credits-name">Miguel Angelo</p>
      <a className="credits-url" href="https://miguelrsant.com.br" target="_blank" rel="noopener">miguelrsant.com.br</a>
      <a className="credits-again" href="#olho">Ver de novo</a>
    </footer>
  );
}

function Chapter({ ch }) {
  return (
    <section id={ch.id} className="ch" aria-label={ch.label}>
      <p className="sr-only">{ch.sr}</p>
      {ch.caps.map((c, i) => <Caption key={i} cap={c} />)}
      {ch.id === 'fim' && <Credits />}
    </section>
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
  // ?capture, ?t e ?c (gravação e testes) pulam a entrada
  const [intro, setIntro] = useState(() => !/[?&](capture|t|c)=?/.test(location.search));
  // o motor lê o DOM (seções, legendas, botões) e passa a cuidar do canvas e da rolagem;
  // com a entrada, ele nasce quando as pálpebras começam a abrir, e o olho se abre junto
  const boot = () => startSite(FRESCOS);
  useEffect(() => { if (!intro) boot(); }, []);
  return (
    <>
      {intro && <Intro onOpen={boot} onDone={() => setIntro(false)} />}
      <Rail chapters={TABS} />
      <div className="backdrop" aria-hidden="true" />
      <canvas id="stage" aria-hidden="true" />
      <TopBar />
      <main>
        <Hero />
        {CHAPTERS.map(ch => (
          <Chapter key={ch.id} ch={ch} />
        ))}
      </main>
      <BottomBar />
    </>
  );
}
