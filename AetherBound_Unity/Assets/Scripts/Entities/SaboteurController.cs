using System;
using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;

namespace AetherBound
{
    public enum SaboteurViewMode
    {
        FreeRoamChase,
        OverheadTactical
    }

    [RequireComponent(typeof(CharacterController))]
    public class SaboteurController : MonoBehaviour
    {
        public static SaboteurController Instance { get; private set; }

        [Header("Movement & Camera")]
        public float moveSpeed = 12.0f;
        public float mouseSensitivity = 0.15f;
        public float cameraDistance = 5.5f;
        public float cameraHeight = 2.2f;
        public float cameraPitch = 15.0f;
        public float cameraYaw = 180f;
        public Camera playerCamera;

        [Header("Tactical Overhead Camera")]
        public SaboteurViewMode currentViewMode = SaboteurViewMode.FreeRoamChase;
        public float tacticalPitch = 55.0f;
        public float tacticalAltitude = 25.0f;
        private Vector3 tacticalCenter;

        [Header("Shadow Blink Ability")]
        public float blinkCooldown = 3.0f;
        public float blinkDistance = 15.0f;
        public float blinkEnergyCost = 20.0f;
        private float blinkCooldownTimer = 0f;

        [Header("Tactical Energy")]
        public float maxEnergy = GameConfig.SaboteurMaxEnergy;
        public float energy = GameConfig.SaboteurMaxEnergy;
        public float energyRegen = GameConfig.SaboteurEnergyRegen;

        [Header("Placement Settings")]
        public ObstacleType selectedType = ObstacleType.Wall;
        public float placementDistance = 16.0f;
        public float placementRotation = 0f;
        public bool isPlacing = true;

        [Header("Recon Ability")]
        public float reconCooldown = GameConfig.SaboteurReconCooldown;
        public float reconDuration = GameConfig.SaboteurReconDuration;
        private float reconCooldownTimer = 0f;
        private float reconActiveTimer = 0f;

        private CharacterController controller;
        private Transform avatarVisuals;
        public Vector2 inputDirection = Vector2.zero;

        // Current target placement data
        public Vector3 currentPlacementPos;
        public bool isPlacementValid;
        public string invalidReason = "";

        public float BlinkCooldownTimer => blinkCooldownTimer;

        public event Action<float, float> OnEnergyChanged;
        public event Action<float> OnReconCooldownChanged;
        public event Action<float> OnBlinkCooldownChanged;
        public event Action<SaboteurViewMode> OnViewModeChanged;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            int saboteurLayer = LayerMask.NameToLayer("Saboteur");
            if (saboteurLayer != -1) gameObject.layer = saboteurLayer;
            gameObject.tag = "Saboteur";

            controller = GetComponent<CharacterController>();
            controller.height = 1.8f;
            controller.radius = 0.45f;
            controller.center = new Vector3(0, 0.9f, 0);
            controller.stepOffset = 0.4f;
            controller.slopeLimit = 45f;

            BuildVisualAvatar();
        }

        private void Start()
        {
            tacticalCenter = transform.position;
        }

        public void BuildVisualAvatar()
        {
            var existing = transform.Find("AvatarVisuals");
            if (existing != null && existing.Find("RogueMesh") != null)
            {
                avatarVisuals = existing;
                return;
            }
            var root = CharacterModelBuilder.BuildSaboteurVisuals(transform);
            avatarVisuals = root != null ? root.transform : null;
        }

        private void Update()
        {
            if (GameManager.Instance != null)
            {
                if (GameManager.Instance.CurrentState != GameState.Playing)
                    return;
                if (GameManager.Instance.CurrentRole != PlayerRole.Saboteur)
                    return;
            }

            HandleEnergy();
            HandleRecon();
            HandleBlinkCooldown();

            // Hotkeys for Saboteur tactical abilities
            int hotbar = GameInput.GetHotbarSelect();
            if (hotbar >= 0 && hotbar <= 4)
            {
                SelectObstacle((ObstacleType)hotbar);
            }

            if (GameInput.GetReconDown())
            {
                TriggerReconPulse();
            }

            if (GameInput.GetRotateDown())
            {
                RotatePlacement(45f);
            }

            if (GameInput.GetToggleCameraModeDown())
            {
                ToggleViewMode();
            }

            if (GameInput.GetSnapRunnerDown())
            {
                SnapCameraToRunner();
            }

            if (GameInput.GetBlinkDown())
            {
                TriggerShadowBlink();
            }

            HandleMovement();
            HandlePlacementRay();
            HandleCamera();
        }

        private void HandleEnergy()
        {
            energy = Mathf.Min(maxEnergy, energy + energyRegen * Time.deltaTime);
            OnEnergyChanged?.Invoke(energy, maxEnergy);
        }

        private void HandleRecon()
        {
            if (reconCooldownTimer > 0)
            {
                reconCooldownTimer -= Time.deltaTime;
                OnReconCooldownChanged?.Invoke(reconCooldownTimer);
            }
            if (reconActiveTimer > 0)
            {
                reconActiveTimer -= Time.deltaTime;
            }
        }

        private void HandleBlinkCooldown()
        {
            if (blinkCooldownTimer > 0)
            {
                blinkCooldownTimer -= Time.deltaTime;
                OnBlinkCooldownChanged?.Invoke(blinkCooldownTimer);
            }
        }

        public void ToggleViewMode()
        {
            if (currentViewMode == SaboteurViewMode.FreeRoamChase)
            {
                currentViewMode = SaboteurViewMode.OverheadTactical;
                tacticalCenter = transform.position;
                if (CursorManager.Instance != null)
                {
                    CursorManager.Instance.UnlockCursor();
                }
            }
            else
            {
                currentViewMode = SaboteurViewMode.FreeRoamChase;
                if (CursorManager.Instance != null)
                {
                    CursorManager.Instance.LockCursor();
                }
            }

            OnViewModeChanged?.Invoke(currentViewMode);
        }

        public void SnapCameraToRunner()
        {
            if (RunnerController.Instance != null)
            {
                Vector3 runnerPos = RunnerController.Instance.transform.position;
                tacticalCenter = runnerPos;

                if (currentViewMode == SaboteurViewMode.FreeRoamChase)
                {
                    Vector3 dir = (runnerPos - transform.position);
                    dir.y = 0;
                    if (dir.sqrMagnitude > 0.01f)
                    {
                        cameraYaw = Quaternion.LookRotation(dir).eulerAngles.y;
                        transform.rotation = Quaternion.Euler(0, cameraYaw, 0);
                    }
                }
            }
        }

        public void TriggerShadowBlink()
        {
            if (blinkCooldownTimer > 0f || energy < blinkEnergyCost) return;

            energy -= blinkEnergyCost;
            blinkCooldownTimer = blinkCooldown;
            OnBlinkCooldownChanged?.Invoke(blinkCooldownTimer);

            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlayBlinkSound();
            }

            Vector3 blinkDir;
            if (currentViewMode == SaboteurViewMode.OverheadTactical)
            {
                blinkDir = (currentPlacementPos - transform.position);
                blinkDir.y = 0;
                if (blinkDir.sqrMagnitude < 0.01f)
                {
                    blinkDir = transform.forward;
                }
                else
                {
                    blinkDir.Normalize();
                }
            }
            else
            {
                float h = inputDirection.x != 0 ? inputDirection.x : GameInput.GetHorizontal();
                float v = inputDirection.y != 0 ? inputDirection.y : GameInput.GetVertical();
                Vector3 moveDir = (transform.forward * v + transform.right * h).normalized;

                blinkDir = (moveDir.sqrMagnitude > 0.01f) ? moveDir : transform.forward;
            }

            // Raycast/SphereCast obstacle check to prevent clipping inside walls
            float actualDist = blinkDistance;
            int obstacleMask = LayerMask.GetMask("Ground", "Obstacle", "Default");
            if (Physics.SphereCast(transform.position + Vector3.up * 0.9f, 0.4f, blinkDir, out RaycastHit hit, blinkDistance, obstacleMask, QueryTriggerInteraction.Ignore))
            {
                actualDist = Mathf.Max(1.0f, hit.distance - 0.5f);
            }

            Vector3 startPos = transform.position;
            Vector3 targetPos = transform.position + blinkDir * actualDist;

            float groundY = (WorldManager.Instance != null)
                ? WorldManager.Instance.GetHeightAt(targetPos.x, targetPos.z) + 0.9f
                : 0.9f;
            targetPos.y = groundY;

            // Spawn shadow flash visual FX at origin and destination
            SpawnBlinkFX(startPos);
            SpawnBlinkFX(targetPos);

            // Teleport character controller
            controller.enabled = false;
            transform.position = targetPos;
            controller.enabled = true;

            if (currentViewMode == SaboteurViewMode.OverheadTactical)
            {
                tacticalCenter = targetPos;
            }
        }

        private void SpawnBlinkFX(Vector3 pos)
        {
            var fx = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            fx.name = "BlinkBurstFX";
            fx.transform.position = pos + Vector3.up * 0.5f;
            fx.transform.localScale = new Vector3(0.7f, 1.8f, 0.7f);
            var col = fx.GetComponent<Collider>();
            if (col != null) Destroy(col);

            var r = fx.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            mat.color = new Color(0.72f, 0.15f, 1.0f, 0.75f);
            r.material = mat;

            StartCoroutine(AnimateBlinkBurst(fx.transform, mat));
        }

        private IEnumerator AnimateBlinkBurst(Transform t, Material mat)
        {
            float elapsed = 0f;
            float duration = 0.35f;
            Vector3 initScale = (t != null) ? t.localScale : Vector3.one;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float p = elapsed / duration;
                if (t != null)
                {
                    t.localScale = initScale * (1f + p * 1.5f);
                    if (mat != null)
                    {
                        Color c = mat.color;
                        c.a = Mathf.Lerp(0.75f, 0f, p);
                        mat.color = c;
                    }
                }
                yield return null;
            }

            if (t != null) Destroy(t.gameObject);
        }

        public void TriggerReconPulse()
        {
            if (reconCooldownTimer > 0) return;

            reconCooldownTimer = reconCooldown;
            reconActiveTimer = reconDuration;

            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlayReconSound();
            }

            // Create visual radar wave ring
            var wave = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            wave.transform.position = transform.position + Vector3.up * 0.2f;
            wave.transform.localScale = new Vector3(1f, 0.05f, 1f);
            var c = wave.GetComponent<Collider>();
            if (c != null) Destroy(c);

            var r = wave.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            mat.color = new Color(1f, 0.45f, 0f, 0.5f);
            r.material = mat;

            StartCoroutine(ExpandWave(wave.transform));
        }

        private IEnumerator ExpandWave(Transform waveTransform)
        {
            float elapsed = 0f;
            float duration = 1.2f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float scale = (elapsed / duration) * 80f;
                if (waveTransform != null)
                {
                    waveTransform.localScale = new Vector3(scale, 0.05f, scale);
                }
                yield return null;
            }
            if (waveTransform != null) Destroy(waveTransform.gameObject);
        }

        private void HandleMovement()
        {
            float h = inputDirection.x != 0 ? inputDirection.x : GameInput.GetHorizontal();
            float v = inputDirection.y != 0 ? inputDirection.y : GameInput.GetVertical();

            if (currentViewMode == SaboteurViewMode.OverheadTactical)
            {
                // In overhead tactical mode, movement inputs pan the tactical focus camera center
                Vector3 camFwd = (playerCamera != null) ? Vector3.ProjectOnPlane(playerCamera.transform.forward, Vector3.up).normalized : Vector3.forward;
                Vector3 camRt = (playerCamera != null) ? Vector3.ProjectOnPlane(playerCamera.transform.right, Vector3.up).normalized : Vector3.right;
                Vector3 panDir = (camFwd * v + camRt * h).normalized;

                tacticalCenter += panDir * (moveSpeed * 1.5f) * Time.deltaTime;

                // Clamp within bounds around play area
                tacticalCenter.x = Mathf.Clamp(tacticalCenter.x, GameConfig.ArenaMinX, GameConfig.ArenaMaxX);
                tacticalCenter.z = Mathf.Clamp(tacticalCenter.z, GameConfig.ArenaMinZ, GameConfig.ArenaMaxZ);
            }
            else
            {
                // In free-roam mode, movement moves avatar relative to camera facing
                Vector3 moveDir = (transform.forward * v + transform.right * h).normalized;
                controller.Move(moveDir * moveSpeed * Time.deltaTime);

                // Decoupled character visual rotation towards move direction
                if (avatarVisuals != null && moveDir.sqrMagnitude > 0.001f)
                {
                    Quaternion targetVisualRot = Quaternion.LookRotation(moveDir, Vector3.up);
                    avatarVisuals.rotation = Quaternion.Slerp(avatarVisuals.rotation, targetVisualRot, Time.deltaTime * 14f);
                }

                // Stick to ground
                float targetY = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(transform.position.x, transform.position.z) + 0.9f : 0.9f;
                transform.position = new Vector3(transform.position.x, targetY, transform.position.z);
            }
        }

        private void HandlePlacementRay()
        {
            if (!isPlacing)
            {
                if (ObstacleManager.Instance != null)
                {
                    ObstacleManager.Instance.SetPreviewState(false, selectedType, Vector3.zero, Quaternion.identity, false);
                }
                return;
            }

            if (currentViewMode == SaboteurViewMode.OverheadTactical)
            {
                // Point-and-click raycast from mouse position onto terrain
                Ray ray = (playerCamera != null)
                    ? playerCamera.ScreenPointToRay(Input.mousePosition)
                    : new Ray(tacticalCenter + Vector3.up * 50f, Vector3.down);

                int groundMask = LayerMask.GetMask("Ground", "Default");
                if (Physics.Raycast(ray, out RaycastHit hit, 500f, groundMask))
                {
                    currentPlacementPos = hit.point;
                }
                else
                {
                    Plane groundPlane = new Plane(Vector3.up, new Vector3(0, 0.8f, 0));
                    if (groundPlane.Raycast(ray, out float enter))
                    {
                        Vector3 pt = ray.GetPoint(enter);
                        float gy = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(pt.x, pt.z) : 0.8f;
                        currentPlacementPos = new Vector3(pt.x, gy, pt.z);
                    }
                }

                // Mouse wheel in tactical zooms camera altitude
                float scroll = GameInput.GetMouseScroll();
                if (Mathf.Abs(scroll) > 0.01f)
                {
                    tacticalAltitude = Mathf.Clamp(tacticalAltitude - scroll * 12f, 12f, 45f);
                }

                // Deploy on left-click if not clicking over UI button
                if (GameInput.GetLeftClickDown())
                {
                    if (EventSystem.current == null || !EventSystem.current.IsPointerOverGameObject())
                    {
                        DeployCurrentObstacle();
                    }
                }
            }
            else
            {
                // Free roam forward placement
                Vector3 aimPos = transform.position + transform.forward * placementDistance;
                float groundY = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(aimPos.x, aimPos.z) : 0f;
                currentPlacementPos = new Vector3(aimPos.x, groundY, aimPos.z);

                // Mouse wheel adjustments for placement distance
                float scroll = GameInput.GetMouseScroll();
                if (Mathf.Abs(scroll) > 0.01f)
                {
                    AdjustPlacementDistance(scroll * 4f);
                }

                if (CursorManager.IsCursorLocked && GameInput.GetLeftClickDown())
                {
                    DeployCurrentObstacle();
                }
            }

            var def = GameConfig.GetObstacleDef(selectedType);
            int cost = (def != null) ? def.cost : 25;

            // Validation rules
            bool hasEnergy = energy >= cost;
            float maxDistAllowed = (currentViewMode == SaboteurViewMode.OverheadTactical) ? GameConfig.SaboteurMaxPlacementDist * 1.5f : GameConfig.SaboteurMaxPlacementDist;
            float currentDist = Vector3.Distance(transform.position, currentPlacementPos);
            bool inRange = currentDist <= maxDistAllowed;

            bool insideGoalSanctuary = (GoalBeacon.Instance != null) && GoalBeacon.Instance.IsInsideSanctuary(currentPlacementPos);
            bool insideSpawnSanctuary = (SpawnSanctuary.Instance != null) && SpawnSanctuary.Instance.IsInsideSanctuary(currentPlacementPos);
            bool insideSanctuary = insideGoalSanctuary || insideSpawnSanctuary;

            isPlacementValid = hasEnergy && inRange && !insideSanctuary;

            if (!hasEnergy) invalidReason = "Not Enough Energy!";
            else if (!inRange) invalidReason = $"Out of Range (Max {Mathf.RoundToInt(maxDistAllowed)}m)!";
            else if (insideSanctuary) invalidReason = "Sanctuary Protected Zone!";
            else invalidReason = "";

            Quaternion rot = Quaternion.Euler(0, transform.eulerAngles.y + placementRotation, 0);

            if (ObstacleManager.Instance != null)
            {
                ObstacleManager.Instance.SetPreviewState(true, selectedType, currentPlacementPos, rot, isPlacementValid);
            }
        }

        public void AdjustPlacementDistance(float delta)
        {
            placementDistance = Mathf.Clamp(placementDistance + delta, GameConfig.SaboteurMinPlacementDist, GameConfig.SaboteurMaxPlacementDist);
        }

        public void RotatePlacement(float deltaAngle = 45f)
        {
            placementRotation = (placementRotation + deltaAngle) % 360f;
        }

        public void SelectObstacle(ObstacleType type)
        {
            selectedType = type;
        }

        public bool DeployCurrentObstacle()
        {
            if (!isPlacementValid) return false;

            var def = GameConfig.GetObstacleDef(selectedType);
            if (def == null || energy < def.cost) return false;

            energy -= def.cost;
            Quaternion rot = Quaternion.Euler(0, transform.eulerAngles.y + placementRotation, 0);

            if (ObstacleManager.Instance != null)
            {
                ObstacleManager.Instance.SpawnObstacle(selectedType, currentPlacementPos, rot);
            }

            if (GameManager.Instance != null)
            {
                GameManager.Instance.RecordObstaclePlaced();
            }

            return true;
        }

        public void AddLookInput(float deltaX, float deltaY = 0f)
        {
            cameraYaw += deltaX * mouseSensitivity;
            cameraPitch = Mathf.Clamp(cameraPitch - deltaY * mouseSensitivity, -25f, 65f);
            transform.rotation = Quaternion.Euler(0, cameraYaw, 0);
        }

        private void HandleCamera()
        {
            if (currentViewMode == SaboteurViewMode.OverheadTactical)
            {
                // In overhead mode, right click or middle drag rotates yaw
                if (GameInput.GetRightClickHeld() || Input.GetMouseButton(2))
                {
                    float dx = GameInput.GetMouseDeltaX();
                    cameraYaw += dx * mouseSensitivity;
                }

                if (playerCamera != null)
                {
                    Quaternion camRot = Quaternion.Euler(tacticalPitch, cameraYaw, 0);
                    Vector3 offset = camRot * new Vector3(0, 0, -tacticalAltitude);
                    Vector3 targetCamPos = tacticalCenter + offset;

                    playerCamera.transform.position = Vector3.Lerp(playerCamera.transform.position, targetCamPos, Time.deltaTime * 16f);
                    playerCamera.transform.rotation = Quaternion.Slerp(playerCamera.transform.rotation, camRot, Time.deltaTime * 16f);
                }
            }
            else
            {
                // In free roam mode, mouse look controls camera yaw & pitch
                if (CursorManager.IsCursorLocked)
                {
                    float dx = GameInput.GetMouseDeltaX();
                    float dy = GameInput.GetMouseDeltaY();
                    if (Mathf.Abs(dx) > 0.001f || Mathf.Abs(dy) > 0.001f)
                    {
                        AddLookInput(dx, dy);
                    }
                }
                else if (GameInput.GetLeftClickHeld() || GameInput.GetRightClickHeld())
                {
                    float dx = GameInput.GetMouseDeltaX();
                    float dy = GameInput.GetMouseDeltaY();
                    AddLookInput(dx, dy);
                }

                if (playerCamera != null)
                {
                    Quaternion camRot = Quaternion.Euler(cameraPitch, cameraYaw, 0);
                    Vector3 basePos = transform.position + Vector3.up * cameraHeight;
                    Vector3 camDir = camRot * new Vector3(0, 0, -1);
                    float desiredDist = cameraDistance;

                    // Sphere-cast camera collision avoidance
                    int obstacleMask = LayerMask.GetMask("Ground", "Obstacle", "Default");
                    if (Physics.SphereCast(basePos, 0.22f, camDir, out RaycastHit hit, cameraDistance, obstacleMask, QueryTriggerInteraction.Ignore))
                    {
                        desiredDist = Mathf.Clamp(hit.distance - 0.15f, 1.2f, cameraDistance);
                    }

                    Vector3 targetCamPos = basePos + camDir * desiredDist;
                    playerCamera.transform.position = Vector3.Lerp(playerCamera.transform.position, targetCamPos, Time.deltaTime * 24f);
                    playerCamera.transform.rotation = camRot;
                }
            }
        }
    }
}
