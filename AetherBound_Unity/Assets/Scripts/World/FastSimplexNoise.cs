using System;
using UnityEngine;

namespace AetherBound
{
    public class FastSimplexNoise
    {
        private readonly byte[] p = new byte[256];
        private readonly byte[] perm = new byte[512];
        private readonly byte[] permMod12 = new byte[512];

        private static readonly float F2 = 0.5f * (Mathf.Sqrt(3.0f) - 1.0f);
        private static readonly float G2 = (3.0f - Mathf.Sqrt(3.0f)) / 6.0f;

        private static readonly int[,] Grad3 = new int[,]
        {
            { 1, 1 }, { -1, 1 }, { 1, -1 }, { -1, -1 },
            { 1, 0 }, { -1, 0 }, { 1, 0 }, { -1, 0 },
            { 0, 1 }, { 0, -1 }, { 0, 1 }, { 0, -1 }
        };

        public FastSimplexNoise(int seed = 1337)
        {
            Init(seed);
        }

        public void Init(int seed)
        {
            long s = seed % 2147483647;
            if (s <= 0) s += 2147483646;

            for (int i = 0; i < 256; i++)
            {
                p[i] = (byte)i;
            }

            for (int i = 255; i > 0; i--)
            {
                s = (s * 16807) % 2147483647;
                float nextVal = (float)(s - 1) / 2147483646.0f;
                int r = Mathf.FloorToInt(nextVal * (i + 1));
                byte tmp = p[i];
                p[i] = p[r];
                p[r] = tmp;
            }

            for (int i = 0; i < 512; i++)
            {
                perm[i] = p[i & 255];
                permMod12[i] = (byte)(perm[i] % 12);
            }
        }

        public float Noise2D(float xin, float yin)
        {
            float s = (xin + yin) * F2;
            int i = Mathf.FloorToInt(xin + s);
            int j = Mathf.FloorToInt(yin + s);
            float t = (i + j) * G2;
            float X0 = i - t;
            float Y0 = j - t;
            float x0 = xin - X0;
            float y0 = yin - Y0;

            int i1, j1;
            if (x0 > y0)
            {
                i1 = 1; j1 = 0;
            }
            else
            {
                i1 = 0; j1 = 1;
            }

            float x1 = x0 - i1 + G2;
            float y1 = y0 - j1 + G2;
            float x2 = x0 - 1.0f + 2.0f * G2;
            float y2 = y0 - 1.0f + 2.0f * G2;

            int ii = i & 255;
            int jj = j & 255;
            int gi0 = permMod12[ii + perm[jj]];
            int gi1 = permMod12[ii + i1 + perm[jj + j1]];
            int gi2 = permMod12[ii + 1 + perm[jj + 1]];

            float t0 = 0.5f - x0 * x0 - y0 * y0;
            float n0 = 0f;
            if (t0 > 0)
            {
                t0 *= t0;
                n0 = t0 * t0 * (Grad3[gi0, 0] * x0 + Grad3[gi0, 1] * y0);
            }

            float t1 = 0.5f - x1 * x1 - y1 * y1;
            float n1 = 0f;
            if (t1 > 0)
            {
                t1 *= t1;
                n1 = t1 * t1 * (Grad3[gi1, 0] * x1 + Grad3[gi1, 1] * y1);
            }

            float t2 = 0.5f - x2 * x2 - y2 * y2;
            float n2 = 0f;
            if (t2 > 0)
            {
                t2 *= t2;
                n2 = t2 * t2 * (Grad3[gi2, 0] * x2 + Grad3[gi2, 1] * y2);
            }

            return 70.0f * (n0 + n1 + n2);
        }
    }
}
