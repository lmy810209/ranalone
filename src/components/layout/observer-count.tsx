"use client";

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

export function ObserverCount() {
  const [count, setCount] = useState(12847);

  useEffect(() => {
    const baseCount = 12847;
    // This function will run only on the client
    const updateCount = () => {
      const fluctuation = Math.floor(Math.random() * 50) - 25;
      setCount(baseCount + fluctuation);
    };
    
    updateCount(); // Set initial client-side value
    const interval = setInterval(updateCount, 3000 + Math.random() * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
      <Eye className="h-4 w-4 text-primary" />
      <span className='hidden sm:inline-block'>{count.toLocaleString()} humans are watching</span>
      <span className='sm:hidden'>{count.toLocaleString()}</span>
    </div>
  );
}
