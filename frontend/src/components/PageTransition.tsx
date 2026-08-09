'use client';
import { useEffect, useRef, Suspense } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Wraps page content and plays a fade-in animation on every route change.
 * Uses a simple CSS keyframe so no extra dependencies are needed.
 */

function PageTransitionInner({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
  }, [pathname]);

  return (
    <div ref={ref} className="page-transition-wrapper">
      {children}
    </div>
  );
}

export function PageTransition({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<div className="page-transition-wrapper">{children}</div>}>
      <PageTransitionInner>{children}</PageTransitionInner>
    </Suspense>
  );
}
