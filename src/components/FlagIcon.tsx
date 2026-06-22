import type { Language } from '../i18n';

type FlagIconProps = {
  language: Language;
};

export function FlagIcon({ language }: FlagIconProps) {
  if (language === 'fi') {
    return (
      <svg viewBox="0 0 28 20" className="h-3.5 w-5 overflow-hidden rounded-sm" aria-hidden="true">
        <rect width="28" height="20" fill="#fff" />
        <rect x="7" width="4" height="20" fill="#002f6c" />
        <rect y="8" width="28" height="4" fill="#002f6c" />
      </svg>
    );
  }

  if (language === 'ru') {
    return (
      <svg viewBox="0 0 28 20" className="h-3.5 w-5 overflow-hidden rounded-sm" aria-hidden="true">
        <rect width="28" height="20" fill="#fff" />
        <rect y="6.67" width="28" height="6.66" fill="#0039a6" />
        <rect y="13.33" width="28" height="6.67" fill="#d52b1e" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 28 20" className="h-3.5 w-5 overflow-hidden rounded-sm" aria-hidden="true">
      <rect width="28" height="20" fill="#012169" />
      <path d="M0 0l28 20M28 0 0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l28 20M28 0 0 20" stroke="#c8102e" strokeWidth="2" />
      <path d="M14 0v20M0 10h28" stroke="#fff" strokeWidth="7" />
      <path d="M14 0v20M0 10h28" stroke="#c8102e" strokeWidth="4" />
    </svg>
  );
}
