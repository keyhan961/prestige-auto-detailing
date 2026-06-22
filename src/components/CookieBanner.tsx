import { useEffect, useState } from 'react';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem('prestige-cookie-consent') !== 'accepted');
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-3xl rounded-lg border border-white/15 bg-charcoal/95 p-4 shadow-2xl backdrop-blur md:bottom-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-platinum/75">
          We use cookies to improve site performance, measure visits, and keep booking preferences smooth.
        </p>
        <button
          onClick={() => {
            localStorage.setItem('prestige-cookie-consent', 'accepted');
            setVisible(false);
          }}
          className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-white shadow-glow"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
