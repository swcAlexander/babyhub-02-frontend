import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Реєстрація',
  description: 'Реєстрація у Дитячі речі напрокат',
};

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
