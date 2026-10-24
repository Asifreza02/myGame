using UnityEngine;
using UnityEngine.Rendering;

namespace AetherBound
{
    public class EnvironmentManager : MonoBehaviour
    {
        public static EnvironmentManager Instance { get; private set; }

        [Header("Lighting & Sun (Locked Daytime)")]
        public Light sunLight;
        public Vector3 daySunEuler = new Vector3(50f, 45f, 0f);
        public Color daySunColor = new Color(1f, 0.98f, 0.94f);
        public float daySunIntensity = 1.35f;

        [Header("Fog Settings (Optimized for 2km radius field)")]
        public FogMode fogMode = FogMode.Linear;
        public float fogStartDistance = 250f;
        public float fogEndDistance = 1250f;
        public Color staticFogColor = new Color(0.70f, 0.84f, 0.92f);

        [Header("Horizon Backdrop (Disabled for Performance)")]
        public bool generateDistantMountains = false;

        [Header("Ambient Sound")]
        private AudioSource ambientAudioSource;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            SetupFog();
            SetupPostProcessingVolume();
            SetupAmbientAudio();
            ApplyFixedDaytimeLighting();
            OptimizeCameraSettings();
        }

        private void Start()
        {
            ApplyFixedDaytimeLighting();
            OptimizeCameraSettings();
        }

        public void OptimizeCameraSettings()
        {
            var cam = Camera.main ?? FindAnyObjectByType<Camera>();
            if (cam != null)
            {
                cam.farClipPlane = 1300f;
                cam.nearClipPlane = 0.25f;
            }
        }

        public void ApplyFixedDaytimeLighting()
        {
            if (sunLight == null)
            {
                var lights = FindObjectsByType<Light>(FindObjectsInactive.Exclude);
                foreach (var l in lights)
                {
                    if (l.type == LightType.Directional)
                    {
                        sunLight = l;
                        break;
                    }
                }
            }

            if (sunLight != null)
            {
                sunLight.transform.rotation = Quaternion.Euler(daySunEuler);
                sunLight.color = daySunColor;
                sunLight.intensity = daySunIntensity;
                sunLight.shadows = LightShadows.Soft;
                sunLight.shadowBias = 0.08f;
                sunLight.shadowNormalBias = 0.8f;
            }

            SetupFog();
        }

        private void SetupFog()
        {
            RenderSettings.fog = true;
            RenderSettings.fogMode = fogMode;
            RenderSettings.fogStartDistance = fogStartDistance;
            RenderSettings.fogEndDistance = fogEndDistance;
            RenderSettings.fogColor = staticFogColor;
        }

        private void SetupPostProcessingVolume()
        {
            var existingVol = FindAnyObjectByType<Volume>();
            if (existingVol == null)
            {
                var volObj = new GameObject("GlobalPostProcessVolume");
                volObj.transform.parent = transform;
                var vol = volObj.AddComponent<Volume>();
                vol.isGlobal = true;
                vol.priority = 1.0f;

#if UNITY_EDITOR
                var profile = UnityEditor.AssetDatabase.LoadAssetAtPath<VolumeProfile>("Assets/Settings/SampleSceneProfile.asset");
                if (profile != null)
                {
                    vol.profile = profile;
                }
#endif
            }
        }

        private void SetupAmbientAudio()
        {
            ambientAudioSource = gameObject.AddComponent<AudioSource>();
            ambientAudioSource.loop = true;
            ambientAudioSource.spatialBlend = 0f;
            ambientAudioSource.volume = 0.20f;

            // Generate procedural continuous ambient wind tone
            int sampleRate = 44100;
            int samples = sampleRate * 3; // 3 second seamless loop
            float[] data = new float[samples];

            for (int i = 0; i < samples; i++)
            {
                float t = (float)i / sampleRate;
                float breeze1 = Mathf.Sin(2f * Mathf.PI * 180f * t + Mathf.Sin(t * 1.5f)) * 0.15f;
                float breeze2 = Mathf.Sin(2f * Mathf.PI * 260f * t) * 0.08f;
                float noise = (Random.value * 2f - 1f) * 0.06f;
                data[i] = (breeze1 + breeze2 + noise) * 0.35f;
            }

            var clip = AudioClip.Create("AmbientWindLoop", samples, 1, sampleRate, false);
            clip.SetData(data, 0);
            ambientAudioSource.clip = clip;
            ambientAudioSource.Play();
        }

        public string GetTimeOfDayName()
        {
            return "☀️ DAY";
        }
    }
}
