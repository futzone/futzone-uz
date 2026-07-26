import { MatchDetailView } from '@/components/match-detail';

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchDetailView id={id} />;
}
