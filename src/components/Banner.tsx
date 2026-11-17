import { useCallback, useEffect, useRef, useState } from "react";

export type Slide = { src: string; alt: string; onClick: () => void };

/** Карусель-баннер: свайп (scroll-snap), автопрокрутка, кликабельные точки */
export function Banner({ slides }: { slides: Slide[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);

  const go = useCallback((i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (paused.current) return;
      const el = ref.current;
      if (!el) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      go((cur + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(t);
  }, [go, slides.length]);

  return (
    <section className="banner" aria-roledescription="карусель" aria-label="Возможности Clean Kitchen">
      <div
        className="banner-track"
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
        onPointerDown={() => { paused.current = true; }}
        onPointerUp={() => { window.setTimeout(() => { paused.current = false; }, 4000); }}
      >
        {slides.map((s, i) => (
          <button key={s.src} className="banner-slide" onClick={s.onClick} aria-label={s.alt} aria-hidden={i !== idx}>
            <img src={s.src} alt="" draggable={false} loading={i === 0 ? "eager" : "lazy"} />
          </button>
        ))}
      </div>
      <div className="banner-dots" role="tablist">
        {slides.map((s, i) => (
          <button key={s.src} role="tab" aria-selected={i === idx} aria-label={`Слайд ${i + 1}`} className={i === idx ? "on" : ""} onClick={() => go(i)} />
        ))}
      </div>
    </section>
  );
}
