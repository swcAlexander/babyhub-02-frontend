import React from 'react';
import './page.module.css';


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
      <body>
        {children}
      </body>
    </html>
  );
}
