import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Вхід',
  description: 'Дитячі речі напрокат',
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
