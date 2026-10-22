using UnityEngine;
using UnityEngine.EventSystems;

namespace AetherBound
{
    /// <summary>
    /// Controls cursor locking, visibility, and desktop interaction states.
    /// Automatically unlocks cursor during menus/game over, and locks cursor during active gameplay.
    /// </summary>
    public class CursorManager : MonoBehaviour
    {
        public static CursorManager Instance { get; private set; }

        [Header("Desktop Settings")]
        public bool autoLockOnPlay = true;
        public bool showHelpHint = true;

        public static bool IsCursorLocked => Cursor.lockState == CursorLockMode.Locked;

        private GUIStyle hintStyle;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
                return;
            }
        }

        private void Start()
        {
            UnlockCursor();
        }

        private void Update()
        {
            if (GameManager.Instance == null) return;

            GameState state = GameManager.Instance.CurrentState;

            if (state == GameState.RoleSelect || state == GameState.GameOver)
            {
                if (IsCursorLocked)
                {
                    UnlockCursor();
                }
                return;
            }

            // State is GameState.Playing
            if (GameInput.GetToggleCursorDown())
            {
                ToggleCursorLock();
            }

            // If unlocked during play and player clicks game window (not on UI button)
            if (!IsCursorLocked && GameInput.GetLeftClickDown())
            {
                // In Saboteur OverheadTactical view mode, allow free mouse pointing & clicking without locking
                if (GameManager.Instance.CurrentRole == PlayerRole.Saboteur &&
                    SaboteurController.Instance != null &&
                    SaboteurController.Instance.currentViewMode == SaboteurViewMode.OverheadTactical)
                {
                    return;
                }

                // Check if pointer is over interactive UI
                if (EventSystem.current == null || !EventSystem.current.IsPointerOverGameObject())
                {
                    LockCursor();
                }
            }
        }

        public void LockCursor()
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }

        public void UnlockCursor()
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        public void ToggleCursorLock()
        {
            if (IsCursorLocked)
            {
                UnlockCursor();
            }
            else
            {
                LockCursor();
            }
        }

        private void OnGUI()
        {
            if (!showHelpHint) return;
            if (GameManager.Instance == null || GameManager.Instance.CurrentState != GameState.Playing) return;

            if (hintStyle == null)
            {
                hintStyle = new GUIStyle(GUI.skin.box)
                {
                    fontSize = 13,
                    fontStyle = FontStyle.Bold,
                    alignment = TextAnchor.MiddleCenter
                };
                hintStyle.normal.textColor = Color.white;
            }

            string hint;
            if (GameManager.Instance.CurrentRole == PlayerRole.Runner)
            {
                hint = IsCursorLocked 
                    ? "[ESC] Cursor | [WASD] Run | [Space] Jump | [Shift] Sprint | [Ctrl/C] Slide | [E] Dash | [Q/R-Click] Pulse | [F] Goal" 
                    : "🖱️ CURSOR UNLOCKED (Click screen to Lock Mouse-Look | [ESC] Toggle)";
            }
            else
            {
                bool isTactical = (SaboteurController.Instance != null && SaboteurController.Instance.currentViewMode == SaboteurViewMode.OverheadTactical);
                if (isTactical)
                {
                    hint = "[T] Chase Cam | [WASD] Pan | [L-Click] Deploy | [R-Click/R] Rotate | [Scroll] Zoom | [Shift/V] Blink | [Space] Snap Runner";
                }
                else
                {
                    hint = IsCursorLocked 
                        ? "[T] Tactical Mode | [WASD] Move | [Mouse] Aim | [L-Click] Deploy | [R] Rotate | [Shift/V] Blink | [Q] Recon" 
                        : "🖱️ CURSOR UNLOCKED (Click screen to Lock Aim | [T] Tactical Cam | [ESC] Toggle)";
                }
            }

            float width = Mathf.Min(Screen.width - 40, 720);
            float x = (Screen.width - width) * 0.5f;
            float y = 10f;

            GUI.backgroundColor = new Color(0.05f, 0.08f, 0.14f, 0.75f);
            GUI.Box(new Rect(x, y, width, 26), hint, hintStyle);
        }
    }
}
