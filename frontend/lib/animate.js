// Small, dependency-free animation helpers. Presentation only -- nothing
// here computes or alters a real value, it only reveals already-computed
// numbers over time and triggers a CSS transition already defined in
// styles.css. No charting/animation library, per project discipline.

// Triggers the CSS transition already defined on .accuracy-bar-fill
// (transform: scaleX(0) -> scaleX(1)) for every bar in `container`. Two
// rAFs, not one: the first lets the browser commit the initial
// scaleX(0) paint before the second flips the class, which is what
// actually makes the transition run instead of jumping straight to the
// end state.
export function animateBarFills(container) {
  const bars = container.querySelectorAll('.accuracy-bar-fill');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bars.forEach((bar) => bar.classList.add('is-visible'));
    });
  });
}

// Animates the text content of every `[data-countup]` element inside
// `container` from 0 (or from its stated start) up to the real target
// value already encoded in its `data-countup` attribute, formatted with
// the formatter registered under `data-countup-kind` in `formatters`.
// The target value itself is never touched -- only how it's revealed.
export function animateCountUps(container, formatters, { duration = 600 } = {}) {
  container.querySelectorAll('[data-countup]').forEach((el) => {
    const target = parseFloat(el.dataset.countup);
    const kind = el.dataset.countupKind;
    const format = formatters[kind];
    if (Number.isNaN(target) || !format) return;

    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3; // ease-out cubic
      el.textContent = format(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = format(target); // guarantee the exact real value lands, not a rounding artifact
    }
    requestAnimationFrame(tick);
  });
}

// Triggers the CSS transition already defined on .compare-hero__arrow-path
// (stroke-dashoffset: 90 -> 0) -- same two-rAF pattern as animateBarFills,
// for the same reason: the browser needs to commit the initial
// dashoffset:90 paint before the class flip, or the transition never
// runs.
export function animateArrowDraw(container) {
  const paths = container.querySelectorAll('.compare-hero__arrow-path');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      paths.forEach((path) => path.classList.add('is-drawn'));
    });
  });
}
