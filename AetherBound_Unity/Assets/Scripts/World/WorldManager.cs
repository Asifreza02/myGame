using System;
using System.Collections.Generic;
using UnityEngine;

namespace AetherBound
{
    public class TerrainChunk
    {
        public int cx;
        public int cz;
        public GameObject gameObject;
        public Mesh mesh;
        public MeshCollider meshCollider;
        public GameObject propsParent;
        public GameObject waterPlane;
    }

    public class WorldManager : MonoBehaviour
    {
        [Header("World Settings (2km Radius Field with Ridges)")]
        public int seed = 1337;
        public int chunkSize = GameConfig.ChunkSize;
        public int segments = GameConfig.ChunkSegments;
        public int renderDistance = GameConfig.RenderDistance;
        public Material terrainMaterial;
        public Material waterMaterial;
        public Material lavaMaterial;

        [Header("Prop Settings (Disabled for Minimal Open Field)")]
        public bool spawnNatureProps = false;

        private FastSimplexNoise noise;
        private readonly Dictionary<Vector2Int, TerrainChunk> activeChunks = new Dictionary<Vector2Int, TerrainChunk>();

        public event Action<int, int> OnChunkCreated;
        public event Action OnChunksCleared;

        public static WorldManager Instance { get; private set; }

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            noise = new FastSimplexNoise(seed);
            EnsureMaterials();
        }

        private void Start()
        {
            InitializeWorld();

            if (FindAnyObjectByType<SpawnSanctuary>() == null)
            {
                var sanctuaryObj = new GameObject("SpawnSanctuary");
                sanctuaryObj.transform.parent = transform;
                sanctuaryObj.transform.position = Vector3.zero;
                sanctuaryObj.AddComponent<SpawnSanctuary>();
            }
        }

        private void EnsureMaterials()
        {
#if UNITY_EDITOR
            if (terrainMaterial == null)
            {
                terrainMaterial = UnityEditor.AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/Environment/M_Terrain.mat");
            }
#endif
            if (terrainMaterial == null)
            {
                Shader tShader = Shader.Find("AetherBound/Terrain") ?? Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                terrainMaterial = new Material(tShader) { name = "Mat_ProceduralTerrain" };
                if (terrainMaterial.HasProperty("_CliffColor"))
                {
                    terrainMaterial.SetColor("_CliffColor", new Color(0.28f, 0.29f, 0.32f, 1f));
                    terrainMaterial.SetFloat("_CliffThreshold", 0.55f);
                    terrainMaterial.SetFloat("_CliffSoftness", 0.15f);
                }
            }
        }

        public void SetSeed(int newSeed)
        {
            seed = newSeed;
            noise = new FastSimplexNoise(newSeed);
            InitializeWorld();
        }

        public void ClearAllChunks()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                var child = transform.GetChild(i);
                if (child.name.StartsWith("Chunk_") || child.name == "ArenaBoundaries" || child.name == "LandmarkBuildings")
                {
                    if (Application.isPlaying)
                    {
                        child.SetParent(null);
                        Destroy(child.gameObject);
                    }
                    else
                    {
                        DestroyImmediate(child.gameObject);
                    }
                }
            }

            activeChunks.Clear();
            OnChunksCleared?.Invoke();
        }

        public struct BiomeWeights
        {
            public float snow;
            public float desert;
            public float volcanic;
            public float lush;
        }

        public BiomeWeights GetBiomeWeights(float x, float z)
        {
            return new BiomeWeights { snow = 0f, desert = 0f, volcanic = 0f, lush = 1.0f };
        }

        public BiomeType GetDominantBiome(float x, float z)
        {
            return BiomeType.Lush;
        }

        /// <summary>
        /// Height profile: Pure rolling meadow field with sweeping, natural ridge lines.
        /// </summary>
        public float GetHeightAt(float x, float z)
        {
            if (noise == null) noise = new FastSimplexNoise(seed);

            float distSq = x * x + z * z;
            if (distSq < 35f * 35f)
            {
                return 0.8f; // Level, safe starting meadow around SpawnSanctuary
            }

            float dist = Mathf.Sqrt(distSq);

            // 1. Broad rolling field undulation (gentle meadow swells)
            float baseField = (noise.Noise2D(x * 0.0012f, z * 0.0012f) * 0.65f +
                               noise.Noise2D(x * 0.0025f + 140f, z * 0.0025f + 140f) * 0.35f) * 5.0f;

            // 2. Primary ridge system (crisp elevated crests running through the landscape)
            float r1 = 1.0f - Mathf.Abs(noise.Noise2D(x * 0.0018f + 250f, z * 0.0018f - 180f));
            r1 = Mathf.Clamp01(r1);
            float ridge1 = Mathf.Pow(r1, 3.2f) * 26.0f;

            // 3. Secondary cross ridge system
            float r2 = 1.0f - Mathf.Abs(noise.Noise2D(x * 0.0028f - 320f, z * 0.0028f + 410f));
            r2 = Mathf.Clamp01(r2);
            float ridge2 = Mathf.Pow(r2, 2.8f) * 16.0f;

            // 4. Subtle terrain micro-relief
            float micro = noise.Noise2D(x * 0.008f, z * 0.008f) * 0.5f;

            float height = 0.8f + baseField + ridge1 + ridge2 + micro;

            // Smooth transition near the sanctuary spawn zone
            if (dist < 70f)
            {
                float t = (dist - 35f) / 35f;
                height = Mathf.Lerp(0.8f, height, t * t);
            }

            return height;
        }

        public Color GetBiomeColor(float x, float z, float height)
        {
            if (noise == null) noise = new FastSimplexNoise(seed);

            // Natural field color variation (lush greens, warm golden meadow, subtle ridge crests)
            Color lushGrass = new Color(0.30f, 0.56f, 0.22f);      // Emerald field grass
            Color dryMeadow = new Color(0.44f, 0.54f, 0.26f);      // Sun-kissed meadow grass
            Color ridgeSoil = new Color(0.42f, 0.39f, 0.32f);      // Earthen ridge crest

            float noiseVal = noise.Noise2D(x * 0.005f, z * 0.005f) * 0.5f + 0.5f;
            Color col = Color.Lerp(lushGrass, dryMeadow, noiseVal);

            // Subtle soil tint on high ridge crests
            if (height > 12.0f)
            {
                float t = Mathf.Clamp01((height - 12.0f) / 14.0f);
                col = Color.Lerp(col, ridgeSoil, t * 0.65f);
            }

            return col;
        }

        public void InitializeWorld()
        {
            ClearAllChunks();
            EnsureMaterials();

            // Generate circular field terrain within 2km radius
            float radius = GameConfig.WorldRadius;
            float radiusSq = radius * radius;

            for (int cx = GameConfig.MinChunkX; cx <= GameConfig.MaxChunkX; cx++)
            {
                for (int cz = GameConfig.MinChunkZ; cz <= GameConfig.MaxChunkZ; cz++)
                {
                    // Check if chunk intersects the 2km radius circle
                    float minX = cx * chunkSize;
                    float maxX = (cx + 1) * chunkSize;
                    float minZ = cz * chunkSize;
                    float maxZ = (cz + 1) * chunkSize;

                    float clampX = Mathf.Clamp(0f, minX, maxX);
                    float clampZ = Mathf.Clamp(0f, minZ, maxZ);
                    float distSq = clampX * clampX + clampZ * clampZ;

                    // Skip chunks lying completely beyond 2km radius
                    if (distSq > radiusSq) continue;

                    GenerateChunk(cx, cz);
                }
            }

            // Generate landmark buildings spaced apart across the map
            GenerateLandmarkBuildings();

            // Build outer 2km radius boundary perimeter
            BuildArenaBoundaries();

            // Optimize for static batching
            if (Application.isPlaying)
            {
                StaticBatchingUtility.Combine(gameObject);
            }
        }

        public void UpdateWorld(Vector3 focusPosition)
        {
            if (activeChunks.Count == 0)
            {
                InitializeWorld();
            }
        }

        /// <summary>
        /// Generates the few distinct stone buildings spaced apart across the 2km radius map.
        /// </summary>
        public void GenerateLandmarkBuildings()
        {
            var oldBuildings = transform.Find("LandmarkBuildings");
            if (oldBuildings != null)
            {
                if (Application.isPlaying)
                {
                    oldBuildings.SetParent(null);
                    Destroy(oldBuildings.gameObject);
                }
                else DestroyImmediate(oldBuildings.gameObject);
            }

            var buildingsRoot = new GameObject("LandmarkBuildings");
            buildingsRoot.transform.parent = transform;

            // 1. North Ridge Watchtower (at Z=800m, landmark goal location)
            float y1 = GetHeightAt(0f, 800f);
            WorldBuildingBuilder.BuildWatchtower(buildingsRoot.transform, new Vector3(0f, y1, 800f), "NorthRidge_Watchtower");

            // 2. South Meadow Outpost (at X=-150m, Z=-750m)
            float y2 = GetHeightAt(-150f, -750f);
            WorldBuildingBuilder.BuildFortifiedOutpost(buildingsRoot.transform, new Vector3(-150f, y2, -750f), "SouthMeadow_Outpost");

            // 3. East Hillside Sanctuary (at X=850m, Z=200m)
            float y3 = GetHeightAt(850f, 200f);
            WorldBuildingBuilder.BuildPillaredSanctuary(buildingsRoot.transform, new Vector3(850f, y3, 200f), "EastHill_Sanctuary");

            // 4. West Ridge Stronghold Ruins (at X=-820m, Z=350m)
            float y4 = GetHeightAt(-820f, 350f);
            WorldBuildingBuilder.BuildAncientRuins(buildingsRoot.transform, new Vector3(-820f, y4, 350f), "WestRidge_Ruins");

            // 5. Northeast Guard Keep (at X=1100m, Z=1050m)
            float y5 = GetHeightAt(1100f, 1050f);
            WorldBuildingBuilder.BuildWatchtower(buildingsRoot.transform, new Vector3(1100f, y5, 1050f), "NorthEast_GuardKeep");

            // 6. Southwest Waystation (at X=-980m, Z=-920m)
            float y6 = GetHeightAt(-980f, -920f);
            WorldBuildingBuilder.BuildFortifiedOutpost(buildingsRoot.transform, new Vector3(-980f, y6, -920f), "SouthWest_Waystation");

            // 7. Northwest Monolith Shrine (at X=-1050m, Z=880m)
            float y7 = GetHeightAt(-1050f, 880f);
            WorldBuildingBuilder.BuildPillaredSanctuary(buildingsRoot.transform, new Vector3(-1050f, y7, 880f), "NorthWest_MonolithShrine");

            // 8. Southeast Ridge Rotunda (at X=1150m, Z=-900m)
            float y8 = GetHeightAt(1150f, -900f);
            WorldBuildingBuilder.BuildRotunda(buildingsRoot.transform, new Vector3(1150f, y8, -900f), "SouthEast_RidgeRotunda");

            buildingsRoot.isStatic = true;
            foreach (var t in buildingsRoot.GetComponentsInChildren<Transform>(true))
            {
                t.gameObject.isStatic = true;
            }
        }

        private void BuildArenaBoundaries()
        {
            var oldBounds = transform.Find("ArenaBoundaries");
            if (oldBounds != null)
            {
                if (Application.isPlaying)
                {
                    oldBounds.SetParent(null);
                    Destroy(oldBounds.gameObject);
                }
                else DestroyImmediate(oldBounds.gameObject);
            }

            var boundsRoot = new GameObject("ArenaBoundaries");
            boundsRoot.transform.parent = transform;

            int obstacleLayer = LayerMask.NameToLayer("Obstacle");
            if (obstacleLayer == -1) obstacleLayer = 0;

            // Circular perimeter collision wall (32 segments) at 2000m radius
            int segmentCount = 32;
            float radius = GameConfig.WorldRadius;
            float perimeter = 2f * Mathf.PI * radius;
            float segmentWidth = (perimeter / segmentCount) + 12f; // slight overlap
            float wallHeight = 28f;
            float wallThickness = 6f;

            for (int i = 0; i < segmentCount; i++)
            {
                float a1 = i * (Mathf.PI * 2f / segmentCount);
                float a2 = (i + 1) * (Mathf.PI * 2f / segmentCount);
                float midAngle = (a1 + a2) * 0.5f;

                float px = Mathf.Cos(midAngle) * radius;
                float pz = Mathf.Sin(midAngle) * radius;
                float py = GetHeightAt(px, pz) + wallHeight * 0.35f;

                var wallObj = new GameObject($"Boundary_Wall_{i}");
                wallObj.layer = obstacleLayer;
                wallObj.transform.parent = boundsRoot.transform;
                wallObj.transform.position = new Vector3(px, py, pz);
                wallObj.transform.rotation = Quaternion.Euler(0, -midAngle * Mathf.Rad2Deg + 90f, 0);

                var box = wallObj.AddComponent<BoxCollider>();
                box.size = new Vector3(segmentWidth, wallHeight, wallThickness);
                wallObj.isStatic = true;
            }

            boundsRoot.isStatic = true;
        }

        private void GenerateChunk(int cx, int cz)
        {
            var coord = new Vector2Int(cx, cz);
            var chunkGO = new GameObject($"Chunk_{cx}_{cz}");
            chunkGO.transform.parent = transform;
            int groundLayer = LayerMask.NameToLayer("Ground");
            chunkGO.layer = groundLayer != -1 ? groundLayer : 0;

            var meshFilter = chunkGO.AddComponent<MeshFilter>();
            var meshRenderer = chunkGO.AddComponent<MeshRenderer>();
            var meshCollider = chunkGO.AddComponent<MeshCollider>();

            if (terrainMaterial == null) EnsureMaterials();
            meshRenderer.sharedMaterial = terrainMaterial;

            int vertCount = (segments + 1) * (segments + 1);
            Vector3[] vertices = new Vector3[vertCount];
            Vector2[] uvs = new Vector2[vertCount];
            Color[] colors = new Color[vertCount];
            int[] triangles = new int[segments * segments * 6];

            float step = (float)chunkSize / segments;
            float startX = cx * chunkSize;
            float startZ = cz * chunkSize;

            int vIdx = 0;
            for (int z = 0; z <= segments; z++)
            {
                for (int x = 0; x <= segments; x++)
                {
                    float worldX = startX + x * step;
                    float worldZ = startZ + z * step;
                    float worldY = GetHeightAt(worldX, worldZ);

                    vertices[vIdx] = new Vector3(worldX, worldY, worldZ);
                    uvs[vIdx] = new Vector2((float)x / segments, (float)z / segments);
                    colors[vIdx] = GetBiomeColor(worldX, worldZ, worldY);
                    vIdx++;
                }
            }

            int tIdx = 0;
            for (int z = 0; z < segments; z++)
            {
                for (int x = 0; x < segments; x++)
                {
                    int root = z * (segments + 1) + x;
                    triangles[tIdx++] = root;
                    triangles[tIdx++] = root + segments + 1;
                    triangles[tIdx++] = root + 1;

                    triangles[tIdx++] = root + 1;
                    triangles[tIdx++] = root + segments + 1;
                    triangles[tIdx++] = root + segments + 2;
                }
            }

            Mesh mesh = new Mesh();
            mesh.name = $"TerrainMesh_{cx}_{cz}";
            mesh.vertices = vertices;
            mesh.triangles = triangles;
            mesh.uv = uvs;
            mesh.colors = colors;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            meshFilter.sharedMesh = mesh;
            meshCollider.sharedMesh = mesh;

            // Mark Chunk Static for Batching & Performance
            chunkGO.isStatic = true;
#if UNITY_EDITOR
            UnityEditor.GameObjectUtility.SetStaticEditorFlags(chunkGO,
                UnityEditor.StaticEditorFlags.BatchingStatic |
                UnityEditor.StaticEditorFlags.OccluderStatic |
                UnityEditor.StaticEditorFlags.OccludeeStatic);
#endif

            var chunk = new TerrainChunk
            {
                cx = cx,
                cz = cz,
                gameObject = chunkGO,
                mesh = mesh,
                meshCollider = meshCollider,
                propsParent = null,
                waterPlane = null
            };

            activeChunks.Add(coord, chunk);
            OnChunkCreated?.Invoke(cx, cz);
        }
    }

    public static class WorldBuildingBuilder
    {
        private static GameObject wallPrefab;
        private static GameObject pillarPrefab;
        private static GameObject monolithPrefab;
        private static GameObject torchPrefab;
        private static Material dungeonMat;

        public static void EnsureAssets()
        {
#if UNITY_EDITOR
            if (wallPrefab == null)
                wallPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Obstacle_Wall.prefab")
                             ?? UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/KayKit_Dungeon/wall.fbx");

            if (pillarPrefab == null)
                pillarPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Sanctuary_Pillar.prefab")
                               ?? UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/KayKit_Dungeon/pillar.fbx");

            if (monolithPrefab == null)
                monolithPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Sanctuary_Monolith.prefab")
                                 ?? UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/CC0_Nature/SM_AbstractZeusSculpture.fbx");

            if (torchPrefab == null)
                torchPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Beacon_Torch.prefab")
                              ?? UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/KayKit_Dungeon/torch_lit.fbx");

            if (dungeonMat == null)
                dungeonMat = UnityEditor.AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/Imported/Dungeon_Material.mat");
#endif
            if (dungeonMat == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                dungeonMat = new Material(shader) { name = "Mat_Dungeon_Stone", color = new Color(0.35f, 0.38f, 0.42f) };
            }
        }

        private static void MarkHierarchyStatic(GameObject go)
        {
            go.isStatic = true;
            int obsLayer = LayerMask.NameToLayer("Obstacle");
            if (obsLayer == -1) obsLayer = 0;

            foreach (var t in go.GetComponentsInChildren<Transform>(true))
            {
                t.gameObject.isStatic = true;
                if (t.gameObject.layer == 0 || t.gameObject.layer == LayerMask.NameToLayer("Default"))
                {
                    t.gameObject.layer = obsLayer;
                }
            }
        }

        public static GameObject BuildWatchtower(Transform parent, Vector3 pos, string buildingName = "NorthRidge_Watchtower")
        {
            EnsureAssets();
            var root = new GameObject(buildingName);
            root.transform.parent = parent;
            root.transform.position = pos;

            float w = 7.0f; // Half-width

            // 4 Colossal Corner Pillars
            PlacePillar(root.transform, new Vector3(-w, 0, -w), new Vector3(1.6f, 3.2f, 1.6f));
            PlacePillar(root.transform, new Vector3(w, 0, -w), new Vector3(1.6f, 3.2f, 1.6f));
            PlacePillar(root.transform, new Vector3(-w, 0, w), new Vector3(1.6f, 3.2f, 1.6f));
            PlacePillar(root.transform, new Vector3(w, 0, w), new Vector3(1.6f, 3.2f, 1.6f));

            // Perimeter Defensive Walls
            PlaceWall(root.transform, new Vector3(0, 0, w), Quaternion.Euler(0, 0, 0), new Vector3(3.2f, 2.2f, 1.4f));
            PlaceWall(root.transform, new Vector3(-w, 0, 0), Quaternion.Euler(0, 90, 0), new Vector3(3.2f, 2.2f, 1.4f));
            PlaceWall(root.transform, new Vector3(w, 0, 0), Quaternion.Euler(0, 90, 0), new Vector3(3.2f, 2.2f, 1.4f));
            PlaceWall(root.transform, new Vector3(-w * 0.6f, 0, -w), Quaternion.Euler(0, 0, 0), new Vector3(1.2f, 2.2f, 1.4f));
            PlaceWall(root.transform, new Vector3(w * 0.6f, 0, -w), Quaternion.Euler(0, 0, 0), new Vector3(1.2f, 2.2f, 1.4f));

            // Upper tier parapet & crown battlements
            PlacePillar(root.transform, new Vector3(-w * 0.7f, 6.4f, -w * 0.7f), new Vector3(1.2f, 2.0f, 1.2f));
            PlacePillar(root.transform, new Vector3(w * 0.7f, 6.4f, -w * 0.7f), new Vector3(1.2f, 2.0f, 1.2f));
            PlacePillar(root.transform, new Vector3(-w * 0.7f, 6.4f, w * 0.7f), new Vector3(1.2f, 2.0f, 1.2f));
            PlacePillar(root.transform, new Vector3(w * 0.7f, 6.4f, w * 0.7f), new Vector3(1.2f, 2.0f, 1.2f));

            MarkHierarchyStatic(root);
            return root;
        }

        public static GameObject BuildPillaredSanctuary(Transform parent, Vector3 pos, string buildingName = "EastHill_Sanctuary")
        {
            EnsureAssets();
            var root = new GameObject(buildingName);
            root.transform.parent = parent;
            root.transform.position = pos;

            float spanX = 8.0f;
            float spanZ = 12.0f;

            for (int i = 0; i < 4; i++)
            {
                float z = -spanZ * 0.5f + i * (spanZ / 3.0f);
                PlacePillar(root.transform, new Vector3(-spanX * 0.5f, 0, z), new Vector3(1.4f, 2.4f, 1.4f));
                PlacePillar(root.transform, new Vector3(spanX * 0.5f, 0, z), new Vector3(1.4f, 2.4f, 1.4f));
            }

            PlaceWall(root.transform, new Vector3(0, 0, spanZ * 0.5f + 1.2f), Quaternion.identity, new Vector3(3.5f, 2.4f, 1.5f));

            if (monolithPrefab != null)
            {
                var mon = UnityEngine.Object.Instantiate(monolithPrefab, root.transform);
                mon.name = "ShrineMonolith";
                mon.transform.localPosition = new Vector3(0, 0.4f, 2.0f);
                mon.transform.localRotation = Quaternion.Euler(0, 180f, 0);
                mon.transform.localScale = Vector3.one * 2.5f;
                EnsureBoxCollider(mon, new Vector3(2.2f, 6.5f, 2.2f), new Vector3(0, 3.2f, 0));
            }

            MarkHierarchyStatic(root);
            return root;
        }

        public static GameObject BuildFortifiedOutpost(Transform parent, Vector3 pos, string buildingName = "SouthMeadow_Outpost")
        {
            EnsureAssets();
            var root = new GameObject(buildingName);
            root.transform.parent = parent;
            root.transform.position = pos;

            float length = 16.0f;
            float width = 9.0f;

            PlacePillar(root.transform, new Vector3(-length * 0.5f, 0, -width * 0.5f), new Vector3(1.6f, 2.5f, 1.6f));
            PlacePillar(root.transform, new Vector3(length * 0.5f, 0, -width * 0.5f), new Vector3(1.6f, 2.5f, 1.6f));
            PlacePillar(root.transform, new Vector3(-length * 0.5f, 0, width * 0.5f), new Vector3(1.6f, 2.5f, 1.6f));
            PlacePillar(root.transform, new Vector3(length * 0.5f, 0, width * 0.5f), new Vector3(1.6f, 2.5f, 1.6f));

            PlacePillar(root.transform, new Vector3(0, 0, -width * 0.5f), new Vector3(1.3f, 2.2f, 1.3f));
            PlacePillar(root.transform, new Vector3(0, 0, width * 0.5f), new Vector3(1.3f, 2.2f, 1.3f));

            PlaceWall(root.transform, new Vector3(-length * 0.25f, 0, width * 0.5f), Quaternion.identity, new Vector3(2.5f, 2.0f, 1.3f));
            PlaceWall(root.transform, new Vector3(length * 0.25f, 0, width * 0.5f), Quaternion.identity, new Vector3(2.5f, 2.0f, 1.3f));
            PlaceWall(root.transform, new Vector3(-length * 0.25f, 0, -width * 0.5f), Quaternion.identity, new Vector3(2.5f, 2.0f, 1.3f));
            PlaceWall(root.transform, new Vector3(length * 0.35f, 0, -width * 0.5f), Quaternion.identity, new Vector3(1.4f, 2.0f, 1.3f));

            PlaceWall(root.transform, new Vector3(-length * 0.5f, 0, 0), Quaternion.Euler(0, 90, 0), new Vector3(2.8f, 2.0f, 1.3f));
            PlaceWall(root.transform, new Vector3(length * 0.5f, 0, 0), Quaternion.Euler(0, 90, 0), new Vector3(2.8f, 2.0f, 1.3f));

            MarkHierarchyStatic(root);
            return root;
        }

        public static GameObject BuildAncientRuins(Transform parent, Vector3 pos, string buildingName = "WestRidge_Ruins")
        {
            EnsureAssets();
            var root = new GameObject(buildingName);
            root.transform.parent = parent;
            root.transform.position = pos;

            float r = 11.0f;

            var p1 = PlacePillar(root.transform, new Vector3(-r, 0, -r), new Vector3(1.8f, 2.6f, 1.8f));
            var p2 = PlacePillar(root.transform, new Vector3(r, 0, -r), new Vector3(1.8f, 2.2f, 1.8f));
            var p3 = PlacePillar(root.transform, new Vector3(-r, 0, r), new Vector3(1.8f, 2.8f, 1.8f));
            var p4 = PlacePillar(root.transform, new Vector3(r, 0, r), new Vector3(1.8f, 1.8f, 1.8f));
            if (p2 != null) p2.transform.localRotation = Quaternion.Euler(2f, 15f, -3f);
            if (p4 != null) p4.transform.localRotation = Quaternion.Euler(-3f, 45f, 2f);

            PlaceWall(root.transform, new Vector3(0, 0, r), Quaternion.identity, new Vector3(3.6f, 2.2f, 1.4f));
            PlaceWall(root.transform, new Vector3(-r, 0, 0), Quaternion.Euler(0, 90, 0), new Vector3(3.2f, 2.0f, 1.4f));
            PlaceWall(root.transform, new Vector3(r, 0, 0), Quaternion.Euler(0, 90, 0), new Vector3(2.0f, 1.4f, 1.4f));
            PlaceWall(root.transform, new Vector3(-r * 0.5f, 0, -r), Quaternion.identity, new Vector3(1.6f, 1.8f, 1.4f));

            if (monolithPrefab != null)
            {
                var mon = UnityEngine.Object.Instantiate(monolithPrefab, root.transform);
                mon.name = "AncientMonolith";
                mon.transform.localPosition = new Vector3(0, 0.2f, 0);
                mon.transform.localRotation = Quaternion.Euler(0, 45f, 0);
                mon.transform.localScale = Vector3.one * 2.2f;
                EnsureBoxCollider(mon, new Vector3(2.0f, 6.0f, 2.0f), new Vector3(0, 3.0f, 0));
            }

            MarkHierarchyStatic(root);
            return root;
        }

        public static GameObject BuildRotunda(Transform parent, Vector3 pos, string buildingName = "Field_Rotunda")
        {
            EnsureAssets();
            var root = new GameObject(buildingName);
            root.transform.parent = parent;
            root.transform.position = pos;

            float radius = 7.5f;
            int pillarCount = 6;

            for (int i = 0; i < pillarCount; i++)
            {
                float angle = i * (Mathf.PI * 2f / pillarCount);
                Vector3 pPos = new Vector3(Mathf.Cos(angle) * radius, 0, Mathf.Sin(angle) * radius);
                PlacePillar(root.transform, pPos, new Vector3(1.3f, 2.2f, 1.3f));
            }

            if (monolithPrefab != null)
            {
                var altar = UnityEngine.Object.Instantiate(monolithPrefab, root.transform);
                altar.name = "RotundaAltar";
                altar.transform.localPosition = Vector3.zero;
                altar.transform.localScale = Vector3.one * 1.8f;
                EnsureBoxCollider(altar, new Vector3(1.6f, 4.5f, 1.6f), new Vector3(0, 2.25f, 0));
            }

            MarkHierarchyStatic(root);
            return root;
        }

        private static GameObject PlacePillar(Transform parent, Vector3 localPos, Vector3 localScale)
        {
            GameObject pillar;
            if (pillarPrefab != null)
            {
                pillar = UnityEngine.Object.Instantiate(pillarPrefab, parent);
                pillar.transform.localPosition = localPos;
                pillar.transform.localScale = localScale;
            }
            else
            {
                pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pillar.transform.parent = parent;
                pillar.transform.localPosition = localPos + Vector3.up * (localScale.y * 1.5f);
                pillar.transform.localScale = new Vector3(localScale.x, localScale.y * 1.5f, localScale.z);
                pillar.GetComponent<Renderer>().sharedMaterial = dungeonMat;
            }

            pillar.name = "StonePillar";
            EnsureBoxCollider(pillar, new Vector3(1.4f * localScale.x, 3.2f * localScale.y, 1.4f * localScale.z), new Vector3(0, 1.6f * localScale.y, 0));
            return pillar;
        }

        private static GameObject PlaceWall(Transform parent, Vector3 localPos, Quaternion localRot, Vector3 localScale)
        {
            GameObject wall;
            if (wallPrefab != null)
            {
                wall = UnityEngine.Object.Instantiate(wallPrefab, parent);
                wall.transform.localPosition = localPos;
                wall.transform.localRotation = localRot;
                wall.transform.localScale = localScale;
            }
            else
            {
                wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
                wall.transform.parent = parent;
                wall.transform.localPosition = localPos + Vector3.up * (localScale.y * 1.2f);
                wall.transform.localRotation = localRot;
                wall.transform.localScale = new Vector3(localScale.x * 2.4f, localScale.y * 2.4f, localScale.z * 0.8f);
                wall.GetComponent<Renderer>().sharedMaterial = dungeonMat;
            }

            wall.name = "StoneWall";
            EnsureBoxCollider(wall, new Vector3(2.6f * localScale.x, 2.6f * localScale.y, 0.9f * localScale.z), new Vector3(0, 1.3f * localScale.y, 0));
            return wall;
        }

        private static GameObject PlaceTorch(Transform parent, Vector3 localPos)
        {
            return null; // All torches/flames removed per user directive to eliminate blinking effects
        }

        private static void EnsureBoxCollider(GameObject go, Vector3 size, Vector3 center)
        {
            var col = go.GetComponent<Collider>();
            if (col == null)
            {
                var box = go.AddComponent<BoxCollider>();
                box.size = size;
                box.center = center;
            }
        }
    }
}
