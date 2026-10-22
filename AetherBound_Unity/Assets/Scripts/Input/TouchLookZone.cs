using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace AetherBound
{
    public class TouchLookZone : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public float sensitivity = 0.25f;
        private Vector2 lastPointerPos;
        private bool isPointerDown = false;

        public float LookDeltaX { get; private set; }

        private Image touchImage;

        private void Awake()
        {
            touchImage = GetComponent<Image>();
        }

        private void Update()
        {
            // On desktop platforms, mouse look is handled by raw cursor deltas in Runner/Saboteur controller.
            // Disable raycast target entirely on desktop so mouse clicks cleanly pass through to UI buttons and scene.
            if (touchImage != null)
            {
                bool isDesktop = !Application.isMobilePlatform;
                if (isDesktop)
                {
                    if (touchImage.raycastTarget) touchImage.raycastTarget = false;
                }
                else
                {
                    // On mobile, only raycast during active gameplay
                    bool isPlaying = GameManager.Instance != null && GameManager.Instance.CurrentState == GameState.Playing;
                    if (touchImage.raycastTarget != isPlaying)
                    {
                        touchImage.raycastTarget = isPlaying;
                    }
                }
            }
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            // Only capture pointer if not desktop with locked cursor
            if (CursorManager.IsCursorLocked) return;

            isPointerDown = true;
            lastPointerPos = eventData.position;
            LookDeltaX = 0f;
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (!isPointerDown) return;

            Vector2 delta = eventData.position - lastPointerPos;
            LookDeltaX = delta.x * sensitivity;
            lastPointerPos = eventData.position;

            if (GameManager.Instance != null)
            {
                if (GameManager.Instance.CurrentRole == PlayerRole.Runner && RunnerController.Instance != null)
                {
                    RunnerController.Instance.AddLookInput(LookDeltaX * 0.1f);
                }
                else if (GameManager.Instance.CurrentRole == PlayerRole.Saboteur && SaboteurController.Instance != null)
                {
                    SaboteurController.Instance.AddLookInput(LookDeltaX * 0.1f);
                }
            }
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            isPointerDown = false;
            LookDeltaX = 0f;
        }
    }
}
