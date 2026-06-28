class GASwarm {
    constructor(populationSize, memoryBank) {
        this.populationSize = populationSize;
        this.memoryBank = memoryBank;
        this.population = [];
        this.generation = 0;
        this.initPopulation();
    }

    initPopulation() {
        this.population = [];
        for (let i = 0; i < this.populationSize; i++) {
            let seedDna = this.memoryBank && this.memoryBank.length > i ? this.memoryBank[i].dna : this.generateRandomDNA();
            this.population.push(this.createAgent(seedDna));
        }
    }

    createAgent(dna) {
        return {
            x: 0, y: 0, vx: 0, vy: 0, w: 14, h: 20,
            isGrounded: true, level: 0, platId: 0, dead: false,
            dna: dna,
            fitness: 0,
            currentKeys: { left: false, right: false, jump: false, down: false, brake: false },
            stepIndex: 0,
            survivalTime: 0,
            distanceToTarget: 9999
        };
    }

    generateRandomDNA() {
        let dna = [];
        for (let i = 0; i < 200; i++) {
            dna.push({
                left: Math.random() < 0.2,
                right: Math.random() < 0.2,
                jump: Math.random() < 0.1,
                down: Math.random() < 0.05,
                brake: Math.random() < 0.1
            });
        }
        return dna;
    }

    updateAgentsActions() {
        this.population.forEach(agent => {
            if (!agent.dead && agent.stepIndex < agent.dna.length) {
                agent.currentKeys = agent.dna[agent.stepIndex];
                agent.stepIndex++;
                agent.survivalTime++;
            } else {
                agent.dead = true;
                agent.currentKeys = { left: false, right: false, jump: false, down: false, brake: true };
            }
        });
    }

    calculateFitness(targetX, targetY) {
        this.population.forEach(agent => {
            let dx = agent.x - targetX;
            let dy = agent.y - targetY;
            agent.distanceToTarget = Math.sqrt(dx*dx + dy*dy);
            agent.fitness = (agent.level * 1000) - agent.distanceToTarget + agent.survivalTime;
            if (agent.fitness < 0) agent.fitness = 0;
        });
    }

    evolve() {
        this.population.sort((a, b) => b.fitness - a.fitness);

        let nextGeneration = [];
        let elitesCount = Math.floor(this.populationSize * 0.2);

        for (let i = 0; i < elitesCount; i++) {
            nextGeneration.push(this.createAgent(this.population[i].dna));
        }

        while (nextGeneration.length < this.populationSize) {
            let parentA = this.selectParent();
            let parentB = this.selectParent();
            let childDNA = this.crossover(parentA.dna, parentB.dna);
            childDNA = this.mutate(childDNA, 0.05);
            nextGeneration.push(this.createAgent(childDNA));
        }

        this.population = nextGeneration;
        this.generation++;
    }

    selectParent() {
        let tournamentSize = 3;
        let best = null;
        for (let i = 0; i < tournamentSize; i++) {
            let candidate = this.population[Math.floor(Math.random() * this.population.length)];
            if (!best || candidate.fitness > best.fitness) {
                best = candidate;
            }
        }
        return best;
    }

    crossover(dnaA, dnaB) {
        let childDNA = [];
        let midpoint = Math.floor(Math.random() * dnaA.length);
        for (let i = 0; i < dnaA.length; i++) {
            if (i > midpoint) childDNA.push(dnaA[i]);
            else childDNA.push(dnaB[i]);
        }
        return childDNA;
    }

    mutate(dna, mutationRate) {
        return dna.map(gene => {
            if (Math.random() < mutationRate) {
                return {
                    left: Math.random() < 0.2,
                    right: Math.random() < 0.2,
                    jump: Math.random() < 0.1,
                    down: Math.random() < 0.05,
                    brake: Math.random() < 0.1
                };
            }
            return gene;
        });
    }
}

module.exports = { GASwarm };
