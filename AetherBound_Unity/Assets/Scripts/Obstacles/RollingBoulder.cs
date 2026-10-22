using UnityEngine;

namespace AetherBound
{
    [RequireComponent(typeof(Rigidbody))]
    public class RollingBoulder : ObstacleBase
    {
        [Header("Kinetic Boulder Properties")]
        public float rollForce = 24f;
        public float hitDamage = 40f;
        public float knockback = 24f;
        public float maxLifetime = 16f;

        private Rigidbody rb;
        private float spawnTime;

        private void Awake()
        {
            type = ObstacleType.Boulder;
            maxHealth = 200f;
            health = 200f;
            isDestructible = true;

            rb = GetComponent<Rigidbody>();
            rb.mass = 450f;
            rb.interpolation = RigidbodyInterpolation.Interpolate;
            rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

            spawnTime = Time.time;
        }

        private void Start()
        {
            // Give initial kinetic forward impulse along roll orientation
            rb.AddForce(transform.forward * rollForce, ForceMode.VelocityChange);
        }

        private void Update()
        {
            if (Time.time - spawnTime > maxLifetime)
            {
                Die();
            }
        }

        private void OnCollisionEnter(Collision collision)
        {
            // 1. Hit Runner
            if (collision.gameObject.TryGetComponent<RunnerController>(out var runner))
            {
                Vector3 knockDir = (runner.transform.position - transform.position).normalized;
                knockDir.y = 0.5f;
                runner.TakeDamage(hitDamage, knockDir * knockback, DamageType.Boulder);

                if (AudioManager.Instance != null)
                {
                    AudioManager.Instance.PlayBoulderImpactSound();
                }

                TakeDamage(50f, Vector3.zero, DamageType.Physical);
            }

            // 2. Smash Barrier Wall
            if (collision.gameObject.TryGetComponent<BarrierWall>(out var wall))
            {
                wall.TakeDamage(100f, transform.forward * 10f, DamageType.Boulder);
                TakeDamage(60f, Vector3.zero, DamageType.Physical);

                if (AudioManager.Instance != null)
                {
                    AudioManager.Instance.PlayBoulderImpactSound();
                }
            }

            // 3. Hit Explosive Barrel -> detonate barrel immediately
            if (collision.gameObject.TryGetComponent<ExplosiveBarrel>(out var barrel))
            {
                barrel.Detonate();
            }
        }

        protected override void Die()
        {
            if (ObstacleManager.Instance != null)
            {
                ObstacleManager.Instance.EmitBreakParticles(transform.position, new Color(0.42f, 0.38f, 0.34f));
            }
            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlayBoulderImpactSound();
            }
            base.Die();
        }
    }
}
