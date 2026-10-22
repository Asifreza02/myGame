using UnityEngine;
using UnityEngine.UI;

namespace AetherBound
{
    public class UIManager : MonoBehaviour
    {
        public static UIManager Instance { get; private set; }

        [Header("Panels")]
        public GameObject roleSelectPanel;
        public GameObject topHudPanel;
        public GameObject runnerHudPanel;
        public GameObject saboteurHudPanel;
        public GameObject gameOverPanel;
        public Image damageFlashImage;

        [Header("Top HUD Elements")]
        public Text timerText;
        public Text goalDistanceText;
        public Text compassText;
        public Text timeOfDayText;

        [Header("Runner HUD Elements")]
        public Image healthBar;
        public Text healthText;
        public Image staminaBar;
        public Text staminaText;

        [Header("Saboteur HUD Elements")]
        public Image energyBar;
        public Text energyText;
        public Text placementDistText;
        public Text invalidWarningText;
        public Text reconCooldownText;

        [Header("Game Over Elements")]
        public Text gameOverTitleText;
        public Text gameOverMessageText;
        public Text matchStatsText;

        private float damageFlashAlpha = 0f;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            InputSystemUIConfigurator.ConfigureEventSystem();
            InputSystemUIConfigurator.EnsureCursorManager();
        }

        private void Start()
        {
            BindAllButtons();
            ShowRoleSelect();
        }

        public void BindAllButtons()
        {
            // 1. Role Select Panel
            if (roleSelectPanel != null)
            {
                var buttons = roleSelectPanel.GetComponentsInChildren<Button>(true);
                foreach (var b in buttons)
                {
                    string n = b.name.ToLowerInvariant();
                    if (n.Contains("runner"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() =>
                        {
                            if (GameManager.Instance != null) GameManager.Instance.StartGameWithRole(PlayerRole.Runner);
                        });
                    }
                    else if (n.Contains("saboteur"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() =>
                        {
                            if (GameManager.Instance != null) GameManager.Instance.StartGameWithRole(PlayerRole.Saboteur);
                        });
                    }
                }
            }

            // 2. Game Over Panel
            if (gameOverPanel != null)
            {
                var buttons = gameOverPanel.GetComponentsInChildren<Button>(true);
                foreach (var b in buttons)
                {
                    string n = b.name.ToLowerInvariant();
                    if (n.Contains("replay"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() =>
                        {
                            if (GameManager.Instance != null) GameManager.Instance.RestartMatch();
                        });
                    }
                    else if (n.Contains("role") || n.Contains("switch"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() =>
                        {
                            if (GameManager.Instance != null) GameManager.Instance.OpenRoleSelect();
                        });
                    }
                }
            }

            // 3. Runner HUD Actions
            if (runnerHudPanel != null)
            {
                var buttons = runnerHudPanel.GetComponentsInChildren<Button>(true);
                foreach (var b in buttons)
                {
                    string n = b.name.ToLowerInvariant();
                    if (n.Contains("jump"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnJumpPressed());
                    }
                    else if (n.Contains("slide"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnSlidePressed());
                    }
                    else if (n.Contains("sprint"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnSprintToggle());
                    }
                    else if (n.Contains("snap"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnSnapGoal());
                    }
                    else if (n.Contains("lookbehind"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnLookBehind());
                    }
                    else if (n.Contains("dash"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnDashPressed());
                    }
                    else if (n.Contains("pulse") || n.Contains("deflect"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnPulsePressed());
                    }
                }
            }

            // 4. Saboteur HUD Actions & Hotbar
            if (saboteurHudPanel != null)
            {
                var buttons = saboteurHudPanel.GetComponentsInChildren<Button>(true);
                foreach (var b in buttons)
                {
                    string n = b.name.ToLowerInvariant();
                    if (n.Contains("deploy"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnDeployObstacle());
                    }
                    else if (n.Contains("rotate"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnRotateObstacle());
                    }
                    else if (n.Contains("recon"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnReconPulse());
                    }
                    else if (n.Contains("mode") || n.Contains("view") || n.Contains("cam"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnToggleSaboteurViewMode());
                    }
                    else if (n.Contains("blink") || n.Contains("dash") || n.Contains("shadow"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnBlinkPressed());
                    }
                    else if (n.Contains("snap"))
                    {
                        b.onClick.RemoveAllListeners();
                        b.onClick.AddListener(() => MobileInputManager.Instance?.OnSnapRunner());
                    }
                    else if (n.StartsWith("hotbar_"))
                    {
                        if (int.TryParse(b.name.Substring(7), out int idx))
                        {
                            int capturedIdx = idx;
                            b.onClick.RemoveAllListeners();
                            b.onClick.AddListener(() => MobileInputManager.Instance?.OnSelectObstacleType(capturedIdx));
                        }
                    }
                }
            }
        }

        private void Update()
        {
            // Damage Flash decay
            if (damageFlashAlpha > 0)
            {
                damageFlashAlpha = Mathf.Max(0, damageFlashAlpha - Time.deltaTime * 2.5f);
                if (damageFlashImage != null)
                {
                    damageFlashImage.color = new Color(1, 0, 0, damageFlashAlpha);
                }
            }

            // Menu keyboard controls for PC players
            if (GameManager.Instance != null)
            {
                if (GameManager.Instance.CurrentState == GameState.RoleSelect)
                {
                    if (GameInput.GetMenuRunnerSelectDown())
                    {
                        GameManager.Instance.StartGameWithRole(PlayerRole.Runner);
                        return;
                    }
                    else if (GameInput.GetMenuSaboteurSelectDown())
                    {
                        GameManager.Instance.StartGameWithRole(PlayerRole.Saboteur);
                        return;
                    }
                }
                else if (GameManager.Instance.CurrentState == GameState.GameOver)
                {
                    if (GameInput.GetMenuRunnerSelectDown())
                    {
                        GameManager.Instance.RestartMatch();
                        return;
                    }
                    else if (GameInput.GetMenuSaboteurSelectDown() || GameInput.GetToggleCursorDown())
                    {
                        GameManager.Instance.OpenRoleSelect();
                        return;
                    }
                }
            }

            if (GameManager.Instance == null || GameManager.Instance.CurrentState != GameState.Playing)
                return;

            UpdateTopHUD();

            if (GameManager.Instance.CurrentRole == PlayerRole.Runner)
            {
                UpdateRunnerHUD();
            }
            else
            {
                UpdateSaboteurHUD();
            }
        }

        public void TriggerDamageFlash()
        {
            damageFlashAlpha = 0.45f;
            if (damageFlashImage != null)
            {
                damageFlashImage.color = new Color(1, 0, 0, damageFlashAlpha);
            }
        }

        private float topHudThrottleTimer = 0f;

        private void UpdateTopHUD()
        {
            if (timerText != null)
            {
                int seconds = Mathf.CeilToInt(GameManager.Instance.TimeRemaining);
                timerText.text = $"⏱️ {seconds}s";
            }

            if (timeOfDayText != null)
            {
                timeOfDayText.text = "☀️ DAY";
            }

            // Throttle distance & compass string updates to save garbage collection overhead
            topHudThrottleTimer += Time.deltaTime;
            if (topHudThrottleTimer < 0.15f) return;
            topHudThrottleTimer = 0f;

            // Distance to Beacon Goal
            Transform activeChar = (GameManager.Instance.CurrentRole == PlayerRole.Runner && RunnerController.Instance != null)
                ? RunnerController.Instance.transform
                : ((SaboteurController.Instance != null) ? SaboteurController.Instance.transform : null);

            if (activeChar != null && GoalBeacon.Instance != null)
            {
                float dist = Vector3.Distance(activeChar.position, GoalBeacon.Instance.transform.position);
                if (goalDistanceText != null)
                {
                    goalDistanceText.text = $"🎯 BEACON: {Mathf.RoundToInt(dist)}m";
                }

                if (compassText != null)
                {
                    Vector3 forward = activeChar.forward;
                    Vector3 toGoal = (GoalBeacon.Instance.transform.position - activeChar.position).normalized;
                    float angle = Vector3.SignedAngle(forward, toGoal, Vector3.up);
                    compassText.text = $"🧭 {Mathf.RoundToInt(angle)}°";
                }
            }
        }

        private void UpdateRunnerHUD()
        {
            if (RunnerController.Instance == null) return;

            if (healthBar != null)
            {
                healthBar.fillAmount = RunnerController.Instance.health / RunnerController.Instance.maxHealth;
            }
            if (healthText != null)
            {
                string shieldBadge = RunnerController.Instance.hasShield ? " 🛡️" : "";
                healthText.text = $"HP {Mathf.CeilToInt(RunnerController.Instance.health)}{shieldBadge}";
            }

            if (staminaBar != null)
            {
                staminaBar.fillAmount = RunnerController.Instance.stamina / RunnerController.Instance.maxStamina;
            }
            if (staminaText != null)
            {
                staminaText.text = $"STM {Mathf.CeilToInt(RunnerController.Instance.stamina)}";
            }
        }

        private void UpdateSaboteurHUD()
        {
            if (SaboteurController.Instance == null) return;

            if (energyBar != null)
            {
                energyBar.fillAmount = SaboteurController.Instance.energy / SaboteurController.Instance.maxEnergy;
            }
            if (energyText != null)
            {
                energyText.text = $"⚡ {Mathf.CeilToInt(SaboteurController.Instance.energy)}";
            }

            if (placementDistText != null)
            {
                if (SaboteurController.Instance.currentViewMode == SaboteurViewMode.OverheadTactical)
                {
                    placementDistText.text = $"🔭 TACTICAL | Alt: {Mathf.RoundToInt(SaboteurController.Instance.tacticalAltitude)}m";
                }
                else
                {
                    placementDistText.text = $"🏃 CHASE | Dist: {Mathf.RoundToInt(SaboteurController.Instance.placementDistance)}m / 75m";
                }
            }

            if (reconCooldownText != null)
            {
                float blinkCd = SaboteurController.Instance.BlinkCooldownTimer;
                if (blinkCd > 0f)
                {
                    reconCooldownText.text = $"⚡ BLINK: {blinkCd:F1}s";
                }
                else
                {
                    reconCooldownText.text = "⚡ BLINK READY";
                }
            }

            if (invalidWarningText != null)
            {
                invalidWarningText.text = SaboteurController.Instance.invalidReason;
                invalidWarningText.gameObject.SetActive(!SaboteurController.Instance.isPlacementValid);
            }
        }

        public void ShowRoleSelect()
        {
            if (roleSelectPanel != null) roleSelectPanel.SetActive(true);
            if (topHudPanel != null) topHudPanel.SetActive(false);
            if (runnerHudPanel != null) runnerHudPanel.SetActive(false);
            if (saboteurHudPanel != null) saboteurHudPanel.SetActive(false);
            if (gameOverPanel != null) gameOverPanel.SetActive(false);

            if (CursorManager.Instance != null) CursorManager.Instance.UnlockCursor();
        }

        public void ShowGameHUD(PlayerRole role)
        {
            if (roleSelectPanel != null) roleSelectPanel.SetActive(false);
            if (topHudPanel != null) topHudPanel.SetActive(true);
            if (gameOverPanel != null) gameOverPanel.SetActive(false);

            if (runnerHudPanel != null) runnerHudPanel.SetActive(role == PlayerRole.Runner);
            if (saboteurHudPanel != null) saboteurHudPanel.SetActive(role == PlayerRole.Saboteur);

            if (CursorManager.Instance != null) CursorManager.Instance.LockCursor();
        }

        public void ShowGameOver(bool runnerWon, string reason, float duration, int obstaclesPlaced)
        {
            if (gameOverPanel != null) gameOverPanel.SetActive(true);

            if (gameOverTitleText != null)
            {
                gameOverTitleText.text = runnerWon ? "🏆 RUNNER VICTORY!" : "💀 SABOTEUR VICTORY!";
                gameOverTitleText.color = runnerWon ? new Color(0f, 0.9f, 1f) : new Color(1f, 0.3f, 0.1f);
            }

            if (gameOverMessageText != null)
            {
                gameOverMessageText.text = reason;
            }

            if (matchStatsText != null)
            {
                matchStatsText.text = $"Time: {Mathf.RoundToInt(duration)}s | Obstacles: {obstaclesPlaced}";
            }

            if (CursorManager.Instance != null) CursorManager.Instance.UnlockCursor();
        }
    }
}
