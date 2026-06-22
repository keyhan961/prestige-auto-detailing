type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  copy?: string;
};

export function SectionHeading({ eyebrow, title, copy }: SectionHeadingProps) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.35em] text-gold">{eyebrow}</p>
      <h2 className="redline mt-4 break-words font-display text-3xl leading-tight text-white sm:text-4xl md:text-5xl">{title}</h2>
      {copy && <p className="mt-5 break-words leading-7 text-platinum/65">{copy}</p>}
    </div>
  );
}
