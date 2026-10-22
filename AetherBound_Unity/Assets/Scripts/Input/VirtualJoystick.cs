using UnityEngine;
using UnityEngine.EventSystems;

namespace AetherBound
{
    public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public RectTransform background;
        public RectTransform handle;
        public float handleRange = 60f;

        public Vector2 InputVector { get; private set; } = Vector2.zero;

        private Vector2 startPos;

        private void Start()
        {
            if (background == null) background = GetComponent<RectTransform>();
            if (handle == null && transform.childCount > 0)
                handle = transform.GetChild(0).GetComponent<RectTransform>();

            startPos = background != null ? background.anchoredPosition : Vector2.zero;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            OnDrag(eventData);
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (background == null || handle == null) return;

            Vector2 pos;
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(background, eventData.position, eventData.pressEventCamera, out pos))
            {
                pos.x = (pos.x / background.sizeDelta.x);
                pos.y = (pos.y / background.sizeDelta.y);

                Vector2 input = new Vector2(pos.x * 2f, pos.y * 2f);
                InputVector = (input.magnitude > 1.0f) ? input.normalized : input;

                handle.anchoredPosition = new Vector2(InputVector.x * handleRange, InputVector.y * handleRange);
            }
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            InputVector = Vector2.zero;
            if (handle != null) handle.anchoredPosition = Vector2.zero;
        }
    }
}
