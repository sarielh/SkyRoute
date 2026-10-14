import { useEffect, useState } from 'react';
import type { AirportDTO } from '../shared';
import { api } from '../api';

let cache: Promise<Map<string, AirportDTO>> | null = null;

/** Full airport list (loaded once) for showing city names next to IATA codes. */
export function useAirportMap(): Map<string, AirportDTO> {
  const [map, setMap] = useState<Map<string, AirportDTO>>(new Map());
  useEffect(() => {
    if (!cache) {
      cache = api
        .airports('', 100)
        .then((r) => new Map(r.airports.map((a) => [a.code, a])))
        .catch((err) => {
          cache = null;
          throw err;
        });
    }
    let alive = true;
    cache.then((m) => alive && setMap(m)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return map;
}
