const fs = require('fs');
const path = require('path');
const { PhysicsEngine } = require('../src/physics');
const { GASwarm } = require('../src/ga_swarm');

describe('GA Swarm Diagnostic Pipeline', () => {
    let world;
    let physicsEngine;
    let botStart;
    let targetX;
    let targetY;

    beforeEach(() => {
        // Construct a standard mock map representing a simple 1-step layout
        // Start platform at level 0, and a target platform at level 1
        world = [
            { id: 0, x: 380, y: 2900, w: 240, h: 20, isTarget: true, level: 0, isSolid: false },
            { id: 1, x: 570, y: 2805, w: 40, h: 10, isTarget: true, level: 1, isSolid: false }
        ];

        physicsEngine = new PhysicsEngine(world);

        // Start position for the swarm agents (on platform 0)
        botStart = {
            x: 380 + 30, // 410
            y: 2900 - 20, // 2880
            vx: 0,
            vy: 0,
            w: 14,
            h: 20,
            isGrounded: true,
            level: 0,
            platId: 0
        };

        // Target coordinates (center of level 1 platform)
        targetX = 570 + 40 / 2; // 590
        targetY = 2805;
    });

    test('GA learning logic correctness, diversity maintenance, and NaN validation', () => {
        const swarm = new GASwarm(50, []);
        const generationsCount = 50;
        const stepsPerGen = 200;
        const history = [];

        let nanDetected = false;
        let nanReason = '';

        for (let gen = 0; gen < generationsCount; gen++) {
            // Reset position and state of all agents for the new generation
            swarm.population.forEach(agent => {
                agent.x = botStart.x;
                agent.y = botStart.y;
                agent.vx = botStart.vx;
                agent.vy = botStart.vy;
                agent.level = botStart.level;
                agent.platId = botStart.platId;
                agent.dead = false;
                agent.stepIndex = 0;
                agent.survivalTime = 0;
            });

            // Simulate batch execution
            for (let step = 0; step < stepsPerGen; step++) {
                swarm.updateAgentsActions();
                physicsEngine.simulateBatch(swarm.population);

                // Inline NaN validation during simulation
                swarm.population.forEach((agent, index) => {
                    if (isNaN(agent.x) || isNaN(agent.y) || isNaN(agent.vx) || isNaN(agent.vy)) {
                        nanDetected = true;
                        nanReason = `NaN detected in agent ${index} at generation ${gen}, step ${step}: x=${agent.x}, y=${agent.y}, vx=${agent.vx}, vy=${agent.vy}`;
                    }
                });
            }

            // Calculate Fitness
            swarm.calculateFitness(targetX, targetY);

            // Inline NaN validation in fitness
            swarm.population.forEach((agent, index) => {
                if (isNaN(agent.fitness)) {
                    nanDetected = true;
                    nanReason = `NaN detected in fitness of agent ${index} at generation ${gen}: fitness=${agent.fitness}`;
                }
            });

            // Record metrics
            const bestAgent = swarm.population.reduce((prev, current) => (prev.fitness > current.fitness) ? prev : current);
            const avgFitness = swarm.population.reduce((acc, agent) => acc + agent.fitness, 0) / swarm.population.length;

            const uniqueDnas = new Set(swarm.population.map(agent => JSON.stringify(agent.dna))).size;
            const diversity = uniqueDnas / swarm.population.length;

            history.push({
                generation: gen,
                bestFitness: bestAgent.fitness,
                avgFitness: avgFitness,
                diversity: diversity
            });

            // Evolve to the next generation
            swarm.evolve();
        }

        // Diagnostic verification
        const lastGen = history[history.length - 1];
        const firstGen = history[0];

        // 1. Stagnation check: Fitness should improve over 50 generations
        const isStagnated = lastGen.bestFitness <= firstGen.bestFitness;

        // 2. Diversity check: Diversity must not drop to absolute zero (indicating a mutation / crossover freeze)
        const isDiversityCollapsed = lastGen.diversity < 0.05;

        const isTestFailed = nanDetected || isStagnated || isDiversityCollapsed;

        if (isTestFailed) {
            const dumpData = {
                timestamp: new Date().toISOString(),
                success: false,
                failReasons: {
                    nanDetected,
                    nanReason,
                    isStagnated,
                    isDiversityCollapsed,
                    bestFitnessProgress: `${firstGen.bestFitness} -> ${lastGen.bestFitness}`,
                    finalDiversity: lastGen.diversity
                },
                history: history,
                populationSample: swarm.population.map((agent, index) => ({
                    index,
                    fitness: agent.fitness,
                    level: agent.level,
                    dnaSample: agent.dna.slice(0, 10) // Dump first 10 genes for brevity
                })),
                worldConfig: world
            };

            const dumpPath = path.join(__dirname, '../debug_dump.json');
            fs.writeFileSync(dumpPath, JSON.stringify(dumpData, null, 2), 'utf-8');
            console.error(`\x1b[31m[GA DIAGNOSTIC FAILED] Stagnation or calculation error detected. State dumped to: ${dumpPath}\x1b[0m`);
        }

        // Jest Assertions
        expect(nanDetected).toBe(false);
        expect(isStagnated).toBe(false);
        expect(isDiversityCollapsed).toBe(false);
    });
});
