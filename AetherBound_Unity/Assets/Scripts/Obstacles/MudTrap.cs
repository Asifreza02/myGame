using UnityEngine;

namespace AetherBound
{
    public class MudTrap : ObstacleBase
    {
        [Header("Quagmire Settings")]
        public float slowFactor = 0.40f;
        public float slowDuration = 0.6f;

        private void Awake()
        {
            type = ObstacleType.Mud;
            isDestructible = false;

            var col = GetComponent<Collider>();
            if (col != null)
            {
                col.isTrigger = true;
            }
        }

        private void OnTriggerStay(Collider other)
        {
            if (other.TryGetComponent<RunnerController>(out var runner))
            {
                runner.ApplySlow(slowFactor, slowDuration);
                runner.isSprinting = false; // Disables sprint while wading through heavy mud
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (other.TryGetComponent<RunnerController>(out var runner))
            {
                runner.ApplySlow(slowFactor, slowDuration);
                runner.isSprinting = false;
            }
        }
    }
}
