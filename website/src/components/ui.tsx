import type { ReactNode } from 'react';

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className = '' }: ContainerProps) {
  return <div className={`container ${className}`.trim()}>{children}</div>;
}

type SectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  tinted?: boolean;
};

export function Section({ id, children, className = '', tinted = false }: SectionProps) {
  return (
    <section id={id} className={`section ${tinted ? 'section--tinted' : ''} ${className}`.trim()}>
      <Container>{children}</Container>
    </section>
  );
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  external?: boolean;
};

export function Button({ href, children, variant = 'primary', external = true }: ButtonProps) {
  return (
    <a
      className={`btn btn--${variant}`}
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

type EyebrowProps = {
  children: ReactNode;
};

export function Eyebrow({ children }: EyebrowProps) {
  return <p className="eyebrow">{children}</p>;
}

type SectionHeadingProps = {
  title: string;
  lead?: string;
};

export function SectionHeading({ title, lead }: SectionHeadingProps) {
  return (
    <header className="section-heading">
      <h2>{title}</h2>
      {lead ? <p>{lead}</p> : null}
    </header>
  );
}
