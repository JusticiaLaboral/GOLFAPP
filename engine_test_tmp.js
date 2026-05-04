/**
 * GOLF ENGINE 2026 - Country Club Los Mochis
 * Unificación de reglas extraídas del código legacy de Classic Golf Bets.
 */

class GolfEngine {
    constructor() {
        this.STABLEFORD_POINTS = {
            'ALBATROSS': 5,
            'EAGLE': 4,
            'BIRDIE': 3,
            'PAR': 2,
            'BOGEY': 1,
            'DOUBLE_BOGEY': 0
        };
    }

    calculateHoleAdvantages(playerHandicap, courseHoles) {
        let advantages = new Array(18).fill(0);
        if (!courseHoles || courseHoles.length === 0) {
            const fullRounds = Math.floor(playerHandicap / 18);
            const remaining = playerHandicap % 18;
            for (let i = 0; i < 18; i++) {
                advantages[i] = fullRounds + (i < remaining ? 1 : 0);
            }
            return advantages;
        }

        const fullRounds = Math.floor(playerHandicap / 18);
        const remaining = playerHandicap % 18;

        for (let i = 0; i < 18; i++) {
            advantages[i] = fullRounds;
            if (courseHoles[i] && courseHoles[i].ventaja <= remaining) {
                advantages[i]++;
            }
        }
        return advantages;
    }

    calculateWolfResult(players, holeIndex, multiplier = 1) {
        const wolf = players.find(p => p.isWolf);
        if (!wolf) return {};
        const partner = players.find(p => p.isPartner);
        
        const getNet = (p) => (p.scores[holeIndex] || 4) - (p.advantages ? p.advantages[holeIndex] : 0);
        
        const wolfScore = getNet(wolf);
        const partnerScore = partner ? getNet(partner) : null;
        const wolfTeamScore = partner ? Math.min(wolfScore, partnerScore) : wolfScore;
        
        const others = players.filter(p => p.id !== wolf.id && (!partner || p.id !== partner.id));
        const othersScore = Math.min(...others.map(p => getNet(p)));
        
        let playerPoints = {};
        players.forEach(p => playerPoints[p.id] = 0);

        if (wolfTeamScore < othersScore) {
            if (partner) {
                const numOthers = others.length;
                playerPoints[wolf.id] = numOthers * multiplier;
                playerPoints[partner.id] = numOthers * multiplier;
                others.forEach(p => playerPoints[p.id] = -2 * multiplier);
            } else {
                const numOthers = others.length;
                playerPoints[wolf.id] = (numOthers * 2) * multiplier;
                others.forEach(p => playerPoints[p.id] = -2 * multiplier);
            }
        } else if (othersScore < wolfTeamScore) {
            if (partner) {
                const numOthers = others.length;
                others.forEach(p => playerPoints[p.id] = 2 * multiplier);
                playerPoints[wolf.id] = -numOthers * multiplier;
                playerPoints[partner.id] = -numOthers * multiplier;
            } else {
                const numOthers = others.length;
                others.forEach(p => playerPoints[p.id] = 2 * multiplier);
                playerPoints[wolf.id] = -(numOthers * 2) * multiplier;
            }
        }
        return playerPoints;
    }

    calculateSkinsWinner(players, holeIndex) {
        const netScores = players.map(p => ({
            id: p.id,
            score: (p.scores[holeIndex] || 4) - (p.advantages ? p.advantages[holeIndex] : 0)
        }));
        const minScore = Math.min(...netScores.map(p => p.score));
        const winners = netScores.filter(p => p.score === minScore);
        if (winners.length === 1) return winners[0].id;
        return null;
    }

    calculateStablefordPoints(netScore, holePar) {
        const diff = netScore - holePar;
        if (diff <= -3) return this.STABLEFORD_POINTS.ALBATROSS;
        if (diff === -2) return this.STABLEFORD_POINTS.EAGLE;
        if (diff === -1) return this.STABLEFORD_POINTS.BIRDIE;
        if (diff === 0) return this.STABLEFORD_POINTS.PAR;
        if (diff === 1) return this.STABLEFORD_POINTS.BOGEY;
        return this.STABLEFORD_POINTS.DOUBLE_BOGEY;
    }

    calculateMatchPlayWinner(players, holeIndex) {
        const netScores = players.map(p => ({
            id: p.id,
            score: (p.scores[holeIndex] || 4) - (p.advantages ? p.advantages[holeIndex] : 0)
        }));
        const minScore = Math.min(...netScores.map(p => p.score));
        const winners = netScores.filter(p => p.score === minScore);
        if (winners.length === 1) return winners[0].id;
        return null; 
    }

    calculateModeResult(mode, players, holeIndex, gameData) {
        if (mode === 'Wolf') {
            const results = this.calculateWolfResult(players, holeIndex);
            const wolf = players.find(p => p.isWolf);
            if (!wolf) return { status: "ESPERANDO LOBO", details: "El lobo aún no ha sido definido." };
            const partner = players.find(p => p.isPartner);
            const wolfPoints = results[wolf.id];
            
            if (wolfPoints > 0) {
                return { status: "GANA LOBO", details: partner ? `Lobo y ${partner.name} ganan el hoyo.` : "Lone Wolf gana el hoyo." };
            } else if (wolfPoints < 0) {
                return { status: "GANAN CAZADORES", details: "El grupo contrario gana el hoyo." };
            } else {
                return { status: "HOYO EMPATADO", details: "No se reparten puntos en este hoyo." };
            }
        }
        return { status: "HOYO COMPLETADO", details: "Puntos calculados para " + mode };
    }

    calculateTotalPoints(data, specificMode = null) {
        const pIds = Object.keys(data.players || {});
        let pointsTable = {};
        pIds.forEach(id => pointsTable[id] = 0);
        
        let modes = data.modes || [data.mode || 'Wolf'];
        if (specificMode) {
            modes = [specificMode];
        } else {
            if (modes.length > 1) {
                modes = modes.filter(m => m !== 'Medal');
            }
        }
        const maxHole = data.holesCount || 18;
        
        const currentCourseHoles = (data.holes) ? data.holes : (data.pars ? data.pars.map((p, i) => ({
            numero: i + 1, par: p, ventaja: (data.advantages ? data.advantages[i] : i + 1)
        })) : []);

        const playersList = pIds.map(id => {
            const p = data.players[id];
            return {
                ...p,
                scores: p.scores || new Array(18).fill(0),
                advantages: this.calculateHoleAdvantages(p.handicap, currentCourseHoles),
                teamIndex: p.teamIndex || 0
            };
        });

        const modeHoleDetails = {};
        if (specificMode) {
            pIds.forEach(id => modeHoleDetails[id] = { total: 0, holes: new Array(maxHole).fill('-') });
        }

        // ==========================================
        // TEAM-BASED CHRONOLOGICAL CALCULATION
        // ==========================================
        const teams = {};
        playersList.forEach(p => {
            if (!teams[p.teamIndex]) teams[p.teamIndex] = [];
            teams[p.teamIndex].push(p);
        });

        Object.keys(teams).forEach(teamIndexStr => {
            const teamPlayers = teams[teamIndexStr];
            const startingHole = (data.startingHoles && data.startingHoles[teamIndexStr]) || 1;
            
            // Carry-overs independientes por equipo
            let wolfCarryOver = 0;
            let skinsCarryOver = 0;
            let matchCarryOver = 0;
            
            for (let h = 1; h <= maxHole; h++) {
                const physicalHoleIndex = (startingHole - 1 + h - 1) % maxHole;
                const physicalHoleNum = physicalHoleIndex + 1;
                
                const hasScores = teamPlayers.some(p => p.scores[physicalHoleIndex] > 0);
                if (!hasScores && data.status !== 'finished') continue;

                modes.forEach(mode => {
                    const modePlayers = teamPlayers.filter(p => {
                        if (mode === 'Medal') return true;
                        return !data.playerModes || (data.playerModes[p.id] && data.playerModes[p.id].includes(mode));
                    });

                    if (modePlayers.length === 0) return;

                    let holeRes = {};

                    if (mode === 'Wolf') {
                        const hState = (data.holeStates && data.holeStates[physicalHoleNum]) || {};
                        const holeWolfId = modePlayers[(h - 1) % modePlayers.length].id;
                        const holePartnerId = hState.partnerId || null;

                        modePlayers.forEach(p => {
                            p.isWolf = (p.id === holeWolfId);
                            p.isPartner = (p.id === holePartnerId);
                            p.chronoNetScore = (p.scores[physicalHoleIndex] || (currentCourseHoles[physicalHoleIndex]?.par || 4)) - p.advantages[physicalHoleIndex];
                        });

                        let wolfRes = this.calculateTeamWolfResult(modePlayers, hState.multiplier || 1);
                        
                        const currentMultiplier = hState.multiplier || 1;
                        const winners = Object.keys(wolfRes).filter(id => wolfRes[id] > 0);
                        const losers = Object.keys(wolfRes).filter(id => wolfRes[id] < 0);

                        if (winners.length === 0) {
                            wolfCarryOver += currentMultiplier;
                        } else {
                            if (wolfCarryOver > 0) {
                                // El carryover se suma al pozo total y se reparte
                                const bonusPerWinner = wolfCarryOver / winners.length;
                                const penaltyPerLoser = wolfCarryOver / losers.length;
                                
                                winners.forEach(id => { 
                                    wolfRes[id] = wolfRes[id] + bonusPerWinner; 
                                });
                                losers.forEach(id => { 
                                    wolfRes[id] = wolfRes[id] - penaltyPerLoser; 
                                });
                            }
                            wolfCarryOver = 0;
                        }
                        holeRes = wolfRes;
                    } 
                    else if (mode === 'Stableford') {
                        const holePar = currentCourseHoles[physicalHoleIndex]?.par || 4;
                        modePlayers.forEach(p => {
                            const net = (p.scores[physicalHoleIndex] || holePar) - p.advantages[physicalHoleIndex];
                            holeRes[p.id] = this.calculateStablefordPoints(net, holePar);
                        });
                    } else if (mode === 'Skins') {
                        const winnerId = this.calculateSkinsWinner(modePlayers, physicalHoleIndex);
                        if (winnerId) {
                            holeRes[winnerId] = 1 + skinsCarryOver;
                            skinsCarryOver = 0;
                        } else {
                            skinsCarryOver += 1;
                        }
                    } else if (mode === 'MatchPlay') {
                        const winnerId = this.calculateMatchPlayWinner(modePlayers, physicalHoleIndex);
                        if (winnerId) {
                            holeRes[winnerId] = 1 + matchCarryOver;
                            matchCarryOver = 0;
                        } else {
                            matchCarryOver += 1;
                        }
                    } else if (mode === 'Medal') {
                        const holePar = currentCourseHoles[physicalHoleIndex]?.par || 4;
                        modePlayers.forEach(p => {
                            const score = p.scores[physicalHoleIndex] || holePar;
                            holeRes[p.id] = score;
                        });
                    }

                    Object.keys(holeRes).forEach(pid => {
                        pointsTable[pid] += (holeRes[pid] || 0);
                    });

                    if (specificMode === mode) {
                        teamPlayers.forEach(p => {
                            if (hasScores) {
                                modeHoleDetails[p.id].holes[physicalHoleIndex] = holeRes[p.id] || 0;
                            }
                            modeHoleDetails[p.id].total += (holeRes[p.id] || 0);
                        });
                    }
                });
            }
        });

        return { pointsTable, modes, modeHoleDetails };
    }

    calculateTeamWolfResult(players, multiplier = 1) {
        const wolf = players.find(p => p.isWolf);
        if (!wolf) return {};
        const partner = players.find(p => p.isPartner);
        
        const wolfScore = wolf.chronoNetScore;
        const partnerScore = partner ? partner.chronoNetScore : null;
        const wolfTeamScore = partner ? Math.min(wolfScore, partnerScore) : wolfScore;
        
        const others = players.filter(p => p.id !== wolf.id && (!partner || p.id !== partner.id));
        const othersScore = Math.min(...others.map(p => p.chronoNetScore));
        
        let playerPoints = {};
        players.forEach(p => playerPoints[p.id] = 0);

        if (wolfTeamScore < othersScore) {
            // Gana equipo del Lobo
            if (partner) {
                // Cada ganador gana el multiplicador
                playerPoints[wolf.id] = multiplier;
                playerPoints[partner.id] = multiplier;
                // Los perdedores se reparten la deuda (2 * multiplicador / numPerdedores)
                const totalWin = 2 * multiplier;
                const penalty = totalWin / others.length;
                others.forEach(p => playerPoints[p.id] = -penalty);
            } else {
                // Lone Wolf gana doble (2x base de cada cazador)
                const numOthers = others.length;
                playerPoints[wolf.id] = (numOthers * 2) * multiplier;
                others.forEach(p => playerPoints[p.id] = -2 * multiplier);
            }
        } else if (othersScore < wolfTeamScore) {
            // Ganan cazadores
            if (partner) {
                const totalLost = 2 * multiplier;
                const gainPerHunter = totalLost / others.length;
                others.forEach(p => playerPoints[p.id] = gainPerHunter);
                playerPoints[wolf.id] = -multiplier;
                playerPoints[partner.id] = -multiplier;
            } else {
                // Cazadores ganan contra Lone Wolf (2x base para cada cazador)
                const totalBase = (others.length * 2) * multiplier;
                const gainPerHunter = totalBase / others.length;
                others.forEach(p => playerPoints[p.id] = gainPerHunter);
                playerPoints[wolf.id] = -totalBase;
            }
        }
        return playerPoints;
    }
}

module.exports = new GolfEngine();
