// Estado Global
let isCm = true;
const cargoItems = [];

// Elementos DOM
const unitToggle = document.getElementById('unitToggle');
const lblCm = document.getElementById('lbl-cm');
const lblMm = document.getElementById('lbl-mm');
const unitTexts = document.querySelectorAll('.unit-text');
const cargoList = document.getElementById('cargoList');
const addCargoBtn = document.getElementById('addCargoBtn');
const calculateBtn = document.getElementById('calculateBtn');
const containerSelect = document.getElementById('containerSelect');
const containerPresetsWrapper = document.getElementById('containerPresetsWrapper');
const customContainerDim = document.getElementById('customContainerDim');
const vehicleOptions = document.querySelectorAll('.vehicle-option');
const vehicleDims = document.querySelectorAll('.vehicle-dim');

// Inputs Container
const contL = document.getElementById('contL');
const contW = document.getElementById('contW');
const contH = document.getElementById('contH');
const contMaxW = document.getElementById('contMaxW');

// Presets de Container (em CM)
const containerPresets = {
    '20ft': { l: 589, w: 235, h: 239, weight: 24000 },
    '40ft': { l: 1203, w: 235, h: 239, weight: 26000 },
    '40hc': { l: 1203, w: 235, h: 269, weight: 28000 }
};

// Alternância de Unidades
unitToggle.addEventListener('change', (e) => {
    const toMm = e.target.checked;
    if (toMm && isCm) {
        // Mudar para MM
        isCm = false;
        lblCm.classList.remove('active');
        lblMm.classList.add('active');
        document.querySelectorAll('.unit-text').forEach(el => el.textContent = 'mm');
        convertAllValues(10);
    } else if (!toMm && !isCm) {
        // Mudar para CM
        isCm = true;
        lblMm.classList.remove('active');
        lblCm.classList.add('active');
        document.querySelectorAll('.unit-text').forEach(el => el.textContent = 'cm');
        convertAllValues(0.1);
    }
});

function convertAllValues(factor) {
    // Inputs Container
    contL.value = Math.round(parseFloat(contL.value) * factor);
    contW.value = Math.round(parseFloat(contW.value) * factor);
    contH.value = Math.round(parseFloat(contH.value) * factor);
    
    // Inputs Cargas
    const items = document.querySelectorAll('.cargo-item');
    items.forEach(item => {
        const l = item.querySelector('.cargo-l');
        const w = item.querySelector('.cargo-w');
        const h = item.querySelector('.cargo-h');
        
        l.value = Math.round(parseFloat(l.value || 0) * factor);
        w.value = Math.round(parseFloat(w.value || 0) * factor);
        h.value = Math.round(parseFloat(h.value || 0) * factor);
    });
}

// Lógica do Vehicle Selector (Container vs Caminhão)
let activeVehicleType = 'container';

vehicleOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        vehicleOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        activeVehicleType = opt.dataset.type;
        
        if (activeVehicleType === 'container') {
            containerPresetsWrapper.style.display = 'block';
            vehicleDims.forEach(i => {
                i.readOnly = true;
                i.style.backgroundColor = 'rgba(255,255,255,0.05)';
                i.style.color = 'var(--text-muted)';
            });
            // Refletir preset atual
            containerSelect.dispatchEvent(new Event('change'));
        } else {
            containerPresetsWrapper.style.display = 'none';
            vehicleDims.forEach(i => {
                i.readOnly = false;
                i.style.backgroundColor = '';
                i.style.color = '';
            });
            // Resetar para um caminhão padrão
            const multiplier = isCm ? 1 : 10;
            contL.value = 600 * multiplier;
            contW.value = 240 * multiplier;
            contH.value = 240 * multiplier;
            contMaxW.value = 15000;
        }
        liveUpdate();
    });
});

// Seleção de Preset de Container
containerSelect.addEventListener('change', (e) => {
    const preset = containerPresets[e.target.value];
    if(preset) {
        const multiplier = isCm ? 1 : 10;
        contL.value = Math.round(preset.l * multiplier);
        contW.value = Math.round(preset.w * multiplier);
        contH.value = Math.round(preset.h * multiplier);
        contMaxW.value = preset.weight;
    }
    liveUpdate();
});

// Atualização Reativa nas Mudanças Manuais
vehicleDims.forEach(input => {
    input.addEventListener('input', () => liveUpdate());
});

function liveUpdate() {
    clearTimeout(liveUpdate.timeout);
    liveUpdate.timeout = setTimeout(() => {
        try { runPacking(); } catch(e) { console.error(e); }
    }, 300); // debounce pequeno
}

// Inicializar container inicial
containerSelect.dispatchEvent(new Event('change'));

// Adição de Carga
addCargoBtn.addEventListener('click', () => {
    const template = document.getElementById('cargo-template');
    const clo = template.content.cloneNode(true);
    
    const cargoItemDiv = clo.querySelector('.cargo-item');
    
    // Botão de remover
    clo.querySelector('.btn-remove').addEventListener('click', () => {
        cargoItemDiv.remove();
    });
    
    // Cor aleatória
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    clo.querySelector('.cargo-color').value = randomColor;

    cargoList.appendChild(clo);
});

// Iniciar com uma carga de exemplo
addCargoBtn.click();

// ----------------------------------------------------
// LÓGICA DE BIN PACKING E THREE.JS
// ----------------------------------------------------

let scene, camera, renderer, controls;
let containerMesh = null;
let boxesMeshes = [];

function init3D() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    
    // Câmera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
    camera.position.set(2000, 2000, 2000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Limpar estado inicial
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';
    
    container.appendChild(renderer.domElement);
    
    // Luzes
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(1000, 2000, 1000);
    scene.add(dirLight);

    // Controles
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Eixos para referência
    const axesHelper = new THREE.AxesHelper(1000);
    scene.add(axesHelper);
    
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    if(controls) controls.update();
    if(renderer && scene && camera) renderer.render(scene, camera);
}

// Quando a janela for redimensionada
window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    if(camera && renderer) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
});

calculateBtn.addEventListener('click', () => {
    document.getElementById('loading-overlay').classList.remove('hidden');
    
    setTimeout(() => {
        try {
            runPacking();
        } catch(e) {
            console.error(e);
            alert("Erro ao calcular: " + e.message);
        }
        document.getElementById('loading-overlay').classList.add('hidden');
    }, 100);
});

function getVal(val) {
    const v = parseFloat(val);
    return isNaN(v) ? 0 : v;
}

// Algoritmo Guildotine 3D Heurístico Simplificado
class Space {
    constructor(x, y, z, w, h, d) {
        this.x = x; this.y = y; this.z = z;
        this.w = w; this.h = h; this.d = d;
    }
}

function runPacking() {
    // 1. Coletar dados do Container (Converter para CM para o cálculo interno, facilita)
    const factorToCm = isCm ? 1 : 0.1;
    const cW = getVal(contW.value) * factorToCm;
    const cH = getVal(contH.value) * factorToCm;
    const cD = getVal(contL.value) * factorToCm; // L = depth
    const maxWeight = getVal(contMaxW.value);
    
    if(cW === 0 || cH === 0 || cD === 0) return alert("Dimensões do container inválidas.");

    // 2. Coletar Cargas
    let itemsToPack = [];
    let boxesCount = 0;
    
    const cargoDOMs = document.querySelectorAll('.cargo-item');
    cargoDOMs.forEach(node => {
        const name = node.querySelector('.cargo-name').value || "Carga";
        const w = getVal(node.querySelector('.cargo-w').value) * factorToCm;
        const h = getVal(node.querySelector('.cargo-h').value) * factorToCm;
        const d = getVal(node.querySelector('.cargo-l').value) * factorToCm;
        const q = parseInt(node.querySelector('.cargo-q').value) || 0;
        const weight = getVal(node.querySelector('.cargo-weight-val').value);
        const rotate = node.querySelector('.cargo-rotate').checked;
        const color = node.querySelector('.cargo-color').value;
        
        boxesCount += q;
        
        for(let i=0; i<q; i++) {
            itemsToPack.push({
                id: Math.random().toString(),
                name, w, h, d, weight, rotate, color, volume: w*h*d
            });
        }
    });
    
    if(itemsToPack.length === 0) return alert("Adicione pelo menos uma carga.");

    // Ordenar itens do maior volume para o menor
    itemsToPack.sort((a,b) => b.volume - a.volume);

    let freeSpaces = [new Space(0,0,0, cW, cH, cD)];
    let packedItems = [];
    let currentWeight = 0;
    
    // Contadores de falha
    let failedWeightCount = 0;
    let failedSpaceCount = 0;

    // Empacotamento
    for(const item of itemsToPack) {
        if(currentWeight + item.weight > maxWeight) {
            // Peso excedido, pula o item
            failedWeightCount++;
            continue; 
        }

        // Tentar encontrar um espaço
        let bestSpaceIndex = -1;
        let finalW, finalH, finalD;
        
        // Gerar rotações permitidas
        // A pedido do usuário: girar apenas no eixo Y (largura x comprimento). NUNCA deitar ou virar de ponta cabeça.
        let rotations = [ [item.w, item.h, item.d] ];
        if(item.rotate) {
            rotations.push([item.d, item.h, item.w]);
        }

        // Achar o espaço mais embaixo e mais no fundo possível (Min Y, Min Z, Min X)
        for(let i = 0; i < freeSpaces.length; i++) {
            let space = freeSpaces[i];
            
            for(let rot of rotations) {
                let [rw, rh, rd] = rot;
                if(rw <= space.w && rh <= space.h && rd <= space.d) {
                    if(bestSpaceIndex === -1) {
                        bestSpaceIndex = i;
                        finalW = rw; finalH = rh; finalD = rd;
                    } else {
                        // Comparar com o best anterior para pegar o melhor (heuristic)
                        let bestSpace = freeSpaces[bestSpaceIndex];
                        if(space.y < bestSpace.y || (space.y === bestSpace.y && space.z < bestSpace.z)) {
                            bestSpaceIndex = i;
                            finalW = rw; finalH = rh; finalD = rd;
                        }
                    }
                }
            }
        }

        if(bestSpaceIndex !== -1) {
            let space = freeSpaces.splice(bestSpaceIndex, 1)[0];
            
            // Empacotar
            packedItems.push({
                ...item,
                x: space.x,
                y: space.y,
                z: space.z,
                w: finalW,
                h: finalH,
                d: finalD
            });
            currentWeight += item.weight;

            // Split do espaço restante (Cria 3 novos espaços em volta da caixa inserida)
            // 1. Espaço Acima (Top)
            if(space.h - finalH > 0) {
                freeSpaces.push(new Space(space.x, space.y + finalH, space.z, finalW, space.h - finalH, finalD));
            }
            // 2. Espaço ao Lado (Right)
            if(space.w - finalW > 0) {
                freeSpaces.push(new Space(space.x + finalW, space.y, space.z, space.w - finalW, space.h, finalD));
            }
            // 3. Espaço a Frente (Front)
            if(space.d - finalD > 0) {
                freeSpaces.push(new Space(space.x, space.y, space.z + finalD, space.w, space.h, space.d - finalD));
            }
            
            // Opcional: Consolidação de espaços vazios seria ideal, mas pra MVP tá ok.
        } else {
            failedSpaceCount++;
        }
    }

    render3D(cW, cH, cD, packedItems);
    updateStats(boxesCount, packedItems.length, cW*cH*cD, packedItems, currentWeight, maxWeight);
    
    // Banner de Aviso: Por que não coube?
    const warningBox = document.getElementById('capacity-warning');
    const warningMsg = document.getElementById('warning-text');
    
    if (failedWeightCount > 0 || failedSpaceCount > 0) {
        warningBox.style.display = 'flex';
        const failCount = failedWeightCount + failedSpaceCount;
        
        let reason = "";
        if(failedWeightCount > 0 && failedSpaceCount > 0) {
            reason = "por limite de peso excedido e por falta de espaço físico no veículo";
        } else if (failedWeightCount > 0) {
            reason = "por limite de peso excedido";
        } else {
            reason = "por falta de espaço físico no veículo";
        }
        
        warningMsg.textContent = `Atenção: ${failCount} item(s) não couberam ${reason}. Tente um veículo maior ou ajuste as cargas.`;
    } else {
        warningBox.style.display = 'none';
    }
}

function updateStats(totalBoxes, packedBoxes, totalVol, packedItems, currentWeight, maxWeight) {
    document.getElementById('stat-count').textContent = `${packedBoxes} / ${totalBoxes}`;
    
    let usedVol = 0;
    packedItems.forEach(i => usedVol += (i.w * i.h * i.d));
    let volPercent = totalVol > 0 ? (usedVol / totalVol) * 100 : 0;
    document.getElementById('stat-vol').textContent = volPercent.toFixed(2) + '%';
    
    let wPercent = maxWeight > 0 ? (currentWeight / maxWeight) * 100 : 0;
    document.getElementById('stat-weight').textContent = wPercent.toFixed(2) + '%';
}

function render3D(cW, cH, cD, packedItems) {
    if(!scene) init3D();
    
    // Limpar meshes antigas
    if(containerMesh) scene.remove(containerMesh);
    boxesMeshes.forEach(mesh => scene.remove(mesh));
    boxesMeshes = [];

    // O Three.js posiciona pelo centro. Para alinhar como a nossa lógia (x,y,z da ponta), vamos criar um Offset.
    const ox = -cW/2;
    const oy = -cH/2;
    const oz = -cD/2;

    // Criar Container Wrapper
    const contGeo = new THREE.BoxGeometry(cW, cH, cD);
    const contMat = new THREE.MeshBasicMaterial({ 
        color: 0x3B82F6, 
        wireframe: false, 
        transparent: true, 
        opacity: 0.1,
        depthWrite: false
    });
    containerMesh = new THREE.Mesh(contGeo, contMat);
    // Adicionar bordas marcadas
    const edges = new THREE.EdgesGeometry(contGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3B82F6, linewidth: 2 }));
    containerMesh.add(line);
    
    // Centralizar
    containerMesh.position.set(0, 0, 0);
    scene.add(containerMesh);

    // Adicionar Caixas
    packedItems.forEach(item => {
        const geo = new THREE.BoxGeometry(item.w, item.h, item.d);
        
        // Criar bordas finas para distinguir caixas da mesma cor
        const bEdges = new THREE.EdgesGeometry(geo);
        const bLine = new THREE.LineSegments(bEdges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1, transparent: true, opacity: 0.5 }));

        const mat = new THREE.MeshLambertMaterial({ color: item.color });
        const mesh = new THREE.Mesh(geo, mat);
        
        // Offset baseado no (x,y,z) que é bottom-left-back no nosso box algorithm
        mesh.position.set(
            ox + item.x + item.w/2,
            oy + item.y + item.h/2,
            oz + item.z + item.d/2
        );
        
        mesh.add(bLine);
        scene.add(mesh);
        boxesMeshes.push(mesh);
    });

    // Ajustar Câmera
    const maxDim = Math.max(cW, cH, cD);
    camera.position.set(maxDim*1.2, maxDim*0.8, maxDim*1.2);
    controls.target.set(0, 0, 0);
}
