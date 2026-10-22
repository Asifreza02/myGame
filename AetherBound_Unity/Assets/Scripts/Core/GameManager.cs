using System;
using UnityEngine;

namespace AetherBound
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Match Settings")]
        public float roundDuration = GameConfig.RoundDuration;
        public float TimeRemaining { get; private set; }
        public GameState CurrentState { get; private set; } = GameState.RoleSelect;
        public PlayerRole CurrentRole { get; private set; } = PlayerRole.Runner;

        [Header("Scene References")]
        public RunnerController runner;
        public SaboteurController saboteur;
        public AISaboteur aiSaboteur;
        public GoalBeacon goalBeacon;
        public Light sunLight;
        public Camera mainCamera;

        [Header("Atmosphere (Locked Daytime)")]
        public Vector3 daySunEuler = new Vector3(50f, 45f, 0f);
        public Color daySunColor = new Color(1f, 0.98f, 0.94f);
        public float daySunIntensity = 1.35f;

        // Match statistics
        private float matchStartTime = 0f;
        private int obstaclesPlacedCount = 0;
        private Vector3 lastStreamPos = new Vector3(-9999f, -9999f, -9999f);

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            // Target 60 FPS on mobile devices
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
        }

        private void Start()
        {
            if (UIManager.Instance != null)
            {
                UIManager.Instance.ShowRoleSelect();
            }

            // Auto-setup scene if references missing
            EnsureSceneReferences();
        }

        private void EnsureSceneReferences()
        {
            if (goalBeacon == null) goalBeacon = FindAnyObjectByType<GoalBeacon>();
            if (runner == null) runner = FindAnyObjectByType<RunnerController>();
            if (saboteur == null) saboteur = FindAnyObjectByType<SaboteurController>();
            if (aiSaboteur == null) aiSaboteur = FindAnyObjectByType<AISaboteur>();
            if (mainCamera == null) mainCamera = Camera.main;
            if (sunLight == null)
            {
                var lights = FindObjectsByType<Light>(FindObjectsInactive.Exclude);
                foreach (var l in lights)
                {
                    if (l.type == LightType.Directional)
                    {
                        sunLight = l;
                        break;
                    }
                }
            }

            if (sunLight != null)
            {
                sunLight.transform.rotation = Quaternion.Euler(daySunEuler);
                sunLight.color = daySunColor;
                sunLight.intensity = daySunIntensity;
                sunLight.shadows = LightShadows.Soft;
            }

            var envMgr = FindAnyObjectByType<EnvironmentManager>();
            if (envMgr == null)
            {
                var envGo = new GameObject("EnvironmentManager");
                envMgr = envGo.AddComponent<EnvironmentManager>();
            }
            if (envMgr.sunLight == null)
            {
                envMgr.sunLight = sunLight;
            }

            if (runner != null) runner.BuildVisualAvatar();
            if (saboteur != null) saboteur.BuildVisualAvatar();

            if (FindAnyObjectByType<SpawnSanctuary>() == null)
            {
                var sanctuaryGo = new GameObject("SpawnSanctuary");
                sanctuaryGo.transform.position = Vector3.zero;
                sanctuaryGo.AddComponent<SpawnSanctuary>();
            }

            if (FindAnyObjectByType<ObstacleManager>() == null)
            {
                var oMgrGo = new GameObject("ObstacleManager");
                oMgrGo.AddComponent<ObstacleManager>();
            }

            if (FindAnyObjectByType<PowerUpManager>() == null)
            {
                var pMgrGo = new GameObject("PowerUpManager");
                pMgrGo.AddComponent<PowerUpManager>();
            }
        }

        public void StartGameWithRole(PlayerRole role)
        {
            CurrentRole = role;
            CurrentState = GameState.Playing;
            TimeRemaining = roundDuration;
            matchStartTime = Time.time;
            obstaclesPlacedCount = 0;

            // Initialize World & Beacon
            if (WorldManager.Instance != null)
            {
                WorldManager.Instance.SetSeed(UnityEngine.Random.Range(1000, 99999));
            }

            if (goalBeacon != null)
            {
                goalBeacon.SetPosition(GameConfig.GoalDefaultX, GameConfig.GoalDefaultZ);
            }

            if (ObstacleManager.Instance != null)
            {
                ObstacleManager.Instance.ClearAll();
            }

            if (PowerUpManager.Instance != null)
            {
                PowerUpManager.Instance.PopulateArenaPowerUps();
            }

            // Setup Characters
            if (role == PlayerRole.Runner)
            {
                if (runner != null)
                {
                    float startY = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(0, 0) + 1.2f : 1.2f;
                    runner.transform.position = new Vector3(0, startY, 0);
                    runner.health = GameConfig.RunnerMaxHealth;
                    runner.stamina = GameConfig.RunnerMaxStamina;
                    runner.playerCamera = mainCamera;
                    runner.gameObject.SetActive(true);
                    runner.enabled = true;
                }

                if (saboteur != null)
                {
                    saboteur.gameObject.SetActive(false);
                }

                if (aiSaboteur != null)
                {
                    aiSaboteur.isEnabled = true;
                }
            }
            else // PlayerRole.Saboteur
            {
                if (saboteur != null)
                {
                    float sY = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(10, 10) + 1.2f : 1.2f;
                    saboteur.transform.position = new Vector3(10, sY, 10);
                    saboteur.energy = GameConfig.SaboteurMaxEnergy;
                    saboteur.playerCamera = mainCamera;
                    saboteur.gameObject.SetActive(true);
                    saboteur.enabled = true;
                }

                if (runner != null)
                {
                    float startY = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(0, 0) + 1.2f : 1.2f;
                    runner.transform.position = new Vector3(0, startY, 0);
                    runner.health = GameConfig.RunnerMaxHealth;
                    runner.stamina = GameConfig.RunnerMaxStamina;
                    runner.playerCamera = null; // Do not control mainCamera when runner is AI
                    runner.gameObject.SetActive(true);
                    runner.enabled = true;
                }

                if (aiSaboteur != null)
                {
                    aiSaboteur.isEnabled = false;
                }
            }

            if (UIManager.Instance != null)
            {
                UIManager.Instance.ShowGameHUD(role);
            }
        }

        private void Update()
        {
            if (CurrentState != GameState.Playing) return;

            // Countdown timer
            TimeRemaining -= Time.deltaTime;
            if (TimeRemaining <= 0)
            {
                TimeRemaining = 0;
                EndMatch(false, "Time Expired! The Saboteur prevented the Runner!");
                return;
            }

            // Stream chunks around player (throttled by distance)
            UpdateChunkStreaming();
        }

        private void UpdateChunkStreaming()
        {
            // Bounded small world: all chunks are statically generated and preserved.
            // Zero runtime chunk streaming or GC allocation needed.
        }

        public string GetTimeOfDayName()
        {
            return "☀️ DAY";
        }

        public void RecordObstaclePlaced()
        {
            obstaclesPlacedCount++;
        }

        public void EndMatch(bool runnerWon, string reason)
        {
            if (CurrentState == GameState.GameOver) return;
            CurrentState = GameState.GameOver;

            float matchDuration = Time.time - matchStartTime;

            if (runnerWon)
            {
                if (AudioManager.Instance != null) AudioManager.Instance.PlayVictorySound();
            }
            else
            {
                if (AudioManager.Instance != null) AudioManager.Instance.PlayDefeatSound();
            }

            if (UIManager.Instance != null)
            {
                UIManager.Instance.ShowGameOver(runnerWon, reason, matchDuration, obstaclesPlacedCount);
            }
        }

        public void RestartMatch()
        {
            StartGameWithRole(CurrentRole);
        }

        public void OpenRoleSelect()
        {
            CurrentState = GameState.RoleSelect;
            if (UIManager.Instance != null)
            {
                UIManager.Instance.ShowRoleSelect();
            }
        }
    }
}
