/**
 * EcoSim - Motor de Simulación Depredador-Presa
 * Arquitectura modular ES6+ sin dependencias.
 */

// ==========================================
// 1. UTILIDADES Y PRNG (Pseudo-Random Number Generator)
// ==========================================
class PRNG {
    constructor(seed) {
        this.seed = seed || Math.floor(Math.random() * 0xFFFFFFFF);
    }
    // Mulberry32
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Algoritmo Fisher-Yates utilizando nuestro PRNG
function shuffle(array, prng) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(prng.next() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ==========================================
// 2. CONFIGURACIÓN GLOBAL (Estado)
// ==========================================
const Config = {
    cols: 45,
    rows: 45,
    cellSize: 12, // 45 * 12 = 540px
    plantGrowthRate: 0.03, // 3.0%
    energyPerPlant: 10,
    energyPerPrey: 15,
    reproductionThreshold: 20,
    colors: {
        0: '#000000', // Vacío
        1: '#2ecc71', // Planta
        2: '#00bcd4', // Herbívoro
        3: '#e74c3c'  // Depredador
    }
};

// ==========================================
// 3. NÚCLEO DE SIMULACIÓN (EcosystemGrid)
// ==========================================
class EcosystemGrid {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.grid = [];
        this.tickCount = 0;
        this.prng = new PRNG();
        this.useFixedSeed = false;
        this.stats = { p: 0, h: 0, pr: 0 };
        this.history = []; // Para exportar a CSV
        this.extinct = { h: false, pr: false };
        this.initGrid();
    }

    initGrid() {
        this.grid = Array.from({ length: Config.rows }, () =>
            Array.from({ length: Config.cols }, () => ({ type: 0, energy: 0, acted: false }))
        );
        this.tickCount = 0;
        this.history = [];
        this.extinct = { h: false, pr: false };
        document.getElementById('extinction-banner').classList.add('hidden');
    }

    setSeed(useFixed) {
        this.useFixedSeed = useFixed;
        this.prng = new PRNG(useFixed ? 42 : null);
    }

    // Siembra inicial de población aleatoria
    populate(plants, herbivores, predators) {
        this.initGrid();
        let cells = [];
        for (let y = 0; y < Config.rows; y++) {
            for (let x = 0; x < Config.cols; x++) cells.push({ x, y });
        }
        cells = shuffle(cells, this.prng);
        
        let i = 0;
        while (plants-- > 0 && i < cells.length) { this.grid[cells[i].y][cells[i].x] = { type: 1, energy: 0, acted: false }; i++; }
        while (herbivores-- > 0 && i < cells.length) { this.grid[cells[i].y][cells[i].x] = { type: 2, energy: Config.reproductionThreshold / 2, acted: false }; i++; }
        while (predators-- > 0 && i < cells.length) { this.grid[cells[i].y][cells[i].x] = { type: 3, energy: Config.reproductionThreshold / 2, acted: false }; i++; }
        
        this.updateStats();
        this.draw();
    }

    getNeighbors(x, y) {
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                let nx = x + dx;
                let ny = y + dy;
                // Toroidal wrap (borde infinito) o límites físicos. Usaremos límites físicos.
                if (nx >= 0 && nx < Config.cols && ny >= 0 && ny < Config.rows) {
                    neighbors.push({ x: nx, y: ny, cell: this.grid[ny][nx] });
                }
            }
        }
        return shuffle(neighbors, this.prng); // Barajar vecinos para evitar sesgos direccionales
    }

    tick() {
        // 1. Resetear bandera de acción
        let cellCoords = [];
        for (let y = 0; y < Config.rows; y++) {
            for (let x = 0; x < Config.cols; x++) {
                this.grid[y][x].acted = false;
                cellCoords.push({ x, y });
            }
        }

        // 2. Barajar orden de ejecución (Evita sesgo de barrido)
        cellCoords = shuffle(cellCoords, this.prng);

        // 3. Procesar celdas
        for (const coord of cellCoords) {
            const x = coord.x;
            const y = coord.y;
            const current = this.grid[y][x];

            if (current.acted) continue;

            const neighbors = this.getNeighbors(x, y);
            const emptyNeighbors = neighbors.filter(n => n.cell.type === 0);

            // Regla 1: Plantas crecen en celdas vacías
            if (current.type === 0) {
                if (this.prng.next() < Config.plantGrowthRate) {
                    this.grid[y][x] = { type: 1, energy: 0, acted: true };
                }
                continue;
            }

            if (current.type === 1) continue; // Planta ya procesada si no fue comida

            // Regla 2 y 3: Herbívoros y Depredadores
            if (current.type === 2 || current.type === 3) {
                current.energy -= 1; // Pierden energía por vivir

                if (current.energy <= 0) {
                    this.grid[y][x] = { type: 0, energy: 0, acted: true }; // Muerte por inanición
                    continue;
                }

                let targetType = current.type === 2 ? 1 : 2; // Herbívoros comen plantas(1), Depredadores comen herbívoros(2)
                let foodNeighbors = neighbors.filter(n => n.cell.type === targetType);
                let newPos = { x, y };

                if (foodNeighbors.length > 0) {
                    // Comer y moverse
                    const target = foodNeighbors[0];
                    current.energy += (current.type === 2) ? Config.energyPerPlant : Config.energyPerPrey;
                    newPos = { x: target.x, y: target.y };
                } else if (emptyNeighbors.length > 0) {
                    // Moverse al azar si no hay comida
                    const target = emptyNeighbors[0];
                    newPos = { x: target.x, y: target.y };
                }

                // Mover entidad a newPos
                let entityToMove = { type: current.type, energy: current.energy, acted: true };
                this.grid[y][x] = { type: 0, energy: 0, acted: true }; // Dejar la celda original
                
                // Reproducción (Ocurre en la posición anterior si se movió, o si no, busca vecino vacío)
                if (entityToMove.energy >= Config.reproductionThreshold) {
                    entityToMove.energy = Math.floor(entityToMove.energy / 2);
                    let spawnPos = { x, y }; // Intentar dejar cría en la posición original (que acaba de quedar vacía)
                    if (spawnPos.x === newPos.x && spawnPos.y === newPos.y && emptyNeighbors.length > 0) {
                         spawnPos = { x: emptyNeighbors[0].x, y: emptyNeighbors[0].y }; // Fallback
                    }
                    if (spawnPos.x !== newPos.x || spawnPos.y !== newPos.y) {
                         this.grid[spawnPos.y][spawnPos.x] = { type: entityToMove.type, energy: entityToMove.energy, acted: true };
                    }
                }

                this.grid[newPos.y][newPos.x] = entityToMove;
            }
        }

        this.tickCount++;
        this.updateStats();
        this.draw();
        return this.stats;
    }

    updateStats() {
        let p = 0, h = 0, pr = 0;
        for (let y = 0; y < Config.rows; y++) {
            for (let x = 0; x < Config.cols; x++) {
                if (this.grid[y][x].type === 1) p++;
                else if (this.grid[y][x].type === 2) h++;
                else if (this.grid[y][x].type === 3) pr++;
            }
        }
        
        // Comprobar extinción (si había en el tick anterior y ahora hay 0)
        const banner = document.getElementById('extinction-banner');
        if ((this.stats.h > 0 && h === 0) || (this.stats.pr > 0 && pr === 0)) {
            banner.classList.remove('hidden');
        }

        this.stats = { p, h, pr };
        this.history.push({ tick: this.tickCount, p, h, pr });
        
        document.getElementById('stat-tick').textContent = this.tickCount;
        document.getElementById('stat-plants').textContent = p;
        document.getElementById('stat-herbs').textContent = h;
        document.getElementById('stat-preds').textContent = pr;
    }

    draw() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let y = 0; y < Config.rows; y++) {
            for (let x = 0; x < Config.cols; x++) {
                const cell = this.grid[y][x];
                if (cell.type !== 0) {
                    ctx.fillStyle = Config.colors[cell.type];
                    ctx.fillRect(x * Config.cellSize, y * Config.cellSize, Config.cellSize, Config.cellSize);
                }
            }
        }
    }

    paintCell(x, y, brushType) {
        const gridX = Math.floor(x / Config.cellSize);
        const gridY = Math.floor(y / Config.cellSize);
        if (gridX >= 0 && gridX < Config.cols && gridY >= 0 && gridY < Config.rows) {
            let type = parseInt(brushType);
            let energy = type > 1 ? Config.reproductionThreshold / 2 : 0;
            this.grid[gridY][gridX] = { type, energy, acted: false };
            this.draw();
            this.updateStats(); // Forzar actualización visual de números pero no empujar a la historia general.
        }
    }
}

// ==========================================
// 4. GRÁFICA POBLACIONAL (PopulationChart)
// ==========================================
class PopulationChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.maxPoints = 200;
        this.data = [];
    }

    update(stats) {
        this.data.push({ ...stats });
        if (this.data.length > this.maxPoints) {
            this.data.shift();
        }
        this.draw();
    }

    reset() {
        this.data = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        const { ctx, canvas, data } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (data.length === 0) return;

        // Encontrar max Y para escala
        let maxVal = Math.max(...data.map(d => Math.max(d.p, d.h, d.pr)), 10);
        
        const drawLine = (key, color) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            for (let i = 0; i < data.length; i++) {
                const x = (i / this.maxPoints) * canvas.width;
                const y = canvas.height - ((data[i][key] / maxVal) * canvas.height);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        };

        drawLine('p', Config.colors[1]);
        drawLine('h', Config.colors[2]);
        drawLine('pr', Config.colors[3]);
    }
}

// ==========================================
// 5. CONTROLADOR DE INTERFAZ Y BUCLE PRINCIPAL (UIController)
// ==========================================
class UIController {
    constructor() {
        this.sim = new EcosystemGrid('gridCanvas');
        this.chart = new PopulationChart('chartCanvas');
        
        this.loopId = null;
        this.speed = 100; // ms
        this.isPlaying = false;
        
        this.setupEventListeners();
        this.loadPreset('equilibrio'); // Cargar preset por defecto
    }

    loop = () => {
        if (!this.isPlaying) return;
        const stats = this.sim.tick();
        this.chart.update(stats);
        this.loopId = setTimeout(this.loop, this.speed);
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        document.getElementById('btn-play-pause').textContent = this.isPlaying ? "Pausar ⏸️" : "Iniciar ▶️";
        if (this.isPlaying) this.loop();
        else clearTimeout(this.loopId);
    }

    step() {
        if (this.isPlaying) this.togglePlay();
        const stats = this.sim.tick();
        this.chart.update(stats);
    }

    loadPreset(presetName) {
        let p, h, pr;
        switch (presetName) {
            case 'equilibrio':
                document.getElementById('sl-plant-growth').value = 5.0;
                document.getElementById('sl-energy-plant').value = 12;
                document.getElementById('sl-energy-prey').value = 25;
                document.getElementById('sl-reproduction').value = 35;
                p = 300; h = 150; pr = 40;
                break;
            case 'colapso':
                document.getElementById('sl-plant-growth').value = 2.0;
                document.getElementById('sl-energy-plant').value = 10;
                document.getElementById('sl-energy-prey').value = 12;
                document.getElementById('sl-reproduction').value = 15; // Se reproducen rapidísimo
                p = 200; h = 100; pr = 200; // Demasiados depredadores
                break;
            case 'explosion':
                document.getElementById('sl-plant-growth').value = 15.0;
                document.getElementById('sl-energy-plant').value = 20;
                document.getElementById('sl-reproduction').value = 10;
                p = 500; h = 200; pr = 0; // Sin depredadores naturales
                break;
        }
        
        // Disparar eventos input para actualizar UI y Config
        ['plant-growth', 'energy-plant', 'energy-prey', 'reproduction'].forEach(id => {
            const el = document.getElementById(`sl-${id}`);
            el.dispatchEvent(new Event('input'));
        });

        this.sim.populate(p, h, pr);
        this.chart.reset();
        this.chart.update(this.sim.stats);
    }

    exportCSV() {
        const rows = [["Tick", "Plantas", "Herbivoros", "Depredadores"]];
        this.sim.history.forEach(r => rows.push([r.tick, r.p, r.h, r.pr]));
        
        let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ecosim_history_tick_${this.sim.tickCount}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    setupEventListeners() {
        // Reproducción
        document.getElementById('btn-play-pause').addEventListener('click', () => this.togglePlay());
        document.getElementById('btn-step').addEventListener('click', () => this.step());
        document.getElementById('btn-reset').addEventListener('click', () => {
            if (this.isPlaying) this.togglePlay();
            this.loadPreset('equilibrio');
        });

        // Velocidad
        document.querySelectorAll('input[name="speed"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.speed = parseInt(e.target.value));
        });

        // Semilla Fija
        document.getElementById('chk-seed').addEventListener('change', (e) => {
            this.sim.setSeed(e.target.checked);
        });

        // Sliders
        const syncSlider = (id, configKey, valId, isFloat = false) => {
            document.getElementById(id).addEventListener('input', (e) => {
                const val = isFloat ? parseFloat(e.target.value) / 100 : parseInt(e.target.value);
                Config[configKey] = val;
                document.getElementById(valId).textContent = e.target.value;
            });
        };
        syncSlider('sl-plant-growth', 'plantGrowthRate', 'val-plant-growth', true);
        syncSlider('sl-energy-plant', 'energyPerPlant', 'val-energy-plant');
        syncSlider('sl-energy-prey', 'energyPerPrey', 'val-energy-prey');
        syncSlider('sl-reproduction', 'reproductionThreshold', 'val-reproduction');

        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.isPlaying) this.togglePlay();
                this.loadPreset(e.target.dataset.preset);
            });
        });

        // Pincel Interactivo
        let isDrawing = false;
        const getBrushVal = () => document.querySelector('input[name="brush"]:checked').value;
        const paint = (e) => {
            const rect = this.sim.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.sim.paintCell(x, y, getBrushVal());
        };

        this.sim.canvas.addEventListener('mousedown', (e) => { isDrawing = true; paint(e); });
        this.sim.canvas.addEventListener('mousemove', (e) => { if (isDrawing) paint(e); });
        window.addEventListener('mouseup', () => isDrawing = false);

        // Exportar CSV
        document.getElementById('btn-export').addEventListener('click', () => this.exportCSV());
    }
}

// Iniciar aplicación
window.onload = () => {
    new UIController();
};
