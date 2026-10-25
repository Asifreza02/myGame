const kits = ['space', 'space-station', 'pirate', 'platformer', 'nature', 'survival'];

async function check() {
  for (const kit of kits) {
    try {
      const res = await fetch(`https://api.github.com/repos/shorepine/kenney/contents/3d/${kit}`, {
        headers: { 'User-Agent': 'Antigravity' }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        const glbs = data.map(f => f.name).filter(n => n.endsWith('.glb'));
        console.log(`=== KIT: ${kit} (${glbs.length} models) ===`);
        console.log(glbs.slice(0, 30).join(', '));
      }
    } catch (e) {
      console.error(kit, e);
    }
  }
}
check();
