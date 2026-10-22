using System;
using UnityEngine;

namespace AetherBound
{
    public enum ObstacleState
    {
        Spawning,
        Active,
        Triggered,
        Destroyed
    }

    public class ObstacleBase : MonoBehaviour, IDamageable
    {
        [Header("Obstacle Stats")]
        public ObstacleType type;
        public float health = 100f;
        public float maxHealth = 100f;
        public bool isDestructible = true;

        public ObstacleState State { get; protected set; } = ObstacleState.Active;

        public event Action<ObstacleBase> OnDestroyed;
        public event Action<float, float> OnHealthChanged;

        public virtual void TakeDamage(float amount, Vector3 knockbackImpulse, DamageType damageType = DamageType.Physical)
        {
            if (!isDestructible || State == ObstacleState.Destroyed) return;

            health = Mathf.Max(0f, health - amount);
            OnHealthChanged?.Invoke(health, maxHealth);

            if (health <= 0f)
            {
                Die();
            }
        }

        public void TakeDamage(float amount)
        {
            TakeDamage(amount, Vector3.zero, DamageType.Physical);
        }

        protected virtual void Die()
        {
            if (State == ObstacleState.Destroyed) return;
            State = ObstacleState.Destroyed;

            OnDestroyed?.Invoke(this);
            if (Application.isPlaying)
                Destroy(gameObject);
            else
                DestroyImmediate(gameObject);
        }
    }
}
