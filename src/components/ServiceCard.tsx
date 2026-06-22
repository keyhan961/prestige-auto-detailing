import type { LucideIcon } from 'lucide-react';

type ServiceCardProps = {
  service: {
    title: string;
    icon: LucideIcon;
    price: string;
    duration: string;
    description: string;
    benefits: string[];
  };
};

export function ServiceCard({ service }: ServiceCardProps) {
  const Icon = service.icon;

  return (
    <article className="group rounded-lg border border-white/10 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-gold/50 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-gold/10 text-gold">
          <Icon />
        </div>
        <div className="text-right">
          <p className="font-bold text-gold">{service.price}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-platinum/45">{service.duration}</p>
        </div>
      </div>
      <h3 className="mt-6 text-xl font-bold text-white">{service.title}</h3>
      <p className="mt-3 text-sm leading-7 text-platinum/65">{service.description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {service.benefits.map((benefit) => (
          <span key={benefit} className="rounded-full border border-white/10 px-3 py-1 text-xs text-platinum/70">
            {benefit}
          </span>
        ))}
      </div>
    </article>
  );
}
