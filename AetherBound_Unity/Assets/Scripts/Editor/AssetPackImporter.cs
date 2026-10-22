#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

namespace AetherBound.Editor
{
    public static class AssetPackImporter
    {
        private const string CharDir = "Assets/Art/KayKit_Characters";
        private const string DungeonDir = "Assets/Art/KayKit_Dungeon";
        private const string NatureDir = "Assets/Art/CC0_Nature";
        private const string MatDir = "Assets/Materials/Imported";
        private const string PrefabDir = "Assets/Prefabs/Imported";
        private const string ResCharDir = "Assets/Resources/Prefabs/Characters";
        private const string CharPrefabDir = "Assets/Prefabs/Characters";

        [MenuItem("Tools/AetherBound/Setup Imported 3D Asset Pack")]
        public static void SetupAssetPack()
        {
            EnsureDirectories();
            AssetDatabase.Refresh();

            // 1. Create Materials
            var knightMat = CreateOrUpdateMaterial("Knight_Material", $"{CharDir}/knight_texture.png", 0.4f);
            var rogueMat = CreateOrUpdateMaterial("Rogue_Material", $"{CharDir}/rogue_texture.png", 0.3f);
            var mageMat = CreateOrUpdateMaterial("Mage_Material", $"{CharDir}/mage_texture.png", 0.5f);
            var dungeonMat = CreateOrUpdateMaterial("Dungeon_Material", $"{DungeonDir}/dungeon_texture.png", 0.25f);
            var pineMat = CreateColorMaterial("PineTree_Material", new Color(0.12f, 0.32f, 0.16f), 0.2f);
            var roundTreeMat = CreateColorMaterial("RoundedTree_Material", new Color(0.22f, 0.52f, 0.20f), 0.25f);
            var deadTreeMat = CreateColorMaterial("DeadTree_Material", new Color(0.35f, 0.26f, 0.19f), 0.15f);
            var monolithMat = CreateColorMaterial("Monolith_Material", new Color(0.40f, 0.46f, 0.54f), 0.5f, new Color(0.0f, 0.6f, 0.9f));

            // 2. Create Model Prefabs in Imported and Resources
            CreateImportedPrefab("Runner_Knight", $"{CharDir}/Knight.fbx", knightMat, new Vector3(0.9f, 0.9f, 0.9f), Vector3.zero);
            CreateImportedPrefab("Runner_Knight", $"{CharDir}/Knight.fbx", knightMat, new Vector3(0.9f, 0.9f, 0.9f), Vector3.zero, ResCharDir);

            CreateImportedPrefab("Saboteur_Rogue", $"{CharDir}/RogueHooded.fbx", rogueMat, new Vector3(0.9f, 0.9f, 0.9f), Vector3.zero);
            CreateImportedPrefab("Saboteur_Rogue", $"{CharDir}/RogueHooded.fbx", rogueMat, new Vector3(0.9f, 0.9f, 0.9f), Vector3.zero, ResCharDir);

            CreateImportedPrefab("AISaboteur_Mage", $"{CharDir}/Mage.fbx", mageMat, new Vector3(0.9f, 0.9f, 0.9f), Vector3.zero);
            CreateImportedPrefab("AISaboteur_Mage", $"{CharDir}/Mage.fbx", mageMat, new Vector3(0.9f, 0.9f, 0.9f), Vector3.zero, ResCharDir);

            CreateImportedPrefab("Obstacle_Wall", $"{DungeonDir}/wall.fbx", dungeonMat, new Vector3(2.0f, 2.0f, 2.0f), Vector3.zero);
            CreateImportedPrefab("Obstacle_Spikes", $"{DungeonDir}/floor_tile_big_spikes.fbx", dungeonMat, new Vector3(1.8f, 1.8f, 1.8f), Vector3.zero);
            CreateImportedPrefab("Obstacle_Barrel", $"{DungeonDir}/barrel_large.fbx", dungeonMat, new Vector3(1.4f, 1.4f, 1.4f), Vector3.zero);
            CreateImportedPrefab("PowerUp_Chest", $"{DungeonDir}/chest_gold.fbx", dungeonMat, new Vector3(1.2f, 1.2f, 1.2f), Vector3.zero);
            CreateImportedPrefab("Sanctuary_Pillar", $"{DungeonDir}/pillar.fbx", dungeonMat, new Vector3(1.8f, 2.2f, 1.8f), Vector3.zero);
            CreateImportedPrefab("Beacon_Torch", $"{DungeonDir}/torch_lit.fbx", dungeonMat, new Vector3(1.5f, 1.5f, 1.5f), Vector3.zero);

            CreateImportedPrefab("Tree_Pine", $"{NatureDir}/SM_Pine_Tree.fbx", pineMat, new Vector3(1.4f, 1.4f, 1.4f), Vector3.zero);
            CreateImportedPrefab("Tree_Rounded", $"{NatureDir}/SM_Tree_Rounded.fbx", roundTreeMat, new Vector3(1.4f, 1.4f, 1.4f), Vector3.zero);
            CreateImportedPrefab("Tree_DeadPine", $"{NatureDir}/SM_DeadPineTree.fbx", deadTreeMat, new Vector3(1.4f, 1.4f, 1.4f), Vector3.zero);
            CreateImportedPrefab("Sanctuary_Monolith", $"{NatureDir}/SM_AbstractZeusSculpture.fbx", monolithMat, new Vector3(1.5f, 1.5f, 1.5f), Vector3.zero);

            AssetDatabase.SaveAssets();

            // 3. Update active characters in scene
            UpdateSceneCharacters();

            Debug.Log("[AetherBound] 3D Asset Pack successfully imported, materials mapped, and prefabs created!");
        }

        private static void EnsureDirectories()
        {
            if (!Directory.Exists(MatDir)) Directory.CreateDirectory(MatDir);
            if (!Directory.Exists(PrefabDir)) Directory.CreateDirectory(PrefabDir);
            if (!Directory.Exists(ResCharDir)) Directory.CreateDirectory(ResCharDir);
            if (!Directory.Exists(CharPrefabDir)) Directory.CreateDirectory(CharPrefabDir);
        }

        private static Material CreateOrUpdateMaterial(string name, string texturePath, float smoothness = 0.3f)
        {
            string matPath = $"{MatDir}/{name}.mat";
            var mat = AssetDatabase.LoadAssetAtPath<Material>(matPath);
            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");

            if (mat == null)
            {
                mat = new Material(shader) { name = name };
                AssetDatabase.CreateAsset(mat, matPath);
            }
            else
            {
                mat.shader = shader;
            }

            var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
            if (tex != null)
            {
                mat.mainTexture = tex;
                if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", tex);
            }
            mat.color = Color.white;
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
            EditorUtility.SetDirty(mat);
            return mat;
        }

        private static Material CreateColorMaterial(string name, Color color, float smoothness, Color? emission = null)
        {
            string matPath = $"{MatDir}/{name}.mat";
            var mat = AssetDatabase.LoadAssetAtPath<Material>(matPath);
            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");

            if (mat == null)
            {
                mat = new Material(shader) { name = name };
                AssetDatabase.CreateAsset(mat, matPath);
            }
            else
            {
                mat.shader = shader;
            }

            mat.color = color;
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);

            if (emission.HasValue && emission.Value != Color.black)
            {
                if (mat.HasProperty("_EmissionColor"))
                {
                    mat.SetColor("_EmissionColor", emission.Value);
                    mat.EnableKeyword("_EMISSION");
                }
            }

            EditorUtility.SetDirty(mat);
            return mat;
        }

        private static GameObject CreateImportedPrefab(string prefabName, string fbxPath, Material mat, Vector3 scale, Vector3 rotOffset, string targetDir = null)
        {
            var fbxAsset = AssetDatabase.LoadAssetAtPath<GameObject>(fbxPath);
            if (fbxAsset == null)
            {
                Debug.LogWarning($"[AssetPackImporter] FBX asset not found at: {fbxPath}");
                return null;
            }

            string dir = string.IsNullOrEmpty(targetDir) ? PrefabDir : targetDir;
            string targetPrefabPath = $"{dir}/{prefabName}.prefab";
            var instance = (GameObject)PrefabUtility.InstantiatePrefab(fbxAsset);
            instance.name = prefabName;
            instance.transform.localScale = scale;
            instance.transform.localRotation = Quaternion.Euler(rotOffset);

            // Apply material to all child renderers
            var renderers = instance.GetComponentsInChildren<Renderer>(true);
            foreach (var r in renderers)
            {
                if (mat != null) r.sharedMaterial = mat;
            }

            // Ensure colliders if obstacle
            if (prefabName.StartsWith("Obstacle_") || prefabName.StartsWith("Tree_") || prefabName.StartsWith("Sanctuary_"))
            {
                var cols = instance.GetComponentsInChildren<Collider>(true);
                if (cols.Length == 0)
                {
                    instance.AddComponent<BoxCollider>();
                }
            }

            var prefab = PrefabUtility.SaveAsPrefabAsset(instance, targetPrefabPath);
            Object.DestroyImmediate(instance);
            return prefab;
        }

        public static void UpdateSceneCharacters()
        {
            int playerLayer = LayerMask.NameToLayer("Player");
            int saboteurLayer = LayerMask.NameToLayer("Saboteur");

            var runner = Object.FindAnyObjectByType<RunnerController>();
            if (runner != null)
            {
                if (playerLayer != -1) runner.gameObject.layer = playerLayer;
                runner.gameObject.tag = "Player";
                CharacterModelBuilder.BuildRunnerVisuals(runner.transform);
                PrefabUtility.SaveAsPrefabAsset(runner.gameObject, $"{CharPrefabDir}/Runner_Character.prefab");
            }

            var saboteur = Object.FindAnyObjectByType<SaboteurController>();
            if (saboteur != null)
            {
                if (saboteurLayer != -1) saboteur.gameObject.layer = saboteurLayer;
                saboteur.gameObject.tag = "Saboteur";
                CharacterModelBuilder.BuildSaboteurVisuals(saboteur.transform);
                PrefabUtility.SaveAsPrefabAsset(saboteur.gameObject, $"{CharPrefabDir}/Saboteur_Character.prefab");
            }

            var aiSaboteur = Object.FindAnyObjectByType<AISaboteur>();
            if (aiSaboteur == null)
            {
                var aiGo = new GameObject("AISaboteur");
                aiGo.transform.position = new Vector3(0, 0, 45f);
                var cc = aiGo.AddComponent<CharacterController>();
                cc.height = 1.8f;
                cc.radius = 0.45f;
                cc.center = new Vector3(0, 0.9f, 0);
                aiSaboteur = aiGo.AddComponent<AISaboteur>();
            }
            if (saboteurLayer != -1) aiSaboteur.gameObject.layer = saboteurLayer;
            aiSaboteur.gameObject.tag = "Saboteur";
            CharacterModelBuilder.BuildAISaboteurVisuals(aiSaboteur.transform);
            PrefabUtility.SaveAsPrefabAsset(aiSaboteur.gameObject, $"{CharPrefabDir}/AISaboteur_Character.prefab");

            var sanctuary = Object.FindAnyObjectByType<SpawnSanctuary>();
            if (sanctuary != null)
            {
                sanctuary.BuildSanctuaryGround();
                PrefabUtility.SaveAsPrefabAsset(sanctuary.gameObject, "Assets/Prefabs/Environment/SpawnSanctuaryGround.prefab");
            }

            var beacon = Object.FindAnyObjectByType<GoalBeacon>();
            if (beacon != null)
            {
                for (int i = beacon.transform.childCount - 1; i >= 0; i--)
                {
                    Object.DestroyImmediate(beacon.transform.GetChild(i).gameObject);
                }
                beacon.SendMessage("BuildVisuals", UnityEngine.SendMessageOptions.DontRequireReceiver);
            }
        }
    }
}
#endif
