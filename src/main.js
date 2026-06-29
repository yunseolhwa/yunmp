const { physicsStep, checkEdge, PhysicsEngine, GRAVITY, JUMP_FORCE, MAX_WALK_SPEED, WALK_ACCEL, FRICTION, AIR_RESISTANCE, AIR_ACCEL, TERMINAL_VELOCITY } = require("./physics.js");
const { GASwarm } = require("./ga_swarm.js");

// Global Constants & Variables
const WORLD_W = 2000;
const WORLD_H = 3000;
const GAME_W = 1280;
const GAME_H = 720;
const FRAME_INTERVAL = 1000 / 60;

let simActive = false;
let lastFrameTime = 0;
let cameraX = 0;
let cameraY = 0;
let absoluteWorld = [];
let finalGoalPlat = null;
let memoryBank = { generation: 1, maxReachedLevel: 0, penaltyRecords: [], slamMapData: new Set() };

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = GAME_W;
canvas.height = GAME_H;

        let bot = {
            x: 0, y: 0, vx: 0, vy: 0, w: 14, h: 20, isGrounded: true, level: 0, platId: 0,
            state: 'SCANNING', scanTimer: 0, sosTimer: 0, probesCompleted: 0, targetProbes: 0,
            sweepState: null, targetPlat: null, targetIsDetour: false, inputQueue: [],
            guidePath: [], failedPaths: [], sensorRays: [], afterimages: [], visualTilt: 0, bestPlan: null, isPhasing: false
        };

        function addLog(msg, type = 'normal') {
            const box = document.getElementById('log-box');
            if(!box) return;
            const div = document.createElement('div');
            if (type === 'attack') div.className = 'text-amber-400 font-extrabold shadow-sm';
            else if (type === 'defense') div.className = 'text-red-500 font-black';
            else if (type === 'success') div.className = 'text-orange-300 font-bold';
            else if (type === 'warning') div.className = 'text-yellow-300';
            else div.className = 'text-gray-400';
            div.innerText = `> ${msg}`;
            box.appendChild(div);
            box.scrollTop = box.scrollHeight;
        }

        let stars = [];
        let highestYGenerated = WORLD_H - 100;
        let nextPlatformId = 1;
        let nextStarId = 1;
        let nextLvl = 1;
        let side = 1;
        let starsCollectedCount = 0;

        function generatePlatformsUpTo(targetY) {
            while (highestYGenerated > targetY) {
                highestYGenerated -= 95;
                let px = (WORLD_W/2) + (side * (30 + Math.random() * 40));
                if (side === -1) px -= 40;
                let pw = 25 + Math.random() * 20;

                // Platform
                absoluteWorld.push({
                    id: nextPlatformId++,
                    x: px,
                    y: highestYGenerated,
                    w: pw,
                    h: 10,
                    isTarget: true,
                    level: nextLvl++,
                    isSolid: false
                });

                // Obstacles
                if (nextLvl > 2) {
                    if (Math.random() < 0.5) {
                        absoluteWorld.push({
                            id: nextPlatformId++,
                            x: px - 10,
                            y: highestYGenerated - 40,
                            w: pw + 20,
                            h: 15,
                            isTarget: false,
                            level: nextLvl - 1,
                            isSolid: true
                        });
                    } else if (Math.random() < 0.4) {
                        let trapX = side === 1 ? px - 30 : px + pw;
                        absoluteWorld.push({
                            id: nextPlatformId++,
                            x: trapX,
                            y: highestYGenerated - 20,
                            w: 20,
                            h: 40,
                            isTarget: false,
                            level: nextLvl - 1,
                            isSolid: true
                        });
                    }
                }

                // Star Spawning
                if (Math.random() < 0.4) {
                    stars.push({
                        id: nextStarId++,
                        x: px + pw/2 - 5,
                        y: highestYGenerated - 25,
                        w: 10,
                        h: 10,
                        collected: false
                    });
                }

                side *= -1;
            }
            absoluteWorld.sort((a,b) => b.y - a.y);
            let targets = absoluteWorld.filter(p => p.isTarget);
            finalGoalPlat = targets[targets.length - 1];
        }

        function initMap() {
            absoluteWorld = [];
            stars = [];
            highestYGenerated = WORLD_H - 100;
            nextPlatformId = 1;
            nextStarId = 1;
            nextLvl = 1;
            side = 1;
            starsCollectedCount = 0;

            // Start platform
            absoluteWorld.push({ id: 0, x: WORLD_W/2 - 120, y: highestYGenerated, w: 240, h: 20, isTarget: true, level: 0, isSolid: false });
            
            // Generate initial batch
            generatePlatformsUpTo(WORLD_H - 2000);

            addLog(`🌅 기억 상실증 치료 완료. 무한의 숲 정상을 향해 올라갑니다!`, 'success');
            spawnBot(true);
        }

        function spawnBot(fullReset) {
            let startPlat = absoluteWorld.find(p=>p.level===0) || absoluteWorld[0];
            bot.x = startPlat.x + 30; bot.y = startPlat.y - bot.h; bot.vx = 0; bot.vy = 0;
            bot.level = 0; bot.platId = startPlat.id; bot.isGrounded = true;
            bot.sosTimer = 0; bot.probesCompleted = 0; bot.targetProbes = 0; bot.sweepState = null;
            bot.targetPlat = null; bot.targetIsDetour = false; bot.inputQueue = [];
            bot.guidePath = []; bot.failedPaths = []; bot.sensorRays = []; bot.afterimages = [];
            bot.visualTilt = 0; bot.bestPlan = null; bot.isPhasing = false;

            if (fullReset) { memoryBank.slamMapData.clear(); memoryBank.slamMapData.add(startPlat.id); }

            bot.state = 'SCANNING'; bot.scanTimer = 30;
            document.getElementById('header-ui').classList.remove('sos-active');
            document.getElementById('canvas-wrapper').classList.remove('thinking-hard');
            document.getElementById('current-level').innerText = `0 F`;
            document.getElementById('compute-progress').style.width = '0%';
            document.getElementById('jump-profile').innerText = `GROUNDED`;

            cameraX = bot.x - GAME_W / 2; cameraY = bot.y - GAME_H / 2 + 50;
        }

        function forceRestart() {
            simActive = false; memoryBank.generation = 1; memoryBank.maxReachedLevel = 0;
            memoryBank.penaltyRecords = []; document.getElementById('stars-count').innerText = `0개`;
            initMap(); simActive = true; lastFrameTime = performance.now(); requestAnimationFrame(gameLoopFn);
        }
        window.forceRestart = forceRestart;
        function softRestart() { memoryBank.generation++; spawnBot(false); }

        function performDenseScan() {
            let startX = bot.x + bot.w/2; let startY = bot.y + bot.h/2;
            bot.sensorRays = []; let newNodes = 0;
            for(let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 90) {
                let hitDist = 600; let hitPoint = { x: startX + Math.cos(angle)*hitDist, y: startY + Math.sin(angle)*hitDist };
                for(let r = 10; r < 600; r += 20) {
                    let rx = startX + Math.cos(angle) * r; let ry = startY + Math.sin(angle) * r;
                    let hitPlat = absoluteWorld.find(p => rx > p.x && rx < p.x + p.w && ry > p.y && ry < p.y + p.h);
                    if (hitPlat) {
                        hitDist = r; hitPoint = { x: rx, y: ry };
                        if (!memoryBank.slamMapData.has(hitPlat.id)) { memoryBank.slamMapData.add(hitPlat.id); newNodes++; }
                        break;
                    }
                }
                if (angle % (Math.PI / 15) < 0.05) bot.sensorRays.push({ hitPoint: {x: startX + Math.cos(angle)*600, y: startY + Math.sin(angle)*600} });
            }
            return newNodes;
        }

        function simulateGhostProbe(tarPlat, startX, t_run, t_air, profile, courageMode) {
            let simState = { x: startX, y: bot.y, vx: 0, vy: 0, w: bot.w, h: bot.h, isGrounded: true, level: bot.level, platId: bot.platId };
            let inputs = []; let dir = tarPlat.x > startX ? 1 : -1;

            if (profile === 2) t_run = 0;
            for(let t=0; t<t_run; t++) inputs.push({left: dir===-1, right: dir===1, jump: false, down: false, brake: false});

            if (profile === 2) inputs.push({left: false, right: false, jump: true, down: false, brake: false});
            else inputs.push({left: dir===-1, right: dir===1, jump: true, down: false, brake: false});

            if (profile === 0) {
                for(let t=0; t<t_air; t++) inputs.push({left: dir===-1, right: dir===1, jump: false, down: false, brake: false});
                for(let t=0; t<60; t++) inputs.push({left: false, right: false, jump: false, down: false, brake: false});
            } else if (profile === 1) {
                for(let t=0; t<t_air; t++) inputs.push({left: dir===-1, right: dir===1, jump: false, down: false, brake: false});
                for(let t=0; t<15; t++) inputs.push({left: dir===1, right: dir===-1, jump: false, down: false, brake: false});
                for(let t=0; t<30; t++) inputs.push({left: dir===-1, right: dir===1, jump: false, down: false, brake: false});
                for(let t=0; t<40; t++) inputs.push({left: false, right: false, jump: false, down: false, brake: false});
            } else if (profile === 2) {
                for(let t=0; t<80; t++) inputs.push({left: false, right: false, jump: false, down: false, brake: false});
            }

            let pathTrace = [{x: simState.x, y: simState.y}];
            let hitTarget = false; let fellOffEarly = false; let traumaHit = false;
            let slamKnownWorld = absoluteWorld.filter(p => memoryBank.slamMapData.has(p.id));

            for(let k=0; k<inputs.length; k++) {
                let keys = inputs[k];
                if (keys.jump && simState.isGrounded) {
                    for (let rec of memoryBank.penaltyRecords) {
                        let fearRadius = courageMode ? 5 : 20;
                        if (rec.platId === simState.platId && Math.abs(rec.jumpX - simState.x) < fearRadius) { traumaHit = true; break; }
                    }
                }
                if (traumaHit) break;

                physicsStep(simState, keys, slamKnownWorld);

                if (k % 4 === 0) pathTrace.push({x: simState.x, y: simState.y});
                if (k < t_run && !simState.isGrounded) { fellOffEarly = true; break; }

                if (simState.isGrounded && simState.platId !== bot.platId) {
                    if (simState.platId === tarPlat.id) { hitTarget = true; inputs = inputs.slice(0, k+1); break; }
                    else break;
                }
                if (simState.y > bot.y + 200) break;
            }
            if (hitTarget && !fellOffEarly && !traumaHit) return { success: true, inputs: inputs, path: pathTrace };
            else return { success: false, path: pathTrace };
        }

        function updateAgent() {
            // Endless Map Generation Trigger
            if (bot.y < highestYGenerated + 1000) {
                generatePlatformsUpTo(bot.y - 1000);
            }

            // Star Collection Collision Check
            stars.forEach(s => {
                if (!s.collected && bot.x < s.x + s.w && bot.x + bot.w > s.x && bot.y < s.y + s.h && bot.y + bot.h > s.y) {
                    s.collected = true;
                    starsCollectedCount++;
                    addLog(`⭐️ 별을 획득했습니다! (총 수집: ${starsCollectedCount}개)`, 'success');
                    document.getElementById('stars-count').innerText = `${starsCollectedCount}개`;
                }
            });

            document.getElementById('bot-state').innerText = bot.state;
            document.getElementById('jump-profile').innerText = bot.isGrounded ? "GROUNDED" : "FREE FALLING";

            if (bot.state === 'SOS') {
                bot.vx *= 0.5; bot.sosTimer--;
                if (bot.sosTimer % 20 === 0) document.getElementById('header-ui').classList.toggle('sos-active');
                if (bot.sosTimer <= 0) {
                    addLog(`🛑 태초마을로 돌아갑니다... (트라우마 각인)`, 'defense');
                    memoryBank.penaltyRecords.push({ platId: bot.platId, jumpX: bot.x, reason: 'STUCK' });
                    bot.state = 'DONE'; setTimeout(() => { softRestart(); }, 1500);
                }
                return;
            }

            if (bot.state === 'DONE') return;

            if (bot.state === 'SCANNING') {
                physicsStep(bot, {left:false, right:false, jump:false, down:false, brake:true}, absoluteWorld);
                if (bot.scanTimer === 30) performDenseScan();
                bot.scanTimer--;
                if (bot.scanTimer <= 0) {
                    let knownTargets = absoluteWorld.filter(p => memoryBank.slamMapData.has(p.id) && p.isTarget && p.level > bot.level);
                    if (knownTargets.length > 0) {
                        knownTargets.sort((a,b) => a.level - b.level);
                        bot.targetPlat = knownTargets[0]; bot.targetIsDetour = false; bot.state = 'THINKING';
                    } else {
                        let knownBlks = absoluteWorld.filter(p => memoryBank.slamMapData.has(p.id) && !p.isTarget && p.y < bot.y - 10);
                        if (knownBlks.length > 0) {
                            knownBlks.sort((a,b) => b.y - a.y);
                            bot.targetPlat = knownBlks[0]; bot.targetIsDetour = true; bot.state = 'THINKING';
                            addLog(`⚠️ 장애물(BLK) 우회 탐색 시작.`, 'warning');
                        } else {
                            addLog(`🛑 시야 완전 차단. SOS 발동!`, 'defense');
                            document.getElementById('header-ui').classList.add('sos-active');
                            bot.state = 'SOS'; bot.sosTimer = 120; return;
                        }
                    }

                    let curPlat = absoluteWorld.find(p => p.id === bot.platId);
                    let safeW = Math.max(0, curPlat.w - bot.w - 4);
                    bot.sweepState = { plat: curPlat, x: 0, xMax: Math.max(1, Math.ceil(safeW / 4)), run: 0, runMax: 6, air: 0, airMax: 6, prof: 0, profMax: 3 };
                    bot.targetProbes = bot.sweepState.xMax * bot.sweepState.runMax * bot.sweepState.airMax * bot.sweepState.profMax;
                    bot.probesCompleted = 0; bot.failedPaths = [];
                    addLog(`🍄 최적의 발판 궤적 계산 중...`, 'success');
                }
                return;
            }

            if (bot.state === 'THINKING' || bot.state === 'DEEP_THINKING') {
                physicsStep(bot, {left:false, right:false, jump:false, down:false, brake:true}, absoluteWorld);

                let curPlat = bot.sweepState.plat; let found = false;
                let courage = (bot.state === 'DEEP_THINKING'); let probesThisFrame = 80;

                if (curPlat) {
                    for(let i=0; i<probesThisFrame; i++) {
                        if (bot.sweepState.x >= bot.sweepState.xMax) { bot.probesCompleted = bot.targetProbes; break; }

                        let startX = curPlat.x + 2 + (bot.sweepState.x * 4);
                        if (startX > curPlat.x + curPlat.w - bot.w - 2) startX = curPlat.x + curPlat.w - bot.w - 2;

                        let t_run = bot.sweepState.run * 8; let t_air = bot.sweepState.air * 10; let profile = bot.sweepState.prof;
                        if (courage) { t_run = Math.random() * 80; t_air = Math.random() * 60; profile = Math.floor(Math.random() * 3); }

                        let res = simulateGhostProbe(bot.targetPlat, startX, t_run, t_air, profile, courage);
                        bot.probesCompleted++;

                        if (res.success) {
                            bot.bestPlan = { startX: startX, inputs: res.inputs, profile: profile, t_run: t_run };
                            bot.guidePath = res.path; found = true; break;
                        } else {
                            bot.failedPaths.push(res.path); if(bot.failedPaths.length > 50) bot.failedPaths.shift();
                        }

                        bot.sweepState.prof++;
                        if (bot.sweepState.prof >= bot.sweepState.profMax) {
                            bot.sweepState.prof = 0; bot.sweepState.air++;
                            if (bot.sweepState.air >= bot.sweepState.airMax) {
                                bot.sweepState.air = 0; bot.sweepState.run++;
                                if (bot.sweepState.run >= bot.sweepState.runMax) {
                                    bot.sweepState.run = 0; bot.sweepState.x++;
                                }
                            }
                        }
                    }
                }

                // Probe count element removed
                let progressPct = (bot.probesCompleted / bot.targetProbes) * 100;
                document.getElementById('compute-progress').style.width = `${Math.min(100, progressPct)}%`;

                if (found) {
                    bot.state = 'REPOSITIONING';
                    document.getElementById('canvas-wrapper').classList.remove('thinking-hard');
                    document.getElementById('compute-progress').style.width = '100%';
                    if (bot.bestPlan.profile === 2) { addLog(`✨ [초지능] 발판을 투과하는 수직 점프 발견!!`, 'attack'); }
                    else if (bot.bestPlan.profile === 1) { addLog(`🌪️ [파쿠르] 가시덤불을 피하는 S자 회피 궤적 발견!`, 'success'); }
                    else { addLog(`🎯 정답 궤적 발견! 도약점으로 이동합니다.`, 'success'); }
                } else if (bot.probesCompleted >= bot.targetProbes) {
                    if (bot.state === 'THINKING') {
                        bot.state = 'DEEP_THINKING'; bot.probesCompleted = 0; bot.targetProbes = 1000;
                        bot.sweepState = { x: 0, xMax: 1000, run:0, air:0, prof:0, plat: curPlat };
                        bot.failedPaths = []; document.getElementById('canvas-wrapper').classList.add('thinking-hard');
                        addLog(`🔥 탐색 실패. 짐승의 직감(랜덤 난수) 돌입`, 'warning');
                    } else {
                        if (curPlat && !curPlat.isSolid && bot.level > 0) {
                            addLog(`⬇️ 하향 도약으로 전술적 후퇴 시전.`, 'warning');
                            let djMacro = [];
                            djMacro.push({left:false, right:false, jump:true, down:true, brake:false});
                            for(let i=0; i<40; i++) djMacro.push({left:false, right:false, jump:false, down:false, brake:false});
                            bot.inputQueue = djMacro; bot.state = 'EXECUTING';
                            document.getElementById('canvas-wrapper').classList.remove('thinking-hard');
                        } else {
                            addLog(`🛑 1층 바닥. 짐승의 직감도 실패. SOS.`, 'defense');
                            document.getElementById('header-ui').classList.add('sos-active');
                            bot.state = 'SOS'; bot.sosTimer = 120; bot.failedPaths = [];
                        }
                    }
                }
                return;
            }

            if (bot.state === 'REPOSITIONING') {
                let goLeft = false, goRight = false, doBrake = false;
                let dist = bot.bestPlan.startX - bot.x;

                if (Math.abs(dist) > 1.5) {
                    if (dist > 0) goRight = true; else goLeft = true;
                    if ((dist > 0 && bot.vx < -0.2) || (dist < 0 && bot.vx > 0.2)) doBrake = true;
                    if (Math.abs(dist) < 15 && Math.abs(bot.vx) > 1.5) { goLeft = false; goRight = false; doBrake = true; }
                    if (Math.abs(dist) < 5 && Math.abs(bot.vx) > 0.5) { goLeft = false; goRight = false; doBrake = true; }
                } else {
                    doBrake = true;
                    if (Math.abs(bot.vx) < 0.2) {
                        bot.vx = 0; bot.x = bot.bestPlan.startX; bot.state = 'EXECUTING';
                        bot.inputQueue = [...bot.bestPlan.inputs]; bot.failedPaths = [];
                        document.getElementById('compute-progress').style.width = '0%';
                        addLog(`✨ 위치 선점 완료. 도약!`, 'success');
                        return;
                    }
                }
                physicsStep(bot, {left:goLeft, right:goRight, jump:false, down:false, brake: doBrake}, absoluteWorld);
                return;
            }

            // [V72 복원] 🚨 스카이다이빙 대기 로직 완벽 복구
            if (bot.state === 'EXECUTING') {
                bot.afterimages.push({x: bot.x, y: bot.y, visualTilt: bot.visualTilt});
                if (bot.afterimages.length > 5) bot.afterimages.shift();

                if (bot.inputQueue.length > 0) {
                    let keys = bot.inputQueue.shift();
                    let prevLevel = bot.level; let prevPlatId = bot.platId;

                    physicsStep(bot, keys, absoluteWorld);

                    if (bot.level > prevLevel) {
                        document.getElementById('current-level').innerText = `${bot.level} F`;
                        if (bot.level > memoryBank.maxReachedLevel) {
                            memoryBank.maxReachedLevel = bot.level;
                            document.getElementById('stars-count').innerText = `${starsCollectedCount}개`;
                        }
                        bot.state = 'SCANNING'; bot.scanTimer = 30; bot.inputQueue = []; bot.guidePath = []; bot.isPhasing = false;
                        addLog(`[안착 성공] 인내의 숲 ${bot.level}층 도달!`, 'success');
                        if(bot.level >= finalGoalPlat.level) {
                            addLog("👑 전설의 모험가!! 인내의 숲 마스터!!", "attack");
                            setTimeout(() => { forceRestart(); }, 4000);
                        }
                    }
                    else if (bot.isGrounded && bot.platId !== prevPlatId) {
                        bot.state = 'SCANNING'; bot.scanTimer = 30; bot.inputQueue = []; bot.guidePath = []; bot.isPhasing = false;
                        addLog(`[이동 완료] 새로운 위치 선점.`, 'success');
                    }
                } else if (!bot.isGrounded) {
                    // 공중 체공 중 대기 (낙하산)
                    physicsStep(bot, {left:false, right:false, jump:false, down:false, brake:false}, absoluteWorld);
                } else {
                    bot.vx = 0; bot.state = 'SCANNING'; bot.guidePath = []; bot.scanTimer = 10; bot.isPhasing = false;
                }
            } else {
                if (bot.afterimages.length > 0) bot.afterimages.shift();
            }

            if (bot.y > WORLD_H + 200 || bot.y > cameraY + GAME_H + 300) {
                addLog(`💀 태초마을로 떨어졌습니다... (트라우마 각인)`, 'defense');
                memoryBank.penaltyRecords.push({ platId: bot.platId, jumpX: bot.x, reason: 'FELL' });
                bot.state = 'DONE';
                setTimeout(() => { softRestart(); }, 1000);
            }
        }

        // ==========================================
        // 5. 시네마틱 렌더링
        // ==========================================
        function render() {
            let targetCamX = bot.x + bot.w / 2 - GAME_W / 2;
            let targetCamY = bot.y + bot.h / 2 - GAME_H / 2 + 50;
            targetCamX = Math.max(0, Math.min(WORLD_W - GAME_W, targetCamX));
            targetCamY = Math.min(WORLD_H - GAME_H, targetCamY);

            let diffY = targetCamY - cameraY;
            if (Math.abs(diffY) > GAME_H / 2) cameraY += diffY * 0.15; else cameraY += diffY * 0.05;
            cameraX += (targetCamX - cameraX) * 0.05;

            ctx.fillStyle = '#2a1106'; ctx.fillRect(0, 0, GAME_W, GAME_H);

            ctx.save(); ctx.translate(Math.round(-cameraX), Math.round(-cameraY));

            ctx.fillStyle = '#1a0f0a';
            ctx.fillRect(WORLD_W/2 - 70, cameraY - 100, 50, GAME_H + 200);
            ctx.fillRect(WORLD_W/2 + 20, cameraY - 100, 60, GAME_H + 200);

            ctx.fillStyle = '#451a03';
            let startBackgroundY = Math.floor((cameraY - 100) / 300) * 300;
            for(let i = startBackgroundY; i < cameraY + GAME_H + 100; i += 300) {
                ctx.beginPath(); ctx.arc(WORLD_W/2, i+150, 80, 0, Math.PI*2); ctx.fill();
            }

            // Draw Stars
            stars.forEach(s => {
                if (!s.collected && s.x + s.w > cameraX - 50 && s.x < cameraX + GAME_W + 50 && s.y > cameraY - 50 && s.y < cameraY + GAME_H + 50) {
                    ctx.fillStyle = '#fbbf24';
                    ctx.shadowColor = '#fbbf24';
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(s.x + s.w/2, s.y + s.h/2, 5, 0, Math.PI*2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });

            absoluteWorld.forEach(p => {
                if (p.x + p.w > cameraX - 50 && p.x < cameraX + GAME_W + 50 && p.y > cameraY - 50 && p.y < cameraY + GAME_H + 50) {
                    let isKnown = memoryBank.slamMapData.has(p.id);
                    ctx.save();
                    if (!isKnown) {
                        ctx.globalAlpha = 0.25;
                    }

                    if (p.isSolid) {
                        ctx.fillStyle = '#451a03'; ctx.fillRect(p.x, p.y, p.w, p.h);
                        ctx.fillStyle = '#94a3b8';
                        for(let i=0; i<p.w; i+=8) { ctx.beginPath(); ctx.moveTo(p.x+i, p.y); ctx.lineTo(p.x+i+4, p.y-6); ctx.lineTo(p.x+i+8, p.y); ctx.fill(); }
                        ctx.strokeStyle = '#ef4444'; ctx.strokeRect(p.x, p.y, p.w, p.h);
                    } else {
                        ctx.fillStyle = '#78350f'; ctx.fillRect(p.x, p.y, p.w, p.h);
                        ctx.fillStyle = '#d97706'; ctx.fillRect(p.x, p.y, p.w, 4);
                        ctx.strokeStyle = '#fcd34d'; ctx.strokeRect(p.x, p.y, p.w, p.h);
                    }

                    if (p.level > 0) {
                        ctx.fillStyle = '#fef08a'; ctx.font = 'bold 9px Arial';
                        ctx.fillText(p.isTarget ? `Lvl ${p.level}` : 'TRAP', p.x + p.w/2 - 12, p.y + 16);
                    }

                    for(let record of memoryBank.penaltyRecords) {
                        if (record.platId === p.id) {
                            ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; ctx.fillRect(record.jumpX - 5, p.y - 12, 10, 10);
                            ctx.fillStyle = 'white'; ctx.font = 'bold 10px Arial'; ctx.fillText('☠️', record.jumpX - 4, p.y - 4);
                        }
                    }
                    ctx.restore();
                }
            });

            if (bot.state === 'SCANNING') {
                ctx.beginPath(); ctx.arc(bot.x + bot.w/2, bot.y + bot.h/2, (30-bot.scanTimer)*20, 0, Math.PI*2);
                ctx.lineWidth = 1; ctx.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, bot.scanTimer/30)})`; ctx.stroke();
            }

            if ((bot.state === 'THINKING' || bot.state === 'DEEP_THINKING') && bot.failedPaths.length > 0) {
                ctx.lineWidth = 1;
                bot.failedPaths.forEach(path => {
                    ctx.strokeStyle = bot.state === 'DEEP_THINKING' ? `rgba(239, 68, 68, 0.4)` : `rgba(251, 191, 36, 0.3)`;
                    ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
                    for(let i=1; i<path.length; i++) ctx.lineTo(path[i].x, path[i].y);
                    ctx.stroke();
                });
            }

            if (bot.guidePath.length > 0) {
                ctx.shadowColor = '#fde047'; ctx.shadowBlur = 10; ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(bot.guidePath[0].x, bot.guidePath[0].y);
                for(let i=1; i<bot.guidePath.length; i+=3) ctx.lineTo(bot.guidePath[i].x, bot.guidePath[i].y);
                ctx.stroke(); ctx.shadowBlur = 0;
            }

            if (bot.state === 'REPOSITIONING' && bot.bestPlan) {
                ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
                ctx.beginPath(); ctx.moveTo(bot.bestPlan.startX, bot.y + bot.h); ctx.lineTo(bot.bestPlan.startX, bot.y - 20);
                ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fde047'; ctx.font = '8px Arial'; ctx.fillText("JUMP", bot.bestPlan.startX - 10, bot.y - 25);
            }

            bot.afterimages.forEach((img, i) => { drawAdventurer(ctx, img.x, img.y, bot.w, bot.h, img.visualTilt, 0, `rgba(253, 224, 71, ${i*0.15})`); });

            ctx.save(); ctx.translate(Math.round(bot.x + bot.w/2), Math.round(bot.y + bot.h));
            let bob = Math.abs(Math.sin(Date.now() / 80)) * (bot.vx !== 0 && bot.isGrounded ? 2 : 0);
            ctx.translate(0, -bob);

            let targetTilt = bot.vx * 0.04; bot.visualTilt += (targetTilt - bot.visualTilt) * 0.15; ctx.rotate(bot.visualTilt);

            if (bot.state === 'SOS') {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'; ctx.fillRect(-bot.w/2, -bot.h, bot.w, bot.h);
                ctx.fillStyle = 'white'; ctx.font = '8px sans-serif'; ctx.fillText("CRY", -10, -bot.h - 6);
            } else if (bot.state === 'DEEP_THINKING') {
                drawAdventurer(ctx, 0, 0, bot.w, bot.h, 0, bot.vx, '#ef4444');
            } else {
                if (bot.isPhasing) { ctx.shadowColor = '#fde047'; ctx.shadowBlur = 15; }
                drawAdventurer(ctx, 0, 0, bot.w, bot.h, 0, bot.vx, null); ctx.shadowBlur = 0;
            }

            ctx.restore(); ctx.restore();
        }

        function drawAdventurer(ctx, x, y, w, h, tilt, vx, overrideColor) {
            if (overrideColor) {
                ctx.fillStyle = overrideColor;
                if(x!==0) { ctx.fillRect(-w/2, -h, w, h); }
                else { ctx.fillRect(-w/2, -h, w, h); ctx.strokeStyle = '#fff'; ctx.strokeRect(-w/2, -h, w, h); }
                return;
            }
            ctx.fillStyle = '#1e3a8a'; ctx.fillRect(-w/2, -h*0.4, w, h*0.4);
            ctx.fillStyle = '#ef4444'; ctx.fillRect(-w/2, -h*0.7, w, h*0.3);
            ctx.fillStyle = '#fde047'; ctx.fillRect(-w/2 + 1, -h, w - 2, h*0.3);
            ctx.fillStyle = '#451a03'; ctx.fillRect(-w/2, -h - 2, w, 4);
            ctx.fillStyle = '#000'; let faceDir = vx > 0.1 ? 1 : (vx < -0.1 ? -1 : 0);
            ctx.fillRect(faceDir > 0 ? 2 : (faceDir < 0 ? -4 : -1), -h + 2, 2, 2);
        }

        function startSim() {
            simActive = true; initMap();
            lastFrameTime = performance.now(); requestAnimationFrame(gameLoopFn);
        }

        function gameLoopFn(timestamp) {
            if (!simActive) return; requestAnimationFrame(gameLoopFn);
            let deltaTime = timestamp - lastFrameTime;
            if (deltaTime >= FRAME_INTERVAL) {
                lastFrameTime = timestamp - (deltaTime % FRAME_INTERVAL);
                try { updateAgent(); render(); } catch(e) {
                    addLog(`[CRITICAL] ${e.message}`, 'defense'); console.error(e);
                    simActive = false; setTimeout(() => { forceRestart(); }, 1000);
                }
            }
        }


        let isLearning = false;
        let swarmManager = null;
        let physicsEngine = null;

        function runLearningMode() {
            if (isLearning) return;
            isLearning = true;
            simActive = false;
            addLog("[SYSTEM] 학습 모드 트리거됨. 진화 알고리즘 스웜 가동...");

            // Always create a new swarmManager to ensure fresh DNA for the current position
            swarmManager = new GASwarm(50, []);
            
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
                    agent.collectedStarIds = new Set();
                });

                // Run Headless Simulation Batch for 200 steps
                for (let step = 0; step < 200; step++) {
                    swarmManager.updateAgentsActions();
                    physicsEngine.simulateBatch(swarmManager.population);

                    // Check star collisions for each agent
                    swarmManager.population.forEach(agent => {
                        if (!agent.dead) {
                            stars.forEach(s => {
                                if (!s.collected && !agent.collectedStarIds.has(s.id)) {
                                    if (agent.x < s.x + s.w && agent.x + agent.w > s.x && agent.y < s.y + s.h && agent.y + agent.h > s.y) {
                                        agent.collectedStarIds.add(s.id);
                                    }
                                }
                            });
                        }
                    });
                }

                // Calculate Fitness based on height climbed relative to starting bot.y
                swarmManager.calculateFitness(bot.y);

                // Find the best in this generation
                let currentBest = swarmManager.population.reduce((prev, current) => (prev.fitness > current.fitness) ? prev : current);

                if (currentBest.fitness > bestGenFitness) {
                    bestGenFitness = currentBest.fitness;
                    bestGenDNA = currentBest.dna;
                }

                document.getElementById('ga-gen').innerText = `Gen ${swarmManager.generation}`;
                document.getElementById('ga-fitness').innerText = `${Math.floor(bestGenFitness)}`;

                swarmManager.evolve();
            }

            addLog(`[SYSTEM] 100세대 진화 완료. 최고 적합도: ${Math.floor(bestGenFitness)}`);

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

        document.getElementById('learn-btn').addEventListener('click', runLearningMode);

        // Auto-start simulation immediately on load
        startSim();
