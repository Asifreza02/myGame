using System;
using UnityEngine;
using UnityEngine.Playables;
using UnityEngine.Animations;

namespace AetherBound
{
    /// <summary>
    /// High-performance, zero-GC character animation controller.
    /// Blends skeletal AnimationClips via PlayableGraph with dynamic procedural banking,
    /// landing cushion squash/stretch, and slide posture.
    /// </summary>
    public class LightweightCharacterAnimator : MonoBehaviour
    {
        [Header("Animation Clips (Generic / Humanoid)")]
        public AnimationClip idleClip;
        public AnimationClip runClip;
        public AnimationClip sprintClip;
        public AnimationClip jumpClip;
        public AnimationClip slideClip;

        [Header("Dynamic Procedural Tuning")]
        public float bankAmount = 12.0f;
        public float forwardLeanAmount = 10.0f;
        public float squashAmount = 0.14f;
        public float stretchAmount = 0.16f;

        private Animator animator;
        private CharacterController controller;
        private Transform meshRoot;
        private Vector3 baseMeshScale = Vector3.one;
        private Vector3 baseMeshLocalPos = Vector3.zero;

        private PlayableGraph playableGraph;
        private AnimationMixerPlayable mixerPlayable;
        private AnimationClipPlayable idlePlayable;
        private AnimationClipPlayable runPlayable;
        private AnimationClipPlayable jumpPlayable;
        private AnimationClipPlayable slidePlayable;
        private bool hasValidGraph = false;

        // Current blended weights
        private float weightIdle = 1f;
        private float weightRun = 0f;
        private float weightJump = 0f;
        private float weightSlide = 0f;

        // Secondary motion state
        private float currentBank = 0f;
        private float currentLean = 0f;
        private float landingCushion = 0f;
        private float jumpStretch = 0f;
        private bool wasGrounded = true;
        private Vector3 prevForward = Vector3.forward;
        private Vector3 prevPos;
        private float proceduralCycle = 0f;

        private void Awake()
        {
            controller = GetComponentInParent<CharacterController>();
            FindMeshAndAnimator();
        }

        private void Start()
        {
            FindMeshAndAnimator();
            AutoPopulateClips();
            SetupPlayableGraph();
            prevPos = transform.position;
            prevForward = transform.forward;
        }

        public void FindMeshAndAnimator()
        {
            if (meshRoot == null)
            {
                var knight = transform.Find("KnightMesh") ?? transform.Find("RogueMesh") ?? transform.Find("MageMesh");
                if (knight != null)
                {
                    meshRoot = knight;
                }
                else if (transform.childCount > 0)
                {
                    meshRoot = transform.GetChild(0);
                }
                else
                {
                    meshRoot = transform;
                }

                baseMeshScale = meshRoot.localScale;
                baseMeshLocalPos = meshRoot.localPosition;
            }

            if (animator == null)
            {
                animator = GetComponentInChildren<Animator>();
                if (animator == null && meshRoot != null)
                {
                    animator = meshRoot.gameObject.AddComponent<Animator>();
                }
            }
        }

        public void AutoPopulateClips()
        {
#if UNITY_EDITOR
            if (idleClip == null || runClip == null)
            {
                string searchFbx = null;
                if (name.Contains("Knight") || (meshRoot != null && meshRoot.name.Contains("Knight")))
                    searchFbx = "Assets/Art/KayKit_Characters/Knight.fbx";
                else if (name.Contains("Rogue") || (meshRoot != null && meshRoot.name.Contains("Rogue")))
                    searchFbx = "Assets/Art/KayKit_Characters/RogueHooded.fbx";
                else if (name.Contains("Mage") || (meshRoot != null && meshRoot.name.Contains("Mage")))
                    searchFbx = "Assets/Art/KayKit_Characters/Mage.fbx";
                else
                    searchFbx = "Assets/Art/KayKit_Characters/Knight.fbx";

                var assets = UnityEditor.AssetDatabase.LoadAllAssetsAtPath(searchFbx);
                foreach (var a in assets)
                {
                    if (a is AnimationClip clip)
                    {
                        if (clip.name == "Idle" && idleClip == null) idleClip = clip;
                        else if (clip.name == "Running_A" && runClip == null) runClip = clip;
                        else if (clip.name == "Running_B" && sprintClip == null) sprintClip = clip;
                        else if (clip.name == "Jump_Start" && jumpClip == null) jumpClip = clip;
                        else if (clip.name == "Dodge_Forward" && slideClip == null) slideClip = clip;
                    }
                }
            }
#endif
        }

        private void SetupPlayableGraph()
        {
            if (animator == null) return;
            if (idleClip == null && runClip == null) return;

            if (playableGraph.IsValid())
            {
                playableGraph.Destroy();
            }

            playableGraph = PlayableGraph.Create($"CharGraph_{gameObject.name}");
            playableGraph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);

            var playableOutput = AnimationPlayableOutput.Create(playableGraph, "Animation", animator);
            mixerPlayable = AnimationMixerPlayable.Create(playableGraph, 4);
            playableOutput.SetSourcePlayable(mixerPlayable);

            // 0: Idle
            if (idleClip != null)
            {
                idlePlayable = AnimationClipPlayable.Create(playableGraph, idleClip);
                playableGraph.Connect(idlePlayable, 0, mixerPlayable, 0);
                mixerPlayable.SetInputWeight(0, 1.0f);
            }

            // 1: Run
            if (runClip != null)
            {
                runPlayable = AnimationClipPlayable.Create(playableGraph, runClip);
                playableGraph.Connect(runPlayable, 0, mixerPlayable, 1);
                mixerPlayable.SetInputWeight(1, 0.0f);
            }

            // 2: Jump
            if (jumpClip != null)
            {
                jumpPlayable = AnimationClipPlayable.Create(playableGraph, jumpClip);
                playableGraph.Connect(jumpPlayable, 0, mixerPlayable, 2);
                mixerPlayable.SetInputWeight(2, 0.0f);
            }

            // 3: Slide / Dodge
            if (slideClip != null)
            {
                slidePlayable = AnimationClipPlayable.Create(playableGraph, slideClip);
                playableGraph.Connect(slidePlayable, 0, mixerPlayable, 3);
                mixerPlayable.SetInputWeight(3, 0.0f);
            }

            playableGraph.Play();
            hasValidGraph = true;
        }

        private void Update()
        {
            Vector3 vel = (controller != null) ? controller.velocity : (transform.position - prevPos) / Mathf.Max(0.001f, Time.deltaTime);
            prevPos = transform.position;

            float horizontalSpeed = new Vector2(vel.x, vel.z).magnitude;
            bool isGrounded = (controller != null) ? controller.isGrounded : true;

            var runner = GetComponentInParent<RunnerController>();
            bool isSliding = (runner != null) && runner.isSliding;

            // Landing cushion & jump stretch
            if (isGrounded && !wasGrounded)
            {
                landingCushion = -squashAmount; // Impact cushion
            }
            else if (!isGrounded && wasGrounded && vel.y > 1.0f)
            {
                jumpStretch = stretchAmount; // Upward launch stretch
            }
            wasGrounded = isGrounded;

            landingCushion = Mathf.Lerp(landingCushion, 0f, Time.deltaTime * 14f);
            jumpStretch = Mathf.Lerp(jumpStretch, 0f, Time.deltaTime * 12f);

            // Update skeletal mixer or procedural fallback
            if (hasValidGraph && mixerPlayable.IsValid())
            {
                UpdateGraphWeights(horizontalSpeed, isGrounded, isSliding);
            }
            else
            {
                UpdateProceduralMotion(horizontalSpeed, isGrounded, isSliding);
            }

            // Secondary physics: Dynamic banking into turns & forward speed lean
            UpdateSecondaryProceduralPostures(vel, horizontalSpeed, isSliding);
        }

        private void UpdateGraphWeights(float speed, bool isGrounded, bool isSliding)
        {
            float targetIdle = 0f;
            float targetRun = 0f;
            float targetJump = 0f;
            float targetSlide = 0f;

            if (isSliding)
            {
                targetSlide = 1.0f;
            }
            else if (!isGrounded)
            {
                targetJump = 1.0f;
            }
            else if (speed > 0.4f)
            {
                float runFactor = Mathf.Clamp01(speed / 12f);
                targetRun = runFactor;
                targetIdle = 1.0f - runFactor;

                // Dynamically pace leg animation with character speed
                if (runPlayable.IsValid())
                {
                    float animSpeed = Mathf.Clamp(speed / 11f, 0.8f, 1.85f);
                    runPlayable.SetSpeed(animSpeed);
                }
            }
            else
            {
                targetIdle = 1.0f;
            }

            float blendSpeed = Time.deltaTime * 14f;
            weightIdle = Mathf.MoveTowards(weightIdle, targetIdle, blendSpeed);
            weightRun = Mathf.MoveTowards(weightRun, targetRun, blendSpeed);
            weightJump = Mathf.MoveTowards(weightJump, targetJump, blendSpeed);
            weightSlide = Mathf.MoveTowards(weightSlide, targetSlide, blendSpeed);

            mixerPlayable.SetInputWeight(0, weightIdle);
            mixerPlayable.SetInputWeight(1, weightRun);
            mixerPlayable.SetInputWeight(2, weightJump);
            mixerPlayable.SetInputWeight(3, weightSlide);
        }

        private void UpdateProceduralMotion(float speed, bool isGrounded, bool isSliding)
        {
            if (meshRoot == null) return;

            if (speed > 0.4f && isGrounded)
            {
                proceduralCycle += Time.deltaTime * speed * 1.2f;
                float verticalBounce = Mathf.Abs(Mathf.Cos(proceduralCycle)) * 0.10f;
                float hipSway = Mathf.Sin(proceduralCycle) * 3.5f;

                meshRoot.localPosition = baseMeshLocalPos + new Vector3(0, verticalBounce + landingCushion, 0);
                meshRoot.localRotation = Quaternion.Euler(currentLean, hipSway, currentBank);
            }
            else
            {
                proceduralCycle = 0f;
                float idleBreathing = Mathf.Sin(Time.time * 2.4f) * 0.025f;
                meshRoot.localPosition = baseMeshLocalPos + new Vector3(0, idleBreathing + landingCushion, 0);
                meshRoot.localRotation = Quaternion.Euler(currentLean, 0, currentBank);
            }
        }

        private void UpdateSecondaryProceduralPostures(Vector3 vel, float speed, bool isSliding)
        {
            if (meshRoot == null) return;

            // Bank tilt into turns
            Vector3 currentFwd = transform.forward;
            float turnDelta = Vector3.SignedAngle(prevForward, currentFwd, Vector3.up);
            prevForward = currentFwd;

            float targetBank = Mathf.Clamp(-turnDelta * 4.5f, -bankAmount, bankAmount);
            currentBank = Mathf.Lerp(currentBank, targetBank, Time.deltaTime * 12f);

            // Forward speed lean
            float targetLean = isSliding ? -22f : Mathf.Clamp((speed / 14f) * forwardLeanAmount, 0f, forwardLeanAmount);
            currentLean = Mathf.Lerp(currentLean, targetLean, Time.deltaTime * 10f);

            meshRoot.localRotation = Quaternion.Euler(currentLean, 0, currentBank);

            // Squash & stretch kinetic scaling
            float stretchFactor = 1.0f + jumpStretch + landingCushion * 0.75f;
            float squashFactor = 1.0f / Mathf.Sqrt(Mathf.Max(0.5f, stretchFactor));

            meshRoot.localScale = new Vector3(baseMeshScale.x * squashFactor, baseMeshScale.y * stretchFactor, baseMeshScale.z * squashFactor);
        }

        private void OnDestroy()
        {
            if (playableGraph.IsValid())
            {
                playableGraph.Destroy();
            }
        }
    }
}
