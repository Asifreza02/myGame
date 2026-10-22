using UnityEngine;
using UnityEngine.EventSystems;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace AetherBound
{
    /// <summary>
    /// Automatically ensures that EventSystem is properly configured with InputSystemUIInputModule
    /// so mouse clicks on UI elements (Role Selection, Match HUD, Game Over) always work seamlessly.
    /// </summary>
#if UNITY_EDITOR
    [InitializeOnLoad]
#endif
    public static class InputSystemUIConfigurator
    {
        static InputSystemUIConfigurator()
        {
#if UNITY_EDITOR
            EditorApplication.playModeStateChanged += OnPlayModeChanged;
#endif
        }

#if UNITY_EDITOR
        private static void OnPlayModeChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                ConfigureEventSystem();
            }
        }

        [MenuItem("Tools/AetherBound/Configure Input & EventSystem")]
        public static void MenuConfigure()
        {
            ConfigureEventSystem();
            Debug.Log("[AetherBound] EventSystem & InputModule configured for New Input System!");
        }
#endif

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        public static void AutoConfigureOnRuntimeLoad()
        {
            ConfigureEventSystem();
            EnsureCursorManager();
        }

        public static void ConfigureEventSystem()
        {
            var eventSystems = Object.FindObjectsByType<EventSystem>(FindObjectsInactive.Include);
            if (eventSystems == null || eventSystems.Length == 0)
            {
                var esGo = new GameObject("EventSystem");
                esGo.AddComponent<EventSystem>();
                eventSystems = new EventSystem[] { esGo.GetComponent<EventSystem>() };
            }

            foreach (var es in eventSystems)
            {
                if (es == null) continue;

#if ENABLE_INPUT_SYSTEM
                // Remove legacy StandaloneInputModule to avoid conflict
                var standalone = es.GetComponent<StandaloneInputModule>();
                if (standalone != null)
                {
                    if (Application.isPlaying)
                        Object.Destroy(standalone);
                    else
                        Object.DestroyImmediate(standalone);
                }

                // Attach InputSystemUIInputModule
                var inputSysModule = es.GetComponent<InputSystemUIInputModule>();
                if (inputSysModule == null)
                {
                    inputSysModule = es.gameObject.AddComponent<InputSystemUIInputModule>();
                }
                
                try
                {
                    inputSysModule.AssignDefaultActions();
                }
                catch { }
#else
                if (es.GetComponent<StandaloneInputModule>() == null)
                {
                    es.gameObject.AddComponent<StandaloneInputModule>();
                }
#endif
            }
        }

        public static void EnsureCursorManager()
        {
            if (CursorManager.Instance == null && Object.FindAnyObjectByType<CursorManager>() == null)
            {
                var go = new GameObject("CursorManager");
                go.AddComponent<CursorManager>();
            }
        }
    }
}
