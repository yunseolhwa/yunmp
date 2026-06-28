const fs = require('fs');
let code = fs.readFileSync('src/main.js', 'utf8');

const injection = `
        let isLearning = false;
        let swarmManager = null;
        let physicsEngine = null;

        function runLearningMode() {
            if (isLearning) return;
            isLearning = true;
            simActive = false;
            addLog("[SYSTEM] 학습 모드 트리거됨. 진화 알고리즘 스웜 가동...");

            // Make sure the memory bank exists, we extract successful runs or create default DNA.
            if (!swarmManager) {
                swarmManager = new GASwarm(50, memoryBank.slamMapData ? [] : []);
            }
            if (!physicsEngine) {
                physicsEngine = new PhysicsEngine(absoluteWorld);
            }

            let bestGenDNA = null;
            let bestGenFitness = -1;

            for (let gen = 0; gen < 100; gen++) {
                // Initialize positions for all agents based on current bot position
                swarmManager.population.forEach(agent => {
                    agent.x = bot.x;
                    agent.y = bot.y;
                    agent.level = bot.level;
                    agent.platId = bot.platId;
                    agent.dead = false;
                    agent.stepIndex = 0;
                    agent.survivalTime = 0;
                });

                // Run Headless Simulation Batch for 200 steps
                for (let step = 0; step < 200; step++) {
                    swarmManager.updateAgentsActions();
                    physicsEngine.simulateBatch(swarmManager.population);
                }

                // Calculate Fitness (We assume target is higher level and x=0 for simplicity, or we use targetPlat if available)
                let targetX = bot.targetPlat ? bot.targetPlat.x + bot.targetPlat.w / 2 : 0;
                let targetY = bot.targetPlat ? bot.targetPlat.y : -2000;

                swarmManager.calculateFitness(targetX, targetY);

                // Find the best in this generation
                let currentBest = swarmManager.population.reduce((prev, current) => (prev.fitness > current.fitness) ? prev : current);

                if (currentBest.fitness > bestGenFitness) {
                    bestGenFitness = currentBest.fitness;
                    bestGenDNA = currentBest.dna;
                }

                document.getElementById('ga-gen').innerText = \`Gen \${swarmManager.generation}\`;
                document.getElementById('ga-fitness').innerText = \`\${Math.floor(bestGenFitness)}\`;

                swarmManager.evolve();
            }

            addLog(\`[SYSTEM] 100세대 진화 완료. 최고 적합도: \${Math.floor(bestGenFitness)}\`);

            if (bestGenDNA) {
                // Override bot's input queue with the best DNA's keys
                bot.inputQueue = [...bestGenDNA];
                bot.state = 'EXECUTING';
            }

            isLearning = false;
            simActive = true;
            lastFrameTime = performance.now();
            requestAnimationFrame(gameLoopFn);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'L' || e.key === 'l') {
                runLearningMode();
            }
        });
`;

code = code.replace("document.getElementById('start-btn').addEventListener('click', startSim);", injection + "\n        document.getElementById('start-btn').addEventListener('click', startSim);");

fs.writeFileSync('src/main.js', code);
