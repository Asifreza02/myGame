using System.Collections.Generic;
using UnityEngine;

namespace AetherBound
{
    public static class CharacterModelBuilder
    {
        private static readonly Dictionary<string, Material> materialCache = new Dictionary<string, Material>();

        private static Material GetOrCreateMaterial(string key, Color color, float smoothness = 0.35f, Color? emission = null)
        {
            if (materialCache.TryGetValue(key, out var mat) && mat != null)
            {
                return mat;
            }

            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            mat = new Material(shader)
            {
                name = $"Mat_Char_{key}",
                color = color
            };

            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", 0.15f);

            if (emission.HasValue && emission.Value != Color.black)
            {
                if (mat.HasProperty("_EmissionColor"))
                {
                    mat.SetColor("_EmissionColor", emission.Value);
                    mat.EnableKeyword("_EMISSION");
                }
            }

            materialCache[key] = mat;
            return mat;
        }

        private static void SafeDestroy(UnityEngine.Object obj)
        {
            if (obj == null) return;
            if (Application.isPlaying)
                Object.Destroy(obj);
            else
                Object.DestroyImmediate(obj);
        }

        private static GameObject LoadCharacterModelPrefab(string prefabName)
        {
            var resPrefab = Resources.Load<GameObject>($"Prefabs/Characters/{prefabName}");
            if (resPrefab != null) return resPrefab;

#if UNITY_EDITOR
            var assetPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Prefabs/Imported/{prefabName}.prefab");
            if (assetPrefab != null) return assetPrefab;

            assetPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Resources/Prefabs/Characters/{prefabName}.prefab");
            if (assetPrefab != null) return assetPrefab;
#endif

            return null;
        }

        private static void EnsureCameraTarget(Transform parent)
        {
            var target = parent.Find("CameraFollowTarget");
            if (target == null)
            {
                var targetGo = new GameObject("CameraFollowTarget");
                targetGo.transform.parent = parent;
                targetGo.transform.localPosition = new Vector3(0, 1.6f, 0);
            }
        }

        // ==========================================
        // RUNNER CHARACTER
        // ==========================================

        public static GameObject BuildRunnerVisuals(Transform parent)
        {
            // Clean any existing placeholder avatar
            var old = parent.Find("AvatarVisuals");
            if (old != null) SafeDestroy(old.gameObject);
            var oldMesh = parent.Find("AvatarMesh");
            if (oldMesh != null) SafeDestroy(oldMesh.gameObject);

            var root = new GameObject("AvatarVisuals");
            root.transform.parent = parent;
            root.transform.localPosition = Vector3.zero;
            root.transform.localRotation = Quaternion.identity;

            var cyanGlowMat = GetOrCreateMaterial("CyanCoreGlow", new Color(0f, 0.9f, 1f), 0.8f, new Color(0f, 2.0f, 2.5f));

            var importedPrefab = LoadCharacterModelPrefab("Runner_Knight");
            if (importedPrefab != null)
            {
                var knight = (GameObject)Object.Instantiate(importedPrefab, root.transform);
                knight.name = "KnightMesh";
                knight.transform.localPosition = Vector3.zero;
                knight.transform.localRotation = Quaternion.identity;
                knight.transform.localScale = new Vector3(0.9f, 0.9f, 0.9f);

                // Add Aether Energy Aura Ring and glow light
                var aura = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                aura.name = "AetherAuraRing";
                aura.transform.parent = root.transform;
                aura.transform.localPosition = new Vector3(0, 0.05f, 0);
                aura.transform.localScale = new Vector3(1.1f, 0.02f, 1.1f);
                RemoveCollider(aura);
                aura.GetComponent<Renderer>().sharedMaterial = cyanGlowMat;

                var lightGo = new GameObject("AetherGlowLight");
                lightGo.transform.parent = root.transform;
                lightGo.transform.localPosition = new Vector3(0, 1.2f, 0);
                var l = lightGo.AddComponent<Light>();
                l.color = new Color(0f, 0.85f, 1f);
                l.intensity = 1.2f;
                l.range = 4f;

                var anim = root.AddComponent<LightweightCharacterAnimator>();
                anim.FindMeshAndAnimator();
                anim.AutoPopulateClips();

                EnsureCameraTarget(parent);
                return root;
            }

            var suitMat = GetOrCreateMaterial("RunnerSuit", new Color(0.11f, 0.15f, 0.22f), 0.4f);
            var armorMat = GetOrCreateMaterial("RunnerArmor", new Color(0.18f, 0.24f, 0.34f), 0.55f);
            var orangeVisorMat = GetOrCreateMaterial("OrangeVisor", new Color(1f, 0.5f, 0f), 0.9f, new Color(2.5f, 1.2f, 0.1f));
            var bootMat = GetOrCreateMaterial("RunnerBoots", new Color(0.14f, 0.14f, 0.18f), 0.3f);

            var animator = root.AddComponent<ProceduralCharacterAnimator>();

            // 1. Body Root (hips & pelvis)
            var bodyRoot = new GameObject("BodyRoot");
            bodyRoot.transform.parent = root.transform;
            bodyRoot.transform.localPosition = new Vector3(0, 0.88f, 0);
            animator.bodyRoot = bodyRoot.transform;

            // Pelvis
            var pelvis = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pelvis.name = "Pelvis";
            pelvis.transform.parent = bodyRoot.transform;
            pelvis.transform.localPosition = Vector3.zero;
            pelvis.transform.localScale = new Vector3(0.42f, 0.22f, 0.28f);
            RemoveCollider(pelvis);
            pelvis.GetComponent<Renderer>().sharedMaterial = suitMat;

            // Torso (athletic chestplate)
            var torso = GameObject.CreatePrimitive(PrimitiveType.Cube);
            torso.name = "Torso";
            torso.transform.parent = bodyRoot.transform;
            torso.transform.localPosition = new Vector3(0, 0.28f, 0);
            torso.transform.localScale = new Vector3(0.48f, 0.42f, 0.30f);
            RemoveCollider(torso);
            torso.GetComponent<Renderer>().sharedMaterial = armorMat;

            // Reactor Core on chest
            var core = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            core.name = "AetherCore";
            core.transform.parent = torso.transform;
            core.transform.localPosition = new Vector3(0, 0.05f, 0.52f);
            core.transform.localScale = new Vector3(0.28f, 0.28f, 0.22f);
            RemoveCollider(core);
            core.GetComponent<Renderer>().sharedMaterial = cyanGlowMat;

            // Core Light
            var coreLightGo = new GameObject("CoreLight");
            coreLightGo.transform.parent = core.transform;
            coreLightGo.transform.localPosition = Vector3.zero;
            var coreLight = coreLightGo.AddComponent<Light>();
            coreLight.color = new Color(0f, 0.85f, 1f);
            coreLight.intensity = 1.2f;
            coreLight.range = 3.5f;

            // 2. Head & Aero Helmet
            var head = new GameObject("Head");
            head.transform.parent = bodyRoot.transform;
            head.transform.localPosition = new Vector3(0, 0.62f, 0);
            animator.head = head.transform;

            var helmet = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            helmet.name = "Helmet";
            helmet.transform.parent = head.transform;
            helmet.transform.localPosition = Vector3.zero;
            helmet.transform.localScale = new Vector3(0.36f, 0.38f, 0.40f);
            RemoveCollider(helmet);
            helmet.GetComponent<Renderer>().sharedMaterial = armorMat;

            // Glowing Aero Visor
            var visor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            visor.name = "Visor";
            visor.transform.parent = head.transform;
            visor.transform.localPosition = new Vector3(0, 0.04f, 0.16f);
            visor.transform.localScale = new Vector3(0.32f, 0.14f, 0.14f);
            RemoveCollider(visor);
            visor.GetComponent<Renderer>().sharedMaterial = orangeVisorMat;

            // 3. Arms (left & right)
            animator.leftArm = CreateLimb(bodyRoot.transform, "LeftArm", new Vector3(-0.32f, 0.42f, 0), new Vector3(0.12f, 0.48f, 0.14f), suitMat, cyanGlowMat);
            animator.rightArm = CreateLimb(bodyRoot.transform, "RightArm", new Vector3(0.32f, 0.42f, 0), new Vector3(0.12f, 0.48f, 0.14f), suitMat, cyanGlowMat);

            // 4. Legs & Boots (left & right)
            animator.leftLeg = CreateLegWithBoot(root.transform, "LeftLeg", new Vector3(-0.16f, 0.78f, 0), suitMat, bootMat, cyanGlowMat);
            animator.rightLeg = CreateLegWithBoot(root.transform, "RightLeg", new Vector3(0.16f, 0.78f, 0), suitMat, bootMat, cyanGlowMat);

            return root;
        }

        // ==========================================
        // SABOTEUR CHARACTER
        // ==========================================

        public static GameObject BuildSaboteurVisuals(Transform parent)
        {
            var old = parent.Find("AvatarVisuals");
            if (old != null) SafeDestroy(old.gameObject);
            var oldMesh = parent.Find("SaboteurMesh");
            if (oldMesh != null) SafeDestroy(oldMesh.gameObject);

            var root = new GameObject("AvatarVisuals");
            root.transform.parent = parent;
            root.transform.localPosition = Vector3.zero;
            root.transform.localRotation = Quaternion.identity;

            var orangeGlowMat = GetOrCreateMaterial("AmberEnergyGlow", new Color(1f, 0.45f, 0f), 0.8f, new Color(2.5f, 1.1f, 0f));

            var importedPrefab = LoadCharacterModelPrefab("Saboteur_Rogue");
            if (importedPrefab != null)
            {
                var rogue = (GameObject)Object.Instantiate(importedPrefab, root.transform);
                rogue.name = "RogueMesh";
                rogue.transform.localPosition = Vector3.zero;
                rogue.transform.localRotation = Quaternion.identity;
                rogue.transform.localScale = new Vector3(0.9f, 0.9f, 0.9f);

                // Add Shadow Energy Aura
                var aura = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                aura.name = "ShadowAuraRing";
                aura.transform.parent = root.transform;
                aura.transform.localPosition = new Vector3(0, 0.05f, 0);
                aura.transform.localScale = new Vector3(1.1f, 0.02f, 1.1f);
                RemoveCollider(aura);
                aura.GetComponent<Renderer>().sharedMaterial = orangeGlowMat;

                var lightGo = new GameObject("ShadowGlowLight");
                lightGo.transform.parent = root.transform;
                lightGo.transform.localPosition = new Vector3(0, 1.2f, 0);
                var l = lightGo.AddComponent<Light>();
                l.color = new Color(1f, 0.4f, 0.05f);
                l.intensity = 1.2f;
                l.range = 4f;

                var anim = root.AddComponent<LightweightCharacterAnimator>();
                anim.FindMeshAndAnimator();
                anim.AutoPopulateClips();

                EnsureCameraTarget(parent);
                return root;
            }

            // ... procedural fallback ...

            var suitMat = GetOrCreateMaterial("SaboteurExosuit", new Color(0.14f, 0.14f, 0.16f), 0.35f);
            var armorMat = GetOrCreateMaterial("SaboteurPlating", new Color(0.20f, 0.20f, 0.24f), 0.6f);
            var redOpticMat = GetOrCreateMaterial("RedOptics", new Color(1f, 0.15f, 0.15f), 0.9f, new Color(3.0f, 0.3f, 0.3f));

            var animator = root.AddComponent<ProceduralCharacterAnimator>();

            // 1. Body Root
            var bodyRoot = new GameObject("BodyRoot");
            bodyRoot.transform.parent = root.transform;
            bodyRoot.transform.localPosition = new Vector3(0, 0.90f, 0);
            animator.bodyRoot = bodyRoot.transform;

            // Pelvis
            var pelvis = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pelvis.name = "Pelvis";
            pelvis.transform.parent = bodyRoot.transform;
            pelvis.transform.localPosition = Vector3.zero;
            pelvis.transform.localScale = new Vector3(0.46f, 0.24f, 0.32f);
            RemoveCollider(pelvis);
            pelvis.GetComponent<Renderer>().sharedMaterial = suitMat;

            // Heavy Torso
            var torso = GameObject.CreatePrimitive(PrimitiveType.Cube);
            torso.name = "Torso";
            torso.transform.parent = bodyRoot.transform;
            torso.transform.localPosition = new Vector3(0, 0.30f, 0);
            torso.transform.localScale = new Vector3(0.54f, 0.46f, 0.36f);
            RemoveCollider(torso);
            torso.GetComponent<Renderer>().sharedMaterial = armorMat;

            // Jetpack unit on back
            var jetpack = GameObject.CreatePrimitive(PrimitiveType.Cube);
            jetpack.name = "JetpackUnit";
            jetpack.transform.parent = torso.transform;
            jetpack.transform.localPosition = new Vector3(0, 0.05f, -0.65f);
            jetpack.transform.localScale = new Vector3(0.75f, 0.85f, 0.45f);
            RemoveCollider(jetpack);
            jetpack.GetComponent<Renderer>().sharedMaterial = suitMat;

            // Dual Thruster nozzles + flame
            CreateThruster(jetpack.transform, new Vector3(-0.35f, -0.45f, 0), orangeGlowMat, out var flameL);
            CreateThruster(jetpack.transform, new Vector3(0.35f, -0.45f, 0), orangeGlowMat, out var flameR);
            animator.jetpackFlame = flameL;

            // Jetpack light
            var jetLightGo = new GameObject("JetLight");
            jetLightGo.transform.parent = jetpack.transform;
            jetLightGo.transform.localPosition = new Vector3(0, -0.5f, 0);
            var jetLight = jetLightGo.AddComponent<Light>();
            jetLight.color = new Color(1f, 0.4f, 0f);
            jetLight.intensity = 1.6f;
            jetLight.range = 4.0f;

            // 2. Tactical Head
            var head = new GameObject("Head");
            head.transform.parent = bodyRoot.transform;
            head.transform.localPosition = new Vector3(0, 0.65f, 0);
            animator.head = head.transform;

            var helm = GameObject.CreatePrimitive(PrimitiveType.Cube);
            helm.name = "CombatHelm";
            helm.transform.parent = head.transform;
            helm.transform.localPosition = Vector3.zero;
            helm.transform.localScale = new Vector3(0.36f, 0.38f, 0.38f);
            RemoveCollider(helm);
            helm.GetComponent<Renderer>().sharedMaterial = armorMat;

            // Dual Red Optics
            var opticL = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            opticL.name = "Optic_L";
            opticL.transform.parent = head.transform;
            opticL.transform.localPosition = new Vector3(-0.09f, 0.04f, 0.18f);
            opticL.transform.localScale = new Vector3(0.09f, 0.09f, 0.09f);
            RemoveCollider(opticL);
            opticL.GetComponent<Renderer>().sharedMaterial = redOpticMat;

            var opticR = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            opticR.name = "Optic_R";
            opticR.transform.parent = head.transform;
            opticR.transform.localPosition = new Vector3(0.09f, 0.04f, 0.18f);
            opticR.transform.localScale = new Vector3(0.09f, 0.09f, 0.09f);
            RemoveCollider(opticR);
            opticR.GetComponent<Renderer>().sharedMaterial = redOpticMat;

            // 3. Arms (Deployer mechanical arm on right)
            animator.leftArm = CreateLimb(bodyRoot.transform, "LeftArm", new Vector3(-0.35f, 0.44f, 0), new Vector3(0.14f, 0.50f, 0.16f), suitMat, null);
            animator.rightArm = CreateDeployerArm(bodyRoot.transform, new Vector3(0.35f, 0.44f, 0), armorMat, orangeGlowMat);

            // 4. Legs
            animator.leftLeg = CreateLegWithBoot(root.transform, "LeftLeg", new Vector3(-0.18f, 0.80f, 0), suitMat, armorMat, orangeGlowMat);
            animator.rightLeg = CreateLegWithBoot(root.transform, "RightLeg", new Vector3(0.18f, 0.80f, 0), suitMat, armorMat, orangeGlowMat);

            // 5. Tactical Companion Drone orbiting shoulder
            CreateCompanionDrone(bodyRoot.transform, orangeGlowMat);

            return root;
        }

        // ==========================================
        // AI SABOTEUR CHARACTER (MAGE)
        // ==========================================

        public static GameObject BuildAISaboteurVisuals(Transform parent)
        {
            var old = parent.Find("AvatarVisuals");
            if (old != null) SafeDestroy(old.gameObject);
            var oldMesh = parent.Find("MageMesh");
            if (oldMesh != null) SafeDestroy(oldMesh.gameObject);

            var root = new GameObject("AvatarVisuals");
            root.transform.parent = parent;
            root.transform.localPosition = Vector3.zero;
            root.transform.localRotation = Quaternion.identity;

            var purpleGlowMat = GetOrCreateMaterial("ArcanePurpleGlow", new Color(0.7f, 0.2f, 1f), 0.8f, new Color(1.8f, 0.4f, 2.5f));

            var importedPrefab = LoadCharacterModelPrefab("AISaboteur_Mage");
            if (importedPrefab != null)
            {
                var mage = (GameObject)Object.Instantiate(importedPrefab, root.transform);
                mage.name = "MageMesh";
                mage.transform.localPosition = Vector3.zero;
                mage.transform.localRotation = Quaternion.identity;
                mage.transform.localScale = new Vector3(0.9f, 0.9f, 0.9f);

                // Add Arcane Aura Ring
                var aura = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                aura.name = "ArcaneAuraRing";
                aura.transform.parent = root.transform;
                aura.transform.localPosition = new Vector3(0, 0.05f, 0);
                aura.transform.localScale = new Vector3(1.1f, 0.02f, 1.1f);
                RemoveCollider(aura);
                aura.GetComponent<Renderer>().sharedMaterial = purpleGlowMat;

                var lightGo = new GameObject("ArcaneGlowLight");
                lightGo.transform.parent = root.transform;
                lightGo.transform.localPosition = new Vector3(0, 1.2f, 0);
                var l = lightGo.AddComponent<Light>();
                l.color = new Color(0.75f, 0.3f, 1f);
                l.intensity = 1.3f;
                l.range = 4.5f;

                var anim = root.AddComponent<LightweightCharacterAnimator>();
                anim.FindMeshAndAnimator();
                anim.AutoPopulateClips();

                EnsureCameraTarget(parent);
                return root;
            }

            return root;
        }

        // ==========================================
        // HELPERS
        // ==========================================

        private static Transform CreateLimb(Transform parent, string name, Vector3 localPos, Vector3 scale, Material mainMat, Material glowMat)
        {
            var pivot = new GameObject(name);
            pivot.transform.parent = parent;
            pivot.transform.localPosition = localPos;

            var mesh = GameObject.CreatePrimitive(PrimitiveType.Cube);
            mesh.transform.parent = pivot.transform;
            mesh.transform.localPosition = new Vector3(0, -scale.y / 2f, 0);
            mesh.transform.localScale = scale;
            RemoveCollider(mesh);
            mesh.GetComponent<Renderer>().sharedMaterial = mainMat;

            if (glowMat != null)
            {
                var bracer = GameObject.CreatePrimitive(PrimitiveType.Cube);
                bracer.name = "BracerGlow";
                bracer.transform.parent = mesh.transform;
                bracer.transform.localPosition = new Vector3(0, -0.2f, 0.52f);
                bracer.transform.localScale = new Vector3(1.05f, 0.35f, 0.3f);
                RemoveCollider(bracer);
                bracer.GetComponent<Renderer>().sharedMaterial = glowMat;
            }

            return pivot.transform;
        }

        private static Transform CreateDeployerArm(Transform parent, Vector3 localPos, Material armorMat, Material glowMat)
        {
            var pivot = new GameObject("RightDeployerArm");
            pivot.transform.parent = parent;
            pivot.transform.localPosition = localPos;

            var arm = GameObject.CreatePrimitive(PrimitiveType.Cube);
            arm.name = "ArmMesh";
            arm.transform.parent = pivot.transform;
            arm.transform.localPosition = new Vector3(0, -0.25f, 0);
            arm.transform.localScale = new Vector3(0.16f, 0.50f, 0.18f);
            RemoveCollider(arm);
            arm.GetComponent<Renderer>().sharedMaterial = armorMat;

            // Gauntlet projector emitter
            var emitter = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            emitter.name = "GauntletEmitter";
            emitter.transform.parent = arm.transform;
            emitter.transform.localPosition = new Vector3(0, -0.35f, 0.45f);
            emitter.transform.localRotation = Quaternion.Euler(90f, 0, 0);
            emitter.transform.localScale = new Vector3(0.7f, 0.2f, 0.7f);
            RemoveCollider(emitter);
            emitter.GetComponent<Renderer>().sharedMaterial = glowMat;

            return pivot.transform;
        }

        private static Transform CreateLegWithBoot(Transform parent, string name, Vector3 localPos, Material suitMat, Material bootMat, Material glowMat)
        {
            var pivot = new GameObject(name);
            pivot.transform.parent = parent;
            pivot.transform.localPosition = localPos;

            // Thigh & Calf
            var leg = GameObject.CreatePrimitive(PrimitiveType.Cube);
            leg.name = "LegMesh";
            leg.transform.parent = pivot.transform;
            leg.transform.localPosition = new Vector3(0, -0.32f, 0);
            leg.transform.localScale = new Vector3(0.18f, 0.64f, 0.20f);
            RemoveCollider(leg);
            leg.GetComponent<Renderer>().sharedMaterial = suitMat;

            // Sneaker / Boot
            var boot = GameObject.CreatePrimitive(PrimitiveType.Cube);
            boot.name = "Boot";
            boot.transform.parent = pivot.transform;
            boot.transform.localPosition = new Vector3(0, -0.72f, 0.06f);
            boot.transform.localScale = new Vector3(0.20f, 0.16f, 0.36f);
            RemoveCollider(boot);
            boot.GetComponent<Renderer>().sharedMaterial = bootMat;

            // Glowing Sole
            var sole = GameObject.CreatePrimitive(PrimitiveType.Cube);
            sole.name = "GlowingSole";
            sole.transform.parent = boot.transform;
            sole.transform.localPosition = new Vector3(0, -0.42f, 0);
            sole.transform.localScale = new Vector3(1.05f, 0.25f, 1.05f);
            RemoveCollider(sole);
            sole.GetComponent<Renderer>().sharedMaterial = glowMat;

            return pivot.transform;
        }

        private static void CreateThruster(Transform parent, Vector3 localPos, Material glowMat, out Transform flameTrans)
        {
            var nozzle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            nozzle.transform.parent = parent;
            nozzle.transform.localPosition = localPos;
            nozzle.transform.localScale = new Vector3(0.35f, 0.25f, 0.35f);
            RemoveCollider(nozzle);
            nozzle.GetComponent<Renderer>().sharedMaterial = glowMat;

            var flame = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            flame.name = "JetFlame";
            flame.transform.parent = nozzle.transform;
            flame.transform.localPosition = new Vector3(0, -0.7f, 0);
            flame.transform.localRotation = Quaternion.Euler(180f, 0, 0);
            flame.transform.localScale = new Vector3(0.8f, 0.7f, 0.8f);
            RemoveCollider(flame);
            flame.GetComponent<Renderer>().sharedMaterial = glowMat;

            flameTrans = flame.transform;
        }

        private static void CreateCompanionDrone(Transform parent, Material glowMat)
        {
            var drone = new GameObject("ReconDrone");
            drone.transform.parent = parent;
            drone.transform.localPosition = new Vector3(0.65f, 0.85f, -0.3f);
            drone.transform.localScale = Vector3.one * 0.28f;

            var body = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            body.transform.parent = drone.transform;
            body.transform.localPosition = Vector3.zero;
            body.transform.localScale = new Vector3(1.2f, 0.6f, 1.2f);
            RemoveCollider(body);
            var ren = body.GetComponent<Renderer>();
            ren.sharedMaterial = glowMat;

            var lightGo = new GameObject("DroneLight");
            lightGo.transform.parent = drone.transform;
            var l = lightGo.AddComponent<Light>();
            l.color = new Color(1f, 0.5f, 0f);
            l.intensity = 0.8f;
            l.range = 2.5f;
        }

        private static void RemoveCollider(GameObject go)
        {
            var c = go.GetComponent<Collider>();
            if (c != null) SafeDestroy(c);
        }
    }
}
