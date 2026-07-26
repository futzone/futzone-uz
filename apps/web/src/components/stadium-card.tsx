import type { Stadium } from '@futzone/contracts';
import { Badge, Card } from '@futzone/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { stadiumName } from '@/lib/stadiums';

export async function StadiumCard({ stadium, locale }: { stadium: Stadium; locale: string }) {
  const t = await getTranslations();
  return <Link href={`/stadiums/${stadium.slug}`} className="block">
    <Card className="h-full p-5 transition-shadow hover:shadow-md">
      <h3 className="text-lg font-semibold">{stadiumName(stadium, locale)}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{stadium.district} · {stadium.address}</p>
      <Badge variant="outline" className="mt-3">{t(`matches.wizard.surfaces.${stadium.surface}`)}</Badge>
    </Card>
  </Link>;
}
