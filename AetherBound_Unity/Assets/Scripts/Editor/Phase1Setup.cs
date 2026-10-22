#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace AetherBound.Editor
{
    public static class Phase1Setup
    {
        [MenuItem("Tools/AetherBound/Execute Phase 1 Setup")]
        public static void ExecutePhase1Manual()
        {
            ExecutePhase1(true);
            ExecutePhase2Setup();
            ExecutePhase3Setup();
        }

        public static void ExecutePhase1(bool force)
        {
            Debug.Log("[AetherBound Phase 1] Starting execution of Phase 1: Foundations...");

            // 1. Configure Physics Settings & Collision Matrix
            ConfigurePhysics();

            // 2. Setup 3D Art Assets, URP Materials, and Prefabs
            AssetPackImporter.SetupAssetPack();

            // 3. Configure Active Scene & Layers
            ConfigureSceneObjects();

            // 4. Save Scene & Project
            var activeScene = EditorSceneManager.GetActiveScene();
            if (activeScene.isDirty)
            {
                EditorSceneManager.SaveScene(activeScene);
            }
            AssetDatabase.SaveAssets();

            Debug.Log("[AetherBound Phase 1] Phase 1 successfully executed and verified!");
        }

        private static void ConfigurePhysics()
        {
            // Global physics gravity target: -24 m/s²
            Physics.gravity = new Vector3(0, -24.0f, 0);

            int defaultLayer = LayerMask.NameToLayer("Default");
            int playerLayer = LayerMask.NameToLayer("Player");
            int saboteurLayer = LayerMask.NameToLayer("Saboteur");
            int obstacleLayer = LayerMask.NameToLayer("Obstacle");
            int groundLayer = LayerMask.NameToLayer("Ground");
            int powerUpLayer = LayerMask.NameToLayer("PowerUp");
            int hazardLayer = LayerMask.NameToLayer("Hazard");

            if (playerLayer != -1 && saboteurLayer != -1)
            {
                // Player collisions
                if (groundLayer != -1) Physics.IgnoreLayerCollision(playerLayer, groundLayer, false);
                if (obstacleLayer != -1) Physics.IgnoreLayerCollision(playerLayer, obstacleLayer, false);
                if (powerUpLayer != -1) Physics.IgnoreLayerCollision(playerLayer, powerUpLayer, false);
                if (hazardLayer != -1) Physics.IgnoreLayerCollision(playerLayer, hazardLayer, false);
                if (defaultLayer != -1) Physics.IgnoreLayerCollision(playerLayer, defaultLayer, false);

                // Disable unnecessary matrix pairs
                Physics.IgnoreLayerCollision(playerLayer, playerLayer, true); // No Player vs Player collision
                Physics.IgnoreLayerCollision(playerLayer, saboteurLayer, true); // Saboteur phantom does not bump physical runner

                // Saboteur collisions (phantom passes through traps and powerups)
                Physics.IgnoreLayerCollision(saboteurLayer, saboteurLayer, true);
                if (powerUpLayer != -1) Physics.IgnoreLayerCollision(saboteurLayer, powerUpLayer, true);
                if (hazardLayer != -1) Physics.IgnoreLayerCollision(saboteurLayer, hazardLayer, true);

                // Obstacle vs PowerUp
                if (obstacleLayer != -1 && powerUpLayer != -1)
                {
                    Physics.IgnoreLayerCollision(obstacleLayer, powerUpLayer, true);
                }
            }

            Debug.Log("[AetherBound Phase 1] Physics gravity (-24 m/s²) and layer collision matrix configured.");
        }

        private static void ConfigureSceneObjects()
        {
            int playerLayer = LayerMask.NameToLayer("Player");
            int saboteurLayer = LayerMask.NameToLayer("Saboteur");
            int obstacleLayer = LayerMask.NameToLayer("Obstacle");
            int groundLayer = LayerMask.NameToLayer("Ground");

            // 1. Runner Character
            var runner = Object.FindAnyObjectByType<RunnerController>();
            if (runner != null)
            {
                if (playerLayer != -1)
                {
                    runner.gameObject.layer = playerLayer;
                    foreach (var t in runner.GetComponentsInChildren<Transform>(true))
                    {
                        t.gameObject.layer = playerLayer;
                    }
                }
                runner.gameObject.tag = "Player";
                runner.BuildVisualAvatar();
                EditorUtility.SetDirty(runner.gameObject);
            }

            // 2. Saboteur Character
            var saboteur = Object.FindAnyObjectByType<SaboteurController>();
            if (saboteur != null)
            {
                if (saboteurLayer != -1)
                {
                    saboteur.gameObject.layer = saboteurLayer;
                    foreach (var t in saboteur.GetComponentsInChildren<Transform>(true))
                    {
                        t.gameObject.layer = saboteurLayer;
                    }
                }
                saboteur.gameObject.tag = "Saboteur";
                saboteur.BuildVisualAvatar();
                EditorUtility.SetDirty(saboteur.gameObject);
            }

            // 3. AI Saboteur
            var aiSaboteur = Object.FindAnyObjectByType<AISaboteur>();
            if (aiSaboteur != null)
            {
                if (saboteurLayer != -1)
                {
                    aiSaboteur.gameObject.layer = saboteurLayer;
                    foreach (var t in aiSaboteur.GetComponentsInChildren<Transform>(true))
                    {
                        t.gameObject.layer = saboteurLayer;
                    }
                }
                aiSaboteur.gameObject.tag = "Saboteur";
                aiSaboteur.BuildVisualAvatar();
                EditorUtility.SetDirty(aiSaboteur.gameObject);
            }

            // 4. Spawn Sanctuary
            var sanctuary = Object.FindAnyObjectByType<SpawnSanctuary>();
            if (sanctuary != null)
            {
                if (groundLayer != -1) sanctuary.gameObject.layer = groundLayer;
                sanctuary.BuildSanctuaryGround();
                EditorUtility.SetDirty(sanctuary.gameObject);
            }

            // 5. Goal Beacon
            var beacon = Object.FindAnyObjectByType<GoalBeacon>();
            if (beacon != null)
            {
                if (groundLayer != -1) beacon.gameObject.layer = groundLayer;
                EditorUtility.SetDirty(beacon.gameObject);
            }

            // 6. World Manager
            var worldMgr = Object.FindAnyObjectByType<WorldManager>();
            if (worldMgr != null)
            {
                if (groundLayer != -1) worldMgr.gameObject.layer = groundLayer;
                worldMgr.ClearAllChunks();
                EditorUtility.SetDirty(worldMgr.gameObject);
            }

            // 7. Green Grass Field Plane
            var planeObj = GameObject.Find("Plane");
            if (planeObj != null)
            {
                if (groundLayer != -1) planeObj.layer = groundLayer;
                planeObj.transform.position = new Vector3(0, 0.79f, 0);
                planeObj.transform.localScale = new Vector3(50f, 1f, 50f); // 500m x 500m green grass plain
                var ren = planeObj.GetComponent<Renderer>();
                if (ren != null)
                {
                    var grassMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/Environment/M_GrassPlain.mat");
                    if (grassMat == null)
                    {
                        var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                        grassMat = new Material(shader)
                        {
                            name = "M_GrassPlain",
                            color = new Color(0.28f, 0.58f, 0.22f)
                        };
                        if (grassMat.HasProperty("_Smoothness")) grassMat.SetFloat("_Smoothness", 0.15f);
                        if (!System.IO.Directory.Exists("Assets/Materials/Environment"))
                        {
                            System.IO.Directory.CreateDirectory("Assets/Materials/Environment");
                        }
                        AssetDatabase.CreateAsset(grassMat, "Assets/Materials/Environment/M_GrassPlain.mat");
                    }
                    ren.sharedMaterial = grassMat;
                }
                EditorUtility.SetDirty(planeObj);
            }

            // Mark active scene dirty
            var scene = EditorSceneManager.GetActiveScene();
            EditorSceneManager.MarkSceneDirty(scene);
        }

        public static void ExecutePhase2Setup()
        {
            Debug.Log("[AetherBound Phase 2] Executing Phase 2: Movement & Controls setup...");

            // 1. Runner Controller
            var runner = Object.FindAnyObjectByType<RunnerController>();
            if (runner != null)
            {
                runner.gravity = 24.0f;
                runner.coyoteTime = 0.15f;
                runner.jumpBufferTime = 0.12f;
                runner.cameraDistance = 5.5f;
                runner.cameraHeight = 2.2f;
                runner.cameraPitch = 15.0f;
                runner.baseSpeed = 9.0f;
                runner.sprintSpeed = 13.5f;
                runner.jumpForce = 8.5f;
                runner.BuildVisualAvatar();
                EditorUtility.SetDirty(runner);
            }

            // 2. Saboteur Controller
            var saboteur = Object.FindAnyObjectByType<SaboteurController>();
            if (saboteur != null)
            {
                saboteur.moveSpeed = 12.0f;
                saboteur.cameraDistance = 5.5f;
                saboteur.cameraHeight = 2.2f;
                saboteur.cameraPitch = 15.0f;
                saboteur.tacticalAltitude = 25.0f;
                saboteur.tacticalPitch = 55.0f;
                saboteur.blinkDistance = 15.0f;
                saboteur.blinkCooldown = 3.0f;
                saboteur.blinkEnergyCost = 20.0f;
                saboteur.BuildVisualAvatar();
                EditorUtility.SetDirty(saboteur);
            }

            // 3. Procedural Character Animators
            var animators = Object.FindObjectsByType<ProceduralCharacterAnimator>(FindObjectsInactive.Include);
            foreach (var anim in animators)
            {
                anim.strideFrequency = 11.0f;
                anim.strideAngle = 36.0f;
                anim.armSwingAngle = 32.0f;
                anim.bankTiltAmount = 14.0f;
                anim.forwardLeanAmount = 12.0f;
                EditorUtility.SetDirty(anim);
            }

            // 4. UI Manager bindings
            var uiMgr = Object.FindAnyObjectByType<UIManager>();
            if (uiMgr != null)
            {
                uiMgr.BindAllButtons();
                EditorUtility.SetDirty(uiMgr);
            }

            var activeScene = EditorSceneManager.GetActiveScene();
            if (activeScene.isDirty)
            {
                EditorSceneManager.SaveScene(activeScene);
            }
            AssetDatabase.SaveAssets();

            Debug.Log("[AetherBound Phase 2] Phase 2 setup complete and saved!");
        }

        public static void ExecutePhase3Setup()
        {
            Debug.Log("[AetherBound Phase 3] Executing Phase 3: Traps, Obstacles & Power-Ups setup...");

            // 1. Ensure Scene Managers
            var oMgr = Object.FindAnyObjectByType<ObstacleManager>();
            if (oMgr == null)
            {
                var go = new GameObject("ObstacleManager");
                oMgr = go.AddComponent<ObstacleManager>();
            }

            var pMgr = Object.FindAnyObjectByType<PowerUpManager>();
            if (pMgr == null)
            {
                var go = new GameObject("PowerUpManager");
                pMgr = go.AddComponent<PowerUpManager>();
            }

            // 2. Configure Runner HUD with Dash & Pulse Buttons
            var uiMgr = Object.FindAnyObjectByType<UIManager>();
            if (uiMgr != null && uiMgr.runnerHudPanel != null)
            {
                EnsureRunnerButton(uiMgr.runnerHudPanel.transform, "Btn_Dash", "💨 DASH", new Vector2(-110, 80));
                EnsureRunnerButton(uiMgr.runnerHudPanel.transform, "Btn_Pulse", "⚡ PULSE", new Vector2(-110, 140));
                uiMgr.BindAllButtons();
                EditorUtility.SetDirty(uiMgr);
            }

            // 3. Populate Guaranteed Corridor Power-Ups
            if (pMgr != null)
            {
                pMgr.PopulateArenaPowerUps();
            }

            var activeScene = EditorSceneManager.GetActiveScene();
            if (activeScene.isDirty)
            {
                EditorSceneManager.SaveScene(activeScene);
            }
            AssetDatabase.SaveAssets();

            Debug.Log("[AetherBound Phase 3] Phase 3 setup complete and saved!");
        }

        private static void EnsureRunnerButton(Transform parent, string name, string label, Vector2 pos)
        {
            var existing = parent.Find(name);
            if (existing != null) return;

            var btnGo = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(UnityEngine.UI.Image), typeof(UnityEngine.UI.Button));
            btnGo.transform.SetParent(parent, false);

            var rt = btnGo.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(1, 0);
            rt.anchorMax = new Vector2(1, 0);
            rt.pivot = new Vector2(1, 0);
            rt.anchoredPosition = pos;
            rt.sizeDelta = new Vector2(120, 48);

            var img = btnGo.GetComponent<UnityEngine.UI.Image>();
            img.color = new Color(0.1f, 0.22f, 0.32f, 0.85f);

            var txtGo = new GameObject("Text", typeof(RectTransform), typeof(CanvasRenderer), typeof(UnityEngine.UI.Text));
            txtGo.transform.SetParent(btnGo.transform, false);
            var txtRt = txtGo.GetComponent<RectTransform>();
            txtRt.anchorMin = Vector2.zero;
            txtRt.anchorMax = Vector2.one;
            txtRt.sizeDelta = Vector2.zero;

            var txt = txtGo.GetComponent<UnityEngine.UI.Text>();
            txt.text = label;
            txt.alignment = TextAnchor.MiddleCenter;
            txt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            txt.fontSize = 14;
            txt.fontStyle = FontStyle.Bold;
            txt.color = Color.white;
        }
    }
}
#endif
