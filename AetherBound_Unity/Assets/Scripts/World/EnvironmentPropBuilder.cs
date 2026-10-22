using System.Collections.Generic;
using UnityEngine;

namespace AetherBound
{
    public static class EnvironmentPropBuilder
    {
        private static readonly Dictionary<string, Material> materialCache = new Dictionary<string, Material>();

        private static Material GetOrCreateMaterial(string key, Color color, float smoothness = 0.15f, Color? emission = null)
        {
            if (materialCache.TryGetValue(key, out var mat) && mat != null)
            {
                return mat;
            }

            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            mat = new Material(shader)
            {
                name = $"Mat_{key}",
                color = color
            };

            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", 0.0f);

            if (emission.HasValue && emission.Value != Color.black)
            {
                if (mat.HasProperty("_EmissionColor"))
                {
                    mat.SetColor("_EmissionColor", emission.Value);
                    mat.EnableKeyword("_EMISSION");
                }
            }

            materialCache[key] = mat;
            return mat;
        }

        private static Material GetCrystalMaterial()
        {
            if (materialCache.TryGetValue("AetherCrystal", out var mat) && mat != null) return mat;

            Shader shader = Shader.Find("AetherBound/Crystal") ?? Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            mat = new Material(shader)
            {
                name = "Mat_AetherCrystal",
                color = new Color(0.1f, 0.85f, 0.98f, 0.8f)
            };
            if (mat.HasProperty("_EmissionColor"))
            {
                mat.SetColor("_EmissionColor", new Color(0.2f, 1.6f, 2.4f) * 1.5f);
                mat.EnableKeyword("_EMISSION");
            }
            materialCache["AetherCrystal"] = mat;
            return mat;
        }

        // ==========================================
        // LUSH BIOME PROPS
        // ==========================================

        public static GameObject CreateLushOakTree(Transform parent, Vector3 pos, float scale = 1.0f)
        {
#if UNITY_EDITOR
            var treePrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Tree_Rounded.prefab");
            if (treePrefab != null)
            {
                var instance = (GameObject)Object.Instantiate(treePrefab, pos, Quaternion.Euler(0, UnityEngine.Random.Range(0, 360f), 0), parent);
                instance.name = "Tree_Oak";
                instance.transform.localScale = Vector3.one * scale * UnityEngine.Random.Range(0.85f, 1.25f);
                return instance;
            }
#endif
            var root = new GameObject("Tree_Oak");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var trunkMat = GetOrCreateMaterial("BarkOak", new Color(0.36f, 0.22f, 0.12f));
            var leafMat1 = GetOrCreateMaterial("LeafEmerald", new Color(0.18f, 0.48f, 0.22f), 0.2f);
            var leafMat2 = GetOrCreateMaterial("LeafLime", new Color(0.28f, 0.58f, 0.26f), 0.2f);

            // Trunk with slight natural tilt
            var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.transform.parent = root.transform;
            trunk.transform.localPosition = new Vector3(0, 1.8f, 0);
            trunk.transform.localRotation = Quaternion.Euler(2f, UnityEngine.Random.Range(0, 360), 1.5f);
            trunk.transform.localScale = new Vector3(0.55f, 1.8f, 0.55f);
            trunk.GetComponent<Renderer>().sharedMaterial = trunkMat;

            // Canopy foliage cluster
            CreateFoliageSphere(root.transform, new Vector3(0, 3.8f, 0), new Vector3(3.2f, 2.6f, 3.2f), leafMat1);
            CreateFoliageSphere(root.transform, new Vector3(0.7f, 4.4f, 0.4f), new Vector3(2.4f, 2.2f, 2.4f), leafMat2);
            CreateFoliageSphere(root.transform, new Vector3(-0.6f, 3.5f, -0.5f), new Vector3(2.2f, 2.0f, 2.2f), leafMat1);

            return root;
        }

        public static GameObject CreateLushPineTree(Transform parent, Vector3 pos, float scale = 1.0f)
        {
#if UNITY_EDITOR
            var pinePrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Tree_Pine.prefab");
            if (pinePrefab != null)
            {
                var instance = (GameObject)Object.Instantiate(pinePrefab, pos, Quaternion.Euler(0, UnityEngine.Random.Range(0, 360f), 0), parent);
                instance.name = "Tree_Pine";
                instance.transform.localScale = Vector3.one * scale * UnityEngine.Random.Range(0.85f, 1.3f);
                return instance;
            }
#endif
            var root = new GameObject("Tree_Pine");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var trunkMat = GetOrCreateMaterial("BarkDark", new Color(0.28f, 0.18f, 0.10f));
            var needleMat = GetOrCreateMaterial("NeedleGreen", new Color(0.12f, 0.38f, 0.20f), 0.15f);

            var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.transform.parent = root.transform;
            trunk.transform.localPosition = new Vector3(0, 2.2f, 0);
            trunk.transform.localScale = new Vector3(0.45f, 2.2f, 0.45f);
            trunk.GetComponent<Renderer>().sharedMaterial = trunkMat;

            // 4 Conical tiers
            CreateFoliageCone(root.transform, new Vector3(0, 2.2f, 0), new Vector3(3.4f, 1.4f, 3.4f), needleMat);
            CreateFoliageCone(root.transform, new Vector3(0, 3.2f, 0), new Vector3(2.8f, 1.3f, 2.8f), needleMat);
            CreateFoliageCone(root.transform, new Vector3(0, 4.2f, 0), new Vector3(2.0f, 1.2f, 2.0f), needleMat);
            CreateFoliageCone(root.transform, new Vector3(0, 5.0f, 0), new Vector3(1.2f, 1.2f, 1.2f), needleMat);

            return root;
        }

        public static GameObject CreateLushBush(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Bush_Lush");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var leafMat = GetOrCreateMaterial("LeafLime", new Color(0.26f, 0.54f, 0.24f));
            CreateFoliageSphere(root.transform, new Vector3(0, 0.7f, 0), new Vector3(1.8f, 1.3f, 1.7f), leafMat);
            CreateFoliageSphere(root.transform, new Vector3(0.5f, 0.5f, 0.2f), new Vector3(1.3f, 1.0f, 1.2f), leafMat);

            return root;
        }

        public static GameObject CreateMossyRockCluster(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Rock_Mossy");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var rockMat = GetOrCreateMaterial("RockMossy", new Color(0.42f, 0.46f, 0.42f), 0.1f);

            var r1 = GameObject.CreatePrimitive(PrimitiveType.Cube);
            r1.transform.parent = root.transform;
            r1.transform.localPosition = new Vector3(0, 0.7f, 0);
            r1.transform.localRotation = Quaternion.Euler(UnityEngine.Random.Range(10, 35), UnityEngine.Random.Range(0, 360), UnityEngine.Random.Range(5, 25));
            r1.transform.localScale = new Vector3(2.0f, 1.4f, 1.8f);
            r1.GetComponent<Renderer>().sharedMaterial = rockMat;

            var r2 = GameObject.CreatePrimitive(PrimitiveType.Cube);
            r2.transform.parent = root.transform;
            r2.transform.localPosition = new Vector3(1.1f, 0.45f, 0.4f);
            r2.transform.localRotation = Quaternion.Euler(UnityEngine.Random.Range(10, 40), UnityEngine.Random.Range(0, 360), 0);
            r2.transform.localScale = new Vector3(1.1f, 0.9f, 1.0f);
            r2.GetComponent<Renderer>().sharedMaterial = rockMat;

            return root;
        }

        public static GameObject CreateWildflowerPatch(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Wildflowers");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            Color[] colors = new Color[]
            {
                new Color(0.95f, 0.25f, 0.35f), // Red Poppy
                new Color(0.98f, 0.85f, 0.20f), // Golden Dandelion
                new Color(0.35f, 0.75f, 0.98f), // Bluebell
                new Color(0.85f, 0.45f, 0.95f)  // Lavender
            };

            for (int i = 0; i < 6; i++)
            {
                float angle = i * (Mathf.PI * 2f / 6f) + UnityEngine.Random.Range(-0.2f, 0.2f);
                float radius = UnityEngine.Random.Range(0.4f, 1.4f);
                Vector3 blossomPos = new Vector3(Mathf.Cos(angle) * radius, 0.25f, Mathf.Sin(angle) * radius);

                var blossom = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                blossom.name = "Bloom";
                blossom.transform.parent = root.transform;
                blossom.transform.localPosition = blossomPos;
                blossom.transform.localScale = new Vector3(0.28f, 0.32f, 0.28f);
                var col = blossom.GetComponent<Collider>();
                if (col != null) Object.Destroy(col);

                Color flowerCol = colors[i % colors.Length];
                blossom.GetComponent<Renderer>().sharedMaterial = GetOrCreateMaterial($"Flower_{i % colors.Length}", flowerCol, 0.3f);
            }

            return root;
        }

        // ==========================================
        // DESERT BIOME PROPS
        // ==========================================

        public static GameObject CreateSaguaroCactus(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Cactus_Saguaro");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var cactusMat = GetOrCreateMaterial("CactusGreen", new Color(0.26f, 0.52f, 0.30f), 0.1f);
            var flowerMat = GetOrCreateMaterial("CactusBloom", new Color(0.95f, 0.25f, 0.55f), 0.3f);

            // Central Main Column
            var mainStem = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            mainStem.transform.parent = root.transform;
            mainStem.transform.localPosition = new Vector3(0, 2.5f, 0);
            mainStem.transform.localScale = new Vector3(0.7f, 2.5f, 0.7f);
            mainStem.GetComponent<Renderer>().sharedMaterial = cactusMat;

            // Left Branch Arm (Horizontal elbow + Upward reach)
            var arm1H = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            arm1H.transform.parent = root.transform;
            arm1H.transform.localPosition = new Vector3(-0.7f, 2.2f, 0);
            arm1H.transform.localRotation = Quaternion.Euler(0, 0, 90);
            arm1H.transform.localScale = new Vector3(0.45f, 0.65f, 0.45f);
            arm1H.GetComponent<Renderer>().sharedMaterial = cactusMat;

            var arm1V = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            arm1V.transform.parent = root.transform;
            arm1V.transform.localPosition = new Vector3(-1.25f, 3.2f, 0);
            arm1V.transform.localScale = new Vector3(0.45f, 1.2f, 0.45f);
            arm1V.GetComponent<Renderer>().sharedMaterial = cactusMat;

            // Right Branch Arm
            var arm2H = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            arm2H.transform.parent = root.transform;
            arm2H.transform.localPosition = new Vector3(0.65f, 2.8f, 0);
            arm2H.transform.localRotation = Quaternion.Euler(0, 0, -90);
            arm2H.transform.localScale = new Vector3(0.42f, 0.6f, 0.42f);
            arm2H.GetComponent<Renderer>().sharedMaterial = cactusMat;

            var arm2V = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            arm2V.transform.parent = root.transform;
            arm2V.transform.localPosition = new Vector3(1.15f, 3.7f, 0);
            arm2V.transform.localScale = new Vector3(0.42f, 1.1f, 0.42f);
            arm2V.GetComponent<Renderer>().sharedMaterial = cactusMat;

            // Crown Blossom
            var crown = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            crown.transform.parent = root.transform;
            crown.transform.localPosition = new Vector3(0, 5.05f, 0);
            crown.transform.localScale = new Vector3(0.4f, 0.3f, 0.4f);
            var col = crown.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
            crown.GetComponent<Renderer>().sharedMaterial = flowerMat;

            return root;
        }

        public static GameObject CreateDesertMesaRock(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Rock_Mesa");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var mesaMat = GetOrCreateMaterial("Sandstone", new Color(0.82f, 0.58f, 0.38f), 0.1f);

            var slab1 = GameObject.CreatePrimitive(PrimitiveType.Cube);
            slab1.transform.parent = root.transform;
            slab1.transform.localPosition = new Vector3(0, 0.8f, 0);
            slab1.transform.localRotation = Quaternion.Euler(0, UnityEngine.Random.Range(0, 360), 0);
            slab1.transform.localScale = new Vector3(3.2f, 1.6f, 2.8f);
            slab1.GetComponent<Renderer>().sharedMaterial = mesaMat;

            var slab2 = GameObject.CreatePrimitive(PrimitiveType.Cube);
            slab2.transform.parent = root.transform;
            slab2.transform.localPosition = new Vector3(0.3f, 1.8f, 0.2f);
            slab2.transform.localRotation = Quaternion.Euler(0, UnityEngine.Random.Range(0, 360), 0);
            slab2.transform.localScale = new Vector3(2.0f, 0.8f, 1.8f);
            slab2.GetComponent<Renderer>().sharedMaterial = mesaMat;

            return root;
        }

        public static GameObject CreateDesertRuinPillar(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Ruin_AetherPillar");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var stoneMat = GetOrCreateMaterial("WeatheredStone", new Color(0.68f, 0.60f, 0.50f), 0.15f);
            var runeMat = GetOrCreateMaterial("CyanRuneGlow", new Color(0f, 1f, 1f), 0.5f, new Color(0f, 2.2f, 2.5f));

            // Ancient base pediment
            var basePed = GameObject.CreatePrimitive(PrimitiveType.Cube);
            basePed.transform.parent = root.transform;
            basePed.transform.localPosition = new Vector3(0, 0.4f, 0);
            basePed.transform.localScale = new Vector3(1.8f, 0.8f, 1.8f);
            basePed.GetComponent<Renderer>().sharedMaterial = stoneMat;

            // Column shaft
            var shaft = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            shaft.transform.parent = root.transform;
            shaft.transform.localPosition = new Vector3(0, 2.8f, 0);
            shaft.transform.localScale = new Vector3(1.0f, 2.0f, 1.0f);
            shaft.GetComponent<Renderer>().sharedMaterial = stoneMat;

            // Glowing Aether Rune Ring
            var runeRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            runeRing.transform.parent = root.transform;
            runeRing.transform.localPosition = new Vector3(0, 3.2f, 0);
            runeRing.transform.localScale = new Vector3(1.08f, 0.25f, 1.08f);
            var col = runeRing.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
            runeRing.GetComponent<Renderer>().sharedMaterial = runeMat;

            return root;
        }

        // ==========================================
        // SNOW BIOME PROPS
        // ==========================================

        public static GameObject CreateSnowyPine(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Tree_SnowyPine");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var trunkMat = GetOrCreateMaterial("BarkDark", new Color(0.24f, 0.16f, 0.12f));
            var pineMat = GetOrCreateMaterial("SnowyNeedles", new Color(0.18f, 0.34f, 0.28f));
            var snowCapMat = GetOrCreateMaterial("SnowCap", new Color(0.94f, 0.97f, 1.0f), 0.4f);

            var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.transform.parent = root.transform;
            trunk.transform.localPosition = new Vector3(0, 2.0f, 0);
            trunk.transform.localScale = new Vector3(0.45f, 2.0f, 0.45f);
            trunk.GetComponent<Renderer>().sharedMaterial = trunkMat;

            // 3 Conical branches + snow caps
            float[] tierY = new float[] { 2.0f, 3.2f, 4.2f };
            float[] tierSizes = new float[] { 3.2f, 2.4f, 1.6f };

            for (int i = 0; i < tierY.Length; i++)
            {
                CreateFoliageCone(root.transform, new Vector3(0, tierY[i], 0), new Vector3(tierSizes[i], 1.2f, tierSizes[i]), pineMat);

                // Snow topping
                var snow = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                snow.transform.parent = root.transform;
                snow.transform.localPosition = new Vector3(0, tierY[i] + 0.65f, 0);
                snow.transform.localScale = new Vector3(tierSizes[i] * 0.75f, 0.45f, tierSizes[i] * 0.75f);
                var c = snow.GetComponent<Collider>();
                if (c != null) Object.Destroy(c);
                snow.GetComponent<Renderer>().sharedMaterial = snowCapMat;
            }

            return root;
        }

        public static GameObject CreateIceSpire(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Ice_Spire");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var iceMat = GetOrCreateMaterial("GlacialIce", new Color(0.55f, 0.88f, 0.98f, 0.85f), 0.85f, new Color(0.1f, 0.6f, 0.9f));

            // Sharp prism shard
            var shard1 = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            shard1.transform.parent = root.transform;
            shard1.transform.localPosition = new Vector3(0, 2.2f, 0);
            shard1.transform.localRotation = Quaternion.Euler(UnityEngine.Random.Range(-12, 12), UnityEngine.Random.Range(0, 360), UnityEngine.Random.Range(-12, 12));
            shard1.transform.localScale = new Vector3(0.8f, 2.2f, 0.8f);
            shard1.GetComponent<Renderer>().sharedMaterial = iceMat;

            var shard2 = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            shard2.transform.parent = root.transform;
            shard2.transform.localPosition = new Vector3(0.5f, 1.2f, 0.3f);
            shard2.transform.localRotation = Quaternion.Euler(20f, 45f, -15f);
            shard2.transform.localScale = new Vector3(0.45f, 1.2f, 0.45f);
            shard2.GetComponent<Renderer>().sharedMaterial = iceMat;

            return root;
        }

        // ==========================================
        // VOLCANIC BIOME PROPS
        // ==========================================

        public static GameObject CreateBasaltColumns(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Basalt_Pillars");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var basaltMat = GetOrCreateMaterial("BasaltDark", new Color(0.16f, 0.16f, 0.18f), 0.25f);

            // Cluster of hexagonal-like stepped pillars
            Vector2[] offsets = new Vector2[]
            {
                new Vector2(0, 0),
                new Vector2(0.85f, 0.5f),
                new Vector2(-0.85f, 0.45f),
                new Vector2(0.35f, -0.8f),
                new Vector2(-0.6f, -0.7f)
            };
            float[] heights = new float[] { 3.2f, 2.4f, 2.8f, 1.8f, 2.1f };

            for (int i = 0; i < offsets.Length; i++)
            {
                var pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pillar.transform.parent = root.transform;
                pillar.transform.localPosition = new Vector3(offsets[i].x, heights[i] / 2f, offsets[i].y);
                pillar.transform.localScale = new Vector3(0.85f, heights[i] / 2f, 0.85f);
                pillar.GetComponent<Renderer>().sharedMaterial = basaltMat;
            }

            return root;
        }

        public static GameObject CreateObsidianSpire(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Obsidian_Spire");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var obsMat = GetOrCreateMaterial("ObsidianGlass", new Color(0.10f, 0.10f, 0.12f), 0.9f);

            var spire = GameObject.CreatePrimitive(PrimitiveType.Cube);
            spire.transform.parent = root.transform;
            spire.transform.localPosition = new Vector3(0, 2.4f, 0);
            spire.transform.localRotation = Quaternion.Euler(UnityEngine.Random.Range(5, 18), UnityEngine.Random.Range(0, 360), UnityEngine.Random.Range(-12, 12));
            spire.transform.localScale = new Vector3(0.9f, 3.0f, 0.9f);
            spire.GetComponent<Renderer>().sharedMaterial = obsMat;

            return root;
        }

        public static GameObject CreateCharredTree(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Tree_Charred");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var charMat = GetOrCreateMaterial("CharredWood", new Color(0.12f, 0.10f, 0.10f), 0.05f);

            // Gnarled black trunk
            var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.transform.parent = root.transform;
            trunk.transform.localPosition = new Vector3(0, 2.0f, 0);
            trunk.transform.localRotation = Quaternion.Euler(UnityEngine.Random.Range(-8, 8), 0, UnityEngine.Random.Range(-8, 8));
            trunk.transform.localScale = new Vector3(0.5f, 2.0f, 0.5f);
            trunk.GetComponent<Renderer>().sharedMaterial = charMat;

            // Broken branch stub
            var branch = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            branch.transform.parent = root.transform;
            branch.transform.localPosition = new Vector3(0.6f, 2.8f, 0);
            branch.transform.localRotation = Quaternion.Euler(0, 0, -45);
            branch.transform.localScale = new Vector3(0.25f, 0.8f, 0.25f);
            branch.GetComponent<Renderer>().sharedMaterial = charMat;

            return root;
        }

        public static GameObject CreateAetherCrystalCluster(Transform parent, Vector3 pos, float scale = 1.0f)
        {
            var root = new GameObject("Aether_CrystalCluster");
            root.transform.parent = parent;
            root.transform.position = pos;
            root.transform.localScale = Vector3.one * scale;

            var crystalMat = GetCrystalMaterial();

            // Main central crystal shard
            var mainSh = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            mainSh.transform.parent = root.transform;
            mainSh.transform.localPosition = new Vector3(0, 1.4f, 0);
            mainSh.transform.localRotation = Quaternion.Euler(8f, 25f, -5f);
            mainSh.transform.localScale = new Vector3(0.55f, 1.4f, 0.55f);
            mainSh.GetComponent<Renderer>().sharedMaterial = crystalMat;

            // Secondary crystal shards
            var sh2 = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            sh2.transform.parent = root.transform;
            sh2.transform.localPosition = new Vector3(0.5f, 0.9f, 0.3f);
            sh2.transform.localRotation = Quaternion.Euler(22f, 60f, -25f);
            sh2.transform.localScale = new Vector3(0.35f, 0.9f, 0.35f);
            sh2.GetComponent<Renderer>().sharedMaterial = crystalMat;

            var sh3 = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            sh3.transform.parent = root.transform;
            sh3.transform.localPosition = new Vector3(-0.4f, 0.75f, -0.3f);
            sh3.transform.localRotation = Quaternion.Euler(-18f, 110f, 20f);
            sh3.transform.localScale = new Vector3(0.3f, 0.75f, 0.3f);
            sh3.GetComponent<Renderer>().sharedMaterial = crystalMat;

            // Point light for gorgeous bloom glow
            var ltObj = new GameObject("CrystalGlow");
            ltObj.transform.parent = root.transform;
            ltObj.transform.localPosition = new Vector3(0, 1.2f, 0);
            var lt = ltObj.AddComponent<Light>();
            lt.color = new Color(0.2f, 0.85f, 1.0f);
            lt.intensity = 2.0f;
            lt.range = 7.0f;

            return root;
        }

        // ==========================================
        // HELPERS
        // ==========================================

        private static void CreateFoliageSphere(Transform parent, Vector3 localPos, Vector3 localScale, Material mat)
        {
            var f = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            f.name = "Foliage";
            f.transform.parent = parent;
            f.transform.localPosition = localPos;
            f.transform.localScale = localScale;
            var c = f.GetComponent<Collider>();
            if (c != null) Object.Destroy(c);
            f.GetComponent<Renderer>().sharedMaterial = mat;
        }

        private static void CreateFoliageCone(Transform parent, Vector3 localPos, Vector3 localScale, Material mat)
        {
            var f = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            f.name = "ConeFoliage";
            f.transform.parent = parent;
            f.transform.localPosition = localPos;
            f.transform.localScale = localScale;
            var c = f.GetComponent<Collider>();
            if (c != null) Object.Destroy(c);
            f.GetComponent<Renderer>().sharedMaterial = mat;
        }
    }
}
