// Manejo de pestanas
function openTab(tabId) {
    const esMaterialGeneral = tabId.startsWith('material:');
    const seccionId = esMaterialGeneral ? 'material-generico' : tabId;

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(seccionId).classList.add('active');

    const materialSelect = document.getElementById('material-select');
    if (materialSelect) {
        materialSelect.value = tabId;
    }

    if (esMaterialGeneral) {
        mostrarMaterialGeneralSeleccionado(tabId.replace('material:', ''));
    }
}

// Redondeo al multiplo de 5 mas cercano
function redondear5(valor) {
    return Math.round(valor / 5) * 5;
}

function prepararSelectBuscable(select) {
    if (!select) return;

    select.dataset.opcionesOriginales = JSON.stringify(
        [...select.options].map(option => ({
            value: option.value,
            text: option.textContent,
            selected: option.selected,
            materialGeneral: option.dataset.materialGeneral || ''
        }))
    );
}

function obtenerOpcionesSelect(select) {
    if (!select.dataset.opcionesOriginales) {
        prepararSelectBuscable(select);
    }

    return JSON.parse(select.dataset.opcionesOriginales || '[]');
}

function filtrarSelect(selectId, busqueda) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const opcionesOriginales = obtenerOpcionesSelect(select);
    const valorActual = select.value;
    const texto = busqueda.trim().toLowerCase();
    const filtradas = opcionesOriginales.filter(option => option.text.toLowerCase().includes(texto));

    select.innerHTML = '';
    filtradas.forEach(optionData => {
        const option = document.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.text;
        if (optionData.materialGeneral) {
            option.dataset.materialGeneral = optionData.materialGeneral;
        }
        select.appendChild(option);
    });

    if (filtradas.some(option => option.value === valorActual)) {
        select.value = valorActual;
    } else if (filtradas.length) {
        select.selectedIndex = 0;
    }
}

const MATERIALES_CORTE_DEFAULT = [
    { id: 'laser', nombre: 'Acrilico (Laser)', costoPie: 0, tipo: 'laser' },
    { id: 'sintra', nombre: 'Sintra (CNC)', costoPie: 0, tipo: 'sintra' },
    { id: 'acm', nombre: 'ACM (CNC)', costoPie: 0, tipo: 'acm' }
];

let materialesGeneralesCache = [];
let materialesCorteCache = [...MATERIALES_CORTE_DEFAULT];

function normalizarIdMaterial(nombre) {
    return nombre.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function verificarCodigoGeneralMaterial() {
    const codigoInput = document.getElementById('material-codigo-verificacion');
    const codigo = codigoInput ? codigoInput.value.trim() : '';
    if (codigo === '2397') return true;
    alert('Código de verificación incorrecto. No se puede crear o editar materiales generales.');
    return false;
}

function verificarCodigoCorteMaterial() {
    const codigoInput = document.getElementById('corte-codigo-verificacion');
    const codigo = codigoInput ? codigoInput.value.trim() : '';
    if (codigo === '2397') return true;
    alert('Código de verificación incorrecto. No se puede crear o editar materiales de corte.');
    return false;
}

function obtenerMaterialesGenerales() {
    return materialesGeneralesCache;
}

function guardarMaterialesGenerales(materiales) {
    materialesGeneralesCache = materiales;
}

function exportarMaterialesGeneralesJson() {
    const materiales = obtenerMaterialesGenerales();
    const payload = { materiales: materiales.map(({ id, nombre, costoPie, costoMinimo }) => ({ id, nombre, costoPie, costoMinimo })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'materiales-generales.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function triggerMaterialJsonUpload() {
    const fileInput = document.getElementById('material-json-file-input');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
}

function importarMaterialesGeneralesJson(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const contenido = reader.result;
            const datos = JSON.parse(contenido);
            cargarMaterialesGeneralesDesdeJson(datos);
        } catch (error) {
            alert('Archivo JSON no válido. Revisa el formato e inténtalo nuevamente.');
            console.error('Error importando JSON de materiales:', error);
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function cargarMaterialesGeneralesDesdeJson(datos) {
    let materiales = [];
    if (Array.isArray(datos)) {
        materiales = datos;
    } else if (Array.isArray(datos.materiales)) {
        materiales = datos.materiales;
    } else {
        return alert('JSON inválido: debe contener un arreglo de materiales o { materiales: [...] }.');
    }

    const validos = materiales.reduce((acc, item) => {
        const nombre = String(item.nombre || item.name || '').trim();
        const costoPie = parseFloat(item.costoPie ?? item.costo ?? item.price ?? '');
        const costoMinimo = parseFloat(item.costoMinimo ?? item.minimo ?? item.minimum ?? 0) || 0;
        if (!nombre || isNaN(costoPie) || costoPie < 0) return acc;

        const id = normalizarIdMaterial(item.id ? String(item.id) : nombre);
        acc[id] = { id, nombre, costoPie, costoMinimo };
        return acc;
    }, {});

    const lista = Object.values(validos);
    if (!lista.length) {
        return alert('No se encontraron materiales válidos en el JSON.');
    }

    guardarMaterialesGenerales(lista);
    cargarMaterialesGenerales();

    lista.forEach(material => guardarMaterialesEnFirebase('generales', material));
    alert(`Se importaron ${lista.length} material(es) correctamente.`);
}

function cargarMaterialesGenerales() {
    const select = document.getElementById('material-select');
    if (!select) return;

    const valorActual = select.value;
    const materiales = obtenerMaterialesGenerales();

    select.querySelectorAll('option[data-material-general="true"]').forEach(option => option.remove());

    materiales.forEach(material => {
        const option = document.createElement('option');
        option.value = `material:${material.id}`;
        option.textContent = material.nombre;
        option.dataset.materialGeneral = 'true';
        select.appendChild(option);
    });

    if ([...select.options].some(option => option.value === valorActual)) {
        select.value = valorActual;
    }

    prepararSelectBuscable(select);

    renderizarTablaMateriales(materiales);
}

function renderizarTablaMateriales(materiales) {
    const tbody = document.getElementById('materiales-config-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!materiales.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" class="empty-cell">No hay materiales agregados todavia.</td>';
        tbody.appendChild(row);
        return;
    }

    materiales.forEach(material => {
        const row = document.createElement('tr');

        const nombreInput = document.createElement('input');
        nombreInput.type = 'text';
        nombreInput.value = material.nombre;
        nombreInput.id = `material-nombre-${material.id}`;

        const costoInput = document.createElement('input');
        costoInput.type = 'number';
        costoInput.value = material.costoPie;
        costoInput.step = '0.01';
        costoInput.id = `material-costo-${material.id}`;

        const minimoInput = document.createElement('input');
        minimoInput.type = 'number';
        minimoInput.value = material.costoMinimo || 0;
        minimoInput.step = '0.01';
        minimoInput.id = `material-minimo-${material.id}`;

        const acciones = document.createElement('div');
        acciones.className = 'table-actions';

        const usarBtn = document.createElement('button');
        usarBtn.type = 'button';
        usarBtn.className = 'table-btn';
        usarBtn.textContent = 'Usar';
        usarBtn.onclick = () => usarMaterialGeneral(material.id);

        const guardarBtn = document.createElement('button');
        guardarBtn.type = 'button';
        guardarBtn.className = 'table-btn';
        guardarBtn.textContent = 'Guardar';
        guardarBtn.onclick = () => guardarMaterialGeneralDesdeTabla(material.id);

        acciones.append(usarBtn, guardarBtn);
        [nombreInput, costoInput, minimoInput, acciones].forEach(elemento => {
            const cell = document.createElement('td');
            cell.appendChild(elemento);
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

function usarMaterialGeneral(idMaterial) {
    openTab(`material:${idMaterial}`);
}

function guardarMaterialGeneralDesdeTabla(idMaterial) {
    const nombreInput = document.getElementById(`material-nombre-${idMaterial}`);
    const costoInput = document.getElementById(`material-costo-${idMaterial}`);
    const minimoInput = document.getElementById(`material-minimo-${idMaterial}`);
    if (!nombreInput || !costoInput || !minimoInput) return;

    guardarMaterialGeneralData(idMaterial, nombreInput.value, costoInput.value, minimoInput.value);
}

function obtenerMaterialGeneralSeleccionado() {
    const select = document.getElementById('material-select');
    if (!select || !select.value.startsWith('material:')) return null;

    const id = select.value.replace('material:', '');
    return obtenerMaterialesGenerales().find(material => material.id === id) || null;
}

function mostrarMaterialGeneralSeleccionado(idMaterial) {
    const material = obtenerMaterialesGenerales().find(item => item.id === idMaterial) || null;
    const nombreInput = document.getElementById('material-seleccionado-nombre');
    const costoInput = document.getElementById('material-seleccionado-costo');
    const minimoInput = document.getElementById('material-seleccionado-minimo');
    const editorSelect = document.getElementById('material-guardado-select');
    const resultado = document.getElementById('res-material-generico');

    if (!nombreInput || !costoInput || !minimoInput) return;

    nombreInput.value = material ? material.nombre : '';
    costoInput.value = material ? material.costoPie : '';
    minimoInput.value = material ? (material.costoMinimo || 0) : 0;

    if (editorSelect && material) {
        editorSelect.value = material.id;
        cargarMaterialGeneralParaEditar(false);
    }

    if (!material && resultado) {
        resultado.innerHTML = "Agrega un material al menu para calcular por pie cuadrado.";
    }
}

function guardarMaterialGeneral() {
    const nombreInput = document.getElementById('material-nombre');
    const costoInput = document.getElementById('material-costo-pie');
    const minimoInput = document.getElementById('material-costo-minimo');
    const guardado = guardarMaterialGeneralData('', nombreInput.value, costoInput.value, minimoInput.value);

    if (guardado) {
        nombreInput.value = '';
        costoInput.value = '';
        minimoInput.value = 0;
    }
}

function guardarMaterialGeneralData(idEditando, nombreValor, costoValor, minimoValor) {
    if (!verificarCodigoGeneralMaterial()) return false;

    const nombre = String(nombreValor).trim();
    const costo = parseFloat(costoValor);
    const costoMinimo = parseFloat(minimoValor) || 0;

    if (!nombre || isNaN(costo) || costo < 0 || costoMinimo < 0) {
        return alert("Ingrese el nombre, costo por pie cuadrado y costo minimo del material.");
    }

    const id = normalizarIdMaterial(nombre);
    const materiales = obtenerMaterialesGenerales();
    const existente = materiales.findIndex(material => material.id === (idEditando || id));
    const existeOtroMaterial = materiales.some(material => material.id === id && material.id !== idEditando);
    const material = { id, nombre, costoPie: costo, costoMinimo };

    if (existeOtroMaterial) {
        return alert("Ya existe otro material con ese nombre.");
    }

    if (existente >= 0) {
        materiales[existente] = material;
    } else {
        materiales.push(material);
    }

    guardarMaterialesGenerales(materiales);
    guardarMaterialesEnFirebase('generales', material);
    cargarMaterialesGenerales();
    openTab(`material:${id}`);
    return true;
}

function cargarMaterialGeneralParaEditar(actualizarCalculadora = true) {
    const editorSelect = document.getElementById('material-guardado-select');
    const nombreInput = document.getElementById('material-nombre');
    const costoInput = document.getElementById('material-costo-pie');
    const minimoInput = document.getElementById('material-costo-minimo');
    if (!editorSelect || !nombreInput || !costoInput || !minimoInput) return;

    const material = obtenerMaterialesGenerales().find(item => item.id === editorSelect.value) || null;
    nombreInput.value = material ? material.nombre : '';
    costoInput.value = material ? material.costoPie : '';
    minimoInput.value = material ? (material.costoMinimo || 0) : 0;

    if (material && actualizarCalculadora) {
        openTab(`material:${material.id}`);
    }
}

function actualizarMaterialGeneralSeleccionado() {
    if (!verificarCodigoGeneralMaterial()) return;
    const material = obtenerMaterialGeneralSeleccionado();
    const nombreInput = document.getElementById('material-seleccionado-nombre');
    const costoInput = document.getElementById('material-seleccionado-costo');
    const minimoInput = document.getElementById('material-seleccionado-minimo');
    if (!material || !nombreInput || !costoInput || !minimoInput) return;

    const nombre = nombreInput.value.trim();
    const costo = parseFloat(costoInput.value);
    const costoMinimo = parseFloat(minimoInput.value) || 0;
    if (!nombre) return alert("Ingrese el nombre del material.");
    if (isNaN(costo) || costo < 0) return alert("Ingrese un costo valido para el pie cuadrado.");
    if (costoMinimo < 0) return alert("El costo minimo no puede ser negativo.");

    const nuevoId = normalizarIdMaterial(nombre);
    const materiales = obtenerMaterialesGenerales();
    const existeOtroMaterial = materiales.some(item => item.id === nuevoId && item.id !== material.id);

    if (existeOtroMaterial) {
        return alert("Ya existe otro material con ese nombre.");
    }

    const actualizados = materiales.map(item => (
        item.id === material.id ? { ...item, id: nuevoId, nombre, costoPie: costo, costoMinimo } : item
    ));

    guardarMaterialesGenerales(actualizados);
    guardarMaterialesEnFirebase('generales', actualizados.find(item => item.id === nuevoId));
    cargarMaterialesGenerales();
    openTab(`material:${nuevoId}`);
}

function obtenerMaterialesCorte() {
    return materialesCorteCache;
}

function guardarMaterialesCorte(materiales) {
    materialesCorteCache = materiales;
}

let firebaseSyncEnabled = true;

function setFirebaseStatus(message) {
    const statusEl = document.getElementById('firebase-status');
    if (!statusEl) return;
    if (!message) {
        statusEl.style.display = 'none';
        statusEl.textContent = '';
        return;
    }
    statusEl.style.display = 'block';
    statusEl.textContent = message;
}

async function cargarMaterialesDesdeFirebase(tipo) {
    if (!window.firebaseLoadMaterials || !firebaseSyncEnabled) return null;
    try {
        return await window.firebaseLoadMaterials(tipo);
    } catch (error) {
        if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
            firebaseSyncEnabled = false;
            setFirebaseStatus('Firebase no autorizado: no se puede sincronizar remotamente.');
        } else {
            console.error('Error cargando materiales de Firebase:', error);
            setFirebaseStatus('Error de Firebase: consulta la consola para más detalles.');
        }
        return null;
    }
}

async function guardarMaterialesEnFirebase(tipo, material) {
    if (!window.firebaseSaveMaterial || !firebaseSyncEnabled) return;
    try {
        await window.firebaseSaveMaterial(tipo, material);
    } catch (error) {
        if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
            firebaseSyncEnabled = false;
            setFirebaseStatus('Firebase no autorizado: no se puede guardar remotamente.');
        } else {
            console.error('Error guardando material en Firebase:', error);
            setFirebaseStatus('Error de Firebase: consulta la consola para más detalles.');
        }
    }
}

async function sincronizarMaterialesFirebase() {
    const generalesRemotos = await cargarMaterialesDesdeFirebase('generales');
    if (Array.isArray(generalesRemotos)) {
        guardarMaterialesGenerales(generalesRemotos);
    }

    const corteRemotos = await cargarMaterialesDesdeFirebase('corte');
    if (Array.isArray(corteRemotos) && corteRemotos.length) {
        guardarMaterialesCorte(corteRemotos);
    }
}

function cargarMaterialesCorte() {
    const select = document.getElementById('corte-material');
    if (!select) return;

    const valorActual = select.value;
    const materiales = obtenerMaterialesCorte();
    select.innerHTML = materiales.map(material => `<option value="${material.id}">${material.nombre}</option>`).join('');

    if (materiales.some(material => material.id === valorActual)) {
        select.value = valorActual;
    }

    prepararSelectBuscable(select);
    mostrarCostoMaterialSeleccionado();
}

function obtenerMaterialCorteSeleccionado() {
    const select = document.getElementById('corte-material');
    if (!select) return null;

    return obtenerMaterialesCorte().find(material => material.id === select.value) || null;
}

function mostrarCostoMaterialSeleccionado() {
    const material = obtenerMaterialCorteSeleccionado();
    const costoInput = document.getElementById('corte-costo-pie');
    if (!material || !costoInput) return;

    costoInput.value = material.costoPie || 0;
}

function actualizarCostoMaterialSeleccionado() {
    if (!verificarCodigoCorteMaterial()) return;
    const select = document.getElementById('corte-material');
    const costoInput = document.getElementById('corte-costo-pie');
    if (!select || !costoInput) return;

    const costo = parseFloat(costoInput.value);
    if (isNaN(costo) || costo < 0) return alert("Ingrese un costo valido para el pie cuadrado.");

    const materiales = obtenerMaterialesCorte().map(material => (
        material.id === select.value ? { ...material, costoPie: costo } : material
    ));

    guardarMaterialesCorte(materiales);
    guardarMaterialesEnFirebase('corte', materiales.find(item => item.id === select.value));
    cargarMaterialesCorte();
}

function guardarMaterialCorte() {
    if (!verificarCodigoCorteMaterial()) return;
    const nombreInput = document.getElementById('nuevo-material-nombre');
    const costoInput = document.getElementById('nuevo-material-costo');
    const select = document.getElementById('corte-material');
    const nombre = nombreInput.value.trim();
    const costo = parseFloat(costoInput.value);

    if (!nombre || isNaN(costo) || costo < 0) {
        return alert("Ingrese el nombre del material y su costo por pie cuadrado.");
    }

    const id = normalizarIdMaterial(nombre);
    const materiales = obtenerMaterialesCorte();
    const existente = materiales.findIndex(material => material.id === id);
    const material = { id, nombre, costoPie: costo, tipo: 'custom' };

    if (existente >= 0) {
        materiales[existente] = { ...materiales[existente], ...material };
    } else {
        materiales.push(material);
    }

    guardarMaterialesCorte(materiales);
    guardarMaterialesEnFirebase('corte', material);
    cargarMaterialesCorte();
    select.value = id;
    mostrarCostoMaterialSeleccionado();
    nombreInput.value = '';
    costoInput.value = '';
}

document.addEventListener('DOMContentLoaded', async () => {
    cargarMaterialesGenerales();
    cargarMaterialesCorte();
    prepararSelectBuscable(document.getElementById('material-select'));
    await sincronizarMaterialesFirebase();
    cargarMaterialesGenerales();
    cargarMaterialesCorte();
});

function calcularMaterialGeneral() {
    const material = obtenerMaterialGeneralSeleccionado();
    const nombreManual = document.getElementById('material-seleccionado-nombre').value.trim();
    const costoPie = parseFloat(document.getElementById('material-seleccionado-costo').value);
    const costoMinimo = parseFloat(document.getElementById('material-seleccionado-minimo').value) || 0;
    const ancho = parseFloat(document.getElementById('material-ancho').value);
    const alto = parseFloat(document.getElementById('material-alto').value);
    const margen = parseFloat(document.getElementById('material-margen').value) || 0;
    const cant = parseInt(document.getElementById('material-cant').value);

    if (!nombreManual) return alert("Ingrese el nombre del material.");
    if (isNaN(costoPie) || costoPie < 0) return alert("Ingrese el costo por pie cuadrado.");
    if (costoMinimo < 0) return alert("El costo minimo no puede ser negativo.");
    if (!ancho || !alto || !cant) return alert("Ingrese ancho, alto y cantidad.");
    if (margen < 0) return alert("El margen no puede ser negativo.");

    const anchoConMargen = ancho + margen;
    const altoConMargen = alto + margen;
    const pieCuadradoTotal = (anchoConMargen * altoConMargen / 144) * cant;
    const totalSinRedondear = pieCuadradoTotal * costoPie;
    const totalConMinimo = Math.max(totalSinRedondear, costoMinimo);
    const total = redondear5(totalConMinimo);
    const nombreMaterial = material ? material.nombre : nombreManual;

    document.getElementById('res-material-generico').innerHTML = `
        0000000<br>
        <strong>Material: ${nombreMaterial}</strong><br>
        Formula: (((${ancho} + ${margen}) * (${alto} + ${margen})) / 144) * ${costoPie} * ${cant}<br>
        Medida con margen: ${anchoConMargen.toFixed(2)}" x ${altoConMargen.toFixed(2)}"<br>
        Area total: ${pieCuadradoTotal.toFixed(2)} pie2<br>
        Costo por pie2: RD$ ${costoPie}<br>
        Costo minimo: RD$ ${costoMinimo}<br>
        Total sin redondear: RD$ ${totalSinRedondear.toFixed(2)}<br>
        Total aplicado: RD$ ${totalConMinimo.toFixed(2)}<br>
        <span class="res-total">Total: RD$ ${total}</span>
    `;
}

// 1. CALCULO DTF TEXTIL
function calcularDTF() {
    let alto = parseFloat(document.getElementById('dtf-largo').value);
    let ancho = parseFloat(document.getElementById('dtf-ancho').value);
    const cantidad = parseInt(document.getElementById('dtf-cant').value);

    if (!ancho || !alto || !cantidad) {
        return alert("Por favor ingresa ancho, largo y cantidad.");
    }

    // Si el ancho es menor a 22 pulgadas, asumir que tiene 22
    // EXCEPTO si tiene 11 pulgadas o menos, o si el área es 93.5 pulgadas cuadradas o menos
    const area = ancho * alto;
    if (ancho < 22 && ancho > 11 && area > 93.5) {
        ancho = 22;
    }

    if (alto > 22 && ancho > 22) {
        document.getElementById('res-dtf').innerHTML = "No se puede calcular: ambas medidas superan las 22 pulgadas.";
        return;
    }

    let resultadoCal = ancho * alto * cantidad;
    const areaTotal = resultadoCal;

    if (resultadoCal <= 125) {
        resultadoCal = 125;
    } else if (resultadoCal >= 125 && resultadoCal <= 186) {
        resultadoCal = redondear5(resultadoCal);
    } else if (resultadoCal >= 187 && resultadoCal <= 396) {
        resultadoCal = 200;
    } else if (resultadoCal > 396) {
        resultadoCal = redondear5(resultadoCal * 0.47348484848);
    }

    document.getElementById('res-dtf').innerHTML = `
        0000000<br>
        <strong>Producto: DTF Textil</strong><br>
        Medidas: ${ancho}" x ${alto}" | Cantidad: ${cantidad}<br>
        Area calculada: ${areaTotal.toFixed(2)}<br>
        <span class="res-total">Total: RD$ ${resultadoCal}</span>
    `;
}

// 2. CALCULO LAPICEROS
function calcularLapiceros() {
    let cant = parseInt(document.getElementById('lap-cant').value);
    let total = 0;

    if (!cant) return alert("Por favor ingresa la cantidad.");

    if (cant <= 10) total = 350;
    else if (cant <= 49) total = cant * 30;
    else if (cant <= 99) total = cant * 15;
    else if (cant <= 499) total = cant * 12;
    else if (cant <= 1000) total = cant * 10;
    else total = cant * 9;

    document.getElementById('res-lap').innerHTML = `0000000<br>Producto: Impresion de Lapiceros<br>Cantidad: ${cant} uds<br><span class="res-total">Total: RD$ ${redondear5(total)}</span>`;
}

// 3. CALCULO CALANDRA
function calcularCalandra() {
    const ancho = parseFloat(document.getElementById('calandra-ancho').value);
    const alto = parseFloat(document.getElementById('calandra-alto').value);
    const cantidad = parseInt(document.getElementById('calandra-cant').value);

    if (!ancho || !alto || !cantidad) {
        return alert("Por favor ingresa ancho, alto y cantidad.");
    }

    let resultadoCal = ancho * alto * cantidad;
    const areaTotal = resultadoCal;

    if (resultadoCal <= 2160) {
        resultadoCal = 500;
    } else if (resultadoCal >= 2161 && resultadoCal <= 8640) {
        resultadoCal = (((Math.ceil(resultadoCal * 0.1111111111111111 / 240)) - 1) * 300) + 500;
    } else if (resultadoCal >= 8641 && resultadoCal < 43200) {
        resultadoCal = redondear5(resultadoCal * 0.138888888888888);
    } else if (resultadoCal >= 43200) {
        resultadoCal = redondear5(resultadoCal * 0.129629629629629);
    }

    document.getElementById('res-calandra').innerHTML = `
        0000000<br>
        <strong>Producto: Calandra</strong><br>
        Medidas: ${ancho}" x ${alto}" | Cantidad: ${cantidad}<br>
        Area calculada: ${areaTotal.toFixed(2)}<br>
        <span class="res-total">Total: RD$ ${resultadoCal}</span>
    `;
}

// 4. CALCULO CORTE
function calcularCorte() {
    let material = obtenerMaterialCorteSeleccionado();
    let mat = material ? material.tipo : 'custom';
    let grosor = parseFloat(document.getElementById('corte-grosor').value);
    let ancho = parseFloat(document.getElementById('corte-ancho').value);
    let alto = parseFloat(document.getElementById('corte-alto').value);
    let cant = parseInt(document.getElementById('corte-cant').value);
    let agujeros = parseInt(document.getElementById('corte-agujeros').value) || 0;

    if (!material || !grosor || !ancho || !alto || !cant) {
        return alert("Por favor completa todos los campos de corte.");
    }

    let velocidad = 35.43;

    if (mat === 'laser') {
        if (grosor > 9) return alert("No cortamos acrilico de 10mm en adelante");
        if (grosor <= 3) velocidad = 35.43;
        else if (grosor <= 4) velocidad = 25.98;
        else if (grosor <= 5) velocidad = 22.98;
        else if (grosor <= 6) velocidad = 20.26;
        else velocidad = 15.26;
    } else if (mat === 'sintra') {
        if (grosor <= 3) velocidad = 35.43;
        else if (grosor <= 5) velocidad = 30.98;
        else if (grosor <= 7) velocidad = 28.26;
        else if (grosor <= 9) velocidad = 26.26;
        else if (grosor <= 11) velocidad = 23.43;
        else if (grosor <= 15) velocidad = 20.98;
        else if (grosor <= 17) velocidad = 15.26;
        else if (grosor <= 20.4) velocidad = 12.26;
        else velocidad = 10.26;
    } else if (mat === 'acm') {
        velocidad = grosor <= 3 ? 30.43 : 20.98;
    }

    let perimetroPieza = ((ancho + 0.1) + (alto + 0.1)) * 2;
    let perimetroTotalPiezas = perimetroPieza * cant;
    let perimetroAgujeros = agujeros * cant * 1;
    let perimetroLinealTotal = perimetroTotalPiezas + perimetroAgujeros;
    let minutosCorte = perimetroLinealTotal / velocidad;
    let costoCorte = minutosCorte * 15;
    let pieCuadradoTotal = (ancho * alto * cant) / 144;
    let costoMaterial = pieCuadradoTotal * (material.costoPie || 0);

    if (costoCorte < 250) costoCorte = 250;

    let final = redondear5(costoCorte + costoMaterial);
    document.getElementById('res-corte').innerHTML = `
        0000000<br>
        <strong>Material: ${material.nombre}</strong><br>
        Area total: ${pieCuadradoTotal.toFixed(2)} pie2<br>
        Material: RD$ ${redondear5(costoMaterial)}<br>
        Corte: RD$ ${redondear5(costoCorte)} (${minutosCorte.toFixed(2)} min)<br>
        <span class="res-total">Total: RD$ ${final}</span>
    `;
}

// 4. CALCULO UV-DTF
function calcularUVPersonalizado() {
    const ancho = parseFloat(document.getElementById('uv-ancho').value);
    const alto = parseFloat(document.getElementById('uv-alto').value);
    const cantidad = parseInt(document.getElementById('uv-cant').value);
    
    if (!ancho || !alto || !cantidad) {
        return alert("Por favor, ingrese ancho, alto y cantidad.");
    }

    let resultadoCal = ancho * alto * cantidad;
    const areaTotal = resultadoCal;

    if (resultadoCal <= 88) {
        resultadoCal = 200;
    } else if (resultadoCal >= 89 && resultadoCal <= 143) {
        resultadoCal = redondear5(resultadoCal * 2.272727272727271);
    } else if (resultadoCal >= 144 && resultadoCal <= 165) {
        resultadoCal = 350;
    } else if (resultadoCal >= 176 && resultadoCal <= 263) {
        resultadoCal = redondear5(resultadoCal * 1.988636363636363);
    } else if (resultadoCal >= 264) {
        resultadoCal = redondear5(resultadoCal * 1.818181818181818);
    }

    document.getElementById('res-uv-custom').innerHTML = `
        0000000<br>
        <strong>Cotizacion UV-DTF (Rigidos)</strong><br>
        Medidas: ${ancho}" x ${alto}" | Cantidad: ${cantidad}<br>
        Area calculada: ${areaTotal.toFixed(2)}<br>
        <span class="res-total">Total estimado: RD$ ${resultadoCal}</span>
    `;
}

// 5. CALCULO UV DIRECTO CAMA PLANA
function precioPiezaPequena(ancho, alto, cantidad) {
    let max = Math.max(ancho, alto);
    let precios = [];

    if (cantidad <= 9) {
        precios = [90, 100, 110, 115, 125];
    } else if (cantidad <= 19) {
        precios = [70, 80, 90, 100, 115];
    } else if (cantidad <= 49) {
        precios = [40, 50, 60, 70, 80];
    } else if (cantidad <= 99) {
        precios = [30, 40, 50, 60, 70];
    } else {
        precios = [20, 30, 40, 50, 60];
    }

    if (max <= 1) return precios[0];
    if (max <= 2.5) return precios[1];
    if (max <= 4.5) return precios[2];
    if (max <= 6.5) return precios[3];
    return precios[4];
}

function precioPiezaGrande(pies2, tipo) {
    if (tipo === "sintra") return 90;

    if (pies2 <= 3) {
        if (tipo === "blanco") return 150;
        if (tipo === "cmyk") return 125;
    } else {
        if (tipo === "blanco") return 125;
        if (tipo === "cmyk") return 90;
    }
}

function calcularUVDirecto() {
    let ancho = parseFloat(document.getElementById('uv-directo-ancho').value);
    let alto = parseFloat(document.getElementById('uv-directo-alto').value);
    let cantidad = parseInt(document.getElementById('uv-directo-cant').value);
    let dobleCara = document.getElementById('uv-directo-doble-cara').checked;
    let tipoGrande = document.getElementById('uv-directo-tipo').value;

    if (!ancho || !alto || !cantidad) {
        return alert("Completa todos los campos");
    }

    let precioUnitario = 0;
    let total = 0;
    let areaTotal = ancho * alto * cantidad;

    // Determinar si es pieza pequeña o grande
    if (ancho <= 8.5 && alto <= 11) {
        precioUnitario = precioPiezaPequena(ancho, alto, cantidad);
        total = precioUnitario * cantidad;
    } else {
        let pies2 = (ancho * alto) / 144;
        let precioPie2 = precioPiezaGrande(pies2, tipoGrande);
        total = pies2 * precioPie2 * cantidad;
    }

    if (dobleCara) {
        total *= 1.70;
    }

    if (total < 150) {
        total = 150;
    }

    const tipoText = ancho <= 8.5 && alto <= 11 ? "Pieza Pequeña" : "Pieza Grande (" + tipoGrande + ")";
    document.getElementById('res-uv-directo').innerHTML = `
        0000000<br>
        <strong>UV Directo Cama Plana</strong><br>
        Medidas: ${ancho.toFixed(2)}" x ${alto.toFixed(2)}" | Cantidad: ${cantidad}<br>
        Tipo: ${tipoText}<br>
        Doble cara: ${dobleCara ? 'Sí' : 'No'}<br>
        Precio unitario: RD$ ${precioUnitario ? precioUnitario.toFixed(2) : 'Calculado'}<br>
        <span class="res-total">Total: RD$ ${total.toFixed(2)}</span>
    `;
}

// 6. CALCULO SUBLIMACIÓN
function calcularSublimacion() {
    const largo = parseFloat(document.getElementById('sublimacion-largo').value);
    const cantidad = parseInt(document.getElementById('sublimacion-cant').value);

    if (!largo || !cantidad) {
        return alert("Por favor ingresa largo y cantidad.");
    }

    // Ancho siempre 60"
    const ancho = 60;
    const yardas = (largo / 36) * cantidad;
    let total = yardas * 280;

    // Precio mínimo RD$75
    if (total < 75) {
        total = 75;
    }

    total = redondear5(total);

    document.getElementById('res-sublimacion').innerHTML = `
        0000000<br>
        <strong>Producto: Sublimación (Impresión)</strong><br>
        Medidas: ${ancho}" x ${largo}" | Cantidad: ${cantidad}<br>
        Yardas calculadas: ${yardas.toFixed(2)}<br>
        Precio por yarda: RD$ 280<br>
        Precio mínimo: RD$ 75<br>
        <span class="res-total">Total: RD$ ${total}</span>
    `;
}
