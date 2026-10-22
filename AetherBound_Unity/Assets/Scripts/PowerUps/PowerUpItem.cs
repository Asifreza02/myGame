using System.Collections;
using UnityEngine;

namespace AetherBound
{
    public class PowerUpItem : MonoBehaviour
    {
        public PowerUpType type;
        public float bobSpeed = 3f;
        public float bobHeight = 0.35f;
        public float rotateSpeed = 90f;

        private Vector3 startPos;
        private Transform visualTransform;
        private Color auraColor = Color.yellow;

        public void Initialize(PowerUpType pType, Color color)
        {
            type = pType;
            startPos = transform.position;
            auraColor = color;

            int powerUpLayer = LayerMask.NameToLayer("PowerUp");
            if (powerUpLayer != -1) gameObject.layer = powerUpLayer;

            GameObject chestPrefab = Resources.Load<GameObject>("Prefabs/PowerUp_Chest");
#if UNITY_EDITOR
            if (chestPrefab == null)
            {
                chestPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/PowerUp_Chest.prefab");
            }
#endif
            if (chestPrefab != null)
            {
                var chest = Instantiate(chestPrefab, transform);
                chest.name = "Visual";
                chest.transform.localPosition = Vector3.zero;
                chest.transform.localScale = Vector3.one * 1.35f;
                visualTransform = chest.transform;

                var lightGo = new GameObject("Glow");
                lightGo.transform.parent = transform;
                lightGo.transform.localPosition = Vector3.up * 0.3f;
                var l = lightGo.AddComponent<Light>();
                l.color = color;
                l.intensity = 1.6f;
                l.range = 3.8f;

                var sc = gameObject.AddComponent<SphereCollider>();
                sc.isTrigger = true;
                sc.radius = 1.3f;
                return;
            }

            // Crystal mesh fallback
            visualTransform = transform.Find("Visual");
            if (visualTransform == null)
            {
                var vis = GameObject.CreatePrimitive(PrimitiveType.Cube);
                vis.name = "Visual";
                vis.transform.parent = transform;
                vis.transform.localPosition = Vector3.zero;
                vis.transform.localScale = new Vector3(0.6f, 0.9f, 0.6f);
                vis.transform.rotation = Quaternion.Euler(45, 45, 45);

                var col = vis.GetComponent<Collider>();
                if (col != null) Destroy(col);

                var ren = vis.GetComponent<Renderer>();
                var mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = color;
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", color * 0.8f);
                ren.material = mat;

                visualTransform = vis.transform;
            }

            // Trigger collider
            var sphereCol = gameObject.AddComponent<SphereCollider>();
            sphereCol.isTrigger = true;
            sphereCol.radius = 1.3f;
        }

        private void Update()
        {
            if (visualTransform != null)
            {
                visualTransform.Rotate(Vector3.up, rotateSpeed * Time.deltaTime, Space.World);
                float newY = startPos.y + Mathf.Sin(Time.time * bobSpeed) * bobHeight;
                transform.position = new Vector3(transform.position.x, newY, transform.position.z);
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (other.TryGetComponent<RunnerController>(out var runner))
            {
                runner.ApplyPowerUp(type);
                if (AudioManager.Instance != null)
                {
                    AudioManager.Instance.PlayPowerupSound();
                }

                SpawnPickupFX();
                Destroy(gameObject);
            }
        }

        private void SpawnPickupFX()
        {
            var burst = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            burst.name = "PowerUpPickupBurst";
            burst.transform.position = transform.position + Vector3.up * 0.4f;
            burst.transform.localScale = new Vector3(0.5f, 0.5f, 0.5f);

            var col = burst.GetComponent<Collider>();
            if (col != null) Destroy(col);

            var r = burst.GetComponent<Renderer>();
            var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color"));
            mat.color = auraColor;
            r.material = mat;

            StartCoroutine(AnimatePickupBurst(burst.transform, mat));
        }

        private IEnumerator AnimatePickupBurst(Transform t, Material mat)
        {
            float elapsed = 0f;
            float duration = 0.35f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float p = elapsed / duration;
                if (t != null)
                {
                    float s = Mathf.Lerp(0.5f, 3.2f, p);
                    t.localScale = new Vector3(s, s, s);
                    if (mat != null)
                    {
                        Color c = mat.color;
                        c.a = Mathf.Lerp(0.9f, 0f, p);
                        mat.color = c;
                    }
                }
                yield return null;
            }
            if (t != null) Destroy(t.gameObject);
        }
    }
}
