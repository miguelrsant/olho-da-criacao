import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { FRESCOS } from './frescos.js';

const RAMP = '.:-=+*#%@&$B8';
const TITLE = [['O Olho da ', false], ['Criação', true]];

/** espera os afrescos (no máximo 3 s) */
function preload() {
  const srcs = Object.values(FRESCOS).flatMap(f => [f.src, f.mask].filter(Boolean));
  const all = Promise.all(srcs.map(src => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = src; })));
  return Promise.race([all, new Promise(r => setTimeout(r, 3000))]);
}

/**
 * Entrada (cerca de 2,3 s): cada letra do título nasce de um caractere da escala de tinta e assenta,
 * um fio dourado se desenha embaixo, vira a fenda do olho e a tela se abre como pálpebras.
 * onOpen dispara quando a fenda se forma: é quando o olho começa a abrir por baixo.
 */
export default function Intro({ onOpen, onDone }) {
  const root = useRef(null);
  useEffect(() => {
    const el = root.current, q = s => el.querySelector(s);
    const html = document.documentElement;
    html.classList.add('intro-on');
    let opened = false;
    const open = () => { if (!opened) { opened = true; onOpen(); } };
    const finish = () => { html.classList.remove('intro-on'); onDone(); };
    const chars = [...el.querySelectorAll('.intro-title .ch')];

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(chars, { opacity: 1 });
      const t = gsap.timeline({ onComplete: finish }).add(open).to(el, { opacity: 0, duration: .5, delay: .4 });
      return () => t.kill();
    }

    // a letra passa por alguns caracteres da escala antes de virar ela mesma
    const settle = (span, i) => {
      const final = span.dataset.c;
      const o = { k: 0 };
      return gsap.timeline()
        .fromTo(span, { opacity: 0, yPercent: 35, filter: 'blur(10px)' }, { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: .55, ease: 'power3.out' })
        .to(o, { k: 1, duration: .32, ease: 'none', onUpdate: () => {
          span.textContent = o.k < 1 ? RAMP[(i * 3 + Math.floor(o.k * 7)) % RAMP.length] : final;
        } }, 0);
    };

    const tl = gsap.timeline({ paused: true, onComplete: finish });
    chars.forEach((s, i) => tl.add(settle(s, i), .04 + i * .035));
    tl.fromTo(q('.intro-line'), { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: .6, ease: 'expo.out' }, .25)
      .fromTo(q('.intro-sub'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .5, ease: 'power2.out' }, .45)
      // o título sobe e some; o fio corre até as bordas e vira a fenda
      .to([q('.intro-title'), q('.intro-sub')], { opacity: 0, y: -14, filter: 'blur(6px)', duration: .35, ease: 'power2.in' }, 1.25)
      .to(q('.intro-line'), { width: '100vw', duration: .45, ease: 'expo.inOut' }, 1.3)
      .add(open, 1.45)
      .to(q('.lid-top'), { yPercent: -100, duration: .95, ease: 'expo.inOut' }, 1.6)
      .to(q('.lid-bot'), { yPercent: 100, duration: .95, ease: 'expo.inOut' }, 1.6)
      .to(q('.intro-line'), { opacity: 0, duration: .4 }, 1.75)
      .fromTo('.bar-top', { yPercent: -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .7, ease: 'power3.out' }, 2)
      .fromTo('.bar-bottom', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .7, ease: 'power3.out' }, 2)
      .fromTo('.hero-copy > *', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: .8, stagger: .07, ease: 'power3.out' }, 2.05)
      .fromTo('.rail', { opacity: 0 }, { opacity: 1, duration: .6 }, 2.2)
      .set(['.bar-top', '.bar-bottom', '.hero-copy > *', '.rail'], { clearProps: 'transform,opacity' });
    gsap.set(chars, { opacity: 0 });
    gsap.set(q('.intro-line'), { xPercent: -50, yPercent: -50 });
    preload().then(() => tl.play());

    // clicar, tocar ou apertar uma tecla pula para a abertura das pálpebras
    const skip = () => { if (tl.time() < 1.25) tl.play(1.25); tl.timeScale(1.6); };
    el.addEventListener('pointerdown', skip, { once: true });
    addEventListener('keydown', skip, { once: true });
    return () => { tl.kill(); removeEventListener('keydown', skip); };
  }, []);

  let n = 0;
  return (
    <div className="intro" ref={root} aria-hidden="true">
      <div className="lid lid-top" />
      <div className="lid lid-bot" />
      <div className="intro-core">
        <p className="intro-title">
          {TITLE.map(([w, em]) => {
            const spans = [...w].map(c => <span key={n++} className="ch" data-c={c}>{c === ' ' ? ' ' : c}</span>);
            return em ? <em key={w}>{spans}</em> : spans;
          })}
        </p>
        <p className="intro-sub">Gênesis em texto vivo</p>
      </div>
      <div className="intro-line" />
    </div>
  );
}
