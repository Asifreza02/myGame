using UnityEngine;

namespace AetherBound
{
    public class BarrierWall : ObstacleBase
    {
        private void Awake()
        {
            type = ObstacleType.Wall;
            maxHealth = 100f;
            health = 100f;
            isDestructible = true;
        }

        protected override void Die()
        {
            if (ObstacleManager.Instance != null)
            {
                ObstacleManager.Instance.EmitBreakParticles(transform.position + Vector3.up * 1.0f, new Color(0.48f, 0.52f, 0.56f));
            }
            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlayBoulderImpactSound();
            }
            base.Die();
        }
    }
}
