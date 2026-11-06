import { useEffect, useRef, useState } from 'react';

/**
 * Barra de rolagem própria: um trilho fino dourado à direita, com uma marca por capítulo.
 * Arrastar o cursor rola a página; clicar numa marca vai ao capítulo.
 */
export default function Rail({ chapters }) {
  const rail = useRef(null), thumb = useRef(null), fill = useRef(null);
  const [marks, setMarks] = useState([]);

  useEffect(() => {
    const root = document.documentElement;
    const max = () => Math.max(1, root.scrollHeight - innerHeight);
    const measure = () => setMarks(chapters.map(([id, label]) => {
      const s = document.getElementById(id);
      return { id, label, at: s ? Math.min(1, (s.getBoundingClientRect().top + scrollY) / max()) : 0 };
    }));
    let raf = 0;
    const paint = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, scrollY / max()));
      const h = rail.current.clientHeight, th = Math.max(28, h * innerHeight / root.scrollHeight);
      thumb.current.style.height = `${th}px`;
      thumb.current.style.transform = `translateY(${p * (h - th)}px)`;
      fill.current.style.transform = `scaleY(${p})`;
      rail.current.style.setProperty('--p', p);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const onResize = () => { measure(); queue(); };
    measure(); paint();
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize); ro.observe(document.body);
    return () => { removeEventListener('scroll', queue); removeEventListener('resize', onResize); ro.disconnect(); cancelAnimationFrame(raf); };
  }, [chapters]);

  // arrastar: posição do ponteiro no trilho → posição na página
  useEffect(() => {
    const r = rail.current;
    let drag = null;
    const toY = e => {
      const b = r.getBoundingClientRect(), th = thumb.current.offsetHeight;
      const p = Math.min(1, Math.max(0, (e.clientY - b.top - drag.grab) / (b.height - th)));
      return p * (document.documentElement.scrollHeight - innerHeight);
    };
    const stopFilm = () => dispatchEvent(new WheelEvent('wheel'));   // o modo filme para quando a pessoa rola
    let moved = false;
    const down = e => {
      if (e.button !== 0) return;
      const tb = thumb.current.getBoundingClientRect();
      const onThumb = e.clientY >= tb.top - 4 && e.clientY <= tb.bottom + 4;
      if (!onThumb && e.target.closest('.rail-mark')) return;   // a marca leva ao capítulo
      e.preventDefault();
      stopFilm();
      moved = onThumb;
      drag = { grab: onThumb ? e.clientY - tb.top : tb.height / 2 };
      r.setPointerCapture(e.pointerId);
      r.classList.add('is-drag');
      scrollTo({ top: toY(e), behavior: onThumb ? 'instant' : 'smooth' });
    };
    const move = e => { if (drag) scrollTo({ top: toY(e), behavior: 'instant' }); };
    const up = () => { drag = null; r.classList.remove('is-drag'); };
    // depois de arrastar, o clique que sobra não pode seguir o link de uma marca
    const click = e => { if (moved) { e.preventDefault(); moved = false; } };
    r.addEventListener('click', click, true);
    r.addEventListener('pointerdown', down);
    r.addEventListener('pointermove', move);
    r.addEventListener('pointerup', up);
    r.addEventListener('pointercancel', up);
    return () => { r.removeEventListener('click', click, true); r.removeEventListener('pointerdown', down); r.removeEventListener('pointermove', move); r.removeEventListener('pointerup', up); r.removeEventListener('pointercancel', up); };
  }, []);

  return (
    <div className="rail" ref={rail} aria-hidden="true">
      <span className="rail-track" />
      <span className="rail-fill" ref={fill} />
      {marks.map(m => (
        <a key={m.id} className="rail-mark" href={`#${m.id}`} style={{ top: `${m.at * 100}%` }} tabIndex={-1}>
          <span>{m.label}</span>
        </a>
      ))}
      <span className="rail-thumb" ref={thumb} />
    </div>
  );
}
