using UnityEngine;

namespace AetherBound
{
    public class SpikeBarricade : ObstacleBase
    {
        [Header("Spike Properties")]
        public float damage = 30f;
        public float knockbackForce = 15f;
        public float slowFactor = 0.5f;
        public float slowDuration = 2.0f;
        public float springCooldown = 1.2f;

        private float lastTriggerTime = -999f;
        private Transform spikeMeshTransform;
        private Vector3 initialSpikeLocalPos;

        private void Awake()
        {
            type = ObstacleType.Spikes;
            maxHealth = 60f;
            health = 60f;
            isDestructible = true;

            spikeMeshTransform = transform.Find("Visual") ?? transform;
            initialSpikeLocalPos = spikeMeshTransform.localPosition;

            // Ensure there is a trigger volume for Runner detection
            var col = GetComponent<Collider>();
            if (col == null)
            {
                var box = gameObject.AddComponent<BoxCollider>();
                box.size = new Vector3(2.4f, 1.2f, 2.4f);
                box.center = new Vector3(0, 0.6f, 0);
                box.isTrigger = true;
            }
            else
            {
                // If it already has a collider, add a secondary trigger volume if not already trigger
                if (!col.isTrigger)
                {
                    var triggerBox = gameObject.AddComponent<BoxCollider>();
                    triggerBox.size = new Vector3(col.bounds.size.x + 0.4f, col.bounds.size.y + 0.4f, col.bounds.size.z + 0.4f);
                    triggerBox.center = new Vector3(0, col.bounds.size.y * 0.5f, 0);
                    triggerBox.isTrigger = true;
                }
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            TrySpringSpikes(other.gameObject);
        }

        private void OnTriggerStay(Collider other)
        {
            TrySpringSpikes(other.gameObject);
        }

        private void OnCollisionEnter(Collision collision)
        {
            TrySpringSpikes(collision.gameObject);
        }

        public void TrySpringSpikes(GameObject target)
        {
            if (Time.time - lastTriggerTime < springCooldown) return;

            if (target.TryGetComponent<RunnerController>(out var runner))
            {
                lastTriggerTime = Time.time;

                Vector3 knockDir = (runner.transform.position - transform.position);
                knockDir.y = 0;
                if (knockDir.sqrMagnitude < 0.01f) knockDir = -transform.forward;
                else knockDir.Normalize();
                knockDir.y = 0.45f;

                runner.TakeDamage(damage, knockDir * knockbackForce, DamageType.Spike);
                runner.ApplySlow(slowFactor, slowDuration);

                if (AudioManager.Instance != null)
                {
                    AudioManager.Instance.PlaySpikesSound();
                }

                // Spring animation
                StartCoroutine(AnimateSpikeSpring());

                // Self-inflict wear damage
                TakeDamage(15f, Vector3.zero, DamageType.Physical);
            }
        }

        private System.Collections.IEnumerator AnimateSpikeSpring()
        {
            float elapsed = 0f;
            float duration = 0.35f;
            Vector3 popPos = initialSpikeLocalPos + Vector3.up * 0.4f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                if (spikeMeshTransform != null)
                {
                    spikeMeshTransform.localPosition = Vector3.Lerp(popPos, initialSpikeLocalPos, t);
                }
                yield return null;
            }

            if (spikeMeshTransform != null)
            {
                spikeMeshTransform.localPosition = initialSpikeLocalPos;
            }
        }

        protected override void Die()
        {
            if (ObstacleManager.Instance != null)
            {
                ObstacleManager.Instance.EmitBreakParticles(transform.position + Vector3.up * 0.4f, new Color(0.6f, 0.2f, 0.2f));
            }
            base.Die();
        }
    }
}
