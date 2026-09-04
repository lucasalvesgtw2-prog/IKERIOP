import type { ReactNode } from 'react';
import { revealDelay } from '@/lib/motion';

export function SectionHeader({
  eyebrow,
  title,
  lead,
  align = 'left',
  as: Heading = 'h2',
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2' | 'h3';
  action?: ReactNode;
  className?: string;
}) {
  const centered = align === 'center';

  return (
    <div
      className={[
        'flex flex-col gap-5',
        centered ? 'items-center text-center' : 'items-start',
        action ? 'md:flex-row md:items-end md:justify-between md:gap-10' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={['max-w-2xl', centered ? 'mx-auto' : ''].join(' ')}>
        {eyebrow ? (
          <p className="eyebrow reveal mb-4">{eyebrow}</p>
        ) : null}
        <Heading className="t-h2 reveal" style={revealDelay(60)}>
          {title}
        </Heading>
        {lead ? (
          <p className="t-lead reveal mt-4" style={revealDelay(120)}>
            {lead}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="reveal shrink-0" style={revealDelay(180)}>
          {action}
        </div>
      ) : null}
    </div>
  );
}
