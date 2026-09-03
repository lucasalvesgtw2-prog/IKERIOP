'use client';

import { Fragment, useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type RevealProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  delay?: number;
  y?: number;
};

/**
 * Blendet einen Block beim Hineinscrollen auf.
 *
 * Der Ruhezustand ist sichtbar: erst wenn GSAP läuft und Bewegung erlaubt
 * ist, wird überhaupt etwas versteckt. Ohne JavaScript oder bei reduzierter
 * Bewegung steht der Inhalt sofort da.
 */
export function Reveal({ children, className, as: Component = 'div', delay = 0, y = 28 }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  // Ein polymorphes `as` lässt TypeScript die Props auf `never` kollabieren;
  // die Festlegung auf ein konkretes Element löst das ohne Laufzeitwirkung.
  const Tag = Component as 'div';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          delay,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        },
      );
    }, el);

    return () => ctx.revert();
  }, [delay, y]);

  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}

type SplitProps = {
  text: string;
  className?: string;
  as?: ElementType;
  /** Startet die Animation sofort statt beim Hineinscrollen (Hero). */
  immediate?: boolean;
  delay?: number;
};

/**
 * Überschrift, die Wort für Wort aus einer Maske nach oben fährt.
 * Die Wörter bleiben als echter Text im DOM — Vorlesesoftware und Suche
 * lesen den zusammenhängenden Satz.
 */
export function SplitHeading({
  text,
  className,
  as: Component = 'h2',
  immediate = false,
  delay = 0,
}: SplitProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = Component as 'h2';
  const words = text.split(' ');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const targets = el.querySelectorAll('[data-word]');

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { yPercent: 116 },
        {
          yPercent: 0,
          duration: 1.25,
          ease: 'expo.out',
          stagger: 0.055,
          delay,
          ...(immediate
            ? {}
            : { scrollTrigger: { trigger: el, start: 'top 86%', once: true } }),
        },
      );
    }, el);

    return () => ctx.revert();
  }, [delay, immediate, text]);

  return (
    <Tag ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <span data-word className="inline-block">
              {word}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  );
}
