// ============================================
// CONFIGURACIÓN INICIAL
// ============================================
const DB_NAME = 'PresupuestoDB';
const DB_VERSION = 2;
let db = null;

const CATEGORIAS = {
    INGRESOS: 'INGRESOS',
    GASTOS_ESENCIALES: 'GASTOS_ESENCIALES',
    GASTOS_DISCRECIONALES: 'GASTOS_DISCRECIONALES',
    PAGO_DEUDAS: 'PAGO_DEUDAS',
    AHORROS: 'AHORROS',
    INVERSIONES: 'INVERSIONES'
};

// ============================================
// BASE DE DATOS (IndexedDB)
// ============================================
function abrirDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('presupuesto')) {
                const store = db.createObjectStore('presupuesto', { keyPath: 'id', autoIncrement: true });
                store.createIndex('categoria', 'categoria', { unique: false });
                store.createIndex('subcategoria', 'subcategoria', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('transacciones')) {
                const store = db.createObjectStore('transacciones', { keyPath: 'id', autoIncrement: true });
                store.createIndex('mes', 'mes', { unique: false });
                store.createIndex('anio', 'anio', { unique: false });
                store.createIndex('categoria', 'categoria', { unique: false });
                store.createIndex('subcategoria', 'subcategoria', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('patrimonio')) {
                const store = db.createObjectStore('patrimonio', { keyPath: 'id', autoIncrement: true });
                store.createIndex('mes', 'mes', { unique: false });
                store.createIndex('tipo', 'tipo', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('configuracion')) {
                db.createObjectStore('configuracion', { keyPath: 'key' });
            }
        };
    });
}

// ============================================
// CONFIGURACIÓN
// ============================================
async function guardarConfiguracion(key, value) {
    const tx = db.transaction('configuracion', 'readwrite');
    const store = tx.objectStore('configuracion');
    return new Promise((resolve, reject) => {
        const req = store.put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function obtenerConfiguracion(key) {
    const tx = db.transaction('configuracion', 'readonly');
    const store = tx.objectStore('configuracion');
    return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
    });
}

// ============================================
// FUNCIONES CRUD (Presupuesto)
// ============================================
async function guardarPresupuesto(categoria, subcategoria, monto) {
    const tx = db.transaction('presupuesto', 'readwrite');
    const store = tx.objectStore('presupuesto');
    const index = store.index('subcategoria');
    
    return new Promise((resolve, reject) => {
        const req = index.get(subcategoria);
        req.onsuccess = () => {
            const existing = req.result;
            if (existing) {
                existing.monto = monto;
                const updateReq = store.put(existing);
                updateReq.onsuccess = () => resolve(updateReq.result);
                updateReq.onerror = () => reject(updateReq.error);
            } else {
                const newItem = { categoria, subcategoria, monto };
                const addReq = store.add(newItem);
                addReq.onsuccess = () => resolve(addReq.result);
                addReq.onerror = () => reject(addReq.error);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

async function obtenerPresupuesto() {
    const tx = db.transaction('presupuesto', 'readonly');
    const store = tx.objectStore('presupuesto');
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function obtenerPresupuestoPorCategoria(categoria) {
    const tx = db.transaction('presupuesto', 'readonly');
    const store = tx.objectStore('presupuesto');
    const index = store.index('categoria');
    return new Promise((resolve, reject) => {
        const req = index.getAll(categoria);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ============================================
// FUNCIONES CRUD (Transacciones)
// ============================================
async function guardarTransaccion({ mes, anio, categoria, subcategoria, fecha, monto, notas, revisado }) {
    const tx = db.transaction('transacciones', 'readwrite');
    const store = tx.objectStore('transacciones');
    const newItem = { 
        mes, anio, categoria, subcategoria, fecha, monto, 
        notas: notas || '', 
        revisado: revisado || false 
    };
    return new Promise((resolve, reject) => {
        const req = store.add(newItem);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function obtenerTransacciones(mes, anio) {
    const tx = db.transaction('transacciones', 'readonly');
    const store = tx.objectStore('transacciones');
    const index = store.index('mes');
    return new Promise((resolve, reject) => {
        const req = index.getAll(mes);
        req.onsuccess = () => {
            const resultados = req.result.filter(t => t.anio === anio);
            resolve(resultados);
        };
        req.onerror = () => reject(req.error);
    });
}

async function eliminarTransaccion(id) {
    const tx = db.transaction('transacciones', 'readwrite');
    const store = tx.objectStore('transacciones');
    return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ============================================
// FUNCIONES CRUD (Patrimonio)
// ============================================
async function guardarPatrimonio({ mes, tipo, subcategoria, monto }) {
    const tx = db.transaction('patrimonio', 'readwrite');
    const store = tx.objectStore('patrimonio');
    const newItem = { mes, tipo, subcategoria, monto };
    return new Promise((resolve, reject) => {
        const req = store.add(newItem);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function obtenerPatrimonio(mes) {
    const tx = db.transaction('patrimonio', 'readonly');
    const store = tx.objectStore('patrimonio');
    const index = store.index('mes');
    return new Promise((resolve, reject) => {
        const req = index.getAll(mes);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function eliminarPatrimonio(id) {
    const tx = db.transaction('patrimonio', 'readwrite');
    const store = tx.objectStore('patrimonio');
    return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ============================================
// FUNCIONES DE CÁLCULO
// ============================================
function calcularTotalesPorCategoria(transacciones) {
    const totales = {};
    for (const cat in CATEGORIAS) {
        totales[CATEGORIAS[cat]] = 0;
    }
    
    transacciones.forEach(t => {
        const categoria = t.categoria;
        if (totales[categoria] !== undefined) {
            totales[categoria] += t.monto;
        }
    });
    
    return totales;
}

function calcularRemanente(transacciones) {
    const totales = calcularTotalesPorCategoria(transacciones);
    const ingresos = totales[CATEGORIAS.INGRESOS] || 0;
    const gastos = (totales[CATEGORIAS.GASTOS_ESENCIALES] || 0) +
                   (totales[CATEGORIAS.GASTOS_DISCRECIONALES] || 0) +
                   (totales[CATEGORIAS.PAGO_DEUDAS] || 0) +
                   (totales[CATEGORIAS.AHORROS] || 0) +
                   (totales[CATEGORIAS.INVERSIONES] || 0);
    return ingresos - gastos;
}

function calcularPatrimonioNeto(activos, pasivos) {
    const totalActivos = activos.reduce((sum, a) => sum + a.monto, 0);
    const totalPasivos = pasivos.reduce((sum, p) => sum + p.monto, 0);
    return totalActivos - totalPasivos;
}

// ============================================
// UTILIDADES
// ============================================
function formatearMoneda(valor, moneda = '$') {
    return moneda + ' ' + valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function obtenerNombreMes(mes) {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[mes - 1];
}

// ============================================
// EXPORTAR
// ============================================
window.app = {
    db,
    abrirDB,
    guardarConfiguracion,
    obtenerConfiguracion,
    guardarPresupuesto,
    obtenerPresupuesto,
    obtenerPresupuestoPorCategoria,
    guardarTransaccion,
    obtenerTransacciones,
    eliminarTransaccion,
    guardarPatrimonio,
    obtenerPatrimonio,
    eliminarPatrimonio,
    calcularTotalesPorCategoria,
    calcularRemanente,
    calcularPatrimonioNeto,
    formatearMoneda,
    obtenerNombreMes,
    CATEGORIAS
};