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

    let activeLen = activePlatforms.length;
    let ew = entity.w, eh = entity.h;
    let ex = entity.x, ey = entity.y;
    let exw = ex + ew, eyh = ey + eh;

    for (let i = 0; i < activeLen; i++) {
        let p = activePlatforms[i];
        if (p.isSolid) {
            if (ex < p.x + p.w && exw > p.x && ey < p.y + p.h && eyh > p.y) {
                if (entity.vx > 0) { entity.x = p.x - ew; entity.vx = 0; ex = entity.x; exw = ex + ew; }
                else if (entity.vx < 0) { entity.x = p.x + p.w; entity.vx = 0; ex = entity.x; exw = ex + ew; }
            }
        }
    }

    // [V72 복원] 완벽한 else if 분기
    if (keys.down && keys.jump && entity.isGrounded && entity.level > 0) {
        let curP = null;
        for (let i = 0; i < activeLen; i++) {
            let p = activePlatforms[i];
            if (Math.abs(eyh - p.y) < 5 && exw > p.x && ex < p.x + p.w) { curP = p; break; }
        }
        if (curP && !curP.isSolid) { entity.y += 10; entity.vy = 0; entity.isGrounded = false; ey = entity.y; eyh = ey + eh; }
    } else if (keys.jump && entity.isGrounded) {
        entity.vy = JUMP_FORCE; entity.isGrounded = false;
    }

    if (!entity.isGrounded) {
        entity.vy += GRAVITY;
        if (entity.vy > TERMINAL_VELOCITY) entity.vy = TERMINAL_VELOCITY;
    }

    entity.y += entity.vy;
    ey = entity.y; eyh = ey + eh;

    if (entity.vy < 0) {
        for (let i = 0; i < activeLen; i++) {
            let p = activePlatforms[i];
            if (ex < p.x + p.w && exw > p.x && ey < p.y + p.h && eyh > p.y) {
                if (p.isSolid) {
                    entity.y = p.y + p.h; entity.vy = 0; entity.hitSolidCeiling = true; ey = entity.y; eyh = ey + eh;
                } else { entity.isPhasing = true; }
            }
        }
    }

    if (entity.vy > 0) {
        let landed = false;
        let pLimit1 = eyh + 20;
        let pLimit2 = ey - entity.vy;
        let prevFoot = eyh - entity.vy;

        for (let i = 0; i < activeLen; i++) {
            let p = activePlatforms[i];
            if (p.y > pLimit1 || p.y < pLimit2) continue;

            if (prevFoot <= p.y + 5 && eyh >= p.y - 5) {
                if (exw > p.x && ex < p.x + p.w) {
                    entity.y = p.y - eh; entity.vy = 0; ey = entity.y; eyh = ey + eh;
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
    let bottom = entity.y + entity.h;
    let right = entity.x + entity.w;
    let left = entity.x;
    for (let i = 0, len = plats.length; i < len; i++) {
        let p = plats[i];
        if (Math.abs(bottom - p.y) < 5 && right > p.x && left < p.x + p.w) { onPlat = true; break; }
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
