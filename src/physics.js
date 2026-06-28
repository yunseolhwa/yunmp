const GRAVITY = 0.25;
const JUMP_FORCE = -8.5;
const MAX_WALK_SPEED = 2.5;
const WALK_ACCEL = 0.5;
const FRICTION = 0.7;
const AIR_RESISTANCE = 0.95;
const AIR_ACCEL = 0.15;
const TERMINAL_VELOCITY = 12;

function physicsStep(entity, keys, activePlatforms) {
    entity.hitSolidCeiling = false; entity.isPhasing = false;
    if (keys.brake && entity.isGrounded) {
        entity.vx *= 0.3; if (Math.abs(entity.vx) < 0.1) entity.vx = 0;
    } else if (keys.right) entity.vx += entity.isGrounded ? WALK_ACCEL : AIR_ACCEL;
    else if (keys.left) entity.vx -= entity.isGrounded ? WALK_ACCEL : AIR_ACCEL;
    else {
        if (entity.isGrounded) { entity.vx *= FRICTION; if (Math.abs(entity.vx) < 0.2) entity.vx = 0; }
        else entity.vx *= AIR_RESISTANCE;
    }

    if (entity.vx > MAX_WALK_SPEED) entity.vx = MAX_WALK_SPEED;
    if (entity.vx < -MAX_WALK_SPEED) entity.vx = -MAX_WALK_SPEED;

    entity.x += entity.vx;
    for (let p of activePlatforms) {
        if (p.isSolid) {
            if (entity.x < p.x + p.w && entity.x + entity.w > p.x && entity.y < p.y + p.h && entity.y + entity.h > p.y) {
                if (entity.vx > 0) { entity.x = p.x - entity.w; entity.vx = 0; }
                else if (entity.vx < 0) { entity.x = p.x + p.w; entity.vx = 0; }
            }
        }
    }

    // [V72 복원] 완벽한 else if 분기
    if (keys.down && keys.jump && entity.isGrounded && entity.level > 0) {
        let curP = activePlatforms.find(p => Math.abs((entity.y + entity.h) - p.y) < 5 && entity.x + entity.w > p.x && entity.x < p.x + p.w);
        if (curP && !curP.isSolid) { entity.y += 10; entity.vy = 0; entity.isGrounded = false; }
    } else if (keys.jump && entity.isGrounded) {
        entity.vy = JUMP_FORCE; entity.isGrounded = false;
    }

    if (!entity.isGrounded) {
        entity.vy += GRAVITY;
        if (entity.vy > TERMINAL_VELOCITY) entity.vy = TERMINAL_VELOCITY;
    }

    entity.y += entity.vy;

    if (entity.vy < 0) {
        for (let p of activePlatforms) {
            if (entity.x < p.x + p.w && entity.x + entity.w > p.x && entity.y < p.y + p.h && entity.y + entity.h > p.y) {
                if (p.isSolid) {
                    entity.y = p.y + p.h; entity.vy = 0; entity.hitSolidCeiling = true;
                } else { entity.isPhasing = true; }
            }
        }
    }

    if (entity.vy > 0) {
        let landed = false;
        for (let p of activePlatforms) {
            if (p.y > entity.y + entity.h + 20 || p.y < entity.y - entity.vy) continue;
            let prevFoot = entity.y + entity.h - entity.vy;
            let currFoot = entity.y + entity.h;
            if (prevFoot <= p.y + 5 && currFoot >= p.y - 5) {
                if (entity.x + entity.w > p.x && entity.x < p.x + p.w) {
                    entity.y = p.y - entity.h; entity.vy = 0;
                    entity.isGrounded = true; entity.level = p.level; entity.platId = p.id;
                    landed = true; break;
                }
            }
        }
        if (!landed) checkEdge(entity, activePlatforms);
    } else if (entity.vy === 0) { checkEdge(entity, activePlatforms); }
}

function checkEdge(entity, plats) {
    let onPlat = false;
    for (let p of plats) {
        if (Math.abs(entity.y + entity.h - p.y) < 5 && entity.x + entity.w > p.x && entity.x < p.x + p.w) { onPlat = true; break; }
    }
    if (!onPlat) entity.isGrounded = false;
}

class PhysicsEngine {
    constructor(worldData) {
        this.activePlatforms = worldData;
    }
    simulateBatch(population) {
        const activePlatforms = this.activePlatforms;
        population.forEach(agent => {
            if (!agent.dead) {
                physicsStep(agent, agent.currentKeys, activePlatforms);
            }
        });
    }
}
module.exports = { physicsStep, checkEdge, PhysicsEngine, GRAVITY, JUMP_FORCE, MAX_WALK_SPEED, WALK_ACCEL, FRICTION, AIR_RESISTANCE, AIR_ACCEL, TERMINAL_VELOCITY };
