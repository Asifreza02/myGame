using System;
using UnityEngine;

namespace AetherBound
{
    public class GoalBeacon : MonoBehaviour
    {
        [Header("Beacon Settings")]
        public float goalRadius = GameConfig.GoalRadius;
        public float sanctuaryRadius = GameConfig.GoalSanctuaryRadius;
        public Color beaconColor = new Color(0f, 1f, 1f);

        public event Action OnRunnerReachedGoal;

        public static GoalBeacon Instance { get; private set; }

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            BuildVisuals();
        }

        public void SetPosition(float x, float z)
        {
            float y = WorldManager.Instance != null ? WorldManager.Instance.GetHeightAt(x, z) : 0f;
            transform.position = new Vector3(x, y, z);
        }

        private static void SafeDestroy(UnityEngine.Object obj)
        {
            if (obj == null) return;
            if (Application.isPlaying)
                Destroy(obj);
            else
                DestroyImmediate(obj);
        }

        private void BuildVisuals()
        {
            // Clear existing children to prevent duplicate accumulation
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                var child = transform.GetChild(i).gameObject;
                if (Application.isPlaying)
                {
                    child.transform.SetParent(null);
                    Destroy(child);
                }
                else
                {
                    DestroyImmediate(child);
                }
            }

            int groundLayer = LayerMask.NameToLayer("Ground");
            if (groundLayer != -1) gameObject.layer = groundLayer;

            // Base cylinder platform
            var baseObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            if (groundLayer != -1) baseObj.layer = groundLayer;
            baseObj.transform.parent = transform;
            baseObj.transform.localPosition = new Vector3(0, 0.4f, 0);
            baseObj.transform.localScale = new Vector3(goalRadius * 2, 0.4f, goalRadius * 2);
            var baseRenderer = baseObj.GetComponent<Renderer>();
            var baseMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            baseMat.color = new Color(0.22f, 0.28f, 0.35f);
            baseRenderer.sharedMaterial = baseMat;

#if UNITY_EDITOR
            var monolithPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Sanctuary_Monolith.prefab");
            if (monolithPrefab != null)
            {
                var monolith = (GameObject)Instantiate(monolithPrefab, transform);
                monolith.name = "BeaconAncientMonolith";
                monolith.transform.localPosition = new Vector3(0, 0.4f, 0);
                monolith.transform.localScale = Vector3.one * 2.2f;
            }
#endif

            // Mark all visuals static
            gameObject.isStatic = true;
            foreach (var t in GetComponentsInChildren<Transform>(true))
            {
                t.gameObject.isStatic = true;
            }
        }

        public bool IsInsideSanctuary(Vector3 worldPos)
        {
            float distSq = (worldPos.x - transform.position.x) * (worldPos.x - transform.position.x) +
                           (worldPos.z - transform.position.z) * (worldPos.z - transform.position.z);
            return distSq <= sanctuaryRadius * sanctuaryRadius;
        }

        public bool CheckGoalReached(Vector3 runnerPos)
        {
            float dx = runnerPos.x - transform.position.x;
            float dz = runnerPos.z - transform.position.z;
            float dist = Mathf.Sqrt(dx * dx + dz * dz);
            if (dist <= goalRadius)
            {
                OnRunnerReachedGoal?.Invoke();
                return true;
            }
            return false;
        }
    }
}
