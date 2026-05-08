import { useState, useEffect } from 'react';
import { getCurrentMinute } from '../utils/time';

export function useCurrentMinute(): number {
  const [minute, setMinute] = useState(getCurrentMinute);

  useEffect(() => {
    const id = setInterval(() => setMinute(getCurrentMinute()), 30_000);
    return () => clearInterval(id);
  }, []);

  return minute;
}
