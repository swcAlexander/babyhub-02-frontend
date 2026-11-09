import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Каталог',
  description: 'Дитячі речі напрокат',
};

export default function CatalogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
