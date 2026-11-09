export type Locale = 'uk' | 'ru';

export const DEFAULT_LOCALE: Locale = 'uk';

export const normalizeLocale = (locale?: string): Locale => {
  return locale === 'ru' ? 'ru' : 'uk';
};

export const buildLocalizedPath = (locale: Locale, path: string): string => {
  const normalizedPath = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`;

  if (locale === 'ru') {
    if (normalizedPath === '/') {
      return '/ru';
    }

    return `/ru${normalizedPath}`;
  }

  return normalizedPath;
};
