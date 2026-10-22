using UnityEngine;

namespace AetherBound
{
    public class AISaboteur : MonoBehaviour
    {
        public bool isEnabled = true;
        public float deployInterval = 12.0f;
        public float minDistanceAhead = 10f;
        public float maxDistanceAhead = 18f;

        private float timer = 0f;
        private int obstacleIndex = 0;
        private readonly ObstacleType[] pool = new ObstacleType[]
        {
            ObstacleType.Wall,
            ObstacleType.Mud,
            ObstacleType.Spikes,
            ObstacleType.Boulder,
            ObstacleType.Barrel
        };

        private Transform avatarVisuals;

        private void Awake()
        {
            int saboteurLayer = LayerMask.NameToLayer("Saboteur");
            if (saboteurLayer != -1) gameObject.layer = saboteurLayer;
            gameObject.tag = "Saboteur";

            BuildVisualAvatar();
        }

        public void BuildVisualAvatar()
        {
            var existing = transform.Find("AvatarVisuals");
            if (existing != null && existing.Find("MageMesh") != null)
            {
                avatarVisuals = existing;
                return;
            }
            var root = CharacterModelBuilder.BuildAISaboteurVisuals(transform);
            avatarVisuals = root != null ? root.transform : null;
        }

        private void Update()
        {
            if (!isEnabled) return;
            if (GameManager.Instance == null || GameManager.Instance.CurrentState != GameState.Playing) return;
            if (GameManager.Instance.CurrentRole != PlayerRole.Runner) return; // Only active in single-player Runner mode

            timer += Time.deltaTime;
            if (timer >= deployInterval)
            {
                timer = 0f;
                DeployObstacleAhead();
            }
        }

        private void DeployObstacleAhead()
        {
            if (RunnerController.Instance == null || ObstacleManager.Instance == null) return;

            // Only deploy when the player is actually running forward (not standing still looking around)
            if (RunnerController.Instance.inputDirection.sqrMagnitude < 0.05f && GameInput.GetHorizontal() == 0 && GameInput.GetVertical() == 0)
            {
                return;
            }

            Vector3 runnerPos = RunnerController.Instance.transform.position;
            if (Vector3.Distance(runnerPos, Vector3.zero) < 14f)
            {
                return; // Keep initial spawn area calm and clear
            }
            Vector3 forward = RunnerController.Instance.transform.forward;

            float dist = UnityEngine.Random.Range(minDistanceAhead, maxDistanceAhead);
            Vector3 targetPos = runnerPos + forward * dist;

            // Clamp inside arena boundaries
            targetPos.x = Mathf.Clamp(targetPos.x, GameConfig.ArenaMinX + 2.5f, GameConfig.ArenaMaxX - 2.5f);
            targetPos.z = Mathf.Clamp(targetPos.z, GameConfig.ArenaMinZ + 2.5f, GameConfig.ArenaMaxZ - 2.5f);

            // Sanctuary checks: cannot place in Spawn Sanctuary or Goal Sanctuary
            if (GoalBeacon.Instance != null && GoalBeacon.Instance.IsInsideSanctuary(targetPos))
            {
                return;
            }
            if (SpawnSanctuary.Instance != null && SpawnSanctuary.Instance.IsInsideSanctuary(targetPos))
            {
                return;
            }

            float y = (WorldManager.Instance != null) ? WorldManager.Instance.GetHeightAt(targetPos.x, targetPos.z) : 0f;
            targetPos.y = y;

            ObstacleType type = pool[obstacleIndex % pool.Length];
            obstacleIndex++;

            Quaternion rot = Quaternion.Euler(0, UnityEngine.Random.Range(0, 4) * 45f, 0);
            ObstacleManager.Instance.SpawnObstacle(type, targetPos, rot);
        }
    }
}
