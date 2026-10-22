using UnityEngine;

namespace AetherBound
{
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        private AudioSource sfxSource;
        private AudioSource musicSource;

        private AudioClip jumpClip;
        private AudioClip slideClip;
        private AudioClip explosionClip;
        private AudioClip powerupClip;
        private AudioClip placementClip;
        private AudioClip reconClip;
        private AudioClip victoryClip;
        private AudioClip defeatClip;
        private AudioClip blinkClip;
        private AudioClip dashClip;
        private AudioClip deflectionPulseClip;
        private AudioClip spikesClip;
        private AudioClip boulderImpactClip;
        private AudioClip shieldBreakClip;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            sfxSource = gameObject.AddComponent<AudioSource>();
            musicSource = gameObject.AddComponent<AudioSource>();

            GenerateProceduralAudioClips();
        }

        private void GenerateProceduralAudioClips()
        {
            jumpClip = CreateToneClip("Jump", 320f, 640f, 0.18f);
            slideClip = CreateNoiseClip("Slide", 0.35f, 0.4f);
            explosionClip = CreateNoiseClip("Explosion", 0.8f, 1.0f);
            powerupClip = CreateArpeggioClip("PowerUp", new float[] { 440f, 554f, 659f, 880f }, 0.28f);
            placementClip = CreateToneClip("Placement", 520f, 260f, 0.15f);
            reconClip = CreateToneClip("Recon", 880f, 1200f, 0.35f);
            victoryClip = CreateArpeggioClip("Victory", new float[] { 523f, 659f, 784f, 1046f }, 0.8f);
            defeatClip = CreateToneClip("Defeat", 300f, 120f, 0.6f);
            blinkClip = CreateToneClip("Blink", 440f, 980f, 0.16f);
            dashClip = CreateToneClip("Dash", 580f, 960f, 0.22f);
            deflectionPulseClip = CreateToneClip("DeflectionPulse", 260f, 920f, 0.32f);
            spikesClip = CreateNoiseClip("Spikes", 0.28f, 2.0f);
            boulderImpactClip = CreateNoiseClip("BoulderImpact", 0.48f, 1.2f);
            shieldBreakClip = CreateToneClip("ShieldBreak", 920f, 280f, 0.26f);
        }

        private AudioClip CreateToneClip(string name, float startFreq, float endFreq, float duration)
        {
            int sampleRate = 44100;
            int samples = Mathf.FloorToInt(sampleRate * duration);
            float[] data = new float[samples];

            for (int i = 0; i < samples; i++)
            {
                float t = (float)i / samples;
                float freq = Mathf.Lerp(startFreq, endFreq, t);
                float envelope = 1f - t;
                data[i] = Mathf.Sin(2f * Mathf.PI * freq * ((float)i / sampleRate)) * envelope * 0.5f;
            }

            var clip = AudioClip.Create(name, samples, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private AudioClip CreateNoiseClip(string name, float duration, float decayPower)
        {
            int sampleRate = 44100;
            int samples = Mathf.FloorToInt(sampleRate * duration);
            float[] data = new float[samples];

            for (int i = 0; i < samples; i++)
            {
                float t = (float)i / samples;
                float envelope = Mathf.Pow(1f - t, decayPower);
                data[i] = (UnityEngine.Random.value * 2f - 1f) * envelope * 0.6f;
            }

            var clip = AudioClip.Create(name, samples, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private AudioClip CreateArpeggioClip(string name, float[] notes, float duration)
        {
            int sampleRate = 44100;
            int samples = Mathf.FloorToInt(sampleRate * duration);
            float[] data = new float[samples];
            int noteCount = notes.Length;

            for (int i = 0; i < samples; i++)
            {
                float t = (float)i / samples;
                int noteIndex = Mathf.Clamp(Mathf.FloorToInt(t * noteCount), 0, noteCount - 1);
                float freq = notes[noteIndex];
                float envelope = 1f - (t * noteCount - Mathf.Floor(t * noteCount));
                data[i] = Mathf.Sin(2f * Mathf.PI * freq * ((float)i / sampleRate)) * envelope * 0.45f;
            }

            var clip = AudioClip.Create(name, samples, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        public void PlayJumpSound() => PlayOneShot(jumpClip);
        public void PlaySlideSound() => PlayOneShot(slideClip);
        public void PlayExplosionSound() => PlayOneShot(explosionClip);
        public void PlayPowerupSound() => PlayOneShot(powerupClip);
        public void PlayPlacementSound() => PlayOneShot(placementClip);
        public void PlayReconSound() => PlayOneShot(reconClip);
        public void PlayVictorySound() => PlayOneShot(victoryClip);
        public void PlayDefeatSound() => PlayOneShot(defeatClip);
        public void PlayBlinkSound() => PlayOneShot(blinkClip);
        public void PlayDashSound() => PlayOneShot(dashClip);
        public void PlayDeflectionPulseSound() => PlayOneShot(deflectionPulseClip);
        public void PlaySpikesSound() => PlayOneShot(spikesClip);
        public void PlayBoulderImpactSound() => PlayOneShot(boulderImpactClip);
        public void PlayShieldBreakSound() => PlayOneShot(shieldBreakClip);

        private void PlayOneShot(AudioClip clip)
        {
            if (sfxSource != null && clip != null)
            {
                sfxSource.PlayOneShot(clip);
            }
        }
    }
}
