import React from 'react';

export const metadata = {
  title: 'register',
  description: 'реєстрація у Дитячі речі напрокат',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
