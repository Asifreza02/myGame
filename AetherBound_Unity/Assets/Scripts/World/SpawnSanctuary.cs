using UnityEngine;

namespace AetherBound
{
    public class SpawnSanctuary : MonoBehaviour
    {
        public static SpawnSanctuary Instance { get; private set; }

        [Header("Sanctuary Visual Settings")]
        public float platformRadius = 9.0f;
        public Color runeGlowColor = new Color(0f, 1f, 1f);

        private void Awake()
        {
            if (Instance == null) Instance = this;
            int groundLayer = LayerMask.NameToLayer("Ground");
            if (groundLayer != -1) gameObject.layer = groundLayer;

            BuildSanctuaryGround();
        }

        public bool IsInsideSanctuary(Vector3 worldPos)
        {
            Vector3 flatPos = new Vector3(worldPos.x, 0, worldPos.z);
            Vector3 flatCenter = new Vector3(transform.position.x, 0, transform.position.z);
            return Vector3.Distance(flatPos, flatCenter) <= platformRadius * 1.15f;
        }

        public void BuildSanctuaryGround()
        {
            // Clean old child objects if regenerating
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

            var stoneMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"))
            {
                name = "Mat_SanctuaryStone",
                color = new Color(0.24f, 0.28f, 0.35f)
            };
            stoneMat.SetFloat("_Smoothness", 0.3f);

            var goldTrimMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"))
            {
                name = "Mat_SanctuaryTrim",
                color = new Color(0.85f, 0.65f, 0.25f)
            };
            goldTrimMat.SetFloat("_Metallic", 0.7f);
            goldTrimMat.SetFloat("_Smoothness", 0.65f);

            var runeMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"))
            {
                name = "Mat_SanctuaryRune",
                color = runeGlowColor
            };
            if (runeMat.HasProperty("_EmissionColor"))
            {
                runeMat.SetColor("_EmissionColor", new Color(0f, 2.0f, 2.5f));
                runeMat.EnableKeyword("_EMISSION");
            }

            int groundLayer = LayerMask.NameToLayer("Ground");
            if (groundLayer == -1) groundLayer = 0;

            // 1. Central Spawn Dais (Single solid stone platform - no overlapping thin discs)
            var dais = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            dais.name = "CentralDais";
            dais.layer = groundLayer;
            dais.transform.parent = transform;
            dais.transform.localPosition = new Vector3(0, 0.85f, 0);
            dais.transform.localScale = new Vector3(platformRadius * 1.6f, 0.15f, platformRadius * 1.6f);
            dais.GetComponent<Renderer>().sharedMaterial = stoneMat;

            // Mark all sanctuary geometry static for batching & zero overhead
            gameObject.isStatic = true;
            foreach (var t in GetComponentsInChildren<Transform>(true))
            {
                t.gameObject.isStatic = true;
            }
        }

        private void CreateGuardianPylon(Vector3 offset, Material stoneMat, Material trimMat, Material runeMat)
        {
            int obstacleLayer = LayerMask.NameToLayer("Obstacle");
            if (obstacleLayer == -1) obstacleLayer = 0;

            var pylon = new GameObject("AetherPylon");
            pylon.layer = obstacleLayer;
            pylon.transform.parent = transform;
            pylon.transform.localPosition = new Vector3(offset.x, 0.85f, offset.z);

#if UNITY_EDITOR
            var pillarPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Sanctuary_Pillar.prefab");
            var torchPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Prefabs/Imported/Beacon_Torch.prefab");
            if (pillarPrefab != null)
            {
                var p = (GameObject)Instantiate(pillarPrefab, pylon.transform);
                p.layer = obstacleLayer;
                foreach (var child in p.GetComponentsInChildren<Transform>(true)) child.gameObject.layer = obstacleLayer;
                p.transform.localPosition = Vector3.zero;
                p.transform.localRotation = Quaternion.identity;
                p.transform.localScale = new Vector3(1.4f, 2.0f, 1.4f);

                if (torchPrefab != null)
                {
                    var torch = (GameObject)Instantiate(torchPrefab, pylon.transform);
                    torch.layer = obstacleLayer;
                    foreach (var child in torch.GetComponentsInChildren<Transform>(true)) child.gameObject.layer = obstacleLayer;
                    torch.transform.localPosition = new Vector3(0, 3.8f, 0);
                    torch.transform.localScale = Vector3.one * 1.5f;
                }

                pylon.isStatic = true;
                foreach (var c in pylon.GetComponentsInChildren<Transform>(true)) c.gameObject.isStatic = true;
                return;
            }
#endif

            // Pillar base
            var baseBlock = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseBlock.transform.parent = pylon.transform;
            baseBlock.transform.localPosition = new Vector3(0, 0.5f, 0);
            baseBlock.transform.localScale = new Vector3(1.2f, 1.0f, 1.2f);
            baseBlock.GetComponent<Renderer>().sharedMaterial = stoneMat;

            // Obelisk Spire
            var spire = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            spire.transform.parent = pylon.transform;
            spire.transform.localPosition = new Vector3(0, 2.2f, 0);
            spire.transform.localScale = new Vector3(0.6f, 1.8f, 0.6f);
            spire.GetComponent<Renderer>().sharedMaterial = stoneMat;

            // Floating glowing capstone
            var crystal = GameObject.CreatePrimitive(PrimitiveType.Cube);
            crystal.name = "PylonCrystal";
            crystal.transform.parent = pylon.transform;
            crystal.transform.localPosition = new Vector3(0, 4.4f, 0);
            crystal.transform.localRotation = Quaternion.Euler(45f, 45f, 0);
            crystal.transform.localScale = new Vector3(0.55f, 0.55f, 0.55f);
            var col = crystal.GetComponent<Collider>();
            if (col != null) DestroyImmediate(col);
            crystal.GetComponent<Renderer>().sharedMaterial = runeMat;

            pylon.isStatic = true;
            foreach (var c in pylon.GetComponentsInChildren<Transform>(true)) c.gameObject.isStatic = true;
        }

        private void CreateParkourHurdles(Material stoneMat, Material trimMat)
        {
            int obstacleLayer = LayerMask.NameToLayer("Obstacle");
            if (obstacleLayer == -1) obstacleLayer = 0;

            var hurdlesRoot = new GameObject("ParkourTrainingObstacles");
            hurdlesRoot.layer = obstacleLayer;
            hurdlesRoot.transform.parent = transform;

            // Vault hurdle (at z = 8m, ideal height 1.2m for testing vaulting!)
            var vaultHurdle = GameObject.CreatePrimitive(PrimitiveType.Cube);
            vaultHurdle.name = "VaultHurdle";
            vaultHurdle.layer = obstacleLayer;
            vaultHurdle.transform.parent = hurdlesRoot.transform;
            vaultHurdle.transform.localPosition = new Vector3(0, 1.45f, 8.5f);
            vaultHurdle.transform.localScale = new Vector3(4.0f, 1.2f, 0.6f);
            vaultHurdle.GetComponent<Renderer>().sharedMaterial = stoneMat;

            // Vault hurdle top bar
            var bar = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bar.name = "TrimBar";
            bar.layer = obstacleLayer;
            bar.transform.parent = vaultHurdle.transform;
            bar.transform.localPosition = new Vector3(0, 0.52f, 0);
            bar.transform.localScale = new Vector3(1.05f, 0.15f, 1.1f);
            var bCol = bar.GetComponent<Collider>();
            if (bCol != null) DestroyImmediate(bCol);
            bar.GetComponent<Renderer>().sharedMaterial = trimMat;

            // Slide underpass arch (at x = 8.5m, clearance 1.3m, ideal for testing slide!)
            var slideArchRoot = new GameObject("SlideUnderpass");
            slideArchRoot.layer = obstacleLayer;
            slideArchRoot.transform.parent = hurdlesRoot.transform;
            slideArchRoot.transform.localPosition = new Vector3(8.5f, 0.85f, 0);
            slideArchRoot.transform.localRotation = Quaternion.Euler(0, 90f, 0);

            var postL = GameObject.CreatePrimitive(PrimitiveType.Cube);
            postL.layer = obstacleLayer;
            postL.transform.parent = slideArchRoot.transform;
            postL.transform.localPosition = new Vector3(-2.2f, 1.2f, 0);
            postL.transform.localScale = new Vector3(0.5f, 2.4f, 0.5f);
            postL.GetComponent<Renderer>().sharedMaterial = stoneMat;

            var postR = GameObject.CreatePrimitive(PrimitiveType.Cube);
            postR.layer = obstacleLayer;
            postR.transform.parent = slideArchRoot.transform;
            postR.transform.localPosition = new Vector3(2.2f, 1.2f, 0);
            postR.transform.localScale = new Vector3(0.5f, 2.4f, 0.5f);
            postR.GetComponent<Renderer>().sharedMaterial = stoneMat;

            var topBeam = GameObject.CreatePrimitive(PrimitiveType.Cube);
            topBeam.layer = obstacleLayer;
            topBeam.transform.parent = slideArchRoot.transform;
            topBeam.transform.localPosition = new Vector3(0, 1.9f, 0); // low beam: clearance is ~1.3m from ground
            topBeam.transform.localScale = new Vector3(4.9f, 1.0f, 0.6f);
            topBeam.GetComponent<Renderer>().sharedMaterial = stoneMat;
        }
    }
}
