// ============================================
// CONFIGURACIÓN INICIAL
// ============================================
const DB_NAME = 'PresupuestoDB';
const DB_VERSION = 1;
let db = null;

// Estructura de datos
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
        };
    });
}

// ============================================
// FUNCIONES CRUD (Presupuesto)
// ============================================
async function guardarPresupuesto(categoria, subcategoria, monto) {
    const transaction = db.transaction('presupuesto', 'readwrite');
    const store = transaction.objectStore('presupuesto');
    
    // Verificar si ya existe
    const index = store.index('subcategoria');
    const request = index.get(subcategoria);
    
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const existing = request.result;
            if (existing) {
                // Actualizar
                existing.monto = monto;
                const updateRequest = store.put(existing);
                updateRequest.onsuccess = () => resolve(updateRequest.result);
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                // Crear nuevo
                const newItem = { categoria, subcategoria, monto };
                const addRequest = store.add(newItem);
                addRequest.onsuccess = () => resolve(addRequest.result);
                addRequest.onerror = () => reject(addRequest.error);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

async function obtenerPresupuesto() {
    const transaction = db.transaction('presupuesto', 'readonly');
    const store = transaction.objectStore('presupuesto');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function obtenerPresupuestoPorCategoria(categoria) {
    const transaction = db.transaction('presupuesto', 'readonly');
    const store = transaction.objectStore('presupuesto');
    const index = store.index('categoria');
    return new Promise((resolve, reject) => {
        const request = index.getAll(categoria);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ============================================
// FUNCIONES CRUD (Transacciones)
// ============================================
async function guardarTransaccion({ mes, anio, categoria, subcategoria, fecha, monto, notas, revisado }) {
    const transaction = db.transaction('transacciones', 'readwrite');
    const store = transaction.objectStore('transacciones');
    const newItem = { mes, anio, categoria, subcategoria, fecha, monto, notas, revisado: revisado || false };
    return new Promise((resolve, reject) => {
        const request = store.add(newItem);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function obtenerTransacciones(mes, anio) {
    const transaction = db.transaction('transacciones', 'readonly');
    const store = transaction.objectStore('transacciones');
    const index = store.index('mes');
    return new Promise((resolve, reject) => {
        const request = index.getAll(mes);
        request.onsuccess = () => {
            const resultados = request.result.filter(t => t.anio === anio);
            resolve(resultados);
        };
        request.onerror = () => reject(request.error);
    });
}

async function eliminarTransaccion(id) {
    const transaction = db.transaction('transacciones', 'readwrite');
    const store = transaction.objectStore('transacciones');
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ============================================
// FUNCIONES CRUD (Patrimonio)
// ============================================
async function guardarPatrimonio({ mes, tipo, subcategoria, monto }) {
    const transaction = db.transaction('patrimonio', 'readwrite');
    const store = transaction.objectStore('patrimonio');
    const newItem = { mes, tipo, subcategoria, monto };
    return new Promise((resolve, reject) => {
        const request = store.add(newItem);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function obtenerPatrimonio(mes) {
    const transaction = db.transaction('patrimonio', 'readonly');
    const store = transaction.objectStore('patrimonio');
    const index = store.index('mes');
    return new Promise((resolve, reject) => {
        const request = index.getAll(mes);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
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
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await abrirDB();
        console.log('Base de datos inicializada correctamente');
        
        // Cargar datos predeterminados si es la primera vez
        const configStore = db.transaction('configuracion', 'readonly').objectStore('configuracion');
        const initRequest = configStore.get('inicializado');
        initRequest.onsuccess = async () => {
            if (!initRequest.result) {
                await cargarDatosIniciales();
                const tx = db.transaction('configuracion', 'readwrite');
                tx.objectStore('configuracion').put({ key: 'inicializado', value: true });
            }
        };
        
        // Actualizar resumen en index.html
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
            actualizarResumenInicio();
        }
        
    } catch (error) {
        console.error('Error al inicializar:', error);
    }
});

async function cargarDatosIniciales() {
    // Datos de ejemplo para el presupuesto
    const presupuestoInicial = [
        { categoria: 'INGRESOS', subcategoria: 'Sueldo', monto: 3200 },
        { categoria: 'GASTOS_ESENCIALES', subcategoria: 'Renta', monto: 1025 },
        { categoria: 'GASTOS_ESENCIALES', subcategoria: 'Super', monto: 200 },
        { categoria: 'GASTOS_ESENCIALES', subcategoria: 'Aseguranza carro', monto: 95 },
        { categoria: 'GASTOS_ESENCIALES', subcategoria: 'Celular', monto: 104 },
        { categoria: 'GASTOS_ESENCIALES', subcategoria: 'Gasolina', monto: 100 },
        { categoria: 'GASTOS_ESENCIALES', subcategoria: 'Laptop', monto: 50 },
        { categoria: 'GASTOS_ESENCIALES', subcategoria: 'Internet', monto: 70 },
        { categoria: 'GASTOS_ESENCIALES', subcategoria: 'Mama', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'Gastos variables', monto: 100 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC Free', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC Aeroméxico', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC América express', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC Nu', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC Volaris Invex', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC Mercado Pago', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'Tj Maxx', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC Discovery', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC Gap', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'After Pay', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'Taxes', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'TC AE $', monto: 0 },
        { categoria: 'GASTOS_DISCRECIONALES', subcategoria: 'LUZ HERMISTON', monto: 0 },
        { categoria: 'PAGO_DEUDAS', subcategoria: 'Solares', monto: 550 },
        { categoria: 'PAGO_DEUDAS', subcategoria: 'Abono extra solar', monto: 0 },
        { categoria: 'AHORROS', subcategoria: 'Ahorro USA', monto: 400 },
        { categoria: 'AHORROS', subcategoria: 'Ahorro MX', monto: 400 },
        { categoria: 'INVERSIONES', subcategoria: '', monto: 0 }
    ];
    
    const tx = db.transaction('presupuesto', 'readwrite');
    const store = tx.objectStore('presupuesto');
    presupuestoInicial.forEach(item => {
        store.add(item);
    });
    
    console.log('Datos iniciales cargados');
}

async function actualizarResumenInicio() {
    try {
        const mesActual = new Date().getMonth() + 1;
        const anioActual = new Date().getFullYear();
        const transacciones = await obtenerTransacciones(mesActual, anioActual);
        const presupuesto = await obtenerPresupuesto();
        
        const remanente = calcularRemanente(transacciones);
        const totales = calcularTotalesPorCategoria(transacciones);
        const ahorro = (totales['AHORROS'] || 0) + (totales['INVERSIONES'] || 0);
        
        document.getElementById('remanente').textContent = formatearMoneda(remanente);
        document.getElementById('ahorro').textContent = formatearMoneda(ahorro);
        
        // Patrimonio
        const activos = await obtenerPatrimonio(mesActual);
        const pasivos = await obtenerPatrimonio(mesActual + 100); // hack para separar
        const patrimonio = calcularPatrimonioNeto(activos, pasivos);
        document.getElementById('patrimonio').textContent = formatearMoneda(patrimonio);
        
    } catch (error) {
        console.error('Error al actualizar resumen:', error);
    }
}

// ============================================
// EXPORTAR PARA USO EN OTRAS PÁGINAS
// ============================================
window.app = {
    db,
    abrirDB,
    guardarPresupuesto,
    obtenerPresupuesto,
    obtenerPresupuestoPorCategoria,
    guardarTransaccion,
    obtenerTransacciones,
    eliminarTransaccion,
    guardarPatrimonio,
    obtenerPatrimonio,
    calcularTotalesPorCategoria,
    calcularRemanente,
    calcularPatrimonioNeto,
    formatearMoneda,
    obtenerNombreMes,
    CATEGORIAS
};
