'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

declare global {
  interface Window {
    ymaps?: {
      ready(callback: () => void): void;
      Map: new (element: HTMLElement, state: { center: number[]; zoom: number }) => {
        geoObjects: { add(object: unknown): void };
        events: { add(name: 'click', callback: (event: { get(key: 'coords'): number[] }) => void): void };
        destroy(): void;
      };
      Placemark: new (coordinates: number[], properties?: object, options?: object) => {
        geometry: { setCoordinates(coordinates: number[]): void; getCoordinates(): number[] };
        events: { add(name: 'dragend', callback: () => void): void };
      };
    };
  }
}

export function YandexMap({ latitude, longitude, onCoordinatesChange, readOnly = false }: { latitude: number; longitude: number; onCoordinatesChange?: (coordinates: readonly number[]) => void; readOnly?: boolean }) {
  const t = useTranslations('matches.map');
  const locale = useLocale();
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!key);

  useEffect(() => {
    if (!key || !element.current) return;
    let map: { geoObjects: { add(object: unknown): void }; events: { add(name: 'click', callback: (event: { get(key: 'coords'): number[] }) => void): void }; destroy(): void } | undefined;
    let initialized = false;
    const failureTimer = window.setTimeout(() => { if (!initialized) setFailed(true); }, 8_000);
    const initialize = () => {
      if (!window.ymaps) { setFailed(true); return; }
      window.ymaps.ready(() => {
      if (!element.current || !window.ymaps) { setFailed(true); return; }
      initialized = true;
      window.clearTimeout(failureTimer);
      map = new window.ymaps.Map(element.current, { center: [latitude, longitude], zoom: 15 });
      const pin = new window.ymaps.Placemark([latitude, longitude], {}, { draggable: !readOnly });
      map.geoObjects.add(pin);
      if (!readOnly) {
        map.events.add('click', (event) => {
          const coordinates = event.get('coords');
          pin.geometry.setCoordinates(coordinates);
          onCoordinatesChange?.(coordinates);
        });
        pin.events.add('dragend', () => onCoordinatesChange?.(pin.geometry.getCoordinates()));
      }
    });
    };
    if (window.ymaps) initialize();
    else {
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=${locale === 'ru' ? 'ru_RU' : 'en_US'}`;
      script.async = true;
      script.onload = initialize;
      script.onerror = () => setFailed(true);
      document.head.append(script);
    }
    return () => { window.clearTimeout(failureTimer); map?.destroy(); };
  }, [key, latitude, locale, longitude, onCoordinatesChange, readOnly]);

  if (failed) return <div className="flex min-h-48 items-center justify-center rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">{t('fallback')}</div>;
  return <div>{!readOnly && <p className="mb-2 text-sm text-muted-foreground">{t('instructions')}</p>}<div ref={element} className="min-h-64 overflow-hidden rounded-xl bg-muted" aria-label={t('label')} /></div>;
}
