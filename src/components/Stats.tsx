import { useLanguage } from '../i18n';

export function Stats() {
  const { content } = useLanguage();

  return (
    <section className="border-y border-white/10 bg-charcoal/60 px-4 py-10 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
        {content.stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-display text-5xl text-gold">{stat.value}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-platinum/55">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
