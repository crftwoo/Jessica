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
if (unitToggle) {
    unitToggle.addEventListener('change', (e) => {
        const toMm = e.target.checked;
        if (toMm && isCm) {
            isCm = false;
            lblCm.classList.remove('active');
            lblMm.classList.add('active');
            document.querySelectorAll('.unit-text').forEach(el => el.textContent = 'mm');
            convertAllValues(10);
        } else if (!toMm && !isCm) {
            isCm = true;
            lblMm.classList.remove('active');
            lblCm.classList.add('active');
            document.querySelectorAll('.unit-text').forEach(el => el.textContent = 'cm');
            convertAllValues(0.1);
        }
    });
}

function convertAllValues(factor) {
    contL.value = Math.round(parseFloat(contL.value) * factor);
    contW.value = Math.round(parseFloat(contW.value) * factor);
    contH.value = Math.round(parseFloat(contH.value) * factor);
    
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
                i.style.opacity = '0.6';
            });
            containerSelect.dispatchEvent(new Event('change'));
        } else {
            containerPresetsWrapper.style.display = 'none';
            vehicleDims.forEach(i => {
                i.readOnly = false;
                i.style.opacity = '1';
            });
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
if (containerSelect) {
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
}

vehicleDims.forEach(input => {
    input.addEventListener('input', () => liveUpdate());
});

function liveUpdate() {
    clearTimeout(liveUpdate.timeout);
    liveUpdate.timeout = setTimeout(() => {
        try { runPacking(); } catch(e) { console.error(e); }
    }, 500);
}

// Inicializar container inicial
if (containerSelect) containerSelect.dispatchEvent(new Event('change'));

// Adição de Carga
addCargoBtn.addEventListener('click', () => {
    const template = document.getElementById('cargo-template');
    const clo = template.content.cloneNode(true);
    const cargoItemDiv = clo.querySelector('.cargo-item');
    
    clo.querySelector('.btn-remove').addEventListener('click', () => {
        cargoItemDiv.remove();
        liveUpdate();
    });
    
    const colors = ['#1966ff', '#e1121a', '#10B981', '#F59E0B', '#8B5CF6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    clo.querySelector('.cargo-color').value = randomColor;

    cargoList.appendChild(clo);
    
    // Auto-update on new input
    cargoItemDiv.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => liveUpdate());
    });
    
    liveUpdate();
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
    if (!container) return;
    
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
    camera.position.set(1200, 1000, 1200);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';
    
    container.appendChild(renderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(1000, 2000, 1000);
    scene.add(dirLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    if(controls) controls.update();
    if(renderer && scene && camera) renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    if(camera && renderer && container) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
});

calculateBtn.addEventListener('click', () => {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');
    
    setTimeout(() => {
        try {
            runPacking();
        } catch(e) {
            console.error(e);
        }
        overlay.classList.add('hidden');
    }, 600);
});

function getVal(val) {
    const v = parseFloat(val);
    return isNaN(v) ? 0 : v;
}

class Space {
    constructor(x, y, z, w, h, d) {
        this.x = x; this.y = y; this.z = z;
        this.w = w; this.h = h; this.d = d;
    }
}

function runPacking() {
    const factorToCm = isCm ? 1 : 0.1;
    const cW = getVal(contW.value) * factorToCm;
    const cH = getVal(contH.value) * factorToCm;
    const cD = getVal(contL.value) * factorToCm; 
    const maxWeight = getVal(contMaxW.value);
    
    if(cW === 0 || cH === 0 || cD === 0) return;

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
    
    if(itemsToPack.length === 0) return;

    itemsToPack.sort((a,b) => b.volume - a.volume);

    let freeSpaces = [new Space(0,0,0, cW, cH, cD)];
    let packedItems = [];
    let currentWeight = 0;
    let failedWeightCount = 0;
    let failedSpaceCount = 0;

    for(const item of itemsToPack) {
        if(currentWeight + item.weight > maxWeight) {
            failedWeightCount++;
            continue; 
        }

        let bestSpaceIndex = -1;
        let finalW, finalH, finalD;
        
        let rotations = [ [item.w, item.h, item.d] ];
        if(item.rotate) rotations.push([item.d, item.h, item.w]);

        for(let i = 0; i < freeSpaces.length; i++) {
            let space = freeSpaces[i];
            for(let rot of rotations) {
                let [rw, rh, rd] = rot;
                if(rw <= space.w && rh <= space.h && rd <= space.d) {
                    if(bestSpaceIndex === -1) {
                        bestSpaceIndex = i;
                        finalW = rw; finalH = rh; finalD = rd;
                    } else {
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
            packedItems.push({
                ...item, x: space.x, y: space.y, z: space.z, w: finalW, h: finalH, d: finalD
            });
            currentWeight += item.weight;

            if(space.h - finalH > 0) freeSpaces.push(new Space(space.x, space.y + finalH, space.z, finalW, space.h - finalH, finalD));
            if(space.w - finalW > 0) freeSpaces.push(new Space(space.x + finalW, space.y, space.z, space.w - finalW, space.h, finalD));
            if(space.d - finalD > 0) freeSpaces.push(new Space(space.x, space.y, space.z + finalD, space.w, space.h, space.d - finalD));
        } else {
            failedSpaceCount++;
        }
    }

    render3D(cW, cH, cD, packedItems);
    updateStats(boxesCount, packedItems.length, cW*cH*cD, packedItems, currentWeight, maxWeight);
    
    const warningBox = document.getElementById('capacity-warning');
    const warningMsg = document.getElementById('warning-text');
    
    if (failedWeightCount > 0 || failedSpaceCount > 0) {
        warningBox.style.display = 'flex';
        const failCount = failedWeightCount + failedSpaceCount;
        let reason = (failedWeightCount > 0 && failedSpaceCount > 0) ? "por limite de peso e falta de espaço" : (failedWeightCount > 0 ? "por limite de peso" : "por falta de espaço físico");
        warningMsg.textContent = `Atenção: ${failCount} item(s) não couberam ${reason}.`;
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
    
    if(containerMesh) scene.remove(containerMesh);
    boxesMeshes.forEach(mesh => scene.remove(mesh));
    boxesMeshes = [];

    const ox = -cW/2;
    const oy = -cH/2;
    const oz = -cD/2;

    const contGeo = new THREE.BoxGeometry(cW, cH, cD);
    const contMat = new THREE.MeshBasicMaterial({ color: 0x1966ff, transparent: true, opacity: 0.1, depthWrite: false });
    containerMesh = new THREE.Mesh(contGeo, contMat);
    const edges = new THREE.EdgesGeometry(contGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1966ff, opacity: 0.5, transparent: true }));
    containerMesh.add(line);
    scene.add(containerMesh);

    packedItems.forEach(item => {
        const geo = new THREE.BoxGeometry(item.w, item.h, item.d);
        const bEdges = new THREE.EdgesGeometry(geo);
        const bLine = new THREE.LineSegments(bEdges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));

        const mat = new THREE.MeshLambertMaterial({ color: item.color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ox + item.x + item.w/2, oy + item.y + item.h/2, oz + item.z + item.d/2);
        mesh.add(bLine);
        scene.add(mesh);
        boxesMeshes.push(mesh);
    });
}
