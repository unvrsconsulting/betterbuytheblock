import { useEffect, useState } from 'react';
import { Neighborhood } from '../types';
import { loadNeighborhoods } from '../services/neighborhoods';

export const useNeighborhoods = () => {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadNeighborhoods().then(list => {
      if (!cancelled) {
        setNeighborhoods(list);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { neighborhoods, isLoading };
};
