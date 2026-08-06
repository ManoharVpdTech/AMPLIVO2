'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import type { HeroBgType, HeroDecoration } from '@/types/hero';

interface HeroBackgroundProps {
  type: HeroBgType;
  src?: string;
  images?: string[];
  poster?: string;
  decoration?: HeroDecoration;
}

export function HeroBackground({ type, src, images, decoration }: Readonly<HeroBackgroundProps>) {
  let content = <AnimatedGradientBg />;
  if (type === 'ken-burns' && images && images.length > 0) {
    content = <KenBurnSlideshow images={images} />;
  } else if (src) {
    content = (
      <Image
        src={src}
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
    );
  }

  return (
    <>
      {/* Layer 1: Background image or gradient fallback */}
      {content}

      {/* Layer 2: Decoration overlay (subtle CSS animation on top of image) */}
      {decoration && decoration !== 'none' && (
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          {decoration === 'cards' && <CardMosaic />}
          {decoration === 'charts' && <DashboardMotion />}
          {decoration === 'network' && <NetworkMap />}
        </div>
      )}
    </>
  );
}

/* ──────────────────────────────────────────────
   Ken Burns Slideshow
   ────────────────────────────────────────────── */
function KenBurnSlideshow({ images }: Readonly<{ images: string[] }>) {
  const items = useMemo(
    () => images.slice(0, 4).map((src, i) => ({ src, id: i })),
    [images],
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="absolute inset-0 animate-ken-burns"
          style={{
            animationDelay: `${index * 5}s`,
            opacity: index === 0 ? 1 : 0,
            zIndex: items.length - index,
          }}
        >
          <Image
            src={item.src}
            alt=""
            fill
            priority={index === 0}
            className="object-cover"
            sizes="100vw"
          />
        </div>
      ))}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(15, 23, 42, 0.75) 0%, rgba(15, 23, 42, 0.55) 50%, rgba(15, 23, 42, 0.8) 100%)',
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Animated Gradient
   ────────────────────────────────────────────── */
function AnimatedGradientBg() {
  return (
    <div
      className="absolute inset-0 animate-gradient-shift"
      style={{
        background:
          'linear-gradient(135deg, #1a0540, #4C1D95, #7C3AED, #06B6D4)',
      }}
    />
  );
}

/* ──────────────────────────────────────────────
   Card Mosaic (Industries)
   ────────────────────────────────────────────── */
const industryCards = [
  { label: 'Real Estate', color: '#4C1D95', x: '10%', y: '15%', d: '7s' },
  { label: 'Healthcare', color: '#7C3AED', x: '65%', y: '10%', d: '9s' },
  { label: 'E-Commerce', color: '#06B6D4', x: '75%', y: '55%', d: '11s' },
  { label: 'Education', color: '#EC4899', x: '15%', y: '60%', d: '8s' },
  { label: 'Finance', color: '#4C1D95', x: '50%', y: '35%', d: '10s' },
  { label: 'IT Solutions', color: '#7C3AED', x: '30%', y: '70%', d: '12s' },
];

function CardMosaic() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {industryCards.map((card) => (
        <div
          key={card.label}
          className="absolute animate-float-slow rounded-2xl border border-white/10 px-4 py-2 backdrop-blur-sm"
          style={{
            left: card.x,
            top: card.y,
            background: `${card.color}20`,
            animationDelay: card.d,
          }}
        >
          <span className="whitespace-nowrap text-sm font-medium text-white/80">
            {card.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Dashboard Motion (Case Studies)
   ────────────────────────────────────────────── */
function DashboardMotion() {
  const bars = [
    { h: '40%', d: '0s', color: '#4C1D95' },
    { h: '65%', d: '0.2s', color: '#7C3AED' },
    { h: '50%', d: '0.4s', color: '#06B6D4' },
    { h: '80%', d: '0.6s', color: '#4C1D95' },
    { h: '55%', d: '0.3s', color: '#7C3AED' },
    { h: '70%', d: '0.5s', color: '#06B6D4' },
    { h: '45%', d: '0.7s', color: '#EC4899' },
    { h: '60%', d: '0.1s', color: '#4C1D95' },
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
      <div className="flex items-end gap-3 h-[200px]">
        {bars.map((bar, i) => (
          <div
            key={`bar-${bar.d}-${i}`}
            className="w-6 rounded-t-md animate-chart-rise"
            style={{
              height: bar.h,
              background: bar.color,
              animationDelay: bar.d,
              transformOrigin: 'bottom',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Network Map (Contact)
   ────────────────────────────────────────────── */
function NetworkMap() {
  const nodes = [
    { x: '20%', y: '30%', d: '0s' },
    { x: '50%', y: '20%', d: '1s' },
    { x: '75%', y: '35%', d: '2s' },
    { x: '30%', y: '60%', d: '0.5s' },
    { x: '60%', y: '65%', d: '1.5s' },
    { x: '80%', y: '55%', d: '2.5s' },
  ];

  const lines = [
    { x1: '20%', y1: '30%', x2: '50%', y2: '20%' },
    { x1: '50%', y1: '20%', x2: '75%', y2: '35%' },
    { x1: '30%', y1: '60%', x2: '60%', y2: '65%' },
    { x1: '60%', y1: '65%', x2: '80%', y2: '55%' },
    { x1: '20%', y1: '30%', x2: '30%', y2: '60%' },
    { x1: '75%', y1: '35%', x2: '80%', y2: '55%' },
    { x1: '50%', y1: '20%', x2: '60%', y2: '65%' },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.08]">
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((line, i) => (
          <line
            key={`line-${line.x1}-${line.y1}-${line.x2}-${line.y2}-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#7C3AED"
            strokeWidth="0.3"
            className="animate-pulse-node"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
        ))}
      </svg>
      {nodes.map((node, i) => (
        <div
          key={`node-${node.x}-${node.y}-${i}`}
          className="absolute h-2 w-2 rounded-full bg-[#06B6D4] animate-pulse-node"
          style={{
            left: node.x,
            top: node.y,
            animationDelay: node.d,
          }}
        />
      ))}
    </div>
  );
}
