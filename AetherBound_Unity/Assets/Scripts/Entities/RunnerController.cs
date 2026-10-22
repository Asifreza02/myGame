using System;
using System.Collections;
using UnityEngine;

namespace AetherBound
{
    [RequireComponent(typeof(CharacterController))]
    public class RunnerController : MonoBehaviour, IDamageable
    {
        public static RunnerController Instance { get; private set; }

        [Header("Movement Settings")]
        public float baseSpeed = GameConfig.RunnerBaseSpeed;
        public float sprintSpeed = GameConfig.RunnerSprintSpeed;
        public float jumpForce = GameConfig.RunnerJumpForce;
        public float gravity = GameConfig.RunnerGravity;

        [Header("Stamina Settings")]
        public float maxStamina = GameConfig.RunnerMaxStamina;
        public float stamina = GameConfig.RunnerMaxStamina;
        public float staminaDrain = GameConfig.RunnerStaminaDrain;
        public float staminaRecovery = GameConfig.RunnerStaminaRecovery;

        [Header("Health & Defense")]
        public float maxHealth = GameConfig.RunnerMaxHealth;
        public float health = GameConfig.RunnerMaxHealth;
        public bool hasShield = false;
        private float invulnerableTimer = 0f;

        [Header("Abilities (Dash & Deflection)")]
        public float dashSpeed = 20.0f;
        public float dashDuration = 0.35f;
        public float dashCooldown = 3.5f;
        public float dashStaminaCost = 15.0f;
        private float dashCooldownTimer = 0f;
        public bool isDashing = false;

        public float pulseRadius = 6.5f;
        public float pulseForce = 28f;
        public float pulseCooldown = 5.0f;
        private float pulseCooldownTimer = 0f;

        [Header("Camera Control")]
        public Transform cameraPivot;
        public Camera playerCamera;
        public float mouseSensitivity = 0.15f;
        public float cameraDistance = 5.5f;
        public float cameraHeight = 2.2f;
        public float cameraPitch = 15.0f;
        public float cameraYaw = 0f;

        [Header("Traversal Actions")]
        public bool isSliding = false;
        public float slideTimer = 0f;
        public float slideDuration = GameConfig.RunnerSlideDuration;
        public bool isVaulting = false;

        private CharacterController controller;
        private Transform avatarVisuals;
        private GameObject shieldAuraObj;
        private Vector3 velocity;
        private Vector3 currentHorizontalVelocity = Vector3.zero;
        private bool isGrounded;
        private float slowTimer = 0f;
        private float currentSlowFactor = 1.0f;

        // Platforming safeguards (Coyote time & Jump buffer)
        public float coyoteTime = 0.15f;
        private float coyoteTimer = 0f;
        public float jumpBufferTime = 0.12f;
        private float jumpBufferTimer = 0f;
        private bool canDoubleJump = false;

        // Power-Up Buffs
        private float speedBuffTimer = 0f;
        private float speedMultiplier = 1f;
        private float jumpBuffTimer = 0f;
        private float bonusJumpForce = 0f;

        // Mobile / Input state
        public Vector2 inputDirection = Vector2.zero;
        public bool isSprinting = false;
        public bool isJumpingRequested = false;
        public bool isSlideRequested = false;

        public float DashCooldownTimer => dashCooldownTimer;
        public float PulseCooldownTimer => pulseCooldownTimer;
        public float DashCooldownMax => dashCooldown;
        public float PulseCooldownMax => pulseCooldown;

        // Events
        public event Action<float, float> OnHealthChanged;
        public event Action<float, float> OnStaminaChanged;
        public event Action<float, float> OnDashCooldownChanged;
        public event Action<float, float> OnPulseCooldownChanged;
        public event Action OnDamaged;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            int playerLayer = LayerMask.NameToLayer("Player");
            if (playerLayer != -1) gameObject.layer = playerLayer;
            gameObject.tag = "Player";

            controller = GetComponent<CharacterController>();
            controller.height = 1.8f;
            controller.radius = 0.45f;
            controller.center = new Vector3(0, 0.9f, 0);
            controller.stepOffset = 0.4f;
            controller.slopeLimit = 45f;
            controller.skinWidth = 0.08f;
            controller.minMoveDistance = 0.001f;

            if (playerCamera == null)
            {
                playerCamera = Camera.main;
                if (playerCamera == null) playerCamera = FindAnyObjectByType<Camera>();
            }

            BuildVisualAvatar();
        }

        private void Start()
        {
            if (playerCamera == null)
            {
                playerCamera = Camera.main;
                if (playerCamera == null) playerCamera = FindAnyObjectByType<Camera>();
            }

            if (playerCamera != null)
            {
                Quaternion camRot = Quaternion.Euler(cameraPitch, cameraYaw, 0);
                var anchor = cameraPivot != null ? cameraPivot : transform.Find("CameraFollowTarget");
                Vector3 basePos = anchor != null ? anchor.position : (transform.position + Vector3.up * cameraHeight);
                Vector3 camDir = camRot * new Vector3(0, 0, -1);
                playerCamera.transform.position = basePos + camDir * cameraDistance;
                playerCamera.transform.rotation = camRot;
            }
        }

        public void BuildVisualAvatar()
        {
            var existing = transform.Find("AvatarVisuals");
            if (existing != null && existing.Find("KnightMesh") != null)
            {
                avatarVisuals = existing;
                return;
            }
            var root = CharacterModelBuilder.BuildRunnerVisuals(transform);
            avatarVisuals = root != null ? root.transform : null;
        }

        private void Update()
        {
            if (GameManager.Instance != null)
            {
                if (GameManager.Instance.CurrentState != GameState.Playing)
                    return;

                if (GameManager.Instance.CurrentRole != PlayerRole.Runner)
                {
                    HandleAIRunner();
                    return;
                }
            }

            HandleBuffTimers();
            HandleAbilityCooldowns();
            HandleStamina();

            // Ability hotkeys
            if (GameInput.GetDashDown())
            {
                TriggerAetherDash();
            }

            if (GameInput.GetDeflectionPulseDown())
            {
                TriggerDeflectionPulse();
            }

            HandleMovement();
            HandleSlide();
            HandleCamera();
            CheckGoal();
        }

        private void HandleAbilityCooldowns()
        {
            if (dashCooldownTimer > 0f)
            {
                dashCooldownTimer -= Time.deltaTime;
                OnDashCooldownChanged?.Invoke(dashCooldownTimer, dashCooldown);
            }

            if (pulseCooldownTimer > 0f)
            {
                pulseCooldownTimer -= Time.deltaTime;
                OnPulseCooldownChanged?.Invoke(pulseCooldownTimer, pulseCooldown);
            }
        }

        public void TriggerAetherDash()
        {
            if (dashCooldownTimer > 0f || isDashing) return;
            if (stamina < dashStaminaCost) return;

            stamina -= dashStaminaCost;
            dashCooldownTimer = dashCooldown;
            OnDashCooldownChanged?.Invoke(dashCooldownTimer, dashCooldown);
            OnStaminaChanged?.Invoke(stamina, maxStamina);

            StartCoroutine(PerformAetherDash());
        }

        private IEnumerator PerformAetherDash()
        {
            isDashing = true;
            invulnerableTimer = Mathf.Max(invulnerableTimer, dashDuration + 0.12f); // i-frames!

            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlayDashSound();
            }

            SpawnAetherTrailFX();

            float elapsed = 0f;
            Vector3 dashDir = (inputDirection.sqrMagnitude > 0.01f)
                ? (transform.forward * inputDirection.y + transform.right * inputDirection.x).normalized
                : transform.forward;

            while (elapsed < dashDuration)
            {
                elapsed += Time.deltaTime;
                controller.Move(dashDir * dashSpeed * Time.deltaTime);
                yield return null;
            }

            isDashing = false;
        }

        private void SpawnAetherTrailFX()
        {
            var ghost = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            ghost.name = "AetherDashGhost";
            ghost.transform.position = transform.position + Vector3.up * 0.9f;
            ghost.transform.rotation = transform.rotation;
            ghost.transform.localScale = new Vector3(0.8f, 0.9f, 0.8f);

            var col = ghost.GetComponent<Collider>();
            if (col != null) Destroy(col);

            var r = ghost.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            mat.color = new Color(0.0f, 0.95f, 1.0f, 0.6f);
            r.material = mat;

            StartCoroutine(FadeAndDestroy(ghost, mat, 0.35f));
        }

        public void TriggerDeflectionPulse()
        {
            if (pulseCooldownTimer > 0f) return;

            pulseCooldownTimer = pulseCooldown;
            OnPulseCooldownChanged?.Invoke(pulseCooldownTimer, pulseCooldown);

            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlayDeflectionPulseSound();
            }

            SpawnPulseWaveFX();

            // Find all colliders in pulse radius
            Collider[] hits = Physics.OverlapSphere(transform.position, pulseRadius);
            foreach (var hit in hits)
            {
                if (hit.gameObject == gameObject) continue;

                // 1. Kinetic Boulders / Rigidbodies -> Push back with heavy force
                if (hit.TryGetComponent<Rigidbody>(out var rb))
                {
                    Vector3 awayDir = (rb.transform.position - transform.position).normalized + Vector3.up * 0.3f;
                    rb.linearVelocity = awayDir * pulseForce;
                }

                // 2. Explosive Barrels -> Detonate or push away
                if (hit.TryGetComponent<ExplosiveBarrel>(out var barrel))
                {
                    barrel.TakeDamage(100f, (barrel.transform.position - transform.position).normalized * pulseForce, DamageType.Physical);
                }

                // 3. Other Obstacles
                if (hit.TryGetComponent<ObstacleBase>(out var obs))
                {
                    obs.TakeDamage(60f, (obs.transform.position - transform.position).normalized * 12f, DamageType.Physical);
                }
            }
        }

        private void SpawnPulseWaveFX()
        {
            var wave = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            wave.name = "DeflectionPulseWave";
            wave.transform.position = transform.position + Vector3.up * 0.3f;
            wave.transform.localScale = new Vector3(1f, 0.05f, 1f);

            var col = wave.GetComponent<Collider>();
            if (col != null) Destroy(col);

            var r = wave.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            mat.color = new Color(0.0f, 1.0f, 0.95f, 0.7f);
            r.material = mat;

            StartCoroutine(ExpandAndFadeWave(wave.transform, mat, pulseRadius * 2f, 0.4f));
        }

        private IEnumerator ExpandAndFadeWave(Transform t, Material mat, float targetDiameter, float duration)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float p = elapsed / duration;
                if (t != null)
                {
                    float curScale = Mathf.Lerp(1f, targetDiameter, p);
                    t.localScale = new Vector3(curScale, 0.05f, curScale);
                    if (mat != null)
                    {
                        Color c = mat.color;
                        c.a = Mathf.Lerp(0.7f, 0f, p);
                        mat.color = c;
                    }
                }
                yield return null;
            }
            if (t != null) Destroy(t.gameObject);
        }

        private IEnumerator FadeAndDestroy(GameObject go, Material mat, float duration)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float p = elapsed / duration;
                if (mat != null)
                {
                    Color c = mat.color;
                    c.a = Mathf.Lerp(0.6f, 0f, p);
                    mat.color = c;
                }
                yield return null;
            }
            if (go != null) Destroy(go);
        }

        private void HandleAIRunner()
        {
            HandleBuffTimers();
            CheckGoal();

            if (GoalBeacon.Instance == null) return;

            Vector3 targetPos = GoalBeacon.Instance.transform.position;
            Vector3 diff = targetPos - transform.position;
            diff.y = 0;

            if (diff.sqrMagnitude < 0.1f) return;

            Vector3 targetDir = diff.normalized;

            // Turn towards goal
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(targetDir), Time.deltaTime * 6f);
            if (avatarVisuals != null)
            {
                avatarVisuals.rotation = transform.rotation;
            }

            // Check if grounded
            isGrounded = controller.isGrounded;
            if (isGrounded && velocity.y < 0)
            {
                velocity.y = -2f;
            }

            // Jump / Vault over low obstacles in front
            RaycastHit hit;
            if (Physics.Raycast(transform.position + Vector3.up * 0.4f, transform.forward, out hit, 2.0f))
            {
                if (isGrounded && !hit.collider.isTrigger)
                {
                    velocity.y = Mathf.Sqrt(jumpForce * 2f * gravity);
                }
            }

            float currentSpeed = baseSpeed * speedMultiplier * currentSlowFactor;
            controller.Move(transform.forward * currentSpeed * Time.deltaTime);

            velocity.y -= gravity * Time.deltaTime;
            controller.Move(velocity * Time.deltaTime);
        }

        private void HandleBuffTimers()
        {
            if (invulnerableTimer > 0) invulnerableTimer -= Time.deltaTime;

            if (slowTimer > 0)
            {
                slowTimer -= Time.deltaTime;
                if (slowTimer <= 0) currentSlowFactor = 1.0f;
            }

            if (speedBuffTimer > 0)
            {
                speedBuffTimer -= Time.deltaTime;
                if (speedBuffTimer <= 0) speedMultiplier = 1.0f;
            }

            if (jumpBuffTimer > 0)
            {
                jumpBuffTimer -= Time.deltaTime;
                if (jumpBuffTimer <= 0) bonusJumpForce = 0f;
            }
        }

        private void HandleStamina()
        {
            if (isSprinting && inputDirection.sqrMagnitude > 0.05f)
            {
                stamina = Mathf.Max(0f, stamina - staminaDrain * Time.deltaTime);
                if (stamina <= 0f) isSprinting = false;
            }
            else
            {
                stamina = Mathf.Min(maxStamina, stamina + staminaRecovery * Time.deltaTime);
            }
            OnStaminaChanged?.Invoke(stamina, maxStamina);
        }

        private void HandleMovement()
        {
            isGrounded = controller.isGrounded;
            if (isGrounded)
            {
                coyoteTimer = coyoteTime;
                canDoubleJump = true;
                if (velocity.y < 0)
                {
                    velocity.y = -2f;
                }
            }
            else
            {
                coyoteTimer -= Time.deltaTime;
            }

            if (GameInput.GetJumpDown() || isJumpingRequested)
            {
                jumpBufferTimer = jumpBufferTime;
                isJumpingRequested = false;
            }
            else if (jumpBufferTimer > 0f)
            {
                jumpBufferTimer -= Time.deltaTime;
            }

            // Keyboard input fallback if no touch joystick
            float h = inputDirection.x != 0 ? inputDirection.x : GameInput.GetHorizontal();
            float v = inputDirection.y != 0 ? inputDirection.y : GameInput.GetVertical();

            if (GameInput.GetSprintHeld()) isSprinting = true;
            else if (inputDirection.sqrMagnitude < 0.01f) isSprinting = false;

            // Shortcut keys
            if (GameInput.GetSnapGoalDown()) SnapToGoal();
            if (GameInput.GetLookBehindDown()) LookBehind();

            Vector3 moveDir = (transform.forward * v + transform.right * h).normalized;

            // Speed calculation
            float currentSpeed = (isSprinting && stamina > 0) ? sprintSpeed : baseSpeed;
            currentSpeed *= speedMultiplier * currentSlowFactor;

            if (isSliding)
            {
                currentSpeed *= GameConfig.RunnerSlideBurst;
            }

            Vector3 targetVelocity = moveDir * currentSpeed;

            // Smooth momentum: crisp acceleration & natural deceleration
            float accelRate = isGrounded ? 55f : 32f;
            currentHorizontalVelocity = Vector3.MoveTowards(currentHorizontalVelocity, targetVelocity, accelRate * Time.deltaTime);

            controller.Move(currentHorizontalVelocity * Time.deltaTime);

            // Decoupled character visual rotation towards move direction
            if (avatarVisuals != null && currentHorizontalVelocity.sqrMagnitude > 0.05f)
            {
                Quaternion targetVisualRot = Quaternion.LookRotation(currentHorizontalVelocity.normalized, Vector3.up);
                avatarVisuals.rotation = Quaternion.Slerp(avatarVisuals.rotation, targetVisualRot, Time.deltaTime * 16f);
            }

            // Jump / Vault with Coyote Time & Jump Buffering
            if (jumpBufferTimer > 0f && coyoteTimer > 0f && !isSliding)
            {
                jumpBufferTimer = 0f;
                coyoteTimer = 0f;
                canDoubleJump = true;

                // Check for dynamic vault
                if (CheckVault())
                {
                    StartCoroutine(PerformVault());
                }
                else
                {
                    velocity.y = Mathf.Sqrt((jumpForce + bonusJumpForce) * 2f * gravity);
                    if (AudioManager.Instance != null) AudioManager.Instance.PlayJumpSound();
                }
            }
            else if (jumpBufferTimer > 0f && canDoubleJump && jumpBuffTimer > 0f && !isSliding)
            {
                // Mid-air Double Jump powered by Wings of Light!
                jumpBufferTimer = 0f;
                canDoubleJump = false;
                velocity.y = Mathf.Sqrt((jumpForce + bonusJumpForce) * 2.1f * gravity);

                if (AudioManager.Instance != null) AudioManager.Instance.PlayJumpSound();
                SpawnDoubleJumpFX();
            }

            // Gravity
            velocity.y -= gravity * Time.deltaTime;
            controller.Move(velocity * Time.deltaTime);
        }

        private void SpawnDoubleJumpFX()
        {
            var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ring.name = "DoubleJumpAura";
            ring.transform.position = transform.position + Vector3.up * 0.1f;
            ring.transform.localScale = new Vector3(1.5f, 0.04f, 1.5f);

            var col = ring.GetComponent<Collider>();
            if (col != null) Destroy(col);

            var r = ring.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            mat.color = new Color(0.2f, 1.0f, 0.6f, 0.75f);
            r.material = mat;

            StartCoroutine(FadeAndDestroy(ring, mat, 0.4f));
        }

        private bool CheckVault()
        {
            RaycastHit hit;
            Vector3 origin = transform.position + Vector3.up * 0.4f;
            if (Physics.Raycast(origin, transform.forward, out hit, 1.8f))
            {
                float obstacleHeight = hit.collider.bounds.max.y - transform.position.y;
                if (obstacleHeight >= GameConfig.RunnerVaultMinHeight && obstacleHeight <= GameConfig.RunnerVaultMaxHeight)
                {
                    return true;
                }
            }
            return false;
        }

        private IEnumerator PerformVault()
        {
            isVaulting = true;
            float elapsed = 0f;
            float duration = 0.4f;
            Vector3 startPos = transform.position;
            Vector3 targetPos = startPos + transform.forward * 2.2f + Vector3.up * 1.5f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                controller.Move((targetPos - transform.position) * (Time.deltaTime / (duration - elapsed + 0.01f)));
                yield return null;
            }
            isVaulting = false;
        }

        private void HandleSlide()
        {
            if ((GameInput.GetSlideDown() || isSlideRequested) && isGrounded && !isSliding)
            {
                isSlideRequested = false;
                StartSlide();
            }

            if (isSliding)
            {
                slideTimer -= Time.deltaTime;
                if (slideTimer <= 0)
                {
                    EndSlide();
                }
            }
        }

        private void StartSlide()
        {
            isSliding = true;
            slideTimer = slideDuration;
            controller.height = GameConfig.RunnerSlideHeight;
            controller.center = new Vector3(0, GameConfig.RunnerSlideHeight / 2f, 0);

            if (AudioManager.Instance != null) AudioManager.Instance.PlaySlideSound();
        }

        private void EndSlide()
        {
            isSliding = false;
            controller.height = 1.8f;
            controller.center = new Vector3(0, 0.9f, 0);
        }

        public void AddLookInput(float deltaX, float deltaY = 0f)
        {
            cameraYaw += deltaX * mouseSensitivity;
            cameraPitch = Mathf.Clamp(cameraPitch - deltaY * mouseSensitivity, -25f, 65f);
            transform.rotation = Quaternion.Euler(0, cameraYaw, 0);
        }

        public void SnapToGoal()
        {
            if (GoalBeacon.Instance == null) return;
            Vector3 dir = (GoalBeacon.Instance.transform.position - transform.position);
            dir.y = 0;
            if (dir.sqrMagnitude > 0.01f)
            {
                transform.rotation = Quaternion.LookRotation(dir);
                cameraYaw = transform.eulerAngles.y;
            }
        }

        public void LookBehind()
        {
            cameraYaw += 180f;
            transform.rotation = Quaternion.Euler(0, cameraYaw, 0);
        }

        private void HandleCamera()
        {
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
                var anchor = cameraPivot != null ? cameraPivot : transform.Find("CameraFollowTarget");
                Vector3 basePos = anchor != null ? anchor.position : (transform.position + Vector3.up * cameraHeight);

                Vector3 camDir = camRot * new Vector3(0, 0, -1);
                float desiredDist = cameraDistance;
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

        private void OnControllerColliderHit(ControllerColliderHit hit)
        {
            if (hit.gameObject.TryGetComponent<SpikeBarricade>(out var spikes))
            {
                spikes.TrySpringSpikes(gameObject);
            }
            else if (hit.gameObject.TryGetComponent<ExplosiveBarrel>(out var barrel))
            {
                barrel.Detonate();
            }
        }

        public void TakeDamage(float amount, Vector3 knockbackImpulse, DamageType damageType = DamageType.Physical)
        {
            if (invulnerableTimer > 0f || isDashing) return;

            // Safe zone protection: Runner cannot be damaged inside the spawn sanctuary
            if (SpawnSanctuary.Instance != null && SpawnSanctuary.Instance.IsInsideSanctuary(transform.position))
            {
                return;
            }

            if (hasShield)
            {
                hasShield = false;
                invulnerableTimer = 1.0f;
                if (shieldAuraObj != null) shieldAuraObj.SetActive(false);
                if (AudioManager.Instance != null) AudioManager.Instance.PlayShieldBreakSound();
                SpawnShieldBreakFX();
                return;
            }

            health = Mathf.Max(0, health - amount);
            invulnerableTimer = 0.8f;
            velocity += knockbackImpulse;

            OnDamaged?.Invoke();
            OnHealthChanged?.Invoke(health, maxHealth);

            // Trigger screen damage vignette / flash
            if (UIManager.Instance != null)
            {
                UIManager.Instance.TriggerDamageFlash();
            }

            if (health <= 0)
            {
                if (GameManager.Instance != null)
                {
                    string msg = (damageType == DamageType.Explosion) ? "Runner Eliminated in Blast!" : "Runner Overwhelmed!";
                    GameManager.Instance.EndMatch(false, msg);
                }
            }
        }

        public void TakeDamage(float amount, Vector3 knockbackImpulse)
        {
            TakeDamage(amount, knockbackImpulse, DamageType.Physical);
        }

        private void SpawnShieldBreakFX()
        {
            if (ObstacleManager.Instance != null)
            {
                ObstacleManager.Instance.EmitBreakParticles(transform.position + Vector3.up * 0.9f, new Color(0.0f, 0.85f, 1.0f));
            }
        }

        public void ApplySlow(float factor, float duration)
        {
            currentSlowFactor = factor;
            slowTimer = duration;
        }

        public void ApplyPowerUp(PowerUpType type)
        {
            switch (type)
            {
                case PowerUpType.Speed:
                    speedBuffTimer = 6.0f;
                    speedMultiplier = 1.6f;
                    break;
                case PowerUpType.Jump:
                    jumpBuffTimer = 12.0f;
                    bonusJumpForce = 5.0f;
                    canDoubleJump = true;
                    break;
                case PowerUpType.Shield:
                    hasShield = true;
                    EnsureShieldBubble();
                    break;
                case PowerUpType.Health:
                    health = Mathf.Min(maxHealth, health + 35f);
                    OnHealthChanged?.Invoke(health, maxHealth);
                    break;
            }
        }

        private void EnsureShieldBubble()
        {
            if (shieldAuraObj == null)
            {
                shieldAuraObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                shieldAuraObj.name = "ShieldAuraBubble";
                shieldAuraObj.transform.parent = transform;
                shieldAuraObj.transform.localPosition = new Vector3(0, 0.9f, 0);
                shieldAuraObj.transform.localScale = new Vector3(2.2f, 2.2f, 2.2f);

                var col = shieldAuraObj.GetComponent<Collider>();
                if (col != null) Destroy(col);

                var r = shieldAuraObj.GetComponent<Renderer>();
                var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
                mat.color = new Color(0.0f, 0.85f, 1.0f, 0.35f);
                r.material = mat;
            }
            shieldAuraObj.SetActive(true);
        }

        private void CheckGoal()
        {
            if (GoalBeacon.Instance != null && GoalBeacon.Instance.CheckGoalReached(transform.position))
            {
                if (GameManager.Instance != null)
                {
                    GameManager.Instance.EndMatch(true, "Beacon Reached!");
                }
            }
        }
    }
}
