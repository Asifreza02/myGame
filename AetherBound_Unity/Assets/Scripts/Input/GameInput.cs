using System;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace AetherBound
{
    /// <summary>
    /// Unified input helper that seamlessly bridges the Unity New Input System
    /// and legacy Input Manager, ensuring desktop keyboard & mouse controls always work.
    /// </summary>
    public static class GameInput
    {
        public static float GetHorizontal()
        {
            float val = 0f;

#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.aKey.isPressed || Keyboard.current.leftArrowKey.isPressed) val -= 1f;
                if (Keyboard.current.dKey.isPressed || Keyboard.current.rightArrowKey.isPressed) val += 1f;
            }
#endif
            if (Mathf.Abs(val) < 0.01f)
            {
                try
                {
                    val = Input.GetAxisRaw("Horizontal");
                }
                catch { }
            }

            return Mathf.Clamp(val, -1f, 1f);
        }

        public static float GetVertical()
        {
            float val = 0f;

#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.sKey.isPressed || Keyboard.current.downArrowKey.isPressed) val -= 1f;
                if (Keyboard.current.wKey.isPressed || Keyboard.current.upArrowKey.isPressed) val += 1f;
            }
#endif
            if (Mathf.Abs(val) < 0.01f)
            {
                try
                {
                    val = Input.GetAxisRaw("Vertical");
                }
                catch { }
            }

            return Mathf.Clamp(val, -1f, 1f);
        }

        public static Vector2 GetMoveVector()
        {
            Vector2 v = new Vector2(GetHorizontal(), GetVertical());
            return v.sqrMagnitude > 1f ? v.normalized : v;
        }

        public static float GetMouseDeltaX()
        {
            float dx = 0f;

#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null)
            {
                dx = Mouse.current.delta.x.ReadValue();
            }
#endif
            if (Mathf.Abs(dx) < 0.001f)
            {
                try
                {
                    dx = Input.GetAxis("Mouse X") * 15f;
                }
                catch { }
            }

            return dx;
        }

        public static float GetMouseDeltaY()
        {
            float dy = 0f;

#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null)
            {
                dy = Mouse.current.delta.y.ReadValue();
            }
#endif
            if (Mathf.Abs(dy) < 0.001f)
            {
                try
                {
                    dy = Input.GetAxis("Mouse Y") * 15f;
                }
                catch { }
            }

            return dy;
        }

        public static float GetMouseScroll()
        {
            float scroll = 0f;

#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null)
            {
                scroll = Mouse.current.scroll.y.ReadValue() / 120f;
            }
#endif
            if (Mathf.Abs(scroll) < 0.001f)
            {
                try
                {
                    scroll = Input.GetAxis("Mouse ScrollWheel") * 5f;
                }
                catch { }
            }

            return scroll;
        }

        public static bool GetJumpDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && Keyboard.current.spaceKey.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetButtonDown("Jump") || Input.GetKeyDown(KeyCode.Space);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetSlideDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.leftCtrlKey.wasPressedThisFrame ||
                    Keyboard.current.rightCtrlKey.wasPressedThisFrame ||
                    Keyboard.current.cKey.wasPressedThisFrame)
                    return true;
            }
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.LeftControl) || Input.GetKeyDown(KeyCode.RightControl) || Input.GetKeyDown(KeyCode.C);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetSprintHeld()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.leftShiftKey.isPressed || Keyboard.current.rightShiftKey.isPressed)
                    return true;
            }
#endif
            try
            {
                return Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetLeftClickDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetMouseButtonDown(0);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetLeftClickHeld()
        {
#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null && Mouse.current.leftButton.isPressed)
                return true;
#endif
            try
            {
                return Input.GetMouseButton(0);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetRightClickDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null && Mouse.current.rightButton.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetMouseButtonDown(1);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetRightClickHeld()
        {
#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null && Mouse.current.rightButton.isPressed)
                return true;
#endif
            try
            {
                return Input.GetMouseButton(1);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetMiddleClickDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null && Mouse.current.middleButton.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetMouseButtonDown(2);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetToggleCursorDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.escapeKey.wasPressedThisFrame || Keyboard.current.tabKey.wasPressedThisFrame)
                    return true;
            }
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.Tab);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetReconDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.qKey.wasPressedThisFrame || Keyboard.current.eKey.wasPressedThisFrame)
                    return true;
            }
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.Q) || Input.GetKeyDown(KeyCode.E);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetRotateDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && Keyboard.current.rKey.wasPressedThisFrame)
                return true;
            if (Mouse.current != null && Mouse.current.rightButton.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.R) || Input.GetMouseButtonDown(1);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetSnapGoalDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && Keyboard.current.fKey.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.F);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetLookBehindDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && Keyboard.current.bKey.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.B);
            }
            catch
            {
                return false;
            }
        }

        public static int GetHotbarSelect()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.digit1Key.wasPressedThisFrame) return 0;
                if (Keyboard.current.digit2Key.wasPressedThisFrame) return 1;
                if (Keyboard.current.digit3Key.wasPressedThisFrame) return 2;
                if (Keyboard.current.digit4Key.wasPressedThisFrame) return 3;
                if (Keyboard.current.digit5Key.wasPressedThisFrame) return 4;
            }
#endif
            try
            {
                if (Input.GetKeyDown(KeyCode.Alpha1)) return 0;
                if (Input.GetKeyDown(KeyCode.Alpha2)) return 1;
                if (Input.GetKeyDown(KeyCode.Alpha3)) return 2;
                if (Input.GetKeyDown(KeyCode.Alpha4)) return 3;
                if (Input.GetKeyDown(KeyCode.Alpha5)) return 4;
            }
            catch { }

            return -1;
        }

        public static bool GetToggleCameraModeDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && Keyboard.current.tKey.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.T);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetBlinkDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && (Keyboard.current.leftShiftKey.wasPressedThisFrame || Keyboard.current.vKey.wasPressedThisFrame))
                return true;
            if (Mouse.current != null && Mouse.current.rightButton.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.LeftShift) || Input.GetKeyDown(KeyCode.V) || Input.GetMouseButtonDown(1);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetSnapRunnerDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && (Keyboard.current.spaceKey.wasPressedThisFrame || Keyboard.current.rKey.wasPressedThisFrame))
                return true;
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.R);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetDashDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && (Keyboard.current.eKey.wasPressedThisFrame || Keyboard.current.leftShiftKey.wasPressedThisFrame))
                return true;
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.E);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetDeflectionPulseDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null && Keyboard.current.qKey.wasPressedThisFrame)
                return true;
            if (Mouse.current != null && Mouse.current.rightButton.wasPressedThisFrame)
                return true;
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.Q) || Input.GetMouseButtonDown(1);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetMenuRunnerSelectDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.digit1Key.wasPressedThisFrame ||
                    Keyboard.current.numpad1Key.wasPressedThisFrame ||
                    Keyboard.current.rKey.wasPressedThisFrame ||
                    Keyboard.current.enterKey.wasPressedThisFrame ||
                    Keyboard.current.numpadEnterKey.wasPressedThisFrame ||
                    Keyboard.current.spaceKey.wasPressedThisFrame)
                    return true;
            }
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.Alpha1) ||
                       Input.GetKeyDown(KeyCode.Keypad1) ||
                       Input.GetKeyDown(KeyCode.R) ||
                       Input.GetKeyDown(KeyCode.Return) ||
                       Input.GetKeyDown(KeyCode.KeypadEnter) ||
                       Input.GetKeyDown(KeyCode.Space);
            }
            catch
            {
                return false;
            }
        }

        public static bool GetMenuSaboteurSelectDown()
        {
#if ENABLE_INPUT_SYSTEM
            if (Keyboard.current != null)
            {
                if (Keyboard.current.digit2Key.wasPressedThisFrame ||
                    Keyboard.current.numpad2Key.wasPressedThisFrame ||
                    Keyboard.current.sKey.wasPressedThisFrame)
                    return true;
            }
#endif
            try
            {
                return Input.GetKeyDown(KeyCode.Alpha2) ||
                       Input.GetKeyDown(KeyCode.Keypad2) ||
                       Input.GetKeyDown(KeyCode.S);
            }
            catch
            {
                return false;
            }
        }
    }
}
