using UnityEngine;

namespace AetherBound
{
    public class MobileInputManager : MonoBehaviour
    {
        public static MobileInputManager Instance { get; private set; }

        public VirtualJoystick joystick;
        public TouchLookZone lookZone;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);
        }

        private void Update()
        {
            if (joystick == null || GameManager.Instance == null) return;

            Vector2 move = joystick.InputVector;

            if (GameManager.Instance.CurrentRole == PlayerRole.Runner && RunnerController.Instance != null)
            {
                RunnerController.Instance.inputDirection = move;
            }
            else if (GameManager.Instance.CurrentRole == PlayerRole.Saboteur && SaboteurController.Instance != null)
            {
                SaboteurController.Instance.inputDirection = move;
            }
        }

        // Runner mobile actions
        public void OnJumpPressed()
        {
            if (RunnerController.Instance != null)
            {
                RunnerController.Instance.isJumpingRequested = true;
            }
        }

        public void OnSlidePressed()
        {
            if (RunnerController.Instance != null)
            {
                RunnerController.Instance.isSlideRequested = true;
            }
        }

        public void OnSprintToggle()
        {
            if (RunnerController.Instance != null)
            {
                RunnerController.Instance.isSprinting = !RunnerController.Instance.isSprinting;
            }
        }

        public void OnSnapGoal()
        {
            if (RunnerController.Instance != null)
            {
                RunnerController.Instance.SnapToGoal();
            }
        }

        public void OnLookBehind()
        {
            if (RunnerController.Instance != null)
            {
                RunnerController.Instance.LookBehind();
            }
        }

        public void OnDashPressed()
        {
            if (RunnerController.Instance != null)
            {
                RunnerController.Instance.TriggerAetherDash();
            }
        }

        public void OnPulsePressed()
        {
            if (RunnerController.Instance != null)
            {
                RunnerController.Instance.TriggerDeflectionPulse();
            }
        }

        // Saboteur mobile actions
        public void OnDeployObstacle()
        {
            if (SaboteurController.Instance != null)
            {
                SaboteurController.Instance.DeployCurrentObstacle();
            }
        }

        public void OnRotateObstacle()
        {
            if (SaboteurController.Instance != null)
            {
                SaboteurController.Instance.RotatePlacement(45f);
            }
        }

        public void OnReconPulse()
        {
            if (SaboteurController.Instance != null)
            {
                SaboteurController.Instance.TriggerReconPulse();
            }
        }

        public void OnSelectObstacleType(int index)
        {
            if (SaboteurController.Instance != null)
            {
                SaboteurController.Instance.SelectObstacle((ObstacleType)index);
            }
        }

        public void OnAdjustPlacementDistance(float delta)
        {
            if (SaboteurController.Instance != null)
            {
                SaboteurController.Instance.AdjustPlacementDistance(delta);
            }
        }

        public void OnToggleSaboteurViewMode()
        {
            if (SaboteurController.Instance != null)
            {
                SaboteurController.Instance.ToggleViewMode();
            }
        }

        public void OnBlinkPressed()
        {
            if (SaboteurController.Instance != null)
            {
                SaboteurController.Instance.TriggerShadowBlink();
            }
        }

        public void OnSnapRunner()
        {
            if (SaboteurController.Instance != null)
            {
                SaboteurController.Instance.SnapCameraToRunner();
            }
        }
    }
}
