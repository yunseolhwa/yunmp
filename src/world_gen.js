class WorldGenerator {
    constructor(worldWidth, worldHeight) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
    }

    generate(numLevels, difficultyParams = {}) {
        let world = [];
        let pId = 0;
        let currentY = this.worldHeight - 100;

        // Base ground level (Level 0)
        world.push({ id: pId++, x: this.worldWidth/2 - 120, y: currentY, w: 240, h: 20, isTarget: true, level: 0, isSolid: false });

        let side = 1;

        // Difficulty overrides or defaults
        const baseGapY = difficultyParams.baseGapY || 95;
        const widthMin = difficultyParams.widthMin || 25;
        const widthVar = difficultyParams.widthVar || 20;
        const obstacleChance1 = difficultyParams.obstacleChance1 || 0.6;
        const obstacleChance2 = difficultyParams.obstacleChance2 || 0.5;

        for (let lvl = 1; lvl <= numLevels; lvl++) {
            // As level increases, jump gaps could increase slightly or platform widths decrease
            let difficultyFactor = Math.min(1.0, lvl / (numLevels * 0.8)); // 0 to 1 scaling

            // Y-Gap dynamically adjusted (could be slightly higher for harder difficulties, but within max jump limit ~100)
            let gapY = baseGapY + (difficultyFactor * 5);
            currentY -= gapY;

            let px = (this.worldWidth / 2) + (side * (30 + Math.random() * 40));
            if (side === -1) px -= 40;

            // Platform width shrinks slightly as it gets harder
            let pw = widthMin + (Math.random() * widthVar) - (difficultyFactor * 10);
            pw = Math.max(15, pw); // Min width 15

            world.push({ id: pId++, x: px, y: currentY, w: pw, h: 10, isTarget: true, level: lvl, isSolid: false });

            // Generate Obstacles (Thorns/Solid blocks)
            if (lvl > 1) {
                let rnd = Math.random();
                // Higher chance of obstacles at higher levels
                let currentObsChance1 = obstacleChance1 + (difficultyFactor * 0.2);

                if (rnd < currentObsChance1) {
                    world.push({ id: pId++, x: px - 10, y: currentY - 40, w: pw + 20, h: 15, isTarget: false, level: lvl, isSolid: true });
                } else if (Math.random() < obstacleChance2) {
                    let trapX = side === 1 ? px - 30 : px + pw;
                    world.push({ id: pId++, x: trapX, y: currentY - 20, w: 20, h: 40, isTarget: false, level: lvl, isSolid: true });
                }
            }

            // Occasional double platform on same level for complex jumps
            if (Math.random() < 0.2) {
                let altX = px + (side * 60);
                world.push({ id: pId++, x: altX, y: currentY + (Math.random() * 10 - 5), w: pw, h: 10, isTarget: true, level: lvl, isSolid: false });
            }

            side *= -1; // Switch side
        }

        return world;
    }
}

module.exports = { WorldGenerator };
