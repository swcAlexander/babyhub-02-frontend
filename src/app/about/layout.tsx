import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Про нас',
  description: 'Дитячі речі напрокат',
};

export default function AboutLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
