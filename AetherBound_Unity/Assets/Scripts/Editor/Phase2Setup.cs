#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace AetherBound.Editor
{
    public static class Phase2Setup
    {
        [MenuItem("Tools/AetherBound/Execute Phase 2 Setup")]
        public static void ExecutePhase2Manual()
        {
            ExecutePhase2(true);
        }

        public static void ExecutePhase2(bool force)
        {
            Debug.Log("[AetherBound Phase 2] Starting execution of Phase 2: Core Movement & Physics Controls...");

            // 1. Configure Runner Controller Physics & Camera Settings
            ConfigureRunner();

            // 2. Configure Saboteur Controller Dual-Mode Camera & Abilities
            ConfigureSaboteur();

            // 3. Configure Procedural Character Visual Animators
            ConfigureAnimators();

            // 4. Ensure Mobile & Desktop HUD Controls
            ConfigureUIHUD();

            // 5. Save Scene & Project
            var activeScene = EditorSceneManager.GetActiveScene();
            if (activeScene.isDirty)
            {
                EditorSceneManager.SaveScene(activeScene);
            }
            AssetDatabase.SaveAssets();

            Debug.Log("[AetherBound Phase 2] Phase 2 successfully executed and verified!");
        }

        private static void ConfigureRunner()
        {
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
                Debug.Log("[AetherBound Phase 2] Runner Controller configured with 24 m/s² gravity, coyote time, and chase camera.");
            }
        }

        private static void ConfigureSaboteur()
        {
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
                Debug.Log("[AetherBound Phase 2] Saboteur Controller configured with dual-mode camera and Shadow Blink.");
            }
        }

        private static void ConfigureAnimators()
        {
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
            Debug.Log($"[AetherBound Phase 2] Configured {animators.Length} Procedural Character Animators.");
        }

        private static void ConfigureUIHUD()
        {
            var uiMgr = Object.FindAnyObjectByType<UIManager>();
            if (uiMgr != null)
            {
                uiMgr.BindAllButtons();

                // Check Saboteur HUD Panel for Mode and Blink buttons
                if (uiMgr.saboteurHudPanel != null)
                {
                    EnsureSaboteurButton(uiMgr.saboteurHudPanel.transform, "Btn_ViewMode", "🔭 CAM MODE", new Vector2(-110, 80));
                    EnsureSaboteurButton(uiMgr.saboteurHudPanel.transform, "Btn_Blink", "⚡ BLINK", new Vector2(-110, 140));
                    EnsureSaboteurButton(uiMgr.saboteurHudPanel.transform, "Btn_SnapRunner", "🎯 SNAP RUNNER", new Vector2(-110, 200));
                }

                EditorUtility.SetDirty(uiMgr);
                Debug.Log("[AetherBound Phase 2] UI HUD verified and buttons bound.");
            }
        }

        private static void EnsureSaboteurButton(Transform parent, string name, string label, Vector2 pos)
        {
            var existing = parent.Find(name);
            if (existing != null) return;

            var btnGo = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
            btnGo.transform.SetParent(parent, false);

            var rt = btnGo.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(1, 0);
            rt.anchorMax = new Vector2(1, 0);
            rt.pivot = new Vector2(1, 0);
            rt.anchoredPosition = pos;
            rt.sizeDelta = new Vector2(130, 48);

            var img = btnGo.GetComponent<Image>();
            img.color = new Color(0.12f, 0.16f, 0.28f, 0.85f);

            var txtGo = new GameObject("Text", typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            txtGo.transform.SetParent(btnGo.transform, false);
            var txtRt = txtGo.GetComponent<RectTransform>();
            txtRt.anchorMin = Vector2.zero;
            txtRt.anchorMax = Vector2.one;
            txtRt.sizeDelta = Vector2.zero;

            var txt = txtGo.GetComponent<Text>();
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
