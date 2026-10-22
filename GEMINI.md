# Antigravity & AI Project Instructions

> **MANDATORY PRE-QUERY RULE**:  
> Every AI agent working on this repository MUST read and adhere to [`instruction.md`](./instruction.md) before executing any query, creating any asset, or modifying any code/scene.

## Core Directives for All Queries

1. **Decent-Looking Internet Assets**: Never use ugly, raw untextured primitives for visible game objects. Always use decent-looking, stylized 3D assets sourced from open-license internet repositories (e.g. KayKit, CC0 models) with URP Lit shaders.
2. **Heavy Focus on Physics**: Movement, traps, barrels, and boulders must feel tactile and momentum-driven with weighty gravity, coyote time, and dynamic Rigidbody responses.
3. **Minimalist but Good-Looking**: Keep aesthetics clean, cohesive, and readable with glowing Aether/Shadow runes, atmospheric lighting, and clean silhouettes.
4. **Optimized for Low-End Android**: Keep game size compact (<100MB), low polycount (<50k triangles per frame), compressed texture atlases, zero runtime GC allocations, targeting stable 60 FPS.
5. **Full PC Testability & Dual Controls**: The game must run buttery smooth on PC, testable in the Unity Editor with Keyboard (WASD) and Mouse look (cursor locked), while preserving mobile touch virtual joysticks.
6. **Zero Errors**: Always verify that the console has zero compiler or runtime errors after every change.
