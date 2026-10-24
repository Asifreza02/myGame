using System;
using UnityEngine;

namespace AetherBound
{
    public enum PlayerRole
    {
        Runner,
        Saboteur
    }

    public enum GameState
    {
        RoleSelect,
        Playing,
        GameOver
    }

    public enum ObstacleType
    {
        Wall,
        Mud,
        Spikes,
        Boulder,
        Barrel
    }

    public enum PowerUpType
    {
        Speed,
        Jump,
        Shield,
        Health
    }

    public enum BiomeType
    {
        Lush,
        Desert,
        Snow,
        Volcanic
    }

    [System.Serializable]
    public class ObstacleDefinition
    {
        public ObstacleType type;
        public string name;
        public int cost;
        public string icon;
        public string description;
        public Vector3 size;
        public Color previewColor;
        public float durability = 100f;
        public float slowFactor = 0.35f;
        public float knockback = 15f;
        public float blastRadius = 9f;
        public float blastKnockback = 26f;
    }

    public static class GameConfig
    {
        public const float RoundDuration = 90f; // seconds

        // World settings (2km radius field with ridges, ultra-optimized & static)
        public const float WorldRadius = 2000.0f; // 2km radius
        public const int ChunkSize = 200; // 200m x 200m chunks
        public const int ChunkSegments = 16; // 16x16 quads (low poly, zero lag)
        public const int MinChunkX = -10;
        public const int MaxChunkX = 9;
        public const int MinChunkZ = -10;
        public const int MaxChunkZ = 9;
        public const int RenderDistance = 6;
        public const float BaseHeightScale = 1.0f;
        public const float NoiseScale = 0.0018f;
        public const float WaterLevel = -100.0f; // No water inside field

        // 2km Bounded Arena Limits
        public const float ArenaMinX = -2000.0f;
        public const float ArenaMaxX = 2000.0f;
        public const float ArenaMinZ = -2000.0f;
        public const float ArenaMaxZ = 2000.0f;

        // Runner settings
        public const float RunnerBaseSpeed = 14.0f;
        public const float RunnerSprintSpeed = 22.0f;
        public const float RunnerJumpForce = 11.0f;
        public const float RunnerGravity = 24.0f;
        public const float RunnerMaxStamina = 100.0f;
        public const float RunnerStaminaDrain = 25.0f;
        public const float RunnerStaminaRecovery = 18.0f;
        public const float RunnerHeight = 1.8f;
        public const float RunnerSlideHeight = 0.9f;
        public const float RunnerSlideBurst = 1.35f;
        public const float RunnerSlideDuration = 0.75f;
        public const float RunnerVaultMinHeight = 0.7f;
        public const float RunnerVaultMaxHeight = 2.3f;
        public const float RunnerMaxHealth = 100.0f;

        // Saboteur settings
        public const float SaboteurMaxEnergy = 100.0f;
        public const float SaboteurEnergyRegen = 6.0f;
        public const float SaboteurMaxPlacementDist = 55.0f;
        public const float SaboteurMinPlacementDist = 3.0f;
        public const float SaboteurReconCooldown = 14.0f;
        public const float SaboteurReconDuration = 6.0f;

        // Goal settings (centered along North ridge watchtower at 800m)
        public const float GoalRadius = 5.0f;
        public const float GoalSanctuaryRadius = 12.0f;
        public const float GoalDefaultX = 0.0f;
        public const float GoalDefaultZ = 800.0f;
        public const float GoalDefaultDistance = 800.0f;

        public static ObstacleDefinition GetObstacleDef(ObstacleType type)
        {
            switch (type)
            {
                case ObstacleType.Wall:
                    return new ObstacleDefinition
                    {
                        type = ObstacleType.Wall,
                        name = "Barrier Wall",
                        cost = 25,
                        icon = "🧱",
                        description = "Solid concrete wall blocking Runner progression. Destructible.",
                        size = new Vector3(8f, 4f, 1.5f),
                        previewColor = new Color(0.53f, 0.6f, 0.67f),
                        durability = 100f
                    };
                case ObstacleType.Mud:
                    return new ObstacleDefinition
                    {
                        type = ObstacleType.Mud,
                        name = "Tar / Mud Trap",
                        cost = 20,
                        icon = "🧪",
                        description = "Sticky swamp zone slowing Runner by 65%.",
                        size = new Vector3(7f, 0.3f, 7f),
                        previewColor = new Color(0.24f, 0.15f, 0.08f),
                        slowFactor = 0.35f
                    };
                case ObstacleType.Spikes:
                    return new ObstacleDefinition
                    {
                        type = ObstacleType.Spikes,
                        name = "Spike Barricade",
                        cost = 35,
                        icon = "⚡",
                        description = "Sharp barricade dealing 20 damage and strong knockback.",
                        size = new Vector3(6f, 2.2f, 2f),
                        previewColor = new Color(0.8f, 0.2f, 0.2f),
                        knockback = 15f,
                        durability = 60f
                    };
                case ObstacleType.Boulder:
                    return new ObstacleDefinition
                    {
                        type = ObstacleType.Boulder,
                        name = "Rolling Boulder",
                        cost = 40,
                        icon = "☄️",
                        description = "Massive kinetic sphere rolling downhill, crushing walls & barrels.",
                        size = new Vector3(4.4f, 4.4f, 4.4f),
                        previewColor = new Color(0.4f, 0.33f, 0.27f)
                    };
                case ObstacleType.Barrel:
                    return new ObstacleDefinition
                    {
                        type = ObstacleType.Barrel,
                        name = "Explosive Barrel",
                        cost = 45,
                        icon = "💥",
                        description = "Mine detonating on proximity or impact with massive 9m shockwave.",
                        size = new Vector3(2.2f, 2.4f, 2.2f),
                        previewColor = new Color(1.0f, 0.27f, 0.0f),
                        blastRadius = 9f,
                        blastKnockback = 26f
                    };
                default:
                    return null;
            }
        }
    }
}
