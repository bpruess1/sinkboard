import { useEffect, useState } from 'react';

export function useVisibility(): boolean {
  const [visible, setVisible] = useState(document.visibilityState === 'visible');

  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return visible;
}
