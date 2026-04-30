import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Wealth Maps — Financial, Retirement & Estate Planning',
  description: 'Educate yourself, assess your planning needs, and build your financial, retirement, and estate plan.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
