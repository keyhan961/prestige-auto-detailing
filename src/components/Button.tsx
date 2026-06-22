import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  to?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
};

export function Button({ children, to, variant = 'primary', className = '' }: ButtonProps) {
  const base =
    'inline-flex min-w-0 max-w-full items-center justify-center rounded-full px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.12em] transition duration-300 sm:px-6 sm:tracking-[0.22em]';
  const styles =
    variant === 'primary'
      ? 'border border-red-400/40 bg-gold text-white shadow-glow hover:bg-red-600 hover:shadow-[0_0_60px_rgba(226,27,35,.36)]'
      : 'border border-white/20 bg-white/5 text-white hover:border-gold hover:text-gold hover:shadow-[0_0_34px_rgba(226,27,35,.22)]';

  if (to) {
    return (
      <Link className={`${base} ${styles} ${className}`} to={to}>
        {children}
      </Link>
    );
  }

  return <button className={`${base} ${styles} ${className}`}>{children}</button>;
}
