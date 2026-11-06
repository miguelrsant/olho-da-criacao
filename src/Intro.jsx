import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { FRESCOS } from './frescos.js';

gsap.registerPlugin(ScrambleTextPlugin);

const CHARS = '.:-=+*#%@$&8B';

/** espera os afrescos (no máximo 5 s) e avisa o progresso de 0 a 1 */
function preload(onProgress) {
  const srcs = Object.values(FRESCOS).flatMap(f => [f.src, f.mask].filter(Boolean));
  let done = 0;
  const all = Promise.all(srcs.map(src => new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = () => { done++; onProgress(done / srcs.length); res(); };
    im.src = src;
  })));
  return Promise.race([all, new Promise(r => setTimeout(r, 5000))]);
}

/**
 * Entrada: o terminal "roda" o script, o título se decifra a partir das letras da escala,
 * a barra de carga vira uma fenda dourada e a tela se abre como pálpebras sobre o olho.
 * onOpen dispara no instante em que as pálpebras começam a abrir (é quando o olho deve nascer).
 */
export default function Intro({ onOpen, onDone }) {
  const root = useRef(null);
  useEffect(() => {
    const el = root.current, q = s => el.querySelector(s);
    const html = document.documentElement;
    html.classList.add('intro-on');
    let opened = false;
    const open = () => { if (!opened) { opened = true; onOpen(); } };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const fill = q('.intro-bar i');
    let target = 0;
    const loaded = preload(p => { target = p; });
    const bar = gsap.quickTo(fill, 'scaleX', { duration: .5, ease: 'power2.out' });
    const tick = () => bar(Math.max(target, .04));
    gsap.ticker.add(tick);

    const finish = () => {
      html.classList.remove('intro-on');
      gsap.ticker.remove(tick);
      onDone();
    };
    const reveal = gsap.timeline({ paused: true, onComplete: finish })
      .add(() => { gsap.ticker.remove(tick); open(); })   // o olho nasce já aqui, para estar abrindo quando a tela se abrir
      .to(fill, { scaleX: 1, duration: .25, ease: 'power1.out' })
      .to('.intro-core > *', { opacity: 0, y: -8, duration: .35, stagger: .04, ease: 'power2.in' }, '<')
      // a barra vira a fenda do olho
      .to(q('.intro-bar'), { width: '100vw', duration: .55, ease: 'expo.inOut' })
      .to(q('.intro-bar'), { opacity: 0, duration: .5 }, '+=.05')
      .to(q('.lid-top'), { yPercent: -100, duration: 1.25, ease: 'expo.inOut' }, '<')
      .to(q('.lid-bot'), { yPercent: 100, duration: 1.25, ease: 'expo.inOut' }, '<')
      .fromTo('.bar-top', { yPercent: -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .8, ease: 'power3.out' }, '-=.55')
      .fromTo('.bar-bottom', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .8, ease: 'power3.out' }, '<')
      .fromTo('.hero-copy > *', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1, stagger: .09, ease: 'power3.out' }, '<+.1')
      .fromTo('.rail', { opacity: 0 }, { opacity: 1, duration: .8 }, '<+.3')
      .set(['.bar-top', '.bar-bottom', '.hero-copy > *', '.rail'], { clearProps: 'transform,opacity' });

    if (reduced) {
      // movimento reduzido: só um esmaecer curto
      const t = gsap.timeline({ onComplete: finish });
      t.add(open).to(el, { opacity: 0, duration: .5, delay: .3 });
      return () => t.kill();
    }

    const intro = gsap.timeline()
      .to(q('.intro-cmd'), { duration: .9, scrambleText: { text: '$ python3 o_olho_da_criacao.py', chars: CHARS, speed: .6 }, ease: 'none' })
      .to(q('.intro-title'), { duration: 1.4, scrambleText: { text: 'O Olho da Criação', chars: CHARS, speed: .5, revealDelay: .3 }, ease: 'none' }, '-=.2')
      .fromTo(q('.intro-sub'), { opacity: 0, letterSpacing: '.6em' }, { opacity: 1, letterSpacing: '.32em', duration: 1.1, ease: 'power3.out' }, '-=.9')
      .fromTo(q('.intro-bar'), { opacity: 0 }, { opacity: 1, duration: .4 }, '<');
    // abre quando a apresentação termina E os afrescos chegaram
    Promise.all([loaded, new Promise(r => intro.eventCallback('onComplete', r))]).then(() => reveal.play());

    // clicar, tocar ou apertar uma tecla pula a entrada
    const skip = () => { intro.progress(1); reveal.timeScale(2.2).play(); };
    el.addEventListener('pointerdown', skip, { once: true });
    addEventListener('keydown', skip, { once: true });
    return () => { intro.kill(); reveal.kill(); gsap.ticker.remove(tick); removeEventListener('keydown', skip); };
  }, []);

  return (
    <div className="intro" ref={root} aria-hidden="true">
      <div className="lid lid-top" />
      <div className="lid lid-bot" />
      <div className="intro-core">
        <p className="intro-cmd">&nbsp;</p>
        <p className="intro-title">&nbsp;</p>
        <p className="intro-sub">Gênesis em texto vivo</p>
      </div>
      <div className="intro-bar"><i /></div>
      <p className="intro-skip">toque para pular</p>
    </div>
  );
}
