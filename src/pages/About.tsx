import { Award, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import { SEO } from '../components/SEO';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n';

export function About() {
  const { content } = useLanguage();
  const page = content.pages.about;

  return (
    <>
      <SEO title={page.seoTitle} description={page.seoDescription} />
      <section className="section-pad bg-obsidian pt-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-gold">{page.storyEyebrow}</p>
            <h1 className="mt-4 font-display text-5xl text-white md:text-6xl">{page.title}</h1>
            <p className="mt-6 text-lg leading-8 text-platinum/70">{page.story1}</p>
            <p className="mt-5 text-lg leading-8 text-platinum/70">{page.story2}</p>
          </div>
          <div className="glass rounded-lg p-8">
            <ShieldCheck className="text-gold" size={42} />
            <h2 className="mt-5 text-2xl font-bold text-white">{page.missionTitle}</h2>
            <p className="mt-4 leading-8 text-platinum/70">{page.missionCopy}</p>
          </div>
        </div>
      </section>

      <section className="section-pad bg-charcoal">
        <SectionHeading eyebrow={page.teamEyebrow} title={page.teamTitle} />
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {content.team.map((member) => (
            <article key={member} className="rounded-lg border border-white/10 bg-black/30 p-6">
              <Sparkles className="text-gold" />
              <h3 className="mt-5 text-xl font-bold text-white">{member}</h3>
              <p className="mt-3 text-sm leading-7 text-platinum/65">{page.teamCopy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad bg-black">
        <SectionHeading eyebrow={page.credentialsEyebrow} title={page.credentialsTitle} />
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          {content.credentials.map((item, index) => {
            const Icon = index % 2 === 0 ? Award : Clock;
            return (
              <div key={item} className="flex items-center gap-4 rounded-lg border border-white/10 p-5">
                <Icon className="text-gold" />
                <p className="font-semibold text-white">{item}</p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
