import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { localizedSite } from './data/site';

export type Language = 'en' | 'fi' | 'ru';

export const languages: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fi', label: 'FI' },
  { code: 'ru', label: 'RU' },
];

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  content: (typeof localizedSite)[Language];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('prestige-language');
    return saved === 'fi' || saved === 'ru' || saved === 'en' ? saved : 'fi';
  });

  const setLanguage = (nextLanguage: Language) => {
    localStorage.setItem('prestige-language', nextLanguage);
    setLanguageState(nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      content: localizedSite[language],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);

  if (!value) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }

  return value;
}
