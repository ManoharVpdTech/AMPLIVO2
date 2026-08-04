'use client';
import Link from 'next/link';
import { Zap, MapPin, Phone, Mail, ArrowRight } from 'lucide-react';
import { FaInstagram, FaFacebook, FaLinkedin, FaTwitter } from 'react-icons/fa';
import { services } from '@/data/services';

const footerLinks = {
  Services: services.map((s) => ({
    label: s.title === 'Search Engine Optimisation' ? 'SEO' : s.title === 'Branding & Creative Design' ? 'Branding & Creative' : s.title,
    href: `/services/${s.slug}`,
  })),
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Our Team', href: '/about#team' },
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Case Studies', href: '/case-studies' },
    { label: 'Insights Blog', href: '/insights' },
    { label: 'Careers', href: '/careers' },
  ],
  Industries: [
    { label: 'Real Estate', href: '/industries' },
    { label: 'Education', href: '/industries' },
    { label: 'Healthcare', href: '/industries' },
    { label: 'E-Commerce', href: '/industries' },
    { label: 'Startups & IT', href: '/industries' },
    { label: 'Hospitality', href: '/industries' },
    { label: 'Finance', href: '/industries' },
  ],
  'Quick Links': [
    { label: 'Contact Us', href: '/contact' },
    { label: 'Client Login', href: '/login' },
    { label: 'Get Free Audit', href: '/contact' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Terms of Service', href: '/terms-of-service' },
    { label: 'Refund Policy', href: '/refund-policy' },
  ],
};

const offices = [
  { city: 'Hyderabad', address: 'HQ — Hi-Tech City, Hyderabad, Telangana' },
  { city: 'Bengaluru', address: 'Indiranagar, Bengaluru, Karnataka' },
  { city: 'Mumbai', address: 'Andheri West, Mumbai, Maharashtra' },
  { city: 'Dubai', address: 'Business Bay, Dubai, UAE' },
];

export function Footer() {
  return (
    <footer className="bg-[#0A0F1E] text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-x-8 gap-y-10 mb-6">
          {/* Brand Column */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#4C1D95] flex items-center justify-center">
                <Zap size={18} className="text-white" />
              </div>
              <span className="font-bold text-xl text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
                Amplivo
              </span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Amplivo Digital Growth Private Limited — A premium digital marketing agency transforming growth ambitions into measurable business results.
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2.5 text-sm text-slate-300">
                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-[#a78bfa]" />
                <span>Hi-Tech City, Hyderabad, Telangana 500081</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-slate-300">
                <Mail size={14} className="flex-shrink-0 text-[#a78bfa]" />
                <a href="mailto:hello@amplivo.in" className="hover:text-[#06B6D4] transition-colors">hello@amplivo.in</a>
              </div>
            </div>
            {/* Social */}
            <div className="flex gap-3">
              {[
                { icon: <FaInstagram size={16} />, href: 'https://instagram.com', label: 'Instagram' },
                { icon: <FaFacebook size={16} />, href: 'https://facebook.com', label: 'Facebook' },
                { icon: <FaLinkedin size={16} />, href: 'https://linkedin.com', label: 'LinkedIn' },
                { icon: <FaTwitter size={16} />, href: 'https://x.com', label: 'Twitter' },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#6B7280] hover:text-white hover:bg-[#4C1D95] hover:border-[#4C1D95] transition-all"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-white font-semibold mb-3 text-sm">{heading}</h4>
              <ul className="space-y-1.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-slate-300 text-sm hover:text-[#06B6D4] hover:translate-x-1 flex items-center transition-all duration-300 transform"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Office Locations */}
        <div className="border-t border-[#1F2937] pt-6 mb-4">
          <div className="grid lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Our Offices</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {offices.map((office) => (
                  <div key={office.city} className="flex items-start gap-2.5">
                    <MapPin size={14} className="text-[#a78bfa] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-white text-sm font-semibold">{office.city}</div>
                      <div className="text-slate-300 text-xs mt-1 leading-relaxed">{office.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Hyderabad HQ Map</h4>
              <div className="w-full h-32 rounded-2xl overflow-hidden border border-[#1F2937] relative">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3806.4025875225114!2d78.3807217!3d17.4447475!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb9158f201b9ad%3A0x6bfe30c0a4e768e1!2sHitech%20City%2C%20Hyderabad%2C%20Telangana!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) grayscale(10%) contrast(90%)' }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Amplivo Hyderabad HQ Location Map"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#1F2937] pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-sm">
            © 2024 Amplivo Digital Growth Private Limited. All rights reserved.

          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-slate-400 text-sm">
            {[
              { label: 'Privacy Policy', href: '/privacy-policy' },
              { label: 'Terms of Service', href: '/terms-of-service' },
              { label: 'Cookie Policy', href: '/cookie-policy' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="hover:text-[#06B6D4] transition-colors duration-300"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
