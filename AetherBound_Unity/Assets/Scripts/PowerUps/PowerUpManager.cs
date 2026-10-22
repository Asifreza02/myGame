using System;
using System.Collections.Generic;
using UnityEngine;

namespace AetherBound
{
    public class PowerUpManager : MonoBehaviour
    {
        public static PowerUpManager Instance { get; private set; }

        private readonly List<GameObject> activeChests = new List<GameObject>();
        private readonly HashSet<Vector2Int> populatedChunks = new HashSet<Vector2Int>();

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);
        }

        private void Start()
        {
            if (WorldManager.Instance != null)
            {
                WorldManager.Instance.OnChunkCreated += HandleChunkCreated;
                WorldManager.Instance.OnChunksCleared += ClearAll;
            }
        }

        private void OnDestroy()
        {
            if (WorldManager.Instance != null)
            {
                WorldManager.Instance.OnChunkCreated -= HandleChunkCreated;
                WorldManager.Instance.OnChunksCleared -= ClearAll;
            }
        }

        public void PopulateArenaPowerUps()
        {
            ClearAll();

            // Spawn guaranteed power-ups along corridor path
            Vector3[] pathWaypoints = new Vector3[]
            {
                new Vector3(-8f, 0f, 18f),
                new Vector3(8f, 0f, 32f),
                new Vector3(-6f, 0f, 48f),
                new Vector3(7f, 0f, 62f)
            };

            PowerUpType[] types = new PowerUpType[]
            {
                PowerUpType.Speed,
                PowerUpType.Shield,
                PowerUpType.Jump,
                PowerUpType.Health
            };

            for (int i = 0; i < pathWaypoints.Length; i++)
            {
                Vector3 p = pathWaypoints[i];
                float y = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(p.x, p.z) + 1.1f : 1.1f;
                SpawnChest(types[i % types.Length], new Vector3(p.x, y, p.z));
            }
        }

        private void HandleChunkCreated(int cx, int cz)
        {
            var coord = new Vector2Int(cx, cz);
            if (populatedChunks.Contains(coord)) return;
            populatedChunks.Add(coord);

            // Spawn additional dynamic power-up chests on outer chunks
            if ((cx + cz) % 2 != 0)
            {
                float x = cx * GameConfig.ChunkSize + 14f;
                float z = cz * GameConfig.ChunkSize + 14f;
                float y = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(x, z) + 1.1f : 1.1f;
                Vector3 pos = new Vector3(x, y, z);

                if (SpawnSanctuary.Instance != null && SpawnSanctuary.Instance.IsInsideSanctuary(pos)) return;
                if (GoalBeacon.Instance != null && GoalBeacon.Instance.IsInsideSanctuary(pos)) return;

                PowerUpType type = (PowerUpType)UnityEngine.Random.Range(0, 4);
                SpawnChest(type, pos);
            }
        }

        public void SpawnChest(PowerUpType type, Vector3 pos)
        {
            var go = new GameObject($"PowerUp_{type}");
            go.transform.parent = transform;
            go.transform.position = pos;

            var item = go.AddComponent<PowerUpItem>();

            Color c = Color.yellow;
            switch (type)
            {
                case PowerUpType.Speed: c = new Color(1f, 0.9f, 0f); break;       // Aether Surge (Yellow)
                case PowerUpType.Jump: c = new Color(0.2f, 1f, 0.5f); break;      // Wings of Light (Emerald)
                case PowerUpType.Shield: c = new Color(0f, 0.85f, 1f); break;     // Aegis Shield (Cyan)
                case PowerUpType.Health: c = new Color(1f, 0.2f, 0.45f); break;   // Vitality (Crimson)
            }

            item.Initialize(type, c);
            activeChests.Add(go);
        }

        public void ClearAll()
        {
            foreach (var go in activeChests)
            {
                if (go != null)
                {
                    if (Application.isPlaying) Destroy(go);
                    else DestroyImmediate(go);
                }
            }
            activeChests.Clear();
            populatedChunks.Clear();
        }
    }
}
