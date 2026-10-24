import '../src/styles/index.css';
import '../src/styles/hud.css';

export const metadata = {
  title: 'AetherBound: Dragon Hunt',
  description: 'Scavenge, survive, and hunt the dragon in a multiplayer free-for-all.',
  applicationName: 'AetherBound',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AetherBound',
  },
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#11191b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
