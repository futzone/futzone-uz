import { occupancyPercent } from '@/lib/matches';

export function OccupancyBar({ occupiedSlots, totalSlots, label }: { occupiedSlots: number; totalSlots: number; label: string }) {
  const percent = occupancyPercent({ occupiedSlots, totalSlots });
  return <div>
    <div className="mb-2 flex justify-between text-sm"><span>{label}</span><span>{occupiedSlots}/{totalSlots}</span></div>
    <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={totalSlots} aria-valuenow={occupiedSlots}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  </div>;
}
