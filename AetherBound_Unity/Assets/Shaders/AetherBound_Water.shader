Shader "AetherBound/Water"
{
    Properties
    {
        _ShallowColor ("Shallow Color", Color) = (0.2, 0.78, 0.88, 0.75)
        _DeepColor ("Deep Color", Color) = (0.05, 0.28, 0.62, 0.92)
        _FoamColor ("Foam Tint", Color) = (0.9, 0.98, 1.0, 0.8)
        _WaveSpeed ("Wave Speed", Float) = 1.2
        _WaveScale ("Wave Scale", Float) = 0.4
        _WaveHeight ("Wave Height", Float) = 0.08
        _Smoothness ("Smoothness", Range(0.0, 1.0)) = 0.95
    }

    SubShader
    {
        Tags 
        { 
            "RenderType" = "Transparent" 
            "RenderPipeline" = "UniversalPipeline"
            "Queue" = "Transparent"
        }
        LOD 200

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Back

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _ShallowColor;
                half4 _DeepColor;
                half4 _FoamColor;
                half _WaveSpeed;
                half _WaveScale;
                half _WaveHeight;
                half _Smoothness;
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
                float2 uv         : TEXCOORD4;
            };

            Varyings vert(Attributes input)
            {
                Varyings output = (Varyings)0;
                float3 posWS = TransformObjectToWorld(input.positionOS.xyz);

                // Animated gentle wave undulation
                float wave = sin(posWS.x * _WaveScale + _Time.y * _WaveSpeed) 
                           * cos(posWS.z * _WaveScale + _Time.y * _WaveSpeed * 0.8);
                posWS.y += wave * _WaveHeight;

                VertexPositionInputs vertexInputs = GetVertexPositionInputs(TransformWorldToObject(posWS));
                output.positionCS = vertexInputs.positionCS;
                output.positionWS = posWS;

                // Perturb normal for wave specular glints
                float dWdx = cos(posWS.x * _WaveScale + _Time.y * _WaveSpeed) * _WaveScale * _WaveHeight;
                float dWdz = -sin(posWS.z * _WaveScale + _Time.y * _WaveSpeed * 0.8) * _WaveScale * _WaveHeight;
                float3 normalPerturbed = normalize(float3(-dWdx, 1.0, -dWdz));

                output.normalWS = normalPerturbed;
                output.fogFactor = ComputeFogFactor(vertexInputs.positionCS.z);
                output.uv = input.uv;

                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                float3 normalWS = normalize(input.normalWS);
                float3 viewDirWS = normalize(GetCameraPositionWS() - input.positionWS);

                // View Fresnel
                half NdotV = saturate(dot(normalWS, viewDirWS));
                half fresnel = pow(1.0 - NdotV, 3.0);

                // Subtle animated water caustics / ripples
                float ripple = sin((input.positionWS.x + input.positionWS.z) * 1.5 + _Time.y * 2.0);
                half4 waterCol = lerp(_DeepColor, _ShallowColor, saturate(fresnel + ripple * 0.1));

                Light mainLight = GetMainLight();
                half3 halfDir = normalize(mainLight.direction + viewDirWS);
                half NdotH = saturate(dot(normalWS, halfDir));
                half spec = pow(NdotH, 64.0) * _Smoothness;

                half3 finalColor = waterCol.rgb + mainLight.color * spec * 0.8;
                finalColor = MixFog(finalColor, input.fogFactor);

                return half4(finalColor, waterCol.a);
            }
            ENDHLSL
        }
    }
}
