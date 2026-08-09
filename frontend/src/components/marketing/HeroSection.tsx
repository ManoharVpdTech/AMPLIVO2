'use client';
import Link from 'next/link';
import { ArrowRight, Star, TrendingUp, Target, BarChart2, Zap } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { VideoBackground } from '@/components/ui/VideoBackground';

const stats = [
  { label: 'Organic Traffic Growth', prefix: '+', value: 284, suffix: '%', icon: TrendingUp, color: '#10B981' },
  { label: 'Reduction in CPL', prefix: '↓ ', value: 47, suffix: '%', icon: Target, color: '#06B6D4' },
  { label: 'Average Conv. Rate', prefix: '', value: 8, suffix: '.9%', icon: BarChart2, color: '#EC4899' },
  { label: 'Average Client ROI', prefix: '', value: 340, suffix: '%', icon: Zap, color: '#F59E0B' },
];

function AnimatedStat({ stat }: { stat: typeof stats[0] }) {
  const { count, ref } = useCountUp(stat.value, 1800);
  return (
    <div
      ref={ref}
      className="bg-black/20 backdrop-blur-md border border-white/15 rounded-2xl p-5 hover:bg-white/15 transition-colors group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${stat.color}30` }}
        >
          <stat.icon size={17} style={{ color: stat.color }} />
        </div>
        <span className="text-white/80 text-xs font-medium">{stat.label}</span>
      </div>
      <div
        className="text-3xl font-bold text-white drop-shadow-md tabular-nums"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {stat.prefix}{count}{stat.suffix}
      </div>
      <div className="text-white/60 text-xs mt-1">vs. prior 6 months avg.</div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      <VideoBackground
        src="/videos/hero-bg.mp4"
        poster="/images/hero/hero-poster.jpeg"
        className="z-0"
      />

      {/* Gradient Overlay — semi-transparent so video shows through */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#1a0540]/80 via-[#4C1D95]/60 to-[#06B6D4]/40">
        <div className="absolute inset-0 opacity-40 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {/* Decorative blobs */}
      <div
        className="absolute inset-0 opacity-[0.1] z-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 20% 60%, #fff 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, #06B6D4 0%, transparent 50%)',
        }}
      />

      <div className="relative z-20 max-w-7xl mx-auto px-6 py-12 lg:py-16 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left — Copy */}
          <div>
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-5">
              <Star size={11} className="text-amber-400 fill-amber-400" />
              Trusted by 250+ brands across 12 countries
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.12] mb-4 drop-shadow-lg"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              We Build Digital Campaigns That{' '}
              <span className="text-[#06B6D4] drop-shadow-md">Convert Attention</span> into Growth
            </h1>

            <p className="text-lg text-white/90 leading-relaxed mb-6 max-w-lg drop-shadow">
              Strategy, performance marketing, content, technology, and analytics combined into measurable customer-acquisition systems for ambitious brands.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="flex items-center gap-2 bg-white text-[#4C1D95] font-semibold px-7 py-3.5 rounded-xl hover:bg-white/92 transition-all shadow-lg shadow-black/20"
              >
                Request Growth Strategy
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/case-studies"
                className="backdrop-blur-md border border-white/30 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 transition-all"
              >
                View Case Studies
              </Link>
            </div>


          </div>

          {/* Right — Animated Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.map((stat, i) => (
              <AnimatedStat key={i} stat={stat} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <svg viewBox="0 0 1440 80" className="w-full" fill="none">
          <path d="M0 80L1440 80L1440 40C1200 80 960 20 720 40C480 60 240 10 0 40Z" fill="#F9FAFB" />
        </svg>
      </div>
    </section>
  );
}
