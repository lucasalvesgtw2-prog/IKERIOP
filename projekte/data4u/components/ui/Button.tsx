import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

function classes(variant: Variant, size: Size, extra?: string) {
  return ['btn', variantClass[variant], sizeClass[size], extra]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
} & (
  | ({ href: string } & Omit<ComponentPropsWithoutRef<'a'>, 'href'>)
  | ({ href?: undefined } & ComponentPropsWithoutRef<'button'>)
);

/**
 * Ein einziger Button für die ganze Seite. Mit `href` wird daraus ein Link —
 * interne Ziele laufen über next/link, externe und `tel:`/`mailto:` über ein
 * normales <a>, damit der Router sie nicht abfängt.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  if (typeof rest.href === 'string') {
    const { href, ...anchorProps } = rest as { href: string } & Omit<
      ComponentPropsWithoutRef<'a'>,
      'href'
    >;
    const isInternal = href.startsWith('/') || href.startsWith('#');

    if (isInternal) {
      return (
        <Link
          href={href}
          className={classes(variant, size, className)}
          {...anchorProps}
        >
          {children}
        </Link>
      );
    }

    return (
      <a href={href} className={classes(variant, size, className)} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = rest as ComponentPropsWithoutRef<'button'>;
  return (
    <button
      type={buttonProps.type ?? 'button'}
      className={classes(variant, size, className)}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
