using UnityEngine;

namespace AetherBound
{
    public enum DamageType
    {
        Physical,
        Spike,
        Explosion,
        Boulder,
        Hazard,
        Void
    }

    public interface IDamageable
    {
        void TakeDamage(float amount, Vector3 knockbackImpulse, DamageType damageType = DamageType.Physical);
    }
}
