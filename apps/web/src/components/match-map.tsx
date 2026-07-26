'use client';

import type { MatchSearchItem } from '@futzone/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface YmapsPlacemark { _futzone?: true }
interface YmapsClusterer {
  add(objects: YmapsPlacemark[]): void;
  getBounds(): number[][] | null;
}
interface YmapsMap {
  geoObjects: { add(object: unknown): void };
  setBounds(bounds: number[][], options?: { checkZoomRange?: boolean; zoomMargin?: number }): void;
  setCenter(center: number[], zoom?: number): void;
  destroy(): void;
}
interface YmapsApi {
  ready(callback: () => void): void;
  Map: new (element: HTMLElement, state: { center: number[]; zoom: number }, options?: object) => YmapsMap;
  Placemark: new (coordinates: number[], properties: object, options?: object) => YmapsPlacemark;
  Clusterer: new (options?: object) => YmapsClusterer;
}
const getYmaps = (): YmapsApi | undefined => (globalThis as { ymaps?: YmapsApi }).ymaps;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));

/** A read-only map of the current result set: clustered match pins whose balloon is a mini match card linking to the match page. */
export function MatchMap({ matches }: { matches: MatchSearchItem[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!key);

  useEffect(() => {
    if (!key || !element.current) return;
    const pins = matches.filter((match) => match.latitude != null && match.longitude != null);
    let map: YmapsMap | undefined;
    let initialized = false;
    const failureTimer = window.setTimeout(() => { if (!initialized) setFailed(true); }, 8_000);
    const dateFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
    const priceFormat = new Intl.NumberFormat(locale);

    const build = () => {
      const ymaps = getYmaps();
      if (!ymaps || !element.current) { setFailed(true); return; }
      ymaps.ready(() => {
        if (!element.current) { setFailed(true); return; }
        initialized = true;
        window.clearTimeout(failureTimer);
        const firstPin = pins[0];
        const center = firstPin ? [firstPin.latitude as number, firstPin.longitude as number] : [41.311081, 69.240562];
        map = new ymaps.Map(element.current, { center, zoom: 11 }, { suppressMapOpenBlock: true });
        const clusterer = new ymaps.Clusterer({ preset: 'islands#invertedGreenClusterIcon', groupByCoordinates: false });
        const placemarks = pins.map((match) => {
          const href = `/${locale}/matches/${match.slug}`;
          const free = t('matches.list.freeSlots', { count: match.freeSlots });
          const body = `<div style="min-width:180px"><p style="margin:0 0 4px;color:#64748b;font-size:12px">${escapeHtml(dateFormat.format(new Date(match.startsAt)))}</p>`
            + `<p style="margin:0 0 6px;font-size:13px">${escapeHtml(`${match.format} · ${priceFormat.format(match.perPlayerFeeUzs)} UZS · ${free}`)}</p>`
            + `<a href="${escapeHtml(href)}" style="color:#16a34a;font-weight:600;font-size:13px">${escapeHtml(t('matches.list.viewMatch'))}</a></div>`;
          return new ymaps.Placemark([match.latitude as number, match.longitude as number], { balloonContentHeader: escapeHtml(match.title), balloonContentBody: body, hintContent: escapeHtml(match.title) }, { preset: 'islands#greenSportIcon' });
        });
        clusterer.add(placemarks);
        map.geoObjects.add(clusterer);
        const bounds = clusterer.getBounds();
        if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40 });
      });
    };

    if (getYmaps()) build();
    else {
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=${locale === 'ru' ? 'ru_RU' : 'en_US'}`;
      script.async = true;
      script.onload = build;
      script.onerror = () => setFailed(true);
      document.head.append(script);
    }
    return () => { window.clearTimeout(failureTimer); map?.destroy(); };
  }, [key, locale, matches, t]);

  if (failed) return <div className="flex min-h-96 items-center justify-center rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">{t('matches.map.fallback')}</div>;
  return <div ref={element} className="min-h-96 overflow-hidden rounded-xl bg-muted" aria-label={t('matches.map.label')} />;
}
