using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace AetherBound
{
    public static class GameBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        public static void AutoBootstrapGame()
        {
            if (GameManager.Instance != null)
            {
                // Already setup in scene
                return;
            }

            Debug.Log("[AetherBound] AutoBootstrapping Game systems and UI...");

            // 1. Camera & Light
            var cam = Camera.main;
            if (cam == null)
            {
                var camGo = new GameObject("Main Camera");
                camGo.tag = "MainCamera";
                cam = camGo.AddComponent<Camera>();
                cam.clearFlags = CameraClearFlags.Skybox;
                cam.fieldOfView = 65f;
                camGo.AddComponent<AudioListener>();
            }

            var light = Object.FindAnyObjectByType<Light>();
            if (light == null || light.type != LightType.Directional)
            {
                var lightGo = new GameObject("Directional Light");
                light = lightGo.AddComponent<Light>();
                light.type = LightType.Directional;
                light.color = new Color(1f, 0.96f, 0.9f);
                light.intensity = 1.6f;
                light.shadows = LightShadows.Soft;
                lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            }

            // 2. Systems
            var sysRoot = new GameObject("[GameSystems]");

            var audioMgr = sysRoot.AddComponent<AudioManager>();
            var worldMgr = sysRoot.AddComponent<WorldManager>();
            var envMgr = sysRoot.AddComponent<EnvironmentManager>();
            envMgr.sunLight = light;
            var obsMgr = sysRoot.AddComponent<ObstacleManager>();
            var powMgr = sysRoot.AddComponent<PowerUpManager>();

            var goalGo = new GameObject("GoalBeacon");
            goalGo.transform.parent = sysRoot.transform;
            var goalBeacon = goalGo.AddComponent<GoalBeacon>();

            var sanctuaryGo = new GameObject("SpawnSanctuary");
            sanctuaryGo.transform.parent = sysRoot.transform;
            sanctuaryGo.transform.position = Vector3.zero;
            sanctuaryGo.AddComponent<SpawnSanctuary>();

            // 3. Characters
            var runnerGo = new GameObject("Runner");
            var runnerCtrl = runnerGo.AddComponent<RunnerController>();
            runnerCtrl.playerCamera = cam;
            CharacterModelBuilder.BuildRunnerVisuals(runnerGo.transform);

            var saboteurGo = new GameObject("Saboteur");
            var saboteurCtrl = saboteurGo.AddComponent<SaboteurController>();
            saboteurCtrl.playerCamera = cam;
            CharacterModelBuilder.BuildSaboteurVisuals(saboteurGo.transform);

            var aiSaboteur = sysRoot.AddComponent<AISaboteur>();

            // 4. GameManager
            var gm = sysRoot.AddComponent<GameManager>();
            gm.runner = runnerCtrl;
            gm.saboteur = saboteurCtrl;
            gm.aiSaboteur = aiSaboteur;
            gm.goalBeacon = goalBeacon;
            gm.sunLight = light;
            gm.mainCamera = cam;

            // 5. Canvas & Mobile Controls
            BuildRuntimeUI(gm, runnerCtrl, saboteurCtrl);

            Debug.Log("[AetherBound] AutoBootstrapping completed successfully! Ready to play.");
        }

        private static void BuildRuntimeUI(GameManager gm, RunnerController runner, SaboteurController saboteur)
        {
            if (Object.FindAnyObjectByType<EventSystem>() == null)
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
            }

            var canvasGo = new GameObject("Canvas");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;
            canvasGo.AddComponent<GraphicRaycaster>();

            var uiMgr = canvasGo.AddComponent<UIManager>();
            var mobileInput = canvasGo.AddComponent<MobileInputManager>();

            // Damage Flash
            var flashGo = CreateUIBox("DamageFlash", canvasGo.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var flashImg = flashGo.AddComponent<Image>();
            flashImg.color = new Color(1, 0, 0, 0);
            flashImg.raycastTarget = false;
            uiMgr.damageFlashImage = flashImg;

            // Virtual Joystick
            var joyBgGo = CreateUIBox("VirtualJoystick_Bg", canvasGo.transform, Vector2.zero, Vector2.zero, new Vector2(180, 180), new Vector2(220, 220));
            var joyBgImg = joyBgGo.AddComponent<Image>();
            joyBgImg.color = new Color(1, 1, 1, 0.22f);
            var joy = joyBgGo.AddComponent<VirtualJoystick>();

            var joyHandleGo = CreateUIBox("Handle", joyBgGo.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(80, 80));
            var joyHandleImg = joyHandleGo.AddComponent<Image>();
            joyHandleImg.color = new Color(0f, 0.85f, 1f, 0.75f);
            joy.handle = joyHandleGo.GetComponent<RectTransform>();
            joy.background = joyBgGo.GetComponent<RectTransform>();
            mobileInput.joystick = joy;

            // Touch Look Zone
            var lookZoneGo = CreateUIBox("TouchLookZone", canvasGo.transform, new Vector2(0.5f, 0f), new Vector2(1f, 0.85f), Vector2.zero, Vector2.zero);
            var lookImg = lookZoneGo.AddComponent<Image>();
            lookImg.color = new Color(1, 1, 1, 0.001f);
            var lookZone = lookZoneGo.AddComponent<TouchLookZone>();
            mobileInput.lookZone = lookZone;

            // Top HUD
            var topHud = CreateUIBox("TopHUD", canvasGo.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0, -50), new Vector2(1000, 80));
            uiMgr.topHudPanel = topHud;

            var timerTextGo = CreateUIText("TimerText", topHud.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 50), "⏱️ 90s", 34, TextAnchor.MiddleCenter, Color.yellow);
            uiMgr.timerText = timerTextGo.GetComponent<Text>();

            var beaconDistTextGo = CreateUIText("BeaconDistText", topHud.transform, new Vector2(0.15f, 0.5f), Vector2.zero, new Vector2(260, 50), "🎯 BEACON: 180m", 26, TextAnchor.MiddleLeft, Color.cyan);
            uiMgr.goalDistanceText = beaconDistTextGo.GetComponent<Text>();

            var compassTextGo = CreateUIText("CompassText", topHud.transform, new Vector2(0.85f, 0.5f), Vector2.zero, new Vector2(200, 50), "🧭 0°", 26, TextAnchor.MiddleRight, Color.white);
            uiMgr.compassText = compassTextGo.GetComponent<Text>();

            var todTextGo = CreateUIText("TimeOfDayText", topHud.transform, new Vector2(0.5f, -0.4f), Vector2.zero, new Vector2(200, 35), "☀️ MIDDAY", 20, TextAnchor.MiddleCenter, Color.white);
            uiMgr.timeOfDayText = todTextGo.GetComponent<Text>();

            // Runner HUD
            var runnerHud = CreateUIBox("RunnerHUD", canvasGo.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            uiMgr.runnerHudPanel = runnerHud;

            // Health bar
            var hpBarBg = CreateUIBox("HP_Bg", runnerHud.transform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(160, -50), new Vector2(240, 24));
            hpBarBg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f, 0.7f);

            var hpBarFill = CreateUIBox("HP_Fill", hpBarBg.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var hpImg = hpBarFill.AddComponent<Image>();
            hpImg.type = Image.Type.Filled;
            hpImg.fillMethod = Image.FillMethod.Horizontal;
            hpImg.color = new Color(0f, 0.9f, 0.35f);
            uiMgr.healthBar = hpImg;

            var hpTextGo = CreateUIText("HP_Text", hpBarBg.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 24), "HP 100", 18, TextAnchor.MiddleCenter, Color.white);
            uiMgr.healthText = hpTextGo.GetComponent<Text>();

            // Stamina bar
            var stmBarBg = CreateUIBox("STM_Bg", runnerHud.transform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(160, -82), new Vector2(240, 20));
            stmBarBg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f, 0.7f);

            var stmBarFill = CreateUIBox("STM_Fill", stmBarBg.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var stmImg = stmBarFill.AddComponent<Image>();
            stmImg.type = Image.Type.Filled;
            stmImg.fillMethod = Image.FillMethod.Horizontal;
            stmImg.color = new Color(0f, 0.75f, 1f);
            uiMgr.staminaBar = stmImg;

            var stmTextGo = CreateUIText("STM_Text", stmBarBg.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 20), "STM 100", 16, TextAnchor.MiddleCenter, Color.white);
            uiMgr.staminaText = stmTextGo.GetComponent<Text>();

            // Runner Action Buttons (Bottom Right)
            CreateButton("JumpBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-120, 140), new Vector2(90, 90), "🦘", () => mobileInput.OnJumpPressed());
            CreateButton("SlideBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-230, 110), new Vector2(80, 80), "💨", () => mobileInput.OnSlidePressed());
            CreateButton("SprintBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-120, 250), new Vector2(80, 80), "🏃", () => mobileInput.OnSprintToggle());
            CreateButton("SnapGoalBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-230, 210), new Vector2(70, 70), "🎯", () => mobileInput.OnSnapGoal());
            CreateButton("LookBehindBtn", runnerHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-320, 140), new Vector2(70, 70), "🔄", () => mobileInput.OnLookBehind());

            // Saboteur HUD
            var sabHud = CreateUIBox("SaboteurHUD", canvasGo.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            uiMgr.saboteurHudPanel = sabHud;

            // Energy Bar
            var nrgBarBg = CreateUIBox("NRG_Bg", sabHud.transform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(160, -50), new Vector2(240, 24));
            nrgBarBg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f, 0.7f);

            var nrgBarFill = CreateUIBox("NRG_Fill", nrgBarBg.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var nrgImg = nrgBarFill.AddComponent<Image>();
            nrgImg.type = Image.Type.Filled;
            nrgImg.fillMethod = Image.FillMethod.Horizontal;
            nrgImg.color = new Color(1f, 0.6f, 0f);
            uiMgr.energyBar = nrgImg;

            var nrgTextGo = CreateUIText("NRG_Text", nrgBarBg.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 24), "⚡ 100", 18, TextAnchor.MiddleCenter, Color.white);
            uiMgr.energyText = nrgTextGo.GetComponent<Text>();

            var pDistTextGo = CreateUIText("PlacementDistText", sabHud.transform, new Vector2(0, 1), new Vector2(160, -90), new Vector2(260, 30), "Dist: 16m / 75m", 18, TextAnchor.MiddleLeft, Color.white);
            uiMgr.placementDistText = pDistTextGo.GetComponent<Text>();

            var warnTextGo = CreateUIText("WarningText", sabHud.transform, new Vector2(0.5f, 0.7f), Vector2.zero, new Vector2(500, 40), "SANCTUARY PROTECTED ZONE", 24, TextAnchor.MiddleCenter, Color.red);
            uiMgr.invalidWarningText = warnTextGo.GetComponent<Text>();

            // Saboteur Hotbar
            string[] obsIcons = new string[] { "🧱 Wall\n(25⚡)", "🧪 Mud\n(20⚡)", "⚡ Spikes\n(35⚡)", "☄️ Boulder\n(40⚡)", "💥 Barrel\n(45⚡)" };
            for (int i = 0; i < obsIcons.Length; i++)
            {
                int index = i;
                float posX = (i - 2) * 110f;
                CreateButton($"Hotbar_{i}", sabHud.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(posX, 60), new Vector2(95, 75), obsIcons[i], () => mobileInput.OnSelectObstacleType(index));
            }

            CreateButton("DeployBtn", sabHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-120, 140), new Vector2(100, 100), "💥\nDEPLOY", () => mobileInput.OnDeployObstacle());
            CreateButton("RotateBtn", sabHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-240, 130), new Vector2(80, 80), "🔄\n45°", () => mobileInput.OnRotateObstacle());
            CreateButton("ReconBtn", sabHud.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-120, 260), new Vector2(80, 80), "📡\nRECON", () => mobileInput.OnReconPulse());

            // Role Select Panel
            var roleSelect = CreateUIBox("RoleSelectPanel", canvasGo.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(650, 420));
            roleSelect.AddComponent<Image>().color = new Color(0.08f, 0.11f, 0.17f, 0.95f);
            uiMgr.roleSelectPanel = roleSelect;

            CreateUIText("RoleTitle", roleSelect.transform, new Vector2(0.5f, 0.85f), Vector2.zero, new Vector2(500, 60), "⚡ AETHERBOUND: SABOTAGE ⚡", 30, TextAnchor.MiddleCenter, Color.cyan);
            CreateUIText("RoleSubtitle", roleSelect.transform, new Vector2(0.5f, 0.70f), Vector2.zero, new Vector2(500, 40), "Select your role to enter the match:", 20, TextAnchor.MiddleCenter, Color.white);

            CreateButton("RunnerBtn", roleSelect.transform, new Vector2(0.5f, 0.45f), new Vector2(0.5f, 0.45f), Vector2.zero, new Vector2(380, 65), "🏃 PLAY AS RUNNER (Solo vs AI)", () => gm.StartGameWithRole(PlayerRole.Runner));
            CreateButton("SaboteurBtn", roleSelect.transform, new Vector2(0.5f, 0.25f), new Vector2(0.5f, 0.25f), Vector2.zero, new Vector2(380, 65), "🦹‍♂️ PLAY AS SABOTEUR", () => gm.StartGameWithRole(PlayerRole.Saboteur));

            // Game Over Panel
            var gameOver = CreateUIBox("GameOverPanel", canvasGo.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(650, 420));
            gameOver.AddComponent<Image>().color = new Color(0.08f, 0.11f, 0.17f, 0.96f);
            uiMgr.gameOverPanel = gameOver;

            var goTitle = CreateUIText("GOTitle", gameOver.transform, new Vector2(0.5f, 0.82f), Vector2.zero, new Vector2(550, 60), "🏆 RUNNER VICTORY!", 34, TextAnchor.MiddleCenter, Color.cyan);
            uiMgr.gameOverTitleText = goTitle.GetComponent<Text>();

            var goMsg = CreateUIText("GOMsg", gameOver.transform, new Vector2(0.5f, 0.65f), Vector2.zero, new Vector2(550, 40), "Beacon Goal reached before timer expired!", 22, TextAnchor.MiddleCenter, Color.white);
            uiMgr.gameOverMessageText = goMsg.GetComponent<Text>();

            var goStats = CreateUIText("GOStats", gameOver.transform, new Vector2(0.5f, 0.48f), Vector2.zero, new Vector2(550, 40), "Time: 42s | Obstacles: 8", 20, TextAnchor.MiddleCenter, Color.yellow);
            uiMgr.matchStatsText = goStats.GetComponent<Text>();

            CreateButton("ReplayBtn", gameOver.transform, new Vector2(0.5f, 0.28f), new Vector2(0.5f, 0.28f), Vector2.zero, new Vector2(320, 55), "🔄 PLAY AGAIN", () => gm.RestartMatch());
            CreateButton("SwitchRoleBtn", gameOver.transform, new Vector2(0.5f, 0.12f), new Vector2(0.5f, 0.12f), Vector2.zero, new Vector2(320, 50), "👥 SWITCH ROLE", () => gm.OpenRoleSelect());

            gameOver.SetActive(false);
            uiMgr.BindAllButtons();
        }

        private static GameObject CreateUIBox(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPos, Vector2 size)
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

        private static GameObject CreateUIText(string name, Transform parent, Vector2 anchor, Vector2 pos, Vector2 size, string content, int fontSize, TextAnchor alignment, Color color)
        {
            var go = CreateUIBox(name, parent, anchor, anchor, pos, size);
            var t = go.AddComponent<Text>();
            t.text = content;
            t.fontSize = fontSize;
            t.alignment = alignment;
            t.color = color;
            t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            return go;
        }

        private static GameObject CreateButton(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pos, Vector2 size, string text, UnityEngine.Events.UnityAction onClick)
        {
            var go = CreateUIBox(name, parent, anchorMin, anchorMax, pos, size);
            var img = go.AddComponent<Image>();
            img.color = new Color(0.15f, 0.22f, 0.35f, 0.85f);
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            btn.onClick.AddListener(onClick);

            var textGo = CreateUIText("Label", go.transform, new Vector2(0.5f, 0.5f), Vector2.zero, size, text, 18, TextAnchor.MiddleCenter, Color.white);
            return go;
        }
    }
}
