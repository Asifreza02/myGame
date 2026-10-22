#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace AetherBound.Editor
{
    public static class SceneSetupWizard
    {
        [MenuItem("Tools/AetherBound/Generate Game Scene")]
        public static void BuildScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 1. Directional Light
            var lightGo = new GameObject("Directional Light");
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = new Color(1f, 0.97f, 0.9f);
            light.intensity = 1.6f;
            light.shadows = LightShadows.Soft;
            lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            // 2. Main Camera
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.Skybox;
            cam.fieldOfView = 65f;
            camGo.AddComponent<AudioListener>();
            camGo.transform.position = new Vector3(0, 5, -8);
            camGo.transform.rotation = Quaternion.Euler(15, 0, 0);

            // 3. Audio & Managers
            var audioGo = new GameObject("AudioManager");
            var audioMgr = audioGo.AddComponent<AudioManager>();

            var envGo = new GameObject("EnvironmentManager");
            var envMgr = envGo.AddComponent<EnvironmentManager>();
            envMgr.sunLight = light;

            var worldGo = new GameObject("WorldManager");
            var worldMgr = worldGo.AddComponent<WorldManager>();

            var goalGo = new GameObject("GoalBeacon");
            var goalBeacon = goalGo.AddComponent<GoalBeacon>();

            var obsGo = new GameObject("ObstacleManager");
            var obsMgr = obsGo.AddComponent<ObstacleManager>();

            var powGo = new GameObject("PowerUpManager");
            var powMgr = powGo.AddComponent<PowerUpManager>();

            // 4. Characters & Ground Sanctuary
            var sanctuaryGo = new GameObject("SpawnSanctuary");
            sanctuaryGo.transform.position = Vector3.zero;
            var sanctuary = sanctuaryGo.AddComponent<SpawnSanctuary>();

            var runnerGo = new GameObject("Runner");
            var runnerCtrl = runnerGo.AddComponent<RunnerController>();
            runnerCtrl.playerCamera = cam;
            CharacterModelBuilder.BuildRunnerVisuals(runnerGo.transform);

            var saboteurGo = new GameObject("Saboteur");
            var saboteurCtrl = saboteurGo.AddComponent<SaboteurController>();
            saboteurCtrl.playerCamera = cam;
            CharacterModelBuilder.BuildSaboteurVisuals(saboteurGo.transform);

            var aiGo = new GameObject("AISaboteur");
            var aiSaboteur = aiGo.AddComponent<AISaboteur>();

            // Save Prefabs
            PrefabUtility.SaveAsPrefabAsset(runnerGo, "Assets/Prefabs/Characters/Runner_Character.prefab");
            PrefabUtility.SaveAsPrefabAsset(saboteurGo, "Assets/Prefabs/Characters/Saboteur_Character.prefab");
            PrefabUtility.SaveAsPrefabAsset(sanctuaryGo, "Assets/Prefabs/Environment/SpawnSanctuaryGround.prefab");

            // 5. Game Manager
            var gmGo = new GameObject("GameManager");
            var gm = gmGo.AddComponent<GameManager>();
            gm.runner = runnerCtrl;
            gm.saboteur = saboteurCtrl;
            gm.aiSaboteur = aiSaboteur;
            gm.goalBeacon = goalBeacon;
            gm.sunLight = light;
            gm.mainCamera = cam;

            // 6. UI & Canvas
            BuildUI(gm, runnerCtrl, saboteurCtrl);

            // Save Scene
            string scenePath = "Assets/Scenes/AetherBound_Main.unity";
            EditorSceneManager.SaveScene(scene, scenePath);
            Debug.Log($"[AetherBound] Scene successfully generated and saved to: {scenePath}");

            // Add to EditorBuildSettings
            EditorBuildSettingsScene[] originalScenes = EditorBuildSettings.scenes;
            bool found = false;
            foreach (var s in originalScenes)
            {
                if (s.path == scenePath) { found = true; break; }
            }
            if (!found)
            {
                var newScenes = new EditorBuildSettingsScene[originalScenes.Length + 1];
                System.Array.Copy(originalScenes, newScenes, originalScenes.Length);
                newScenes[originalScenes.Length] = new EditorBuildSettingsScene(scenePath, true);
                EditorBuildSettings.scenes = newScenes;
            }
        }

        [MenuItem("Tools/AetherBound/Setup Environment In Current Scene")]
        public static void SetupEnvironmentCurrentScene()
        {
            var light = Object.FindAnyObjectByType<Light>();
            if (light == null || light.type != LightType.Directional)
            {
                var lightGo = new GameObject("Directional Light");
                light = lightGo.AddComponent<Light>();
                light.type = LightType.Directional;
                light.color = new Color(1f, 0.97f, 0.9f);
                light.intensity = 1.6f;
                light.shadows = LightShadows.Soft;
                lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            }

            var envMgr = Object.FindAnyObjectByType<EnvironmentManager>();
            if (envMgr == null)
            {
                var envGo = new GameObject("EnvironmentManager");
                envMgr = envGo.AddComponent<EnvironmentManager>();
            }
            envMgr.sunLight = light;

            var worldMgr = Object.FindAnyObjectByType<WorldManager>();
            if (worldMgr != null)
            {
                worldMgr.ClearAllChunks();
            }

            EditorSceneManager.MarkSceneDirty(EditorSceneManager.GetActiveScene());
            Debug.Log("[AetherBound] Environment successfully added and configured in current scene!");
        }

        [MenuItem("Tools/AetherBound/Add Character & Ground To Scene")]
        public static void AddCharacterAndGroundCurrentScene()
        {
            var cam = Camera.main;
            if (cam == null)
            {
                var camGo = new GameObject("Main Camera");
                camGo.tag = "MainCamera";
                cam = camGo.AddComponent<Camera>();
                cam.clearFlags = CameraClearFlags.Skybox;
                cam.fieldOfView = 65f;
                camGo.AddComponent<AudioListener>();
                camGo.transform.position = new Vector3(0, 5, -8);
                camGo.transform.rotation = Quaternion.Euler(15, 0, 0);
            }

            // 1. Spawn Sanctuary Ground
            var sanctuary = Object.FindAnyObjectByType<SpawnSanctuary>();
            if (sanctuary == null)
            {
                var sanctuaryGo = new GameObject("SpawnSanctuary");
                sanctuaryGo.transform.position = Vector3.zero;
                sanctuary = sanctuaryGo.AddComponent<SpawnSanctuary>();
            }
            else
            {
                sanctuary.BuildSanctuaryGround();
            }

            // 2. World & Environment
            var worldMgr = Object.FindAnyObjectByType<WorldManager>();
            if (worldMgr == null)
            {
                var worldGo = new GameObject("WorldManager");
                worldMgr = worldGo.AddComponent<WorldManager>();
            }

            var envMgr = Object.FindAnyObjectByType<EnvironmentManager>();
            if (envMgr == null)
            {
                var envGo = new GameObject("EnvironmentManager");
                envMgr = envGo.AddComponent<EnvironmentManager>();
            }

            // 3. Runner Character
            var runner = Object.FindAnyObjectByType<RunnerController>();
            if (runner == null)
            {
                var runnerGo = new GameObject("Runner");
                runner = runnerGo.AddComponent<RunnerController>();
            }
            runner.playerCamera = cam;
            CharacterModelBuilder.BuildRunnerVisuals(runner.transform);
            float startY = (worldMgr != null) ? worldMgr.GetHeightAt(0, 0) + 1.2f : 1.2f;
            runner.transform.position = new Vector3(0, startY, 0);

            // 4. Saboteur Character
            var saboteur = Object.FindAnyObjectByType<SaboteurController>();
            if (saboteur == null)
            {
                var saboteurGo = new GameObject("Saboteur");
                saboteur = saboteurGo.AddComponent<SaboteurController>();
            }
            saboteur.playerCamera = cam;
            CharacterModelBuilder.BuildSaboteurVisuals(saboteur.transform);
            float sY = (worldMgr != null) ? worldMgr.GetHeightAt(6, 6) + 1.2f : 1.2f;
            saboteur.transform.position = new Vector3(6, sY, 6);

            // 5. Save Prefabs
            PrefabUtility.SaveAsPrefabAsset(runner.gameObject, "Assets/Prefabs/Characters/Runner_Character.prefab");
            PrefabUtility.SaveAsPrefabAsset(saboteur.gameObject, "Assets/Prefabs/Characters/Saboteur_Character.prefab");
            PrefabUtility.SaveAsPrefabAsset(sanctuary.gameObject, "Assets/Prefabs/Environment/SpawnSanctuaryGround.prefab");

            // 6. Game Manager & Systems
            var gm = Object.FindAnyObjectByType<GameManager>();
            if (gm == null)
            {
                var gmGo = new GameObject("GameManager");
                gm = gmGo.AddComponent<GameManager>();
            }
            gm.runner = runner;
            gm.saboteur = saboteur;
            gm.mainCamera = cam;

            if (Object.FindAnyObjectByType<AudioManager>() == null)
            {
                new GameObject("AudioManager").AddComponent<AudioManager>();
            }
            if (Object.FindAnyObjectByType<GoalBeacon>() == null)
            {
                var g = new GameObject("GoalBeacon").AddComponent<GoalBeacon>();
                gm.goalBeacon = g;
            }
            if (Object.FindAnyObjectByType<ObstacleManager>() == null)
            {
                new GameObject("ObstacleManager").AddComponent<ObstacleManager>();
            }
            if (Object.FindAnyObjectByType<PowerUpManager>() == null)
            {
                new GameObject("PowerUpManager").AddComponent<PowerUpManager>();
            }

            // 7. UI Canvas
            if (Object.FindAnyObjectByType<UIManager>() == null)
            {
                BuildUI(gm, runner, saboteur);
            }

            EditorSceneManager.MarkSceneDirty(EditorSceneManager.GetActiveScene());
            Debug.Log("[AetherBound] Ground, Sanctuary, Characters and gameplay systems successfully added to current scene!");
        }

        private static void BuildUI(GameManager gm, RunnerController runner, SaboteurController saboteur)
        {
            var eventSysGo = new GameObject("EventSystem");
            eventSysGo.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM
            var inputModule = eventSysGo.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
            try { inputModule.AssignDefaultActions(); } catch { }
#else
            eventSysGo.AddComponent<StandaloneInputModule>();
#endif
            eventSysGo.AddComponent<CursorManager>();

            var canvasGo = new GameObject("Canvas");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;
            canvasGo.AddComponent<GraphicRaycaster>();

            var uiMgrGo = new GameObject("UIManager");
            uiMgrGo.transform.parent = canvasGo.transform;
            var uiMgr = uiMgrGo.AddComponent<UIManager>();

            var mobileInputGo = new GameObject("MobileInputManager");
            mobileInputGo.transform.parent = canvasGo.transform;
            var mobileInput = mobileInputGo.AddComponent<MobileInputManager>();

            // Damage Flash Overlay
            var flashGo = CreateUIElement("DamageFlash", canvasGo.transform, new Vector2(0, 0), new Vector2(1, 1), Vector2.zero, Vector2.zero);
            var flashImg = flashGo.AddComponent<Image>();
            flashImg.color = new Color(1, 0, 0, 0);
            flashImg.raycastTarget = false;
            uiMgr.damageFlashImage = flashImg;

            // Virtual Joystick
            var joyBgGo = CreateUIElement("VirtualJoystick_Bg", canvasGo.transform, new Vector2(0, 0), new Vector2(0, 0), new Vector2(180, 180), new Vector2(220, 220));
            var joyBgImg = joyBgGo.AddComponent<Image>();
            joyBgImg.color = new Color(1, 1, 1, 0.25f);
            var joy = joyBgGo.AddComponent<VirtualJoystick>();

            var joyHandleGo = CreateUIElement("Handle", joyBgGo.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(80, 80));
            var joyHandleImg = joyHandleGo.AddComponent<Image>();
            joyHandleImg.color = new Color(0f, 0.85f, 1f, 0.75f);
            joy.handle = joyHandleGo.GetComponent<RectTransform>();
            joy.background = joyBgGo.GetComponent<RectTransform>();
            mobileInput.joystick = joy;

            // Touch Look Zone
            var lookZoneGo = CreateUIElement("TouchLookZone", canvasGo.transform, new Vector2(0.5f, 0f), new Vector2(1f, 0.85f), Vector2.zero, Vector2.zero);
            var lookImg = lookZoneGo.AddComponent<Image>();
            lookImg.color = new Color(1, 1, 1, 0.001f); // transparent touch interceptor
            var lookZone = lookZoneGo.AddComponent<TouchLookZone>();
            mobileInput.lookZone = lookZone;

            // Top HUD
            var topHud = CreateUIElement("TopHUD", canvasGo.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0, -50), new Vector2(1000, 80));
            uiMgr.topHudPanel = topHud;

            var timerTextGo = CreateText("TimerText", topHud.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 50), "⏱️ 90s", 34, TextAnchor.MiddleCenter, Color.yellow);
            uiMgr.timerText = timerTextGo.GetComponent<Text>();

            var beaconDistTextGo = CreateText("BeaconDistText", topHud.transform, new Vector2(0.15f, 0.5f), Vector2.zero, new Vector2(260, 50), "🎯 BEACON: 180m", 26, TextAnchor.MiddleLeft, Color.cyan);
            uiMgr.goalDistanceText = beaconDistTextGo.GetComponent<Text>();

            var compassTextGo = CreateText("CompassText", topHud.transform, new Vector2(0.85f, 0.5f), Vector2.zero, new Vector2(200, 50), "🧭 0°", 26, TextAnchor.MiddleRight, Color.white);
            uiMgr.compassText = compassTextGo.GetComponent<Text>();

            var todTextGo = CreateText("TimeOfDayText", topHud.transform, new Vector2(0.5f, -0.4f), Vector2.zero, new Vector2(200, 35), "☀️ MIDDAY", 20, TextAnchor.MiddleCenter, Color.white);
            uiMgr.timeOfDayText = todTextGo.GetComponent<Text>();

            // Runner HUD
            var runnerHud = CreateUIElement("RunnerHUD", canvasGo.transform, new Vector2(0f, 0f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero);
            uiMgr.runnerHudPanel = runnerHud;

            // Health & Stamina bars (Top-Left)
            var hpBarBg = CreateUIElement("HP_Bg", runnerHud.transform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(160, -50), new Vector2(240, 24));
            hpBarBg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f, 0.7f);

            var hpBarFill = CreateUIElement("HP_Fill", hpBarBg.transform, new Vector2(0, 0), new Vector2(1, 1), Vector2.zero, Vector2.zero);
            var hpImg = hpBarFill.AddComponent<Image>();
            hpImg.type = Image.Type.Filled;
            hpImg.fillMethod = Image.FillMethod.Horizontal;
            hpImg.color = new Color(0f, 0.9f, 0.35f);
            uiMgr.healthBar = hpImg;

            var hpTextGo = CreateText("HP_Text", hpBarBg.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 24), "HP 100", 18, TextAnchor.MiddleCenter, Color.white);
            uiMgr.healthText = hpTextGo.GetComponent<Text>();

            var stmBarBg = CreateUIElement("STM_Bg", runnerHud.transform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(160, -82), new Vector2(240, 20));
            stmBarBg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f, 0.7f);

            var stmBarFill = CreateUIElement("STM_Fill", stmBarBg.transform, new Vector2(0, 0), new Vector2(1, 1), Vector2.zero, Vector2.zero);
            var stmImg = stmBarFill.AddComponent<Image>();
            stmImg.type = Image.Type.Filled;
            stmImg.fillMethod = Image.FillMethod.Horizontal;
            stmImg.color = new Color(0f, 0.75f, 1f);
            uiMgr.staminaBar = stmImg;

            var stmTextGo = CreateText("STM_Text", stmBarBg.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 20), "STM 100", 16, TextAnchor.MiddleCenter, Color.white);
            uiMgr.staminaText = stmTextGo.GetComponent<Text>();

            // Runner Action Buttons (Bottom Right)
            CreateActionButton("JumpBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-120, 140), new Vector2(90, 90), "🦘", () => mobileInput.OnJumpPressed());
            CreateActionButton("SlideBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-230, 110), new Vector2(80, 80), "💨", () => mobileInput.OnSlidePressed());
            CreateActionButton("SprintBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-120, 250), new Vector2(80, 80), "🏃", () => mobileInput.OnSprintToggle());
            CreateActionButton("SnapGoalBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-230, 210), new Vector2(70, 70), "🎯", () => mobileInput.OnSnapGoal());
            CreateActionButton("LookBehindBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-320, 140), new Vector2(70, 70), "🔄", () => mobileInput.OnLookBehind());

            // Saboteur HUD
            var sabHud = CreateUIElement("SaboteurHUD", canvasGo.transform, new Vector2(0f, 0f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero);
            uiMgr.saboteurHudPanel = sabHud;

            // Energy Bar (Top-Left)
            var nrgBarBg = CreateUIElement("NRG_Bg", sabHud.transform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(160, -50), new Vector2(240, 24));
            nrgBarBg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f, 0.7f);

            var nrgBarFill = CreateUIElement("NRG_Fill", nrgBarBg.transform, new Vector2(0, 0), new Vector2(1, 1), Vector2.zero, Vector2.zero);
            var nrgImg = nrgBarFill.AddComponent<Image>();
            nrgImg.type = Image.Type.Filled;
            nrgImg.fillMethod = Image.FillMethod.Horizontal;
            nrgImg.color = new Color(1f, 0.6f, 0f);
            uiMgr.energyBar = nrgImg;

            var nrgTextGo = CreateText("NRG_Text", nrgBarBg.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 24), "⚡ 100", 18, TextAnchor.MiddleCenter, Color.white);
            uiMgr.energyText = nrgTextGo.GetComponent<Text>();

            var pDistTextGo = CreateText("PlacementDistText", sabHud.transform, new Vector2(0, 1), new Vector2(160, -90), new Vector2(260, 30), "Dist: 16m / 75m", 18, TextAnchor.MiddleLeft, Color.white);
            uiMgr.placementDistText = pDistTextGo.GetComponent<Text>();

            var warnTextGo = CreateText("WarningText", sabHud.transform, new Vector2(0.5f, 0.7f), Vector2.zero, new Vector2(500, 40), "SANCTUARY PROTECTED ZONE", 24, TextAnchor.MiddleCenter, Color.red);
            uiMgr.invalidWarningText = warnTextGo.GetComponent<Text>();

            // Saboteur Hotbar (Bottom Center)
            string[] obsIcons = new string[] { "🧱 Wall\n(25⚡)", "🧪 Mud\n(20⚡)", "⚡ Spikes\n(35⚡)", "☄️ Boulder\n(40⚡)", "💥 Barrel\n(45⚡)" };
            for (int i = 0; i < obsIcons.Length; i++)
            {
                int index = i;
                float posX = (i - 2) * 110f;
                CreateActionButton($"Hotbar_{i}", sabHud.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(posX, 60), new Vector2(95, 75), obsIcons[i], () => mobileInput.OnSelectObstacleType(index));
            }

            // Saboteur Action Buttons (Right)
            CreateActionButton("DeployBtn", sabHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-120, 140), new Vector2(100, 100), "💥\nDEPLOY", () => mobileInput.OnDeployObstacle());
            CreateActionButton("RotateBtn", sabHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-240, 130), new Vector2(80, 80), "🔄\n45°", () => mobileInput.OnRotateObstacle());
            CreateActionButton("ReconBtn", sabHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-120, 260), new Vector2(80, 80), "📡\nRECON", () => mobileInput.OnReconPulse());

            // Role Select Panel
            var roleSelect = CreateUIElement("RoleSelectPanel", canvasGo.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(650, 420));
            roleSelect.AddComponent<Image>().color = new Color(0.08f, 0.11f, 0.17f, 0.95f);
            uiMgr.roleSelectPanel = roleSelect;

            CreateText("RoleTitle", roleSelect.transform, new Vector2(0.5f, 0.85f), Vector2.zero, new Vector2(500, 60), "⚡ AETHERBOUND: SABOTAGE ⚡", 30, TextAnchor.MiddleCenter, Color.cyan);
            CreateText("RoleSubtitle", roleSelect.transform, new Vector2(0.5f, 0.70f), Vector2.zero, new Vector2(500, 40), "Select your role to enter the match:", 20, TextAnchor.MiddleCenter, Color.white);

            CreateActionButton("RunnerBtn", roleSelect.transform, new Vector2(0.5f, 0.45f), new Vector2(0.5f, 0.45f), Vector2.zero, new Vector2(380, 65), "🏃 PLAY AS RUNNER (Solo vs AI)", () => gm.StartGameWithRole(PlayerRole.Runner));
            CreateActionButton("SaboteurBtn", roleSelect.transform, new Vector2(0.5f, 0.25f), new Vector2(0.5f, 0.25f), Vector2.zero, new Vector2(380, 65), "🦹‍♂️ PLAY AS SABOTEUR", () => gm.StartGameWithRole(PlayerRole.Saboteur));

            // Game Over Panel
            var gameOver = CreateUIElement("GameOverPanel", canvasGo.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(650, 420));
            gameOver.AddComponent<Image>().color = new Color(0.08f, 0.11f, 0.17f, 0.96f);
            uiMgr.gameOverPanel = gameOver;

            var goTitle = CreateText("GOTitle", gameOver.transform, new Vector2(0.5f, 0.82f), Vector2.zero, new Vector2(550, 60), "🏆 RUNNER VICTORY!", 34, TextAnchor.MiddleCenter, Color.cyan);
            uiMgr.gameOverTitleText = goTitle.GetComponent<Text>();

            var goMsg = CreateText("GOMsg", gameOver.transform, new Vector2(0.5f, 0.65f), Vector2.zero, new Vector2(550, 40), "Beacon Goal reached before timer expired!", 22, TextAnchor.MiddleCenter, Color.white);
            uiMgr.gameOverMessageText = goMsg.GetComponent<Text>();

            var goStats = CreateText("GOStats", gameOver.transform, new Vector2(0.5f, 0.48f), Vector2.zero, new Vector2(550, 40), "Time: 42s | Obstacles: 8", 20, TextAnchor.MiddleCenter, Color.yellow);
            uiMgr.matchStatsText = goStats.GetComponent<Text>();

            CreateActionButton("ReplayBtn", gameOver.transform, new Vector2(0.5f, 0.28f), new Vector2(0.5f, 0.28f), Vector2.zero, new Vector2(320, 55), "🔄 PLAY AGAIN", () => gm.RestartMatch());
            CreateActionButton("SwitchRoleBtn", gameOver.transform, new Vector2(0.5f, 0.12f), new Vector2(0.5f, 0.12f), Vector2.zero, new Vector2(320, 50), "👥 SWITCH ROLE", () => gm.OpenRoleSelect());

            gameOver.SetActive(false);
            uiMgr.BindAllButtons();
        }

        private static GameObject CreateUIElement(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPos, Vector2 size)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = size;
            return go;
        }

        private static GameObject CreateText(string name, Transform parent, Vector2 anchor, Vector2 pos, Vector2 size, string content, int fontSize, TextAnchor alignment, Color color)
        {
            var go = CreateUIElement(name, parent, anchor, anchor, pos, size);
            var t = go.AddComponent<Text>();
            t.text = content;
            t.fontSize = fontSize;
            t.alignment = alignment;
            t.color = color;
            t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            return go;
        }

        private static GameObject CreateActionButton(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pos, Vector2 size, string text, UnityEngine.Events.UnityAction onClick)
        {
            var go = CreateUIElement(name, parent, anchorMin, anchorMax, pos, size);
            var img = go.AddComponent<Image>();
            img.color = new Color(0.15f, 0.22f, 0.35f, 0.85f);
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            btn.onClick.AddListener(onClick);

            var textGo = CreateText("Label", go.transform, new Vector2(0.5f, 0.5f), Vector2.zero, size, text, 18, TextAnchor.MiddleCenter, Color.white);
            return go;
        }
    }
}
#endif
