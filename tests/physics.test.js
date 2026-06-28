const { physicsStep, checkEdge, GRAVITY, JUMP_FORCE, MAX_WALK_SPEED, WALK_ACCEL, FRICTION, AIR_RESISTANCE, AIR_ACCEL, TERMINAL_VELOCITY } = require('../src/physics');

describe('Physics Engine', () => {
    let entity;
    let activePlatforms;

    beforeEach(() => {
        entity = {
            x: 50, y: 50, vx: 0, vy: 0, w: 10, h: 20,
            isGrounded: true, level: 1, platId: 1,
            hitSolidCeiling: false, isPhasing: false
        };
        activePlatforms = [
            { id: 1, x: 0, y: 70, w: 100, h: 10, isSolid: true, level: 1 }, // Floor
            { id: 2, x: 0, y: 30, w: 100, h: 10, isSolid: false, level: 2 }, // One-way platform above
            { id: 3, x: 200, y: 70, w: 50, h: 10, isSolid: true, level: 1 } // Another floor
        ];
    });

    test('Basic jumping', () => {
        const keys = { left: false, right: false, jump: true, down: false, brake: false };
        physicsStep(entity, keys, activePlatforms);

        expect(entity.vy).toBeCloseTo(JUMP_FORCE + GRAVITY);
        expect(entity.isGrounded).toBe(false);
    });

    test('Down-jumping through one-way platform (regression test)', () => {
        // Place entity on a one-way platform
        entity.y = 10;
        entity.level = 2;
        entity.platId = 2;
        entity.isGrounded = true;

        const keys = { left: false, right: false, jump: true, down: true, brake: false };

        // Before step
        expect(entity.y).toBe(10);

        physicsStep(entity, keys, activePlatforms);

        // Entity should drop by 10
        expect(entity.y).toBeGreaterThan(10);
        expect(entity.isGrounded).toBe(false);
        expect(entity.vy).toBe(GRAVITY); // vy was reset to 0, then GRAVITY applied
    });

    test('Vertical phasing through one-way platforms', () => {
        // Entity moving upwards through a one-way platform
        entity.y = 45;
        entity.vy = -10; // moving up fast
        entity.isGrounded = false;

        const keys = { left: false, right: false, jump: false, down: false, brake: false };
        physicsStep(entity, keys, activePlatforms);

        // Should move up
        expect(entity.y).toBeLessThan(45);
        // isPhasing should be true because it intersected platform 2
        expect(entity.isPhasing).toBe(true);
        // Should not lose velocity (except gravity)
        expect(entity.vy).toBe(-10 + GRAVITY);
    });
});
