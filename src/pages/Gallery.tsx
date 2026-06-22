import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SEO } from '../components/SEO';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n';

export function Gallery() {
  const { content } = useLanguage();
  const page = content.pages.gallery;
  const [category, setCategory] = useState<string>(content.categories[0]);
  const [active, setActive] = useState<(typeof content.galleryItems)[number] | null>(null);

  useEffect(() => {
    setCategory(content.categories[0]);
    setActive(null);
  }, [content.categories]);

  const filtered = useMemo(
    () => (category === content.categories[0] ? content.galleryItems : content.galleryItems.filter((item) => item.category === category)),
    [category, content.categories, content.galleryItems],
  );

  return (
    <>
      <SEO title={page.seoTitle} description={page.seoDescription} />
      <section className="section-pad bg-obsidian pt-32">
        <SectionHeading eyebrow={page.eyebrow} title={page.title} copy={page.copy} />
        <div className="mx-auto mb-10 flex max-w-5xl flex-wrap justify-center gap-3">
          {content.categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition ${
                category === item ? 'border-gold bg-gold text-white shadow-glow' : 'border-white/10 bg-white/5 text-platinum/70 hover:text-gold'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, index) => (
            <button key={`${item.title}-${index}`} onClick={() => setActive(item)} className="group overflow-hidden rounded-lg border border-white/10 text-left">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold">{item.category}</p>
                  <h3 className="mt-1 text-xl font-bold text-white">{item.title}</h3>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
      {active && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-4" onClick={() => setActive(null)}>
          <button className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white" aria-label={page.close}>
            <X />
          </button>
          <div className="max-w-5xl overflow-hidden rounded-lg border border-white/15" onClick={(event) => event.stopPropagation()}>
            <img src={active.image} alt={active.title} className="max-h-[75vh] w-full object-cover" loading="lazy" />
            <div className="bg-charcoal p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">{active.category}</p>
              <h3 className="mt-1 text-2xl font-bold text-white">{active.title}</h3>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
