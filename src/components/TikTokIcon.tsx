type TikTokIconProps = {
  className?: string;
};

export function TikTokIcon({ className = '' }: TikTokIconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 3c.35 2.35 1.72 3.79 4.02 3.94v3.07a7.2 7.2 0 0 1-4.02-1.19v5.82c0 2.95-1.84 5.36-4.72 6.07-2.23.55-4.53-.28-5.82-2.1-1.48-2.09-1.33-4.96.36-6.85 1.29-1.45 3.2-2.15 5.33-1.77v3.28c-.29-.1-.55-.17-.82-.21-1.01-.14-1.91.31-2.35 1.17-.48.93-.28 2.04.49 2.7.72.62 1.78.73 2.66.28.9-.46 1.36-1.24 1.36-2.27V3h3.51Z" />
    </svg>
  );
}
