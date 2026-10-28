import React from 'react';
import { Logo } from './ui';

/** Top bar for public (non-staff) screens. `children` renders on the right. */
export default function PublicHeader({ onHome, subtitle, children, className = '' }) {
  return (
    <header className={`no-print border-b border-ink-200/70 bg-white/80 backdrop-blur ${className}`}>
      <div className="container-page flex h-16 items-center justify-between gap-3 sm:h-[72px]">
        <Logo onClick={onHome} subtitle={subtitle} />
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
