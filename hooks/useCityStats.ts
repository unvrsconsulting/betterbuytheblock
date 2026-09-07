import { useEffect, useState } from 'react';
import { CityStats } from '../types';
import { loadCityStats } from '../services/cityStats';

export const useCityStats = () => {
  const [cityStats, setCityStats] = useState<Record<string, CityStats>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadCityStats().then(stats => {
      if (!cancelled) {
        setCityStats(stats);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { cityStats, isLoading };
};
