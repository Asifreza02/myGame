#if UNITY_EDITOR
using UnityEditor;

namespace AetherBound.Editor
{
    public static class Phase3Setup
    {
        [MenuItem("Tools/AetherBound/Execute Phase 3 Setup")]
        public static void ExecutePhase3Manual()
        {
            Phase1Setup.ExecutePhase3Setup();
        }

        public static void ExecutePhase3(bool force)
        {
            Phase1Setup.ExecutePhase3Setup();
        }
    }
}
#endif
