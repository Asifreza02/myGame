using UnityEngine;

namespace AetherBound
{
    public class ExplosiveBarrel : ObstacleBase
    {
        [Header("Explosion Settings")]
        public float blastRadius = 9f;
        public float blastKnockback = 26f;
        public float proximityThreshold = 2.5f;

        private bool detonated = false;

        private void Awake()
        {
            type = ObstacleType.Barrel;
            maxHealth = 20f;
            health = 20f;
            isDestructible = true;
        }

        private void Update()
        {
            if (detonated) return;

            // Check proximity to Runner
            if (RunnerController.Instance != null)
            {
                float dist = Vector3.Distance(transform.position, RunnerController.Instance.transform.position);
                if (dist <= proximityThreshold)
                {
                    Detonate();
                }
            }
        }

        public override void TakeDamage(float amount, Vector3 knockbackImpulse, DamageType damageType = DamageType.Physical)
        {
            base.TakeDamage(amount, knockbackImpulse, damageType);
            if (health <= 0f && !detonated)
            {
                Detonate();
            }
        }

        public void Detonate()
        {
            if (detonated) return;
            detonated = true;

            Vector3 blastPos = transform.position;

            // Spawn explosion effect & sound
            if (ObstacleManager.Instance != null)
            {
                ObstacleManager.Instance.TriggerExplosion(blastPos, blastRadius, blastKnockback);
            }

            // Find all colliders in blast radius
            Collider[] hits = Physics.OverlapSphere(blastPos, blastRadius);
            foreach (var hit in hits)
            {
                if (hit.gameObject == gameObject) continue;

                // Runner
                if (hit.TryGetComponent<RunnerController>(out var runner))
                {
                    Vector3 dir = (runner.transform.position - blastPos);
                    float dist = dir.magnitude;
                    if (dist > 0.01f && dist <= blastRadius)
                    {
                        float falloff = 1f - (dist / blastRadius);
                        Vector3 impulse = (dir.normalized + Vector3.up * 0.8f).normalized * blastKnockback * falloff;
                        float dmg = Mathf.Round(Mathf.Max(25f, 65f * falloff));
                        runner.TakeDamage(dmg, impulse, DamageType.Explosion);
                    }
                }

                // Other obstacles (Walls, Barrels for chain reactions)
                if (hit.TryGetComponent<ObstacleBase>(out var obs))
                {
                    obs.TakeDamage(100f, Vector3.zero, DamageType.Explosion);
                }

                // Rigidbodies (Boulders, Debris)
                if (hit.TryGetComponent<Rigidbody>(out var rb))
                {
                    rb.AddExplosionForce(blastKnockback * 300f, blastPos, blastRadius, 2.5f);
                }
            }

            Die();
        }
    }
}
