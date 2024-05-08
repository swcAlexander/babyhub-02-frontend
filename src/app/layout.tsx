import React from 'react';
import Header from '@/(components)/Header/Header';
import Footer from '@/(components)/Footer/Footer';
import { Kodchasan } from 'next/font/google';
import './globals.css';
const font = Kodchasan({
  style: ['normal'],
  weight: ['400', '700'],
  subsets: ['latin'],
});

export const metadata = {
  title: 'Babyhub',
  description: 'Дитячі речі напрокат',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={font.className}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
