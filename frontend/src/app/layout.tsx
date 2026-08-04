import type { Metadata } from 'next';
import { PageTransition } from '@/components/PageTransition';
import { ScrollToTop } from '@/components/ScrollToTop';
import { Toaster } from '@/components/ui/Toaster';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Amplivo Digital Growth Private Limited | Digital Marketing Agency',
    template: '%s | Amplivo',
  },
  description:
    'Amplivo is a premium digital marketing agency delivering SEO, performance marketing, social media, branding, content, lead generation, and web development for ambitious brands across India.',
  keywords: ['digital marketing agency', 'SEO', 'performance marketing', 'social media', 'lead generation', 'Hyderabad', 'India'],
  authors: [{ name: 'Amplivo Digital Growth Private Limited' }],
  creator: 'Amplivo',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://amplivo.in',
    siteName: 'Amplivo',
    title: 'Amplivo Digital Growth Private Limited',
    description: 'Digital Strategies That Deliver. Premium digital marketing agency based in Hyderabad, India.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Amplivo Digital Growth Private Limited',
    description: 'Amplify Visibility. Accelerate Growth. Premium digital marketing agency.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-inter antialiased bg-[#F9FAFB]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#4C1D95] focus:text-white focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <ScrollToTop />
        <PageTransition>{children}</PageTransition>
        <Toaster />
      </body>
    </html>
  );
}
