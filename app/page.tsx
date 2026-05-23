'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from '@/components/chat-panel';
import { StatsSidebar } from '@/components/stats-sidebar';
import {
  clearLifterState,
  loadLifterState,
  saveLifterState,
} from '@/lib/storage';
import { DEFAULT_LIFTER_STATE } from '@/lib/types';
import type { LifterState } from '@/lib/types';

export default function Home() {
  const [lifterState, setLifterState] = useState<LifterState>(DEFAULT_LIFTER_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLifterState(loadLifterState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveLifterState(lifterState), 300);
    return () => clearTimeout(t);
  }, [lifterState, hydrated]);

  function handleReset() {
    clearLifterState();
    setLifterState(DEFAULT_LIFTER_STATE);
  }

  return (
    <main className="flex h-screen w-screen flex-col md:flex-row">
      <aside className="w-full border-b border-zinc-800 md:h-full md:w-[380px] md:flex-shrink-0 md:border-b-0 md:border-r">
        <StatsSidebar
          lifterState={lifterState}
          onChange={setLifterState}
          onReset={handleReset}
        />
      </aside>
      <ChatPanel lifterState={hydrated ? lifterState : null} />
    </main>
  );
}
