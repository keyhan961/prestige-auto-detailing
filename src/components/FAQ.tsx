import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n';
import { SectionHeading } from './SectionHeading';

export function FAQ() {
  const [active, setActive] = useState(0);
  const { content } = useLanguage();

  return (
    <section className="section-pad bg-black">
      <SectionHeading eyebrow="FAQ" title={content.common.faqTitle} />
      <div className="mx-auto max-w-3xl divide-y divide-white/10 rounded-lg border border-white/10">
        {content.faqs.map((faq, index) => (
          <button key={faq.question} onClick={() => setActive(active === index ? -1 : index)} className="w-full p-5 text-left">
            <span className="flex items-center justify-between gap-4 font-bold text-white">
              {faq.question}
              <ChevronDown className={`text-gold transition ${active === index ? 'rotate-180' : ''}`} />
            </span>
            {active === index && <span className="mt-3 block text-sm leading-7 text-platinum/65">{faq.answer}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
