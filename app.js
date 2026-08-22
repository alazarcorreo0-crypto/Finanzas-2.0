// ============================================
// CONFIGURACIÓN INICIAL
// ============================================
const DB_NAME = 'PresupuestoDB';
const DB_VERSION = 3; // ← Cambié a versión 3 para agregar store de subcategorías
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
            
            // Store: Presupuesto
            if (!db.objectStoreNames.contains('presupuesto')) {
                const store = db.createObjectStore('presupuesto', { keyPath: 'id', autoIncrement: true });
                store.createIndex('categoria', 'categoria', { unique: false });
                store.createIndex('subcategoria', 'subcategoria', { unique: false });
            }
            
            // Store: Transacciones
            if (!db.objectStoreNames.contains('transacciones')) {
                const store = db.createObjectStore('transacciones', { keyPath: 'id', autoIncrement: true });
                store.createIndex('mes', 'mes', { unique: false });
                store.createIndex('anio', 'anio', { unique: false });
                store.createIndex('categoria', 'categoria', { unique: false });
                store.createIndex('subcategoria', 'subcategoria', { unique: false });
            }
            
            // Store: Patrimonio
            if (!db.objectStoreNames.contains('patrimonio')) {
                const store = db.createObjectStore('patrimonio', { keyPath: 'id', autoIncrement: true });
                store.createIndex('mes', 'mes', { unique: false });
                store.createIndex('tipo', 'tipo', { unique: false });
            }
            
            // Store: Configuración
            if (!db.objectStoreNames.contains('configuracion')) {
                db.createObjectStore('configuracion', { keyPath: 'key' });
            }

            // ============ NUEVO: Store para subcategorías ============
            if (!db.objectStoreNames.contains('subcategorias')) {
                const store = db.createObjectStore('subcategorias', { keyPath: 'id', autoIncrement: true });
                store.createIndex('categoria', 'categoria', { unique: false });
                store.createIndex('nombre', 'nombre', { unique: false });
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

async function eliminarPresupuesto(id) {
    const tx = db.transaction('presupuesto', 'readwrite');
    const store = tx.objectStore('presupuesto');
    return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ============================================
// ============ NUEVO: FUNCIONES CRUD (Subcategorías) ============
// ============================================

// Guardar una subcategoría (nueva o actualizar)
async function guardarSubcategoria(categoria, nombre, monto = 0) {
    const tx = db.transaction(['subcategorias', 'presupuesto'], 'readwrite');
    const subStore = tx.objectStore('subcategorias');
    
    // Buscar si ya existe
    const index = subStore.index('nombre');
    return new Promise((resolve, reject) => {
        const req = index.get(nombre);
        req.onsuccess = () => {
            const existing = req.result;
            if (existing) {
                // Actualizar
                existing.categoria = categoria;
                const updateReq = subStore.put(existing);
                updateReq.onsuccess = () => resolve(updateReq.result);
                updateReq.onerror = () => reject(updateReq.error);
            } else {
                // Crear nueva
                const newItem = { categoria, nombre, monto: monto || 0 };
                const addReq = subStore.add(newItem);
                addReq.onsuccess = () => {
                    // También guardar en presupuesto
                    guardarPresupuesto(categoria, nombre, monto || 0);
                    resolve(addReq.result);
                };
                addReq.onerror = () => reject(addReq.error);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

// Obtener todas las subcategorías
async function obtenerSubcategorias() {
    const tx = db.transaction('subcategorias', 'readonly');
    const store = tx.objectStore('subcategorias');
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Obtener subcategorías por categoría
async function obtenerSubcategoriasPorCategoria(categoria) {
    const tx = db.transaction('subcategorias', 'readonly');
    const store = tx.objectStore('subcategorias');
    const index = store.index('categoria');
    return new Promise((resolve, reject) => {
        const req = index.getAll(categoria);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Eliminar una subcategoría
async function eliminarSubcategoria(id) {
    const tx = db.transaction(['subcategorias', 'presupuesto'], 'readwrite');
    
    // Primero obtener la subcategoría para saber su nombre
    const subStore = tx.objectStore('subcategorias');
    const getReq = subStore.get(id);
    
    return new Promise((resolve, reject) => {
        getReq.onsuccess = () => {
            const item = getReq.result;
            if (!item) {
                resolve();
                return;
            }
            
            // Eliminar de subcategorías
            const deleteReq = subStore.delete(id);
            deleteReq.onsuccess = () => {
                // Eliminar de presupuesto
                const presStore = tx.objectStore('presupuesto');
                const index = presStore.index('subcategoria');
                const presReq = index.get(item.nombre);
                presReq.onsuccess = () => {
                    const presItem = presReq.result;
                    if (presItem) {
                        presStore.delete(presItem.id);
                    }
                    resolve();
                };
                presReq.onerror = () => reject(presReq.error);
            };
            deleteReq.onerror = () => reject(deleteReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

// Inicializar subcategorías por defecto (solo si no existen)
async function inicializarSubcategorias() {
    const existentes = await obtenerSubcategorias();
    if (existentes.length > 0) return;
    
    const defaults = [
        // Ingresos
        { categoria: 'INGRESOS', nombre: 'Sueldo', monto: 3200 },
        { categoria: 'INGRESOS', nombre: 'Freelance', monto: 0 },
        
        // Gastos Esenciales
        { categoria: 'GASTOS_ESENCIALES', nombre: 'Renta', monto: 1025 },
        { categoria: 'GASTOS_ESENCIALES', nombre: 'Super', monto: 200 },
        { categoria: 'GASTOS_ESENCIALES', nombre: 'Aseguranza carro', monto: 95 },
        { categoria: 'GASTOS_ESENCIALES', nombre: 'Celular', monto: 104 },
        { categoria: 'GASTOS_ESENCIALES', nombre: 'Gasolina', monto: 100 },
        { categoria: 'GASTOS_ESENCIALES', nombre: 'Laptop', monto: 50 },
        { categoria: 'GASTOS_ESENCIALES', nombre: 'Internet', monto: 70 },
        { categoria: 'GASTOS_ESENCIALES', nombre: 'Mama', monto: 0 },
        
        // Gastos Discrecionales
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'Gastos variables', monto: 100 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC Free', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC Aeroméxico', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC América express', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC Nu', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC Volaris Invex', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC Mercado Pago', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'Tj Maxx', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC Discovery', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC Gap', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'After Pay', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'Taxes', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'TC AE $', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', nombre: 'LUZ HERMISTON', monto: 0 },
        
        // Pago de Deudas
        { categoria: 'PAGO_DEUDAS', nombre: 'Solares', monto: 550 },
        { categoria: 'PAGO_DEUDAS', nombre: 'Abono extra solar', monto: 0 },
        
        // Ahorros
        { categoria: 'AHORROS', nombre: 'Ahorro USA', monto: 400 },
        { categoria: 'AHORROS', nombre: 'Ahorro MX', monto: 400 },
        
        // Inversiones
        { categoria: 'INVERSIONES', nombre: 'Inversión', monto: 0 }
    ];
    
    for (const item of defaults) {
        await guardarSubcategoria(item.categoria, item.nombre, item.monto);
    }
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

async function obtenerTodasTransacciones() {
    const tx = db.transaction('transacciones', 'readonly');
    const store = tx.objectStore('transacciones');
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
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
    eliminarPresupuesto,
    guardarTransaccion,
    obtenerTransacciones,
    obtenerTodasTransacciones,
    eliminarTransaccion,
    guardarPatrimonio,
    obtenerPatrimonio,
    eliminarPatrimonio,
    // Nuevas funciones de subcategorías
    guardarSubcategoria,
    obtenerSubcategorias,
    obtenerSubcategoriasPorCategoria,
    eliminarSubcategoria,
    inicializarSubcategorias,
    calcularTotalesPorCategoria,
    calcularRemanente,
    calcularPatrimonioNeto,
    formatearMoneda,
    obtenerNombreMes,
    CATEGORIAS
};