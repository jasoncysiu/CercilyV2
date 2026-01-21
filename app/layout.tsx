import '@/styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cercily - Brainstorming & Decision Making',
  description: 'A professional brainstorming and decision-making tool',
}

// Script to apply theme before React hydration (prevents flash)
const themeScript = `
  (function() {
    try {
      const theme = localStorage.getItem('cercily-theme');
      if (theme === 'light') {
        document.documentElement.classList.add('theme-light');
      } else if (theme === 'dark') {
        document.documentElement.classList.add('theme-dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}