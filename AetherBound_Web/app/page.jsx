'use client';

import dynamic from 'next/dynamic';

const GameApp = dynamic(() => import('../src/App.jsx'), {
  ssr: false,
  loading: () => <main aria-label="Loading AetherBound" />,
});

export default function Page() {
  return <GameApp />;
}
