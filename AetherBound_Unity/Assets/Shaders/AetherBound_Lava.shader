Shader "AetherBound/Lava"
{
    Properties
    {
        [HDR] _LavaCoreColor ("Molten Core (HDR)", Color) = (3.0, 0.8, 0.05, 1.0)
        _LavaCrustColor ("Basalt Crust Color", Color) = (0.12, 0.06, 0.06, 1.0)
        _FlowSpeed ("Flow Speed", Float) = 0.35
        _PulseRate ("Glow Pulse Speed", Float) = 1.8
    }

    SubShader
    {
        Tags 
        { 
            "RenderType" = "Opaque" 
            "RenderPipeline" = "UniversalPipeline"
            "Queue" = "Geometry"
        }
        LOD 200

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            Cull Back
            ZWrite On

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _LavaCoreColor;
                half4 _LavaCrustColor;
                half _FlowSpeed;
                half _PulseRate;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
                float2 uv         : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS   : TEXCOORD1;
                half   fogFactor  : TEXCOORD3;
            };

            Varyings vert(Attributes input)
            {
                Varyings output = (Varyings)0;
                VertexPositionInputs vertexInputs = GetVertexPositionInputs(input.positionOS.xyz);
                VertexNormalInputs normalInputs = GetVertexNormalInputs(input.normalOS);

                output.positionCS = vertexInputs.positionCS;
                output.positionWS = vertexInputs.positionWS;
                output.normalWS = normalInputs.normalWS;
                output.fogFactor = ComputeFogFactor(vertexInputs.positionCS.z);

                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                float2 p = input.positionWS.xz * 0.18;
                float t = _Time.y * _FlowSpeed;

                // Procedural flowing magma veins
                float v1 = sin(p.x * 2.5 + t) + cos(p.y * 2.5 - t * 0.8);
                float v2 = sin(p.x * 4.0 - t * 1.2) * cos(p.y * 4.0 + t);
                float veinNoise = saturate((v1 + v2) * 0.5 + 0.5);

                // Pulsing thermal glow
                float pulse = 0.85 + 0.25 * sin(_Time.y * _PulseRate);
                half3 coreEmission = _LavaCoreColor.rgb * pulse;

                // Sharp crust edge
                float crustMask = smoothstep(0.42, 0.58, veinNoise);
                half3 finalColor = lerp(coreEmission, _LavaCrustColor.rgb, crustMask);

                finalColor = MixFog(finalColor, input.fogFactor);
                return half4(finalColor, 1.0);
            }
            ENDHLSL
        }
    }
}
