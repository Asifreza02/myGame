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
            // All small floating/blinking powerup chests removed per user request
        }

        private void HandleChunkCreated(int cx, int cz)
        {
            // Kept clean and uncluttered across the 2km radius field
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
