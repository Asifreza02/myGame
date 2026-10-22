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

        private Transform ring1;
        private Transform ring2;
        private Transform ring3;
        private Light pointLight;

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
            baseMat.color = new Color(0f, 0.55f, 0.7f);
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

            // Tall Sky Beam
            var beamObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            beamObj.transform.parent = transform;
            beamObj.transform.localPosition = new Vector3(0, 90f, 0);
            beamObj.transform.localScale = new Vector3(1.2f, 90f, 1.2f);
            var col = beamObj.GetComponent<Collider>();
            SafeDestroy(col);

            var beamRenderer = beamObj.GetComponent<Renderer>();
            var beamMat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            beamMat.color = new Color(0f, 1f, 1f, 0.65f);
            beamRenderer.sharedMaterial = beamMat;

            // Rotating Rings
            ring1 = CreateRing(2.0f, 4f);
            ring2 = CreateRing(4.2f, 4.8f);
            ring3 = CreateRing(6.4f, 5.6f);

            // Light
            var lightObj = new GameObject("BeaconLight");
            lightObj.transform.parent = transform;
            lightObj.transform.localPosition = new Vector3(0, 4f, 0);
            pointLight = lightObj.AddComponent<Light>();
            pointLight.color = beaconColor;
            pointLight.range = 30f;
            pointLight.intensity = 4f;

            // Sanctuary perimeter circle line
            CreateSanctuaryRing();
        }

        private Transform CreateRing(float localY, float scale)
        {
            var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ring.transform.parent = transform;
            ring.transform.localPosition = new Vector3(0, localY, 0);
            ring.transform.localScale = new Vector3(scale, 0.1f, scale);
            var c = ring.GetComponent<Collider>();
            SafeDestroy(c);

            var r = ring.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            mat.color = new Color(0.2f, 1f, 1f, 0.8f);
            r.sharedMaterial = mat;
            return ring.transform;
        }

        private void CreateSanctuaryRing()
        {
            var lineObj = new GameObject("SanctuaryLine");
            lineObj.transform.parent = transform;
            lineObj.transform.localPosition = Vector3.up * 0.15f;

            var lr = lineObj.AddComponent<LineRenderer>();
            lr.useWorldSpace = false;
            lr.loop = true;
            lr.startWidth = 0.25f;
            lr.endWidth = 0.25f;

            int segments = 48;
            Vector3[] points = new Vector3[segments];
            for (int i = 0; i < segments; i++)
            {
                float angle = (float)i / segments * Mathf.PI * 2f;
                points[i] = new Vector3(Mathf.Cos(angle) * sanctuaryRadius, 0f, Mathf.Sin(angle) * sanctuaryRadius);
            }
            lr.positionCount = segments;
            lr.SetPositions(points);

            var lineMat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            lineMat.color = new Color(0f, 1f, 0.8f, 0.7f);
            lr.material = lineMat;
        }

        private void Update()
        {
            if (ring1 != null) ring1.Rotate(Vector3.up, 6f * Time.deltaTime);
            if (ring2 != null) ring2.Rotate(Vector3.up, -8f * Time.deltaTime);
            if (ring3 != null) ring3.Rotate(Vector3.up, 5f * Time.deltaTime);
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
