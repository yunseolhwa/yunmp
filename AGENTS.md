# AI Agent Instructions for Kinematic AI Pathfinding

This repository contains a kinematic AI pathfinding bot designed to navigate a 2D platforming environment using a physics engine.

## Code Structure
- `src/main.js`: Contains the main simulation interface and game loop.
- `src/physics.js`: Contains the core physics engine (`physicsStep`, `checkEdge`) and the `PhysicsEngine` class for headless batch simulation.
- `src/ga_swarm.js`: Contains the genetic algorithm swarm implementation (`GASwarm`).

## Feature Preservation Checklist
When proposing or making any changes to the code, **you MUST verify the following** to prevent the loss of critical features:

1. **[ ] Down-Jump (하향 도약):**
   - Ensure that down-jumping logic remains functional: `keys.down && keys.jump && entity.isGrounded && entity.level > 0`.
   - Ensure the entity correctly drops through one-way platforms and enters a free-fall state (`entity.isGrounded = false`).
2. **[ ] Vertical Phasing (수직 관통):**
   - When an entity moves upwards (`entity.vy < 0`), it should pass through non-solid platforms seamlessly (`p.isSolid == false`).
   - `entity.isPhasing` should be correctly assigned.
3. **[ ] Input Masking (슈퍼 점프 글리치 방지):**
   - Ensure the `else if` structures inside `physicsStep` separate standard jumps from down-jumps to prevent them from conflicting and causing the agent to hit the ceiling unexpectedly.
4. **[ ] Skydiving Wait (스카이다이빙 대기 로직):**
   - The agent should wait and not execute new commands while in mid-air unless intended by its DNA/profile (`entity.isGrounded == false`).
5. **[ ] Zeno's Paradox (조기 브레이크 버그 방지):**
   - Do not stop the agent prematurely when approaching a target; ensure dynamic braking logic does not freeze the agent before reaching the destination.

## Testing Rules
- Always run `npm test` after making modifications to `src/physics.js` to run the regression suite.
- Tests are located in the `tests/` directory and use Jest.

**Failure to adhere to these instructions could result in reverting to older, broken states. Follow them carefully.**
