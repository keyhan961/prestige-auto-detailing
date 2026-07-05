export const serviceSlugs = [
  'exterior-detailing',
  'interior-detailing',
  'paint-correction',
  'ceramic-coating',
  'engine-bay-cleaning',
  'full-detail-package',
] as const;

export function serviceBookingPath(index: number) {
  return `/services/${serviceSlugs[index]}/book`;
}

export function serviceIndexFromSlug(slug: string | undefined) {
  return serviceSlugs.findIndex((item) => item === slug);
}
