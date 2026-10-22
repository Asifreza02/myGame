export default function manifest() {
  return {
    name: 'AetherBound: Sabotage',
    short_name: 'AetherBound',
    description: 'Outrun the traps or control the terrain in AetherBound.',
    start_url: '/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#11191b',
    theme_color: '#11191b',
    icons: [
      {
        src: '/aetherbound-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
