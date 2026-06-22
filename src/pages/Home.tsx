import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';
import { FAQ } from '../components/FAQ';
import { SEO } from '../components/SEO';
import { SectionHeading } from '../components/SectionHeading';
import { ServiceCard } from '../components/ServiceCard';
import { Stats } from '../components/Stats';
import { useLanguage } from '../i18n';

export function Home() {
  const { content } = useLanguage();
  const home = content.home;

  return (
    <>
      <SEO title={home.seoTitle} description={home.seoDescription} />
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute right-[-18%] top-1/2 w-[92vw] max-w-[760px] -translate-y-1/2 sm:right-[-8%] sm:w-[74vw] md:right-[3%] md:w-[48vw]">
          <div className="absolute -inset-10 rounded-[3rem] bg-black/60 blur-3xl" />
          <img
            src="/assets/prestige-logo.jpeg"
            alt={home.heroTitle}
            className="relative h-auto w-full object-contain opacity-85 [mask-image:radial-gradient(ellipse_at_center,black_48%,rgba(0,0,0,.85)_62%,transparent_82%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_48%,rgba(0,0,0,.85)_62%,transparent_82%)]"
            fetchPriority="high"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/35" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(226,27,35,.2),transparent_34%)]" />
        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center px-4 pb-44 pt-24 sm:pb-28 md:px-8">
          <div className="w-full min-w-0 max-w-3xl reveal">
            <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-gold sm:text-xs sm:tracking-[0.4em]">{home.heroEyebrow}</p>
            <h1 className="chrome-text mt-5 font-display text-[2.85rem] leading-[1.06] sm:text-5xl md:text-7xl">{home.heroTitle}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-platinum/78 sm:text-lg sm:leading-8">{home.heroSubtitle}</p>
            <div className="hero-actions mt-8 grid gap-3 sm:flex sm:w-auto sm:max-w-none sm:gap-4">
              <Button to="/contact#booking" className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap">{home.bookNow}</Button>
              <Button to="/contact" variant="secondary" className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap">{home.quote}</Button>
            </div>
          </div>
        </div>
      </section>

      <Stats />

      <section className="section-pad bg-obsidian">
        <SectionHeading eyebrow={home.servicesEyebrow} title={home.servicesTitle} copy={home.servicesCopy} />
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {content.services.slice(0, 6).map((service) => (
            <ServiceCard key={service.title} service={service} />
          ))}
        </div>
      </section>

      <section className="section-pad bg-charcoal">
        <SectionHeading eyebrow={home.beforeAfterEyebrow} title={home.beforeAfterTitle} />
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {content.galleryItems.slice(0, 3).map((item) => (
            <article key={item.title} className="group overflow-hidden rounded-lg border border-white/10 bg-black/30">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold">{item.category}</p>
                  <h3 className="mt-1 text-xl font-bold text-white">{item.title}</h3>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad bg-black">
        <SectionHeading eyebrow={home.testimonialsEyebrow} title={home.testimonialsTitle} />
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {content.testimonials.map((item) => (
            <article key={item.name} className="glass rounded-lg p-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">{item.vehicle}</p>
              <h3 className="mt-4 text-xl font-bold text-white">{item.name}</h3>
              <p className="mt-4 leading-7 text-platinum/70">{item.quote}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad bg-obsidian">
        <SectionHeading eyebrow={home.whyEyebrow} title={home.whyTitle} />
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {content.whyChoose.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-lg border border-white/10 bg-luxury p-7">
                <Icon className="text-gold" size={34} />
                <h3 className="mt-5 text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 leading-7 text-platinum/65">{item.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-pad bg-charcoal">
        <SectionHeading eyebrow={home.processEyebrow} title={home.processTitle} />
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-5">
          {home.process.map((step, index) => (
            <div key={step} className="rounded-lg border border-white/10 bg-black/30 p-5">
              <p className="text-sm font-bold text-gold">0{index + 1}</p>
              <h3 className="mt-4 text-xl font-bold text-white">{step}</h3>
              <CheckCircle2 className="mt-6 text-gold" />
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-fit">
          <Button to="/services" variant="secondary">
            {home.exploreServices} <ArrowRight className="ml-2" size={16} />
          </Button>
        </div>
      </section>

      <FAQ />
    </>
  );
}
