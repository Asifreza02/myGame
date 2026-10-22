using UnityEngine;

namespace AetherBound
{
    public enum LiquidType
    {
        Water,
        Lava
    }

    public class WaterHazard : MonoBehaviour
    {
        public LiquidType liquidType = LiquidType.Water;
        public float slowFactor = 0.65f;
        public float lavaDamagePerSecond = 20.0f;

        private float lavaDamageTimer = 0f;

        private void Awake()
        {
            int hazardLayer = LayerMask.NameToLayer("Hazard");
            if (hazardLayer != -1) gameObject.layer = hazardLayer;
        }

        private void OnTriggerStay(Collider other)
        {
            var runner = other.GetComponent<RunnerController>();
            if (runner != null)
            {
                if (liquidType == LiquidType.Water)
                {
                    // Wading through water slows the runner slightly
                    runner.ApplySlow(slowFactor, 0.25f);
                }
                else if (liquidType == LiquidType.Lava)
                {
                    // Wading into molten lava deals hazard burn damage!
                    lavaDamageTimer += Time.deltaTime;
                    if (lavaDamageTimer >= 0.5f)
                    {
                        lavaDamageTimer = 0f;
                        runner.TakeDamage(lavaDamagePerSecond * 0.5f, Vector3.up * 4.0f);
                    }
                }
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            var runner = other.GetComponent<RunnerController>();
            if (runner != null)
            {
                if (liquidType == LiquidType.Water)
                {
                    if (AudioManager.Instance != null)
                    {
                        // Water splash tone
                        AudioManager.Instance.PlaySlideSound();
                    }
                }
                else if (liquidType == LiquidType.Lava)
                {
                    runner.TakeDamage(10.0f, Vector3.up * 6.0f);
                    if (AudioManager.Instance != null)
                    {
                        AudioManager.Instance.PlayExplosionSound();
                    }
                }
            }
        }
    }
}
