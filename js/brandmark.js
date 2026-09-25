// Drives the header logo's hands from the visitor's local time: smooth-sweeping seconds hand,
// or a once-per-second tick when the user prefers reduced motion.
const svg = document.querySelector('.brandmark__dial');
if (svg) {
  const hands = {
    h: svg.querySelector('.brandmark__h'),
    m: svg.querySelector('.brandmark__m'),
    s: svg.querySelector('.brandmark__s'),
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const set = (el, deg) => el && el.setAttribute('transform', `rotate(${deg.toFixed(2)} 20 20)`);

  const draw = () => {
    const d = new Date();
    const ms = reduced.matches ? 0 : d.getMilliseconds();
    const s = d.getSeconds() + ms / 1000;
    const m = d.getMinutes() + s / 60;
    const h = (d.getHours() % 12) + m / 60;
    set(hands.s, s * 6);
    set(hands.m, m * 6);
    set(hands.h, h * 30);
  };

  let raf = 0, timer = 0;
  const loop = () => { draw(); raf = requestAnimationFrame(loop); };
  const start = () => {
    cancelAnimationFrame(raf); clearTimeout(timer);
    if (document.hidden) return;
    if (reduced.matches) {
      const tick = () => { draw(); timer = setTimeout(tick, 1000 - new Date().getMilliseconds()); };
      tick();
    } else loop();
  };
  document.addEventListener('visibilitychange', start);
  reduced.addEventListener?.('change', start);
  start();
}
