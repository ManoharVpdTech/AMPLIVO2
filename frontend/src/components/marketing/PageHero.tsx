'use client';

import { motion } from 'framer-motion';
import { HeroBackground } from '@/components/marketing/HeroBackground';
import type { HeroConfig } from '@/types/hero';
import { HERO_DELAY, HERO_DURATION, HERO_EASE } from '@/constants/hero';

interface PageHeroProps {
  config: HeroConfig;
  className?: string;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: HERO_DELAY.title,
      delayChildren: 0.15,
    },
  },
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: HERO_DURATION, ease: HERO_EASE },
  },
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: HERO_EASE },
  },
};

const ctaVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: HERO_EASE },
  },
};

export function PageHero({ config, className = '' }: PageHeroProps) {
  const { background, content } = config;

  const overlayStyle = 'from-slate-950/90 via-slate-950/70 to-slate-950/90';

  return (
    <section
      id="page-hero"
      className={`relative min-h-[480px] pt-32 pb-20 flex items-center overflow-hidden ${className}`}
    >
      <HeroBackground type={background.type} src={background.src} images={background.images} poster={background.poster} decoration={background.decoration} />

      <div className={`absolute inset-0 bg-gradient-to-br backdrop-blur-[4px] ${overlayStyle}`} />

      <div
        className="absolute inset-0 opacity-[0.06] backdrop-blur-[2px]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 50%, #7C3AED 0%, transparent 50%), radial-gradient(circle at 75% 50%, #06B6D4 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          {content.badge && (
            <motion.div variants={badgeVariants} className="mb-6">
              <span className="inline-block bg-white/15 backdrop-blur-md border border-white/30 text-white text-xs font-bold px-5 py-2.5 rounded-full uppercase tracking-widest drop-shadow-sm">
                {content.badge}
              </span>
            </motion.div>
          )}

          {content.iconName && (
            <motion.div variants={badgeVariants} className="mb-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <HeroIcon name={content.iconName} />
              </div>
            </motion.div>
          )}

          <motion.h1
            variants={fadeUpVariants}
            className={`font-bold text-slate-50 drop-shadow-xl mb-5 ${content.titleClass || 'text-4xl lg:text-5xl'}`}
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {content.title}
          </motion.h1>

          <motion.p
            variants={fadeUpVariants}
            className="text-slate-100/90 text-lg leading-relaxed max-w-2xl mx-auto drop-shadow-md font-medium"
          >
            {content.subtitle}
          </motion.p>

          {content.cta && (
            <motion.div variants={ctaVariants} className="mt-8">
              <a
                href={content.cta.href}
                className="inline-block bg-white text-[#4C1D95] font-semibold px-8 py-3.5 rounded-xl shadow-xl hover:-translate-y-1 transition-all duration-200"
              >
                {content.cta.label}
              </a>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function HeroIcon({ name }: { name: string }) {
  if (name === 'download') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  if (name === 'help') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return null;
}
