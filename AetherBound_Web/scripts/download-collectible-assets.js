import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '../public/models/collectibles');

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/shorepine/kenney/main/3d';

const ASSETS_TO_DOWNLOAD = [
  // Survival pack
  { pack: 'survival', file: 'bottle.glb' },
  { pack: 'survival', file: 'bottle-large.glb' },
  { pack: 'survival', file: 'chest.glb' },
  { pack: 'survival', file: 'resource-wood.glb' },
  { pack: 'survival', file: 'resource-stone-large.glb' },
  { pack: 'survival', file: 'grass-large.glb' },
  { pack: 'survival', file: 'Textures/colormap.png' },

  // Platformer pack
  { pack: 'platformer', file: 'heart.glb' },
  { pack: 'platformer', file: 'jewel.glb' },
  { pack: 'platformer', file: 'star.glb' },
  { pack: 'platformer', file: 'bomb.glb' },
  { pack: 'platformer', file: 'coin-gold.glb' },
  { pack: 'platformer', file: 'Textures/colormap.png' },

  // Mini-Dungeon pack
  { pack: 'mini-dungeon', file: 'shield-round.glb' },
  { pack: 'mini-dungeon', file: 'shield-rectangle.glb' },
  { pack: 'mini-dungeon', file: 'Textures/colormap.png' },

  // Tower Defense pack
  { pack: 'tower-defense', file: 'detail-crystal-large.glb' },
  { pack: 'tower-defense', file: 'detail-crystal.glb' },
  { pack: 'tower-defense', file: 'Textures/colormap.png' },

  // Space pack
  { pack: 'space', file: 'satelliteDish.glb' },
  { pack: 'space', file: 'rock_crystalsLargeA.glb' },
  { pack: 'space', file: 'machine_barrel.glb' },

  // Weapon pack
  { pack: 'weapon', file: 'ammo_machinegun.glb' },
  { pack: 'weapon', file: 'ammo_sniper.glb' },
  { pack: 'weapon', file: 'ammo_rocket.glb' },
  { pack: 'weapon', file: 'grenade.glb' },

  // Factory pack
  { pack: 'factory', file: 'cog-b.glb' },
  { pack: 'factory', file: 'Textures/colormap.png' },

  // Space-station pack
  { pack: 'space-station', file: 'container-tall.glb' },
  { pack: 'space-station', file: 'Textures/colormap.png' },
];

async function downloadFile(pack, file) {
  const url = `${GITHUB_RAW_BASE}/${pack}/${file}`;
  const targetPath = path.join(baseDir, pack, file);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (HTTP ${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(targetPath, buffer);
  console.log(`✓ Downloaded [${pack}] ${file} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log('Downloading 3D realistic collectible models from CC0 open-license repository...');
  let count = 0;
  for (const item of ASSETS_TO_DOWNLOAD) {
    try {
      await downloadFile(item.pack, item.file);
      count++;
    } catch (err) {
      console.error(`✗ Error downloading ${item.pack}/${item.file}:`, err.message);
    }
  }
  console.log(`\nSuccessfully downloaded ${count} of ${ASSETS_TO_DOWNLOAD.length} collectible assets into public/models/collectibles.`);
}

main().catch(console.error);
