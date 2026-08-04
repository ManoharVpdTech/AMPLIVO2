'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const navLinks = [
  { label: 'Home', href: '/' },
  {
    label: 'Services',
    href: '/services',
    children: [
      { label: 'Social Media Marketing', href: '/services/social-media-marketing' },
      { label: 'Performance Marketing', href: '/services/performance-marketing' },
      { label: 'SEO', href: '/services/search-engine-optimisation' },
      { label: 'Branding & Creative', href: '/services/branding-and-creative-design' },
      { label: 'Content Marketing', href: '/services/content-marketing' },
      { label: 'Lead Generation', href: '/services/lead-generation' },
      { label: 'Website Development', href: '/services/website-development' },
      { label: 'Marketing Automation', href: '/services/marketing-automation' },
      { label: 'Influencer Marketing', href: '/services/influencer-marketing' },
      { label: 'Video Marketing', href: '/services/video-marketing' },
    ],
  },
  { label: 'Industries', href: '/industries' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Case Studies', href: '/case-studies' },
  { label: 'Insights', href: '/insights' },
  { label: 'About', href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
];

interface NavbarProps {
  alwaysSolid?: boolean;
}

export function Navbar({ alwaysSolid = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const isSolid = alwaysSolid || scrolled;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isSolid
          ? 'bg-white/97 backdrop-blur-md border-b border-slate-200 shadow-md'
          : 'bg-[#1a0540]/60 backdrop-blur-md border-b border-white/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 lg:py-0 min-h-[88px] flex flex-wrap items-center justify-between gap-2 lg:gap-4">
        {/* Logo */}
        <Logo variant={isSolid ? 'dark' : 'white'} size="md" />

        {/* Navigation Bar (Always Visible) */}
        <nav className="flex w-full order-last mt-3 lg:mt-0 lg:w-auto lg:order-none overflow-x-auto scrollbar-hide items-center gap-1 xl:gap-2 pb-2 lg:pb-0" aria-label="Primary">
          {navLinks.map((link) => {
            const linkActive = isActive(link.href);
            const hasActiveChild = link.children?.some((c) => isActive(c.href));
            const dropdownOpen = activeDropdown === link.label;
            return (
              <div
                key={link.label}
                className="relative shrink-0"
                onMouseEnter={() => link.children && setActiveDropdown(link.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <Link
                  href={link.href}
                  onClick={(e) => {
                    if (link.href === '/' && pathname === '/') {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  aria-current={linkActive ? 'page' : undefined}
                  aria-haspopup={link.children ? 'true' : undefined}
                  aria-expanded={link.children ? dropdownOpen : undefined}
                  className={`flex items-center gap-0.5 xl:gap-1 px-2.5 xl:px-3 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-medium transition-colors whitespace-nowrap ${
                    isSolid
                      ? linkActive || hasActiveChild
                        ? 'text-[#4C1D95] font-bold bg-[#4C1D95]/5'
                        : 'text-slate-600 hover:text-[#4C1D95] hover:bg-[#4C1D95]/5'
                      : linkActive || hasActiveChild
                        ? 'text-white font-bold bg-white/10'
                        : 'text-white/85 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.label}
                  {link.children && <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />}
                </Link>

                {(linkActive || hasActiveChild) && (
                  <span className={`absolute bottom-0 left-2 right-2 xl:left-3 xl:right-3 h-0.5 rounded-full ${isSolid ? 'bg-[#4C1D95]' : 'bg-white'}`} />
                )}

                {/* Dropdown */}
                {link.children && dropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-black/10 p-2 z-50" aria-label={`${link.label} submenu`}>
                    {link.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        aria-current={isActive(child.href) ? 'page' : undefined}
                        className={`flex items-center px-4 py-2.5 rounded-xl text-sm transition-colors ${
                          isActive(child.href)
                            ? 'text-[#4C1D95] font-bold bg-[#4C1D95]/5'
                            : 'text-slate-600 hover:text-[#4C1D95] hover:bg-[#4C1D95]/5'
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-2 xl:gap-4 shrink-0">
          <Link
            href="/login"
            className={`text-xs xl:text-sm font-medium px-3.5 xl:px-5 py-2 xl:py-2.5 rounded-xl border transition-all whitespace-nowrap ${isSolid
              ? 'border-slate-200 text-slate-700 hover:border-[#4C1D95] hover:text-[#4C1D95]'
              : 'border-white/30 text-white hover:bg-white/10'
              }`}
          >
            Client Login
          </Link>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div id="mobile-nav-menu" className="lg:hidden bg-white border-t border-slate-100 shadow-lg max-h-[80vh] overflow-y-auto" aria-label="Mobile">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => {
              const linkActive = isActive(link.href);
              const hasActiveChild = link.children?.some((c) => isActive(c.href));
              return (
                <div key={link.label}>
                  <Link
                    href={link.href}
                    onClick={(e) => {
                      setMobileOpen(false);
                      if (link.href === '/' && pathname === '/') {
                        e.preventDefault();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className={`block px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                      linkActive || hasActiveChild
                        ? 'text-[#4C1D95] font-bold bg-[#4C1D95]/5'
                        : 'text-slate-700 hover:text-[#4C1D95] hover:bg-[#4C1D95]/5'
                    }`}
                  >
                    {link.label}
                  </Link>
                  {link.children && (
                    <div className="ml-4 space-y-0.5">
                      {link.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          onClick={() => setMobileOpen(false)}
                          className={`block px-4 py-2 text-xs rounded-lg transition-colors ${
                            isActive(child.href)
                              ? 'text-[#4C1D95] font-bold bg-[#4C1D95]/5'
                              : 'text-slate-500 hover:text-[#4C1D95]'
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="pt-3 border-t border-slate-100 mt-2">
              <Link href="/login" onClick={() => setMobileOpen(false)} className="block w-full text-center px-4 py-3 text-sm font-medium border border-slate-200 text-slate-700 rounded-xl hover:border-[#4C1D95] hover:text-[#4C1D95]">
                Client Login
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

