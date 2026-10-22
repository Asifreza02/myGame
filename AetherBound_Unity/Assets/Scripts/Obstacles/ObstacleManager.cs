using System;
using System.Collections.Generic;
using UnityEngine;

namespace AetherBound
{
    public class ObstacleManager : MonoBehaviour
    {
        public static ObstacleManager Instance { get; private set; }

        private readonly List<ObstacleBase> activeObstacles = new List<ObstacleBase>();

        [Header("Preview Settings")]
        public GameObject previewObject;
        private Renderer previewRenderer;
        private Material previewMat;

        private static Material boulderMaterial;
        private static Material mudMaterial;

        public event Action<Vector3, float, float> OnExplosion;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            CreatePreviewObject();
            EnsureMaterials();
        }

        private void EnsureMaterials()
        {
            if (boulderMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                boulderMaterial = new Material(shader)
                {
                    name = "Mat_Obstacle_Boulder",
                    color = new Color(0.42f, 0.40f, 0.38f)
                };
                if (boulderMaterial.HasProperty("_Smoothness")) boulderMaterial.SetFloat("_Smoothness", 0.15f);
            }

            if (mudMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                mudMaterial = new Material(shader)
                {
                    name = "Mat_Obstacle_Mud",
                    color = new Color(0.20f, 0.13f, 0.08f)
                };
                if (mudMaterial.HasProperty("_Smoothness")) mudMaterial.SetFloat("_Smoothness", 0.65f);
            }
        }

        private void CreatePreviewObject()
        {
            previewObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            previewObject.name = "PlacementPreview";
            var col = previewObject.GetComponent<Collider>();
            if (col != null) Destroy(col);

            previewRenderer = previewObject.GetComponent<Renderer>();
            previewMat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            previewRenderer.material = previewMat;
            previewObject.SetActive(false);
        }

        public void SetPreviewState(bool active, ObstacleType type, Vector3 pos, Quaternion rot, bool isValid)
        {
            if (previewObject == null) return;

            previewObject.SetActive(active);
            if (!active) return;

            var def = GameConfig.GetObstacleDef(type);
            previewObject.transform.position = pos;
            previewObject.transform.rotation = rot;
            previewObject.transform.localScale = (def != null) ? def.size : Vector3.one;

            Color c = isValid ? new Color(0f, 1f, 0.45f, 0.45f) : new Color(1f, 0.2f, 0.2f, 0.45f);
            previewMat.color = c;
        }

        public ObstacleBase SpawnObstacle(ObstacleType type, Vector3 position, Quaternion rotation)
        {
            EnsureMaterials();
            var def = GameConfig.GetObstacleDef(type);
            if (def == null) return null;

            GameObject go = null;
            ObstacleBase obs = null;

            switch (type)
            {
                case ObstacleType.Wall:
                    go = LoadPrefab("Obstacle_Wall");
                    if (go != null)
                    {
                        go.transform.position = position;
                        go.transform.rotation = rotation;
                        go.name = "BarrierWall";
                        if (go.GetComponent<Collider>() == null)
                        {
                            var box = go.AddComponent<BoxCollider>();
                            box.size = new Vector3(2.6f, 2.4f, 0.9f);
                            box.center = new Vector3(0, 1.2f, 0);
                        }
                    }
                    else
                    {
                        go = CreateStyledWall(position, rotation, def.size);
                    }
                    obs = go.AddComponent<BarrierWall>();
                    break;

                case ObstacleType.Spikes:
                    go = LoadPrefab("Obstacle_Spikes");
                    if (go != null)
                    {
                        go.transform.position = position;
                        go.transform.rotation = rotation;
                        go.name = "SpikeBarricade";
                        if (go.GetComponent<Collider>() == null)
                        {
                            var box = go.AddComponent<BoxCollider>();
                            box.size = new Vector3(2.2f, 1.2f, 2.2f);
                            box.center = new Vector3(0, 0.6f, 0);
                        }
                    }
                    else
                    {
                        go = CreateStyledSpikes(position, rotation, def.size);
                    }
                    obs = go.AddComponent<SpikeBarricade>();
                    break;

                case ObstacleType.Barrel:
                    go = LoadPrefab("Obstacle_Barrel");
                    if (go != null)
                    {
                        go.transform.position = position;
                        go.transform.rotation = rotation;
                        go.name = "ExplosiveBarrel";
                        if (go.GetComponent<Collider>() == null)
                        {
                            var col = go.AddComponent<CapsuleCollider>();
                            col.radius = 0.55f;
                            col.height = 1.4f;
                            col.center = new Vector3(0, 0.7f, 0);
                        }
                    }
                    else
                    {
                        go = CreateStyledBarrel(position, rotation, def.size);
                    }
                    obs = go.AddComponent<ExplosiveBarrel>();
                    break;

                case ObstacleType.Boulder:
                    go = CreateStyledBoulder(position + Vector3.up * 2.2f, rotation, def.size);
                    obs = go.AddComponent<RollingBoulder>();
                    break;

                case ObstacleType.Mud:
                    go = CreateStyledMudTrap(position + Vector3.up * 0.08f, rotation, def.size);
                    obs = go.AddComponent<MudTrap>();
                    break;
            }

            if (obs != null && go != null)
            {
                int obsLayer = LayerMask.NameToLayer("Obstacle");
                if (obsLayer != -1)
                {
                    go.layer = obsLayer;
                    foreach (var c in go.GetComponentsInChildren<Transform>(true)) c.gameObject.layer = obsLayer;
                }

                activeObstacles.Add(obs);
                obs.OnDestroyed += HandleObstacleDestroyed;

                if (AudioManager.Instance != null)
                {
                    AudioManager.Instance.PlayPlacementSound();
                }
            }

            return obs;
        }

        private GameObject LoadPrefab(string name)
        {
            var resPrefab = Resources.Load<GameObject>($"Prefabs/{name}") ?? Resources.Load<GameObject>($"Prefabs/Obstacles/{name}");
            if (resPrefab != null)
            {
                return Instantiate(resPrefab);
            }

#if UNITY_EDITOR
            var editorPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Prefabs/Imported/{name}.prefab");
            if (editorPrefab != null)
            {
                return (GameObject)Instantiate(editorPrefab);
            }
#endif
            return null;
        }

        private GameObject CreateStyledWall(Vector3 pos, Quaternion rot, Vector3 size)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = "BarrierWall";
            go.transform.position = pos + Vector3.up * (size.y * 0.5f);
            go.transform.rotation = rot;
            go.transform.localScale = size;
            var r = go.GetComponent<Renderer>();
            r.material = boulderMaterial ?? new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            return go;
        }

        private GameObject CreateStyledSpikes(Vector3 pos, Quaternion rot, Vector3 size)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = "SpikeBarricade";
            go.transform.position = pos + Vector3.up * (size.y * 0.5f);
            go.transform.rotation = rot;
            go.transform.localScale = size;
            var r = go.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            mat.color = new Color(0.7f, 0.2f, 0.2f);
            r.material = mat;
            return go;
        }

        private GameObject CreateStyledBarrel(Vector3 pos, Quaternion rot, Vector3 size)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = "ExplosiveBarrel";
            go.transform.position = pos + Vector3.up * (size.y * 0.5f);
            go.transform.rotation = rot;
            go.transform.localScale = size;
            var r = go.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            mat.color = new Color(0.95f, 0.35f, 0.05f);
            r.material = mat;
            return go;
        }

        private GameObject CreateStyledBoulder(Vector3 pos, Quaternion rot, Vector3 size)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "RollingBoulder";
            go.transform.position = pos;
            go.transform.rotation = rot;
            go.transform.localScale = size;

            var r = go.GetComponent<Renderer>();
            r.material = boulderMaterial ?? new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));

            // Add dynamic physics
            var rb = go.GetComponent<Rigidbody>();
            if (rb == null) rb = go.AddComponent<Rigidbody>();
            rb.mass = 450f;
            rb.interpolation = RigidbodyInterpolation.Interpolate;
            rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

            return go;
        }

        private GameObject CreateStyledMudTrap(Vector3 pos, Quaternion rot, Vector3 size)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = "MudTrap";
            go.transform.position = pos;
            go.transform.rotation = rot;
            go.transform.localScale = new Vector3(size.x, 0.12f, size.z);

            var r = go.GetComponent<Renderer>();
            r.material = mudMaterial ?? new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));

            var col = go.GetComponent<Collider>();
            if (col != null) col.isTrigger = true;

            return go;
        }

        private void HandleObstacleDestroyed(ObstacleBase obs)
        {
            activeObstacles.Remove(obs);
        }

        public void TriggerExplosion(Vector3 blastPos, float radius, float knockback)
        {
            OnExplosion?.Invoke(blastPos, radius, knockback);
            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlayExplosionSound();
            }
            EmitBreakParticles(blastPos, new Color(1f, 0.45f, 0.1f));
        }

        public void EmitBreakParticles(Vector3 pos, Color color)
        {
            for (int i = 0; i < 6; i++)
            {
                var piece = GameObject.CreatePrimitive(PrimitiveType.Cube);
                piece.name = "Debris";
                piece.transform.position = pos + UnityEngine.Random.insideUnitSphere * 0.4f;
                piece.transform.localScale = Vector3.one * UnityEngine.Random.Range(0.2f, 0.45f);

                var c = piece.GetComponent<Collider>();
                if (c != null) Destroy(c);

                var r = piece.GetComponent<Renderer>();
                var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
                mat.color = color;
                r.material = mat;

                var rb = piece.AddComponent<Rigidbody>();
                rb.mass = 1.5f;
                Vector3 burstDir = (UnityEngine.Random.insideUnitSphere + Vector3.up * 1.5f).normalized;
                rb.AddForce(burstDir * UnityEngine.Random.Range(6f, 12f), ForceMode.VelocityChange);

                Destroy(piece, 1.2f);
            }
        }

        public void ClearAll()
        {
            foreach (var obs in activeObstacles.ToArray())
            {
                if (obs != null && obs.gameObject != null)
                {
                    if (Application.isPlaying) Destroy(obs.gameObject);
                    else DestroyImmediate(obs.gameObject);
                }
            }
            activeObstacles.Clear();
            if (previewObject != null) previewObject.SetActive(false);
        }
    }
}
