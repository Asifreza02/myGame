using UnityEngine;

namespace AetherBound
{
    public class ProceduralCharacterAnimator : MonoBehaviour
    {
        [Header("Hierarchy Targets")]
        public Transform bodyRoot;
        public Transform head;
        public Transform leftArm;
        public Transform rightArm;
        public Transform leftLeg;
        public Transform rightLeg;
        public Transform jetpackFlame;

        [Header("Animation Tuning")]
        public float strideFrequency = 11.0f;
        public float strideAngle = 36.0f;
        public float armSwingAngle = 32.0f;
        public float bankTiltAmount = 14.0f;
        public float forwardLeanAmount = 12.0f;

        private CharacterController controller;
        private Vector3 prevPosition;
        private float strideCycle = 0f;
        private float currentBank = 0f;
        private float currentLean = 0f;
        private float baseBodyY = 0f;
        private Vector3 baseScale = Vector3.one;

        private bool wasGroundedLastFrame = true;
        private float landingCushion = 0f;
        private float jumpStretch = 0f;

        private void Start()
        {
            controller = GetComponentInParent<CharacterController>();
            prevPosition = transform.position;

            if (bodyRoot == null)
            {
                // Auto-detect imported 3D mesh (Knight, Rogue, Mage)
                var meshTransform = transform.Find("KnightMesh") ?? transform.Find("RogueMesh") ?? transform.Find("MageMesh");
                if (meshTransform == null && transform.childCount > 0)
                {
                    meshTransform = transform.GetChild(0);
                }
                bodyRoot = meshTransform;
            }

            if (bodyRoot != null)
            {
                baseBodyY = bodyRoot.localPosition.y;
                baseScale = bodyRoot.localScale;
            }
        }

        private void Update()
        {
            Vector3 worldVel;
            if (controller != null)
            {
                worldVel = controller.velocity;
            }
            else
            {
                worldVel = (transform.position - prevPosition) / Mathf.Max(0.001f, Time.deltaTime);
                prevPosition = transform.position;
            }

            Vector3 localVel = transform.InverseTransformDirection(worldVel);
            float horizontalSpeed = new Vector2(localVel.x, localVel.z).magnitude;
            bool isGrounded = (controller != null) ? controller.isGrounded : true;

            // Dynamic jump launch stretch & landing cushion
            if (isGrounded && !wasGroundedLastFrame)
            {
                landingCushion = -0.16f; // Cushion squash upon impact
            }
            else if (!isGrounded && wasGroundedLastFrame && worldVel.y > 1.2f)
            {
                jumpStretch = 0.16f; // Stretch upward on jump launch
            }
            wasGroundedLastFrame = isGrounded;

            landingCushion = Mathf.Lerp(landingCushion, 0f, Time.deltaTime * 12f);
            jumpStretch = Mathf.Lerp(jumpStretch, 0f, Time.deltaTime * 10f);

            // Squash & stretch deformation
            if (bodyRoot != null)
            {
                float stretchY = 1.0f + jumpStretch + landingCushion * 0.75f;
                float squashXZ = 1.0f / Mathf.Sqrt(Mathf.Max(0.4f, stretchY));
                bodyRoot.localScale = new Vector3(baseScale.x * squashXZ, baseScale.y * stretchY, baseScale.z * squashXZ);
            }

            // Check if sliding
            var runner = GetComponentInParent<RunnerController>();
            bool isSliding = runner != null && runner.isSliding;

            if (isSliding)
            {
                AnimateSlide();
            }
            else if (horizontalSpeed > 0.4f && isGrounded)
            {
                AnimateLocomotion(horizontalSpeed, localVel);
            }
            else
            {
                AnimateIdle(isGrounded);
            }

            // Jetpack flame pulse (for saboteur)
            if (jetpackFlame != null)
            {
                float flameScale = 0.8f + Mathf.Sin(Time.time * 24f) * 0.35f;
                jetpackFlame.localScale = new Vector3(0.35f, flameScale * 0.6f, 0.35f);
            }
        }

        private void AnimateLocomotion(float speed, Vector3 localVel)
        {
            strideCycle += Time.deltaTime * speed * (strideFrequency / 10f);

            float legAngle = Mathf.Sin(strideCycle) * strideAngle;
            float armAngle = -Mathf.Sin(strideCycle) * armSwingAngle;

            // Running vertical bounce
            float bounce = Mathf.Abs(Mathf.Cos(strideCycle)) * 0.12f;

            if (bodyRoot != null)
            {
                // Bank into turning and lean forward with speed
                float targetBank = -localVel.x * bankTiltAmount * 0.1f;
                float targetLean = Mathf.Clamp(localVel.z * forwardLeanAmount * 0.08f, -5f, 25f);

                currentBank = Mathf.Lerp(currentBank, targetBank, Time.deltaTime * 10f);
                currentLean = Mathf.Lerp(currentLean, targetLean, Time.deltaTime * 10f);

                bodyRoot.localPosition = new Vector3(0, baseBodyY + bounce + landingCushion, 0);
                bodyRoot.localRotation = Quaternion.Euler(currentLean, 0, currentBank);
            }

            // Leg articulation
            if (leftLeg != null) leftLeg.localRotation = Quaternion.Euler(legAngle, 0, 0);
            if (rightLeg != null) rightLeg.localRotation = Quaternion.Euler(-legAngle, 0, 0);

            // Arm counter-swing
            if (leftArm != null) leftArm.localRotation = Quaternion.Euler(armAngle, 0, 0);
            if (rightArm != null) rightArm.localRotation = Quaternion.Euler(-armAngle, 0, 0);

            // Head stabilization
            if (head != null)
            {
                head.localRotation = Quaternion.Euler(-currentLean * 0.5f, 0, -currentBank * 0.5f);
            }
        }

        private void AnimateIdle(bool isGrounded)
        {
            strideCycle = 0f;
            currentBank = Mathf.Lerp(currentBank, 0f, Time.deltaTime * 8f);
            currentLean = Mathf.Lerp(currentLean, 0f, Time.deltaTime * 8f);

            float idleBob = Mathf.Sin(Time.time * 2.2f) * 0.035f;

            if (bodyRoot != null)
            {
                bodyRoot.localPosition = new Vector3(0, baseBodyY + idleBob + landingCushion, 0);
                bodyRoot.localRotation = Quaternion.Euler(currentLean, 0, currentBank);
            }

            // Return limbs smoothly to rest
            if (leftLeg != null) leftLeg.localRotation = Quaternion.Slerp(leftLeg.localRotation, Quaternion.identity, Time.deltaTime * 8f);
            if (rightLeg != null) rightLeg.localRotation = Quaternion.Slerp(rightLeg.localRotation, Quaternion.identity, Time.deltaTime * 8f);
            if (leftArm != null) leftArm.localRotation = Quaternion.Slerp(leftArm.localRotation, Quaternion.Euler(0, 0, -5f), Time.deltaTime * 8f);
            if (rightArm != null) rightArm.localRotation = Quaternion.Slerp(rightArm.localRotation, Quaternion.Euler(0, 0, 5f), Time.deltaTime * 8f);
            if (head != null) head.localRotation = Quaternion.Slerp(head.localRotation, Quaternion.identity, Time.deltaTime * 8f);
        }

        private void AnimateSlide()
        {
            if (bodyRoot != null)
            {
                // Low slide posture leaning backward
                bodyRoot.localPosition = new Vector3(0, baseBodyY * 0.45f, -0.3f);
                bodyRoot.localRotation = Quaternion.Euler(-25f, 0, 0);
            }

            // Legs stretched forward
            if (leftLeg != null) leftLeg.localRotation = Quaternion.Euler(60f, -10f, 0);
            if (rightLeg != null) rightLeg.localRotation = Quaternion.Euler(75f, 10f, 0);

            // Arms stabilizing behind
            if (leftArm != null) leftArm.localRotation = Quaternion.Euler(-45f, 0, -20f);
            if (rightArm != null) rightArm.localRotation = Quaternion.Euler(-45f, 0, 20f);
        }
    }
}
