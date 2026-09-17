import { useState, useEffect, useCallback } from 'react';

export interface AppUrlState {
  tab: 'home' | 'cases' | 'district' | 'analytics' | 'compare';
  districtId: number | null;
  districtName: string | null;
  districtsLayer: boolean;
  crimeLayer: boolean;
  infraLayer: boolean;
  opacity: number;
}

const DEFAULT_STATE: AppUrlState = {
  tab: 'home',
  districtId: null,
  districtName: null,
  districtsLayer: true,
  crimeLayer: false,
  infraLayer: false,
  opacity: 0.7,
};

export function useUrlState(): [AppUrlState, (updates: Partial<AppUrlState>) => void] {
  const readFromUrl = useCallback((): AppUrlState => {
    if (typeof window === 'undefined') return DEFAULT_STATE;

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as AppUrlState['tab'];
    const validTabs: AppUrlState['tab'][] = ['home', 'cases', 'district', 'analytics', 'compare'];

    const districtIdParam = params.get('district_id');
    const districtId = districtIdParam ? parseInt(districtIdParam, 10) : null;

    const opacityParam = params.get('opacity');
    const opacity = opacityParam ? Math.max(0, Math.min(1, parseFloat(opacityParam))) : 0.7;

    return {
      tab: validTabs.includes(tabParam) ? tabParam : 'home',
      districtId: !isNaN(districtId as number) ? districtId : null,
      districtName: params.get('district_name') || null,
      districtsLayer: params.get('districts') !== '0',
      crimeLayer: params.get('crime') === '1',
      infraLayer: params.get('infra') === '1',
      opacity: isNaN(opacity) ? 0.7 : opacity,
    };
  }, []);

  const [state, setState] = useState<AppUrlState>(readFromUrl);

  const setUrlState = useCallback(
    (updates: Partial<AppUrlState>) => {
      setState((prev) => {
        const next = { ...prev, ...updates };
        const params = new URLSearchParams();

        if (next.tab !== 'home') params.set('tab', next.tab);
        if (next.districtId) {
          params.set('district_id', String(next.districtId));
          if (next.districtName) params.set('district_name', next.districtName);
        }
        if (!next.districtsLayer) params.set('districts', '0');
        if (next.crimeLayer) params.set('crime', '1');
        if (next.infraLayer) params.set('infra', '1');
        if (next.opacity !== 0.7) params.set('opacity', String(Math.round(next.opacity * 100) / 100));

        const query = params.toString();
        const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        return next;
      });
    },
    []
  );

  useEffect(() => {
    const handlePopState = () => {
      setState(readFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [readFromUrl]);

  return [state, setUrlState];
}
