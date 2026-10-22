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
        [Header("World Settings")]
        public int seed = 1337;
        public int chunkSize = GameConfig.ChunkSize;
        public int segments = GameConfig.ChunkSegments;
        public int renderDistance = GameConfig.RenderDistance;
        public Material terrainMaterial;
        public Material waterMaterial;
        public Material lavaMaterial;

        [Header("Prop Settings")]
        public bool spawnNatureProps = true;

        private FastSimplexNoise noise;
        private readonly Dictionary<Vector2Int, TerrainChunk> activeChunks = new Dictionary<Vector2Int, TerrainChunk>();
        private readonly List<Vector2Int> toRemove = new List<Vector2Int>();
        private readonly HashSet<Vector2Int> neededKeys = new HashSet<Vector2Int>();

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
            // Immediately generate the compact arena world and boundaries
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
            if (waterMaterial == null)
            {
                waterMaterial = UnityEditor.AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/Environment/M_Water.mat");
            }
            if (lavaMaterial == null)
            {
                lavaMaterial = UnityEditor.AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/Environment/M_Lava.mat");
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

            if (waterMaterial == null)
            {
                Shader wShader = Shader.Find("AetherBound/Water") ?? Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                waterMaterial = new Material(wShader) { name = "Mat_ProceduralWater" };
                if (waterMaterial.HasProperty("_ShallowColor"))
                {
                    waterMaterial.SetColor("_ShallowColor", new Color(0.2f, 0.78f, 0.88f, 0.75f));
                    waterMaterial.SetColor("_DeepColor", new Color(0.05f, 0.28f, 0.62f, 0.92f));
                }
                else
                {
                    waterMaterial.color = new Color(0.1f, 0.45f, 0.75f, 0.8f);
                }
            }

            if (lavaMaterial == null)
            {
                Shader lShader = Shader.Find("AetherBound/Lava") ?? Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                lavaMaterial = new Material(lShader) { name = "Mat_ProceduralLava" };
                if (lavaMaterial.HasProperty("_LavaCoreColor"))
                {
                    lavaMaterial.SetColor("_LavaCoreColor", new Color(3.0f, 0.8f, 0.05f, 1.0f));
                }
                else
                {
                    lavaMaterial.color = new Color(1.0f, 0.3f, 0.0f);
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
            foreach (var kvp in activeChunks)
            {
                if (kvp.Value.gameObject != null)
                {
                    Destroy(kvp.Value.gameObject);
                }
            }
            activeChunks.Clear();

            var oldBounds = transform.Find("ArenaBoundaries");
            if (oldBounds != null)
            {
                Destroy(oldBounds.gameObject);
            }

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
            float climateScale = 0.0028f;
            float temp = noise.Noise2D(x * climateScale, z * climateScale);
            float moisture = noise.Noise2D(x * climateScale + 350f, z * climateScale + 350f);

            float weightSnow = Mathf.Max(0f, -temp - 0.15f);
            float weightDesert = Mathf.Max(0f, temp - 0.15f) * Mathf.Max(0f, -moisture + 0.1f);
            float weightVolcanic = Mathf.Max(0f, temp - 0.2f) * Mathf.Max(0f, moisture + 0.1f);
            float weightLush = Mathf.Max(0.12f, 1.0f - (weightSnow * 1.8f + weightDesert * 1.8f + weightVolcanic * 1.8f));

            float total = weightSnow + weightDesert + weightVolcanic + weightLush;
            return new BiomeWeights
            {
                snow = weightSnow / total,
                desert = weightDesert / total,
                volcanic = weightVolcanic / total,
                lush = weightLush / total
            };
        }

        public BiomeType GetDominantBiome(float x, float z)
        {
            var w = GetBiomeWeights(x, z);
            if (w.snow > w.desert && w.snow > w.volcanic && w.snow > w.lush) return BiomeType.Snow;
            if (w.desert > w.snow && w.desert > w.volcanic && w.desert > w.lush) return BiomeType.Desert;
            if (w.volcanic > w.snow && w.volcanic > w.desert && w.volcanic > w.lush) return BiomeType.Volcanic;
            return BiomeType.Lush;
        }

        public float GetHeightAt(float x, float z)
        {
            float distFromOrigin = Mathf.Sqrt(x * x + z * z);
            if (distFromOrigin < 28f)
            {
                return 0.8f; // Safe flat starting meadow
            }

            var climate = GetBiomeWeights(x, z);

            // Green grass field is a level, flat plain
            if (climate.lush > 0.35f || distFromOrigin < 220f)
            {
                return 0.8f;
            }

            float nx = x * GameConfig.NoiseScale;
            float nz = z * GameConfig.NoiseScale;

            float baseH = (noise.Noise2D(nx, nz) * 0.75f + noise.Noise2D(nx * 2.2f, nz * 2.2f) * 0.25f);
            float heightMultiplier = climate.desert * 2.5f + climate.snow * 2.9f + climate.volcanic * 2.2f;
            float h = baseH * heightMultiplier + 0.8f;

            // Desert stepped mesa effect
            if (climate.desert > 0.35f)
            {
                float step = Mathf.Floor(h / 1.35f) * 1.35f;
                h = Mathf.Lerp(h, step, (climate.desert - 0.35f) * 0.75f);
            }

            // Natural water source depression in snow / volcanic biomes
            if (climate.snow > 0.35f || climate.volcanic > 0.35f)
            {
                float lakeNoise = noise.Noise2D(nx * 0.8f + 120f, nz * 0.8f + 120f);
                if (lakeNoise < -0.24f)
                {
                    float depth = ((-0.24f - lakeNoise) / 0.76f) * 3.6f;
                    h -= depth;
                }
            }

            return h;
        }

        public Color GetBiomeColor(float x, float z, float height)
        {
            var w = GetBiomeWeights(x, z);

            Color lushColor = new Color(0.28f, 0.58f, 0.22f);      // Vibrant lush green grass plain
            Color desertColor = new Color(0.83f, 0.60f, 0.36f);    // #d49a5b
            Color snowColor = new Color(0.93f, 0.96f, 0.99f);      // #eef5fc
            Color volcanicColor = new Color(0.14f, 0.14f, 0.16f);  // #232328

            Color col = lushColor * w.lush + desertColor * w.desert + snowColor * w.snow + volcanicColor * w.volcanic;

            // Altitude slope tint
            if (height > 4.5f)
            {
                col = Color.Lerp(col, Color.gray, 0.35f);
            }
            return col;
        }

        public void InitializeWorld()
        {
            ClearAllChunks();
            EnsureMaterials();

            for (int cx = GameConfig.MinChunkX; cx <= GameConfig.MaxChunkX; cx++)
            {
                for (int cz = GameConfig.MinChunkZ; cz <= GameConfig.MaxChunkZ; cz++)
                {
                    GenerateChunk(cx, cz);
                }
            }

            BuildArenaBoundaries();
        }

        public void UpdateWorld(Vector3 focusPosition)
        {
            if (activeChunks.Count == 0)
            {
                InitializeWorld();
            }
        }

        private void BuildArenaBoundaries()
        {
            var oldBounds = transform.Find("ArenaBoundaries");
            if (oldBounds != null) Destroy(oldBounds.gameObject);

            var boundsRoot = new GameObject("ArenaBoundaries");
            boundsRoot.transform.parent = transform;

            int obstacleLayer = LayerMask.NameToLayer("Obstacle");
            if (obstacleLayer == -1) obstacleLayer = 0;

            float minX = GameConfig.ArenaMinX;
            float maxX = GameConfig.ArenaMaxX;
            float minZ = GameConfig.ArenaMinZ;
            float maxZ = GameConfig.ArenaMaxZ;
            float groundY = 0.8f;
            float wallH = 14f;
            float wallThick = 2f;

            float centerX = (minX + maxX) * 0.5f;
            float centerZ = (minZ + maxZ) * 0.5f;
            float sizeX = maxX - minX;
            float sizeZ = maxZ - minZ;

            // Physical collision barriers on all 4 sides (prevent falling into the void)
            CreateBoundaryWall(boundsRoot.transform, "Wall_West", new Vector3(minX - wallThick * 0.5f, groundY + wallH * 0.5f, centerZ), new Vector3(wallThick, wallH, sizeZ + wallThick * 2f), obstacleLayer);
            CreateBoundaryWall(boundsRoot.transform, "Wall_East", new Vector3(maxX + wallThick * 0.5f, groundY + wallH * 0.5f, centerZ), new Vector3(wallThick, wallH, sizeZ + wallThick * 2f), obstacleLayer);
            CreateBoundaryWall(boundsRoot.transform, "Wall_South", new Vector3(centerX, groundY + wallH * 0.5f, minZ - wallThick * 0.5f), new Vector3(sizeX + wallThick * 2f, wallH, wallThick), obstacleLayer);
            CreateBoundaryWall(boundsRoot.transform, "Wall_North", new Vector3(centerX, groundY + wallH * 0.5f, maxZ + wallThick * 0.5f), new Vector3(sizeX + wallThick * 2f, wallH, wallThick), obstacleLayer);

            // Perimeter aesthetic pylons and glowing containment line
            CreatePerimeterVisuals(boundsRoot.transform, minX, maxX, minZ, maxZ, groundY);
        }

        private void CreateBoundaryWall(Transform parent, string name, Vector3 pos, Vector3 size, int layer)
        {
            var wallObj = new GameObject(name);
            wallObj.layer = layer;
            wallObj.transform.parent = parent;
            wallObj.transform.position = pos;

            var box = wallObj.AddComponent<BoxCollider>();
            box.size = size;
        }

        private void CreatePerimeterVisuals(Transform parent, float minX, float maxX, float minZ, float maxZ, float groundY)
        {
#if UNITY_EDITOR
            var pillarPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Sanctuary_Pillar.prefab");
#else
            GameObject pillarPrefab = null;
#endif

            // Place decorative boundary pylons along the edges
            float step = 20.0f;
            List<Vector3> perimeterNodes = new List<Vector3>();

            // Bottom edge (minZ): from minX to maxX
            for (float x = minX; x <= maxX + 0.1f; x += step)
                perimeterNodes.Add(new Vector3(Mathf.Min(x, maxX), groundY, minZ));

            // Right edge (maxX): from minZ to maxZ
            for (float z = minZ + step; z <= maxZ + 0.1f; z += step)
                perimeterNodes.Add(new Vector3(maxX, groundY, Mathf.Min(z, maxZ)));

            // Top edge (maxZ): from maxX down to minX
            for (float x = maxX - step; x >= minX - 0.1f; x -= step)
                perimeterNodes.Add(new Vector3(Mathf.Max(x, minX), groundY, maxZ));

            // Left edge (minX): from maxZ down to minZ
            for (float z = maxZ - step; z > minZ; z -= step)
                perimeterNodes.Add(new Vector3(minX, groundY, z));

            var stoneMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            stoneMat.color = new Color(0.25f, 0.28f, 0.35f);

            var runeMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            runeMat.color = new Color(0f, 0.85f, 1f);
            if (runeMat.HasProperty("_EmissionColor"))
            {
                runeMat.SetColor("_EmissionColor", new Color(0f, 1.8f, 2.2f));
                runeMat.EnableKeyword("_EMISSION");
            }

            int obstacleLayer = LayerMask.NameToLayer("Obstacle");
            if (obstacleLayer == -1) obstacleLayer = 0;

            foreach (var pos in perimeterNodes)
            {
                var pylon = new GameObject("BoundaryPylon");
                pylon.layer = obstacleLayer;
                pylon.transform.parent = parent;
                pylon.transform.position = pos;

                if (pillarPrefab != null)
                {
                    var p = Instantiate(pillarPrefab, pylon.transform);
                    p.layer = obstacleLayer;
                    foreach (var c in p.GetComponentsInChildren<Transform>(true)) c.gameObject.layer = obstacleLayer;
                    p.transform.localPosition = Vector3.zero;
                    p.transform.localScale = new Vector3(1.2f, 1.6f, 1.2f);
                }
                else
                {
                    var col = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    col.layer = obstacleLayer;
                    col.transform.parent = pylon.transform;
                    col.transform.localPosition = new Vector3(0, 1.2f, 0);
                    col.transform.localScale = new Vector3(0.8f, 1.2f, 0.8f);
                    col.GetComponent<Renderer>().sharedMaterial = stoneMat;
                }
            }

            // Glowing Aether boundary line perimeter
            var lineObj = new GameObject("PerimeterContainmentLine");
            lineObj.transform.parent = parent;
            lineObj.transform.position = Vector3.zero;

            var lr = lineObj.AddComponent<LineRenderer>();
            lr.useWorldSpace = true;
            lr.loop = true;
            lr.startWidth = 0.35f;
            lr.endWidth = 0.35f;

            Vector3[] linePoints = new Vector3[]
            {
                new Vector3(minX, groundY + 0.85f, minZ),
                new Vector3(maxX, groundY + 0.85f, minZ),
                new Vector3(maxX, groundY + 0.85f, maxZ),
                new Vector3(minX, groundY + 0.85f, maxZ)
            };
            lr.positionCount = linePoints.Length;
            lr.SetPositions(linePoints);

            var lineMat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            lineMat.color = new Color(0f, 1f, 1f, 0.8f);
            lr.material = lineMat;
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
            meshRenderer.material = terrainMaterial;

            int vertCount = (segments + 1) * (segments + 1);
            Vector3[] vertices = new Vector3[vertCount];
            Vector3[] normals = new Vector3[vertCount];
            Vector2[] uvs = new Vector2[vertCount];
            Color[] colors = new Color[vertCount];
            int[] triangles = new int[segments * segments * 6];

            float step = (float)chunkSize / segments;
            float startX = cx * chunkSize;
            float startZ = cz * chunkSize;

            float minHeight = float.MaxValue;
            int vIdx = 0;
            for (int z = 0; z <= segments; z++)
            {
                for (int x = 0; x <= segments; x++)
                {
                    float worldX = startX + x * step;
                    float worldZ = startZ + z * step;
                    float worldY = GetHeightAt(worldX, worldZ);

                    if (worldY < minHeight) minHeight = worldY;

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

            // Water or Lava Body in Chunk
            GameObject waterPlaneObj = null;
            if (minHeight <= GameConfig.WaterLevel + 0.15f)
            {
                waterPlaneObj = CreateChunkLiquidPlane(cx, cz, chunkGO.transform);
            }

            // Nature & Biome Props
            var propsParent = new GameObject("Props");
            propsParent.transform.parent = chunkGO.transform;

            if (spawnNatureProps)
            {
                SpawnPropsInChunk(cx, cz, propsParent.transform);
            }

            var chunk = new TerrainChunk
            {
                cx = cx,
                cz = cz,
                gameObject = chunkGO,
                mesh = mesh,
                meshCollider = meshCollider,
                propsParent = propsParent,
                waterPlane = waterPlaneObj
            };

            activeChunks.Add(coord, chunk);
            OnChunkCreated?.Invoke(cx, cz);
        }

        private GameObject CreateChunkLiquidPlane(int cx, int cz, Transform parent)
        {
            float centerX = cx * chunkSize + chunkSize / 2f;
            float centerZ = cz * chunkSize + chunkSize / 2f;
            var dominant = GetDominantBiome(centerX, centerZ);

            var liquidObj = GameObject.CreatePrimitive(PrimitiveType.Quad);
            liquidObj.name = (dominant == BiomeType.Volcanic) ? "LavaPlane" : "WaterPlane";
            int hazardLayer = LayerMask.NameToLayer("Hazard");
            liquidObj.layer = hazardLayer != -1 ? hazardLayer : 0;
            liquidObj.transform.parent = parent;
            liquidObj.transform.position = new Vector3(centerX, GameConfig.WaterLevel, centerZ);
            liquidObj.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
            liquidObj.transform.localScale = new Vector3(chunkSize, chunkSize, 1f);

            var col = liquidObj.GetComponent<Collider>();
            if (col != null) Destroy(col);

            // Trigger box collider
            var boxCol = liquidObj.AddComponent<BoxCollider>();
            boxCol.isTrigger = true;
            boxCol.size = new Vector3(1f, 1f, 2.0f);

            var hazard = liquidObj.AddComponent<WaterHazard>();
            hazard.liquidType = (dominant == BiomeType.Volcanic) ? LiquidType.Lava : LiquidType.Water;

            var ren = liquidObj.GetComponent<Renderer>();
            ren.sharedMaterial = (dominant == BiomeType.Volcanic) ? lavaMaterial : waterMaterial;

            return liquidObj;
        }

        private void SpawnPropsInChunk(int cx, int cz, Transform parent)
        {
            float distFromCenter = Mathf.Sqrt(cx * cx + cz * cz) * chunkSize;
            if (distFromCenter < 14f) return; // Keep starting area clear

            float chunkCenterX = cx * chunkSize + chunkSize / 2f;
            float chunkCenterZ = cz * chunkSize + chunkSize / 2f;
            var dominant = GetDominantBiome(chunkCenterX, chunkCenterZ);

            System.Random prng = new System.Random(cx * 73856093 ^ cz * 19349663 ^ seed);

            // Bounded arena: exactly 2 stylized props per chunk for peak performance & low memory
            int propCount = 2;

            for (int i = 0; i < propCount; i++)
            {
                float localX = 4f + (float)prng.NextDouble() * (chunkSize - 8f);
                float localZ = 4f + (float)prng.NextDouble() * (chunkSize - 8f);
                float wx = cx * chunkSize + localX;
                float wz = cz * chunkSize + localZ;

                // Keep strictly inside arena bounds
                if (wx < GameConfig.ArenaMinX + 2.5f || wx > GameConfig.ArenaMaxX - 2.5f) continue;
                if (wz < GameConfig.ArenaMinZ + 2.5f || wz > GameConfig.ArenaMaxZ - 2.5f) continue;

                // Keep Goal Beacon sanctuary clear
                if (Vector3.Distance(new Vector3(wx, 0, wz), new Vector3(GameConfig.GoalDefaultX, 0, GameConfig.GoalDefaultZ)) < 11f) continue;

                float wy = GetHeightAt(wx, wz);

                // Don't spawn props submerged in water or lava
                if (wy < GameConfig.WaterLevel + 0.3f) continue;

                float scale = 0.85f + (float)prng.NextDouble() * 0.45f;
                int propVariety = prng.Next(0, 5);

                switch (dominant)
                {
                    case BiomeType.Lush:
                        if (propVariety == 0 || propVariety == 1)
                            EnvironmentPropBuilder.CreateLushOakTree(parent, new Vector3(wx, wy, wz), scale);
                        else if (propVariety == 2)
                            EnvironmentPropBuilder.CreateLushPineTree(parent, new Vector3(wx, wy, wz), scale);
                        else if (propVariety == 3)
                            EnvironmentPropBuilder.CreateMossyRockCluster(parent, new Vector3(wx, wy, wz), scale);
                        else
                            EnvironmentPropBuilder.CreateWildflowerPatch(parent, new Vector3(wx, wy, wz), scale);
                        break;

                    case BiomeType.Desert:
                        if (propVariety == 0 || propVariety == 1)
                            EnvironmentPropBuilder.CreateSaguaroCactus(parent, new Vector3(wx, wy, wz), scale);
                        else if (propVariety == 2)
                            EnvironmentPropBuilder.CreateDesertMesaRock(parent, new Vector3(wx, wy, wz), scale);
                        else if (propVariety == 3)
                            EnvironmentPropBuilder.CreateDesertRuinPillar(parent, new Vector3(wx, wy, wz), scale);
                        else
                            EnvironmentPropBuilder.CreateDesertMesaRock(parent, new Vector3(wx, wy, wz), scale * 0.8f);
                        break;

                    case BiomeType.Snow:
                        if (propVariety == 0 || propVariety == 1 || propVariety == 2)
                            EnvironmentPropBuilder.CreateSnowyPine(parent, new Vector3(wx, wy, wz), scale);
                        else if (propVariety == 3)
                            EnvironmentPropBuilder.CreateIceSpire(parent, new Vector3(wx, wy, wz), scale);
                        else
                            EnvironmentPropBuilder.CreateMossyRockCluster(parent, new Vector3(wx, wy, wz), scale);
                        break;

                    case BiomeType.Volcanic:
                        if (propVariety == 0)
                            EnvironmentPropBuilder.CreateBasaltColumns(parent, new Vector3(wx, wy, wz), scale);
                        else if (propVariety == 1)
                            EnvironmentPropBuilder.CreateObsidianSpire(parent, new Vector3(wx, wy, wz), scale);
                        else if (propVariety == 2)
                            EnvironmentPropBuilder.CreateCharredTree(parent, new Vector3(wx, wy, wz), scale);
                        else if (propVariety == 3)
                            EnvironmentPropBuilder.CreateAetherCrystalCluster(parent, new Vector3(wx, wy, wz), scale);
                        else
                            EnvironmentPropBuilder.CreateBasaltColumns(parent, new Vector3(wx, wy, wz), scale * 0.85f);
                        break;
                }
            }
        }
    }
}
