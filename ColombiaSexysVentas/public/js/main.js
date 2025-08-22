// Main application file. Orchestrates all other modules.

import { auth, googleProvider } from './firebase-config.js';
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import * as ui from './ui.js';
import * as dbService from './firestore-service.js';

// --- Application State ---
let currentUserData = null;
let unsubscribeFromRecords = null;
let allRecordsData = [];

// Estados de fecha para cada panel
let adminCurrentWeek = dbService.getStartAndEndOfWeek(new Date()); // Para la página de Registros
let dashboardDateFilter = {
    type: 'week', // 'week', 'month', 'all'
    date: new Date() // Fecha de referencia para semana/mes
};

let catalogos = {
    lugares: [],
    bancos: [],
    choferes: [],
    empleadas: [], // Empleadas activas (Global)
    empleadasDeLaOficina: [], // Empleadas activas para la oficina del Jefe actual
    membresias: [], // Todas las membresías
    membresiasActivas: [], // Membresías con horas > 0
    oficinas: []
};
let adminData = {
    users: [], // Todos los usuarios
    jefes: [], // Solo usuarios con rol 'jefe'
    empleadas: [], // Solo usuarios con rol 'empleada' (no necesariamente activos)
    membresias: []
};

// --- Authentication Logic ---

function initializeAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const profile = await dbService.getUserProfile(user.uid, user.email);
            if (profile) {
                currentUserData = { ...user, ...profile, customRole: profile.rol || 'empleada' };
                initializeAppUI(currentUserData);
            } else {
                ui.showFeedback('Tu cuenta no está autorizada.', 'error');
                signOut(auth);
                ui.showLoginUI(); // Muestra el login si no está autorizado
            }
        } else {
            currentUserData = null;
            if (unsubscribeFromRecords) unsubscribeFromRecords();
            ui.showLoginUI();
        }
    });
}

// --- Application Initialization ---

async function initializeAppUI(user) {
    ui.showAppUI(user);
    ui.handleUserRoleUI(user.customRole);

    await loadAndPopulateCatalogs();

    if (user.customRole === 'jefe') {
        if (user.oficina && user.oficina.id) {
            const employeesOfOffice = await dbService.getEmployeesByOffice(user.oficina);
            catalogos.empleadasDeLaOficina = employeesOfOffice;
            ui.renderEmployeeButtons(employeesOfOffice);
        } else {
            ui.showFeedback('No tienes una oficina asignada. No puedes registrar servicios.', 'error');
        }
    } else if (user.customRole === 'admin') {
        await loadAdminPanelData();
        ui.setupAdminFormDate();
        ui.updateDashboardControlsUI(dashboardDateFilter.type);
    }

    if (unsubscribeFromRecords) unsubscribeFromRecords();

    unsubscribeFromRecords = dbService.setupRecordsListener(user, (snapshot) => {
        allRecordsData = snapshot.docs.map(doc => {
            const data = doc.data();
            const oficinaInfo = data.oficina_ref ? { id: data.oficina_ref.id } : null;
            return { id: doc.id, ...data, oficina_info: oficinaInfo };
        });

        if (user.customRole === 'admin') {
            processAdminData();
            const { weeks, employees } = getWeeksAndEmployeesFromRecords(allRecordsData);
            ui.updateCutSelectors(weeks, employees);
        } else if (user.customRole === 'jefe') {
            ui.renderJefeColumns(allRecordsData, user);
        } else { // Empleada
            ui.renderRecordsList(allRecordsData, user);
        }
    });
}

async function loadAndPopulateCatalogs() {
    const [lugaresData, bancosData, choferesData, empleadasActivasData, membresiasData, oficinasData] = await Promise.all([
        dbService.getCatalog('lugares'),
        dbService.getCatalog('bancos'),
        dbService.getCatalog('choferes'),
        dbService.getCatalog('usuarios', [
            { field: 'rol', operator: '==', value: 'empleada' },
            { field: 'estado', operator: '!=', value: 'inactivo' }
        ]),
        dbService.getCatalog('membresias'),
        dbService.getCatalog('oficinas')
    ]);
    catalogos.lugares = lugaresData;
    catalogos.bancos = bancosData;
    catalogos.choferes = choferesData;
    catalogos.empleadas = empleadasActivasData;
    catalogos.membresias = membresiasData;
    catalogos.oficinas = oficinasData;
    catalogos.membresiasActivas = membresiasData.filter(m => m.horas_restantes > 0);

    ui.populateAllForms(catalogos, currentUserData.customRole);
}

async function loadAdminPanelData() {
    const [users, membresias] = await Promise.all([
        dbService.getCatalog('usuarios', null, false),
        dbService.getCatalog('membresias')
    ]);
    adminData.users = users;
    adminData.jefes = users.filter(u => u.rol === 'jefe');
    adminData.empleadas = users.filter(u => u.rol === 'empleada');
    adminData.membresias = membresias;

    ui.populateAdminFormSelectors(adminData);
    ui.renderAdminSettings(adminData, catalogos);
}

// --- Admin Data Processing ---

function getRecordsForDashboardFilter() {
    const { type, date } = dashboardDateFilter;
    if (type === 'all') {
        return allRecordsData;
    }
    if (type === 'month') {
        const { start, end } = dbService.getStartAndEndOfMonth(date);
        return allRecordsData.filter(record => {
            if (!record.fecha || !record.fecha.toDate) return false;
            const recordDate = record.fecha.toDate();
            return recordDate >= start && recordDate <= end;
        });
    }
    const { start, end } = dbService.getStartAndEndOfWeek(date);
    return allRecordsData.filter(record => {
        if (!record.fecha || !record.fecha.toDate) return false;
        const recordDate = record.fecha.toDate();
        return recordDate >= start && recordDate <= end;
    });
}

function processAdminData() {
    const dashboardRecords = getRecordsForDashboardFilter();
    const officeDashboardRecords = dashboardRecords.filter(r => r.rol_registrador === 'jefe' || r.rol_registrador === 'admin');
    const dashboardData = calculateDashboardMetrics(officeDashboardRecords, catalogos.bancos);
    ui.renderDashboard(dashboardData);
    ui.renderDashboardDateDisplay(dashboardDateFilter);

    const { start, end } = adminCurrentWeek;
    const weekRecordsForRegistrosPage = allRecordsData.filter(record => {
        if (!record.fecha || !record.fecha.toDate) return false;
        const recordDate = record.fecha.toDate();
        return recordDate >= start && recordDate <= end;
    });
    ui.updateAdminWeekDisplay(dbService.getWeekNumber(start), start, end);
    ui.renderRecordsAccordion(weekRecordsForRegistrosPage, catalogos.oficinas, adminData.users, currentUserData);
}

function calculateDashboardMetrics(records, bancos) {
    const employeeMetrics = {};
    let totalIngresos = 0, totalEfectivo = 0, totalTarjeta = 0, totalUber = 0, totalExtras = 0;
    let totalMembresias = 0, totalPromociones = 0;
    const ingresosPorBanco = bancos.reduce((acc, banco) => ({ ...acc, [banco.nombre]: 0 }), {});

    records.forEach(r => {
        if (r.cancelado || !r.nombre_empleada) return;

        const key = r.nombre_empleada;

        if (!employeeMetrics[key]) {
            employeeMetrics[key] = {
                nombre: r.nombre_empleada,
                servicios: 0,
                ventaTotal: 0,
                totalTarjeta: 0,
                totalEfectivo: 0,
                gastoUber: 0,
                extras: 0,
            };
        }

        const metrics = employeeMetrics[key];
        const venta = r.total_servicio || 0;
        const extra = r.extra || 0;
        const uber = (r.uber_ida || 0) + (r.uber_regreso || 0);

        metrics.servicios++;
        metrics.ventaTotal += venta;
        metrics.extras += extra;
        metrics.gastoUber += uber;

        totalIngresos += venta;
        totalExtras += extra;
        totalUber += uber;
        if (r.promocion) totalPromociones += 300;

        if (r.metodo_pago === 'tarjeta') {
            const monto1 = r.monto_tarjeta || venta;
            const monto2 = r.monto_tarjeta_2 || 0;
            const totalPagoTarjeta = monto1 + monto2;
            metrics.totalTarjeta += totalPagoTarjeta;
            totalTarjeta += totalPagoTarjeta;
            if (r.banco && ingresosPorBanco.hasOwnProperty(r.banco)) ingresosPorBanco[r.banco] += monto1;
            if (r.banco_2 && ingresosPorBanco.hasOwnProperty(r.banco_2)) ingresosPorBanco[r.banco_2] += monto2;
        } else if (r.metodo_pago === 'efectivo') {
            metrics.totalEfectivo += venta;
            totalEfectivo += venta;
        } else if (r.metodo_pago === 'mixto') {
            const tarjeta = r.monto_tarjeta || 0;
            const efectivo = r.monto_efectivo || 0;
            metrics.totalTarjeta += tarjeta;
            metrics.totalEfectivo += efectivo;
            totalTarjeta += tarjeta;
            totalEfectivo += efectivo;
            if (r.banco && ingresosPorBanco.hasOwnProperty(r.banco)) ingresosPorBanco[r.banco] += tarjeta;
        } else if (r.metodo_pago === 'membresia') {
            totalMembresias += venta;
        }
    });

    const sortedAnalytics = Object.values(employeeMetrics).sort((a, b) => b.ventaTotal - a.ventaTotal);

    return {
        ranking: sortedAnalytics,
        analiticas: sortedAnalytics,
        kpis: {
            ingresos: { total: totalIngresos, efectivo: totalEfectivo, tarjeta: totalTarjeta },
            bancos: ingresosPorBanco,
            gastos: { uber: totalUber, extras: totalExtras, membresias: totalMembresias, promociones: totalPromociones }
        }
    };
}


function changeAdminWeek(direction) {
    const newDate = new Date(adminCurrentWeek.start);
    newDate.setDate(newDate.getDate() + (direction * 7));
    adminCurrentWeek = dbService.getStartAndEndOfWeek(newDate);
    processAdminData();
}

function getWeeksAndEmployeesFromRecords(records) {
    const employeeNames = new Set();
    records.forEach(record => {
        if (record.nombre_empleada) {
            employeeNames.add(record.nombre_empleada);
        }
    });

    const weeks = new Set(records.filter(r => r.fecha && r.fecha.toDate).map(r => `Semana ${dbService.getWeekNumber(r.fecha.toDate())}`));
    const sortedWeeks = Array.from(weeks).sort((a, b) => parseInt(b.replace('Semana ', ''), 10) - parseInt(a.replace('Semana ', ''), 10));

    const sortedEmployees = Array.from(employeeNames).sort((a, b) => a.localeCompare(b))
        .map(name => ({ id: name, nombre: name }));

    return { weeks: sortedWeeks, employees: sortedEmployees };
}

// --- Event Handlers ---

function setupEventListeners() {
    // Auth
    ui.dom.loginButton?.addEventListener('click', () => signInWithPopup(auth, googleProvider));
    ui.dom.logoutButton?.addEventListener('click', () => signOut(auth));

    // Non-admin form
    ui.dom.serviceForm?.addEventListener('submit', handleServiceFormSubmit);
    document.querySelectorAll('input[name="metodo_pago"]').forEach(radio => radio.addEventListener('change', () => ui.handlePaymentMethodChange('')));
    ui.setupAddCardButton('');
    ui.setupRemoveCardButton('');

    // Admin form
    ui.dom.adminServiceForm?.addEventListener('submit', handleAdminServiceFormSubmit);
    document.querySelectorAll('input[name="admin_metodo_pago"]').forEach(radio => radio.addEventListener('change', () => ui.handlePaymentMethodChange('admin-')));
    ui.setupAddCardButton('admin-');
    ui.setupRemoveCardButton('admin-');
    document.querySelectorAll('input[name="register_as"]').forEach(radio => radio.addEventListener('change', ui.handleRegisterAsChange));
    ui.dom.adminJefeSelect?.addEventListener('change', handleJefeSelectionChange);


    // Edit modal
    document.querySelectorAll('input[name="edit_metodo_pago"]').forEach(radio => radio.addEventListener('change', () => ui.handlePaymentMethodChange('edit-')));
    ui.setupAddCardButton('edit-');
    ui.setupRemoveCardButton('edit-');

    // Admin Navigation
    ui.dom.adminNav?.addEventListener('click', handleAdminNavClick);

    // Dashboard Date Controls
    ui.dom.dashboardDateControls?.addEventListener('click', handleDashboardNavClick);
    ui.dom.dashboardFilterType?.addEventListener('change', handleDashboardFilterTypeChange);

    // Records Container
    const recordsContainers = ['#records-list', '#office-records-view', '#records-accordion-container'];
    recordsContainers.forEach(selector => {
        const container = document.querySelector(selector);
        container?.addEventListener('click', handleRecordsListClick);
    });

    // Modal
    ui.dom.cancelEditBtn?.addEventListener('click', ui.closeEditModal);
    ui.dom.editRecordForm?.addEventListener('submit', handleEditFormSubmit);

    // Admin Weekly Navigation (Records Page)
    ui.dom.adminPrevWeekBtn?.addEventListener('click', () => changeAdminWeek(-1));
    ui.dom.adminNextWeekBtn?.addEventListener('click', () => changeAdminWeek(1));

    // Weekly Cut
    ui.dom.generateCutButton?.addEventListener('click', handleGenerateCutReport);
    ui.dom.cutReportOutput?.addEventListener('click', handleCutTableClick);

    // Settings Panel
    ui.dom.ajustesContent?.addEventListener('click', handleAdminPanelClicks);
}

function handleAdminNavClick(e) {
    if (e.target.matches('.admin-nav-btn')) {
        const page = e.target.dataset.page;
        ui.showAdminPage(page);
    }
}

function handleDashboardFilterTypeChange(e) {
    dashboardDateFilter.type = e.target.value;
    dashboardDateFilter.date = new Date();
    processAdminData();
    ui.updateDashboardControlsUI(dashboardDateFilter.type);
}

function handleDashboardNavClick(e) {
    const target = e.target;
    let direction = 0;
    if (target.matches('#dashboard-prev-btn')) direction = -1;
    if (target.matches('#dashboard-next-btn')) direction = 1;

    if (direction === 0) return;

    const { type, date } = dashboardDateFilter;
    if (type === 'week') {
        date.setDate(date.getDate() + (direction * 7));
    } else if (type === 'month') {
        date.setMonth(date.getMonth() + direction);
    }
    dashboardDateFilter.date = date;
    processAdminData();
}

async function handleJefeSelectionChange(e) {
    const jefeId = e.target.value;
    if (!jefeId) {
        ui.populateEmpleadasOfJefeSelect([]);
        return;
    }
    const selectedJefe = adminData.jefes.find(j => j.id === jefeId);
    if (selectedJefe && selectedJefe.oficina) {
        const employeesOfOffice = await dbService.getEmployeesByOffice(selectedJefe.oficina);
        ui.populateEmpleadasOfJefeSelect(employeesOfOffice);
    } else {
        ui.populateEmpleadasOfJefeSelect([]);
    }
}


function validateForm(data, role) {
    if (data.cancelado === 'on') {
        if (role === 'jefe' && !data.empleada_uid) {
            return { valid: false, message: 'Debes seleccionar una empleada, incluso si el servicio está cancelado.' };
        }
        return { valid: true };
    }

    if (!data.horas_servicio || !data.total_servicio || !data.lugar) {
        return { valid: false, message: 'Los campos Horas, Total y Lugar son obligatorios.' };
    }
    if (role === 'jefe' && !data.empleada_uid) {
        return { valid: false, message: 'Debes seleccionar una empleada.' };
    }
    if (data.metodo_pago === 'membresia' && !data.membresia_id) {
        return { valid: false, message: 'Debes seleccionar una membresía.' };
    }

    return { valid: true };
}

function processAndGetServiceData(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const totalServicio = parseFloat(data.total_servicio || data.edit_total_servicio) || 0;

    let montoTarjeta1 = parseFloat(data.monto_tarjeta || data.edit_monto_tarjeta) || 0;
    const montoTarjeta2 = parseFloat(data.monto_tarjeta_2 || data.edit_monto_tarjeta_2) || 0;
    const metodoPago = data.metodo_pago || data.admin_metodo_pago || data.edit_metodo_pago;

    if (metodoPago === 'tarjeta' && !montoTarjeta2 && montoTarjeta1 === 0) {
        montoTarjeta1 = totalServicio;
    }

    return {
        ...data,
        horas_servicio: parseInt(data.horas_servicio || data.edit_horas_servicio, 10) || 0,
        total_servicio: totalServicio,
        monto_tarjeta: montoTarjeta1,
        monto_tarjeta_2: montoTarjeta2,
        monto_efectivo: parseFloat(data.monto_efectivo || data.edit_monto_efectivo) || 0,
        extra: parseFloat(data.extra || data.edit_extra) || 0,
        uber_ida: parseFloat(data.uber_ida || data.edit_uber_ida) || 0,
        uber_regreso: parseFloat(data.uber_regreso || data.edit_uber_regreso) || 0,
        cancelado: data.cancelado === 'on' || data.edit_cancelado === 'on',
        promocion: data.promocion === 'on' || data.edit_promocion === 'on',
        metodo_pago: metodoPago,
        membresia_id: data.membresia_id || data.edit_membresia_id || null,
        banco: data.banco || data.edit_banco || null,
        banco_2: data.banco_2 || data.edit_banco_2 || null,
        lugar: data.lugar || data.edit_lugar || null,
        chofer_ida: data.chofer_ida || data.edit_chofer_ida || null,
        chofer_regreso: data.chofer_regreso || data.edit_chofer_regreso || null,
    };
}

async function handleServiceFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const serviceData = processAndGetServiceData(form);

    if (currentUserData.customRole === 'jefe') {
        const selectedEmployeeId = ui.dom.empleadaUidSelectedInput.value;
        const selectedEmployee = catalogos.empleadasDeLaOficina.find(emp => emp.id === selectedEmployeeId);

        if (!selectedEmployeeId) {
            return ui.showFeedback('Debes seleccionar una empleada.', 'error');
        }
        if (!selectedEmployee) {
            return ui.showFeedback('La empleada seleccionada no es válida. Por favor, refresca la página e intenta de nuevo.', 'error');
        }
        serviceData.uid_empleada = selectedEmployee.id;
        serviceData.nombre_empleada = selectedEmployee.nombre;
    }

    const validation = validateForm(serviceData, currentUserData.customRole);
    if (!validation.valid) {
        return ui.showFeedback(validation.message, 'error');
    }

    serviceData.uid_registrador = currentUserData.uid;
    serviceData.nombre_registrador = currentUserData.nombre;
    serviceData.rol_registrador = currentUserData.customRole;
    serviceData.oficina_ref = currentUserData.oficina ? dbService.getDocRef('oficinas', currentUserData.oficina.id) : null;

    if (currentUserData.customRole === 'empleada') {
        serviceData.uid_empleada = currentUserData.uid;
        serviceData.nombre_empleada = currentUserData.nombre;
    }

    try {
        const result = await dbService.addServiceRecord(serviceData, serviceData.rol_registrador);
        if (result.success) {
            ui.showFeedback('Registro guardado con éxito.', 'success');
            form.reset();
            ui.handlePaymentMethodChange('');
            if (currentUserData.customRole === 'jefe') ui.clearEmployeeButtonSelection();
            if (serviceData.metodo_pago === 'membresia') await loadAndPopulateCatalogs();
        } else {
            ui.showFeedback(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        ui.showFeedback('Error al guardar el registro.', 'error');
        console.error(error);
    }
}

async function handleAdminServiceFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const serviceData = processAndGetServiceData(form);
    const registerAs = serviceData.register_as;
    let registrador, empleada;

    if (registerAs === 'jefe') {
        if (!serviceData.jefe_uid || !serviceData.empleada_uid_from_jefe) {
            return ui.showFeedback('Debes seleccionar un jefe y una empleada.', 'error', 'admin-');
        }
        registrador = adminData.jefes.find(j => j.id === serviceData.jefe_uid);
        empleada = adminData.users.find(u => u.id === serviceData.empleada_uid_from_jefe);
    } else { // 'empleada'
        if (!serviceData.empleada_uid_single) {
            return ui.showFeedback('Debes seleccionar una empleada.', 'error', 'admin-');
        }
        registrador = adminData.empleadas.find(em => em.id === serviceData.empleada_uid_single);
        empleada = registrador;
    }

    if (!registrador || !empleada) {
        return ui.showFeedback('Los usuarios seleccionados no son válidos.', 'error', 'admin-');
    }

    serviceData.rol_registrador = registrador.rol;
    serviceData.uid_registrador = registrador.id;
    serviceData.nombre_registrador = registrador.nombre;
    serviceData.uid_empleada = empleada.id;
    serviceData.nombre_empleada = empleada.nombre;
    serviceData.oficina_ref = empleada.oficina || null;
    serviceData.creado_por_admin = currentUserData.uid;

    if (serviceData.fecha_servicio) {
        const [year, month, day] = serviceData.fecha_servicio.split('-');
        serviceData.fecha = new Date(year, month - 1, day, 12, 0, 0);
    }

    if (serviceData.metodo_pago === 'membresia' && !serviceData.membresia_id) {
        return ui.showFeedback('Debes seleccionar una membresía.', 'error', 'admin-');
    }

    try {
        const result = await dbService.addServiceRecord(serviceData, serviceData.rol_registrador);
        if (result.success) {
            ui.showFeedback('Registro guardado con éxito.', 'success', 'admin-');
            form.reset();
            ui.setupAdminFormDate();
            ui.handlePaymentMethodChange('admin-');
            ui.handleRegisterAsChange();
            if (serviceData.metodo_pago === 'membresia') {
                await loadAndPopulateCatalogs();
                await loadAdminPanelData();
            }
        } else {
            ui.showFeedback(`Error: ${result.error}`, 'error', 'admin-');
        }
    } catch (error) {
        ui.showFeedback('Error al guardar el registro.', 'error', 'admin-');
        console.error(error);
    }
}


async function handleRecordsListClick(e) {
    const target = e.target;
    const recordElement = target.closest('.record-item');
    if (!recordElement) return;
    const recordId = recordElement.dataset.id;

    if (target.classList.contains('edit-record-btn')) {
        try {
            ui.showFeedback('Cargando datos...', 'info', 'edit-', 1500);
            const recordToEdit = await dbService.getRecordById(recordId);
            if (recordToEdit) {
                ui.openEditModal(recordToEdit, { ...catalogos, empleadas: adminData.users }, currentUserData);
            } else {
                ui.showFeedback('Error: No se encontró el registro.', 'error', 'edit-');
            }
        } catch (error) {
            console.error("Error al obtener registro para editar:", error);
            ui.showFeedback('Error al cargar el registro.', 'error', 'edit-');
        }
    }

    if (target.classList.contains('delete-record-btn')) {
        if (confirm('¿Estás seguro de que quieres borrar este registro? Esta acción no se puede deshacer.')) {
            try {
                await dbService.deleteRecord(recordId);
                ui.showFeedback('Registro borrado con éxito.', 'success');
            } catch (error) {
                console.error("Error al borrar el registro:", error);
                ui.showFeedback('Error al borrar el registro.', 'error');
            }
        }
    }
}

async function handleEditFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const recordId = form.querySelector('#edit-record-id').value;

    const getRadio = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;
    const getValue = (id) => form.querySelector(`#${id}`)?.value || '';
    const getFloat = (id) => parseFloat(form.querySelector(`#${id}`)?.value) || 0;
    const getInt = (id) => parseInt(form.querySelector(`#${id}`)?.value, 10) || 0;
    const getChecked = (id) => form.querySelector(`#${id}`)?.checked || false;

    const totalServicio = getFloat('edit-total_servicio');
    let montoTarjeta1 = getFloat('edit-monto_tarjeta');
    const montoTarjeta2 = getFloat('edit-monto_tarjeta_2');
    const metodoPago = getRadio('edit_metodo_pago');

    if (metodoPago === 'tarjeta' && !montoTarjeta2 && !montoTarjeta1) {
        montoTarjeta1 = totalServicio;
    }

    const dataToUpdate = {
        horas_servicio: getInt('edit-horas_servicio'),
        total_servicio: totalServicio,
        metodo_pago: metodoPago,
        lugar: getValue('edit-lugar'),
        banco: getValue('edit-banco'),
        banco_2: getValue('edit-banco_2'),
        monto_tarjeta: montoTarjeta1,
        monto_tarjeta_2: montoTarjeta2,
        monto_efectivo: getFloat('edit-monto_efectivo'),
        extra: getFloat('edit-extra'),
        uber_ida: getFloat('edit-uber_ida'),
        uber_regreso: getFloat('edit-uber_regreso'),
        chofer_ida: getValue('edit-chofer_ida'),
        chofer_regreso: getValue('edit-chofer_regreso'),
        cancelado: getChecked('edit-cancelado'),
        promocion: getChecked('edit-promocion'),
        membresia_id: getValue('edit-membresia_id'),
    };

    if (currentUserData.customRole === 'admin') {
        const newEmployeeId = getValue('edit-empleada');
        if (newEmployeeId) {
            const newEmployee = adminData.users.find(emp => emp.id === newEmployeeId);
            dataToUpdate.uid_empleada = newEmployeeId;
            dataToUpdate.nombre_empleada = newEmployee ? newEmployee.nombre : '';
        }
    }

    try {
        const result = await dbService.updateRecord(recordId, dataToUpdate);
        if (result.success) {
            ui.showFeedback('Registro actualizado con éxito.', 'success', 'edit-');
            ui.closeEditModal();
            if (dataToUpdate.metodo_pago === 'membresia') {
                await loadAndPopulateCatalogs();
                await loadAdminPanelData();
            }
        } else {
            ui.showFeedback(`Error: ${result.error}`, 'error', 'edit-');
        }
    } catch (error) {
        console.error('Error al actualizar el registro:', error);
        ui.showFeedback('Error al guardar los cambios.', 'error', 'edit-');
    }
}


async function handleAddCatalogItem(collectionName, inputId) {
    const inputElement = document.getElementById(inputId);
    const nombre = inputElement.value.trim();
    if (!nombre) return ui.showFeedback(`El nombre es obligatorio.`, 'error');

    try {
        await dbService.addCatalogItem(collectionName, { nombre });
        ui.showFeedback(`"${nombre}" agregado.`, 'success');
        inputElement.value = '';
        await loadAndPopulateCatalogs();
        await loadAdminPanelData();
    } catch (error) {
        ui.showFeedback('Error al agregar el elemento.', 'error');
        console.error(error);
    }
}

async function handleAdminPanelClicks(e) {
    const target = e.target;

    if (target.matches('.settings-accordion-header')) {
        const content = target.nextElementSibling;

        document.querySelectorAll('#ajustes-content .settings-accordion-content.open').forEach(openContent => {
            if (openContent !== content) {
                openContent.classList.remove('open');
                openContent.previousElementSibling.classList.remove('active');
            }
        });

        content.classList.toggle('open');
        target.classList.toggle('active');

        return;
    }

    const id = target.dataset.id;
    const type = target.dataset.type;

    if (target.matches('.add-catalog-btn')) {
        const collection = target.dataset.collection;
        const inputId = target.dataset.input;
        await handleAddCatalogItem(collection, inputId);
    }
    if (target.matches('.delete-btn')) {
        if (!id || !type) return;
        if (confirm(`¿Estás seguro de que quieres eliminar este elemento?`)) {
            try {
                await dbService.deleteCatalogItem(type, id);
                ui.showFeedback('Elemento eliminado.', 'success');
                await loadAndPopulateCatalogs();
                await loadAdminPanelData();
            } catch (error) {
                ui.showFeedback('Error al eliminar.', 'error');
                console.error(error);
            }
        }
    }

    if (target.matches('.create-user-btn')) {
        const form = target.closest('form');
        const nombre = form.querySelector('#create-user-name').value.trim();
        const email = form.querySelector('#create-user-email').value.trim();
        const oficinaId = form.querySelector('#create-user-oficina').value;
        if (!nombre || !email || !oficinaId) return ui.showFeedback('Por favor, completa todos los campos.', 'error');
        try {
            await dbService.createProvisionalUser(email, nombre, oficinaId);
            ui.showFeedback(`Usuario ${nombre} agregado. Ya puede iniciar sesión.`, 'success');
            form.reset();
            await loadAdminPanelData();
        } catch (error) {
            ui.showFeedback('Error al crear el usuario. El email podría ya existir.', 'error');
        }
    }
    if (target.matches('.edit-user-btn')) {
        const userToEdit = adminData.users.find(u => u.id === id);
        if (userToEdit) ui.showUserEditForm(id, userToEdit, catalogos.oficinas);
    }
    if (target.matches('.save-user-btn')) {
        const dataToUpdate = {
            nombre: document.getElementById(`edit-user-name-${id}`).value,
            rol: document.getElementById(`edit-user-rol-${id}`).value,
            oficinaId: document.getElementById(`edit-user-oficina-${id}`).value,
            estado: document.getElementById(`edit-user-estado-${id}`).value,
        };
        try {
            await dbService.updateUser(id, dataToUpdate);
            ui.showFeedback('Usuario actualizado.', 'success');
            await loadAdminPanelData();
            await loadAndPopulateCatalogs();
        } catch (error) {
            ui.showFeedback('Error al actualizar.', 'error');
        }
    }
    if (target.matches('.cancel-edit-user-btn')) {
        ui.removeUserEditForm(target.dataset.id);
    }

    if (target.matches('.add-membresia-btn')) {
        const form = target.closest('form');
        const nombre = form.querySelector('#nueva-membresia-nombre').value.trim();
        const horas = parseInt(form.querySelector('#nueva-membresia-horas').value, 10);
        if (!nombre || !horas || horas <= 0) return ui.showFeedback('Ingresa un nombre y horas válidas.', 'error');
        try {
            await dbService.addMembership(nombre, horas);
            ui.showFeedback(`Membresía para "${nombre}" creada.`, 'success');
            form.reset();
            await loadAndPopulateCatalogs();
            await loadAdminPanelData();
        } catch (error) {
            ui.showFeedback('Error al crear la membresía.', 'error');
        }
    }
    if (target.matches('.edit-membresia-btn')) {
        const membresiaToEdit = adminData.membresias.find(m => m.id === id);
        if (membresiaToEdit) ui.showMembresiaEditForm(id, membresiaToEdit);
    }
    if (target.matches('.save-membresia-btn')) {
        const nombre = document.getElementById(`edit-membresia-name-${id}`).value.trim();
        const horas_restantes = parseInt(document.getElementById(`edit-membresia-horas-${id}`).value, 10);
        if (!nombre || isNaN(horas_restantes) || horas_restantes < 0) return ui.showFeedback('Ingresa datos válidos.', 'error');
        try {
            await dbService.updateMembership(id, { nombre, horas_restantes });
            ui.showFeedback('Membresía actualizada.', 'success');
            await loadAdminPanelData();
            await loadAndPopulateCatalogs();
        } catch (error) {
            ui.showFeedback('Error al actualizar.', 'error');
        }
    }
    if (target.matches('.cancel-edit-membresia-btn')) {
        ui.removeMembresiaEditForm(target.dataset.id);
    }
}

function handleGenerateCutReport() {
    const weekString = ui.dom.cutWeekSelect.value;
    const employeeName = ui.dom.cutEmployeeSelect.value;

    if (!weekString || !employeeName) {
        return ui.renderCutReport({ error: 'Por favor, selecciona una semana y una empleada.' });
    }

    const weekInfo = dbService.getWeekInfoFromString(weekString);
    if (!weekInfo) return;

    const { start, end } = weekInfo;

    const weekRecords = allRecordsData.filter(r => {
        const recordDate = r.fecha?.toDate();
        return recordDate && recordDate >= start && recordDate <= end && !r.cancelado;
    });

    const officeRecords = weekRecords.filter(r => r.nombre_empleada === employeeName && (r.rol_registrador === 'jefe' || r.rol_registrador === 'admin'));
    const employeeRecords = weekRecords.filter(r => r.nombre_empleada === employeeName && r.rol_registrador === 'empleada');

    const calculateCut = (records) => {
        let ventaTotal = 0, gastoUberTotal = 0, ventaTarjetaTotal = 0, extrasCalculados = 0, membresiaTotal = 0, promocionTotal = 0;
        records.forEach(r => {
            const venta = r.total_servicio || 0;
            ventaTotal += venta;
            gastoUberTotal += (r.uber_ida || 0) + (r.uber_regreso || 0);

            if (r.metodo_pago === 'tarjeta') {
                ventaTarjetaTotal += (r.monto_tarjeta || venta) + (r.monto_tarjeta_2 || 0);
            } else if (r.metodo_pago === 'mixto') {
                ventaTarjetaTotal += r.monto_tarjeta || 0;
            }

            if (r.metodo_pago === 'membresia') membresiaTotal += venta;
            if (r.promocion) promocionTotal += 300;

            const extra = r.extra || 0;
            extrasCalculados += (extra >= 1000) ? (extra * 0.85) : extra;
        });

        const result = (ventaTotal * 0.40) - gastoUberTotal - ventaTarjetaTotal - extrasCalculados - membresiaTotal - promocionTotal;

        return { result, ventaTotal, extrasCalculados, gastoUberTotal, ventaTarjetaTotal, membresiaTotal, promocionTotal };
    };

    const oficinaCut = calculateCut(officeRecords);
    const empleadaCut = calculateCut(employeeRecords);

    ui.renderCutReport({
        officeCut: oficinaCut,
        employeeCut: empleadaCut,
        officeRecords: officeRecords,
        employeeRecords: employeeRecords,
        membresias: catalogos.membresias
    });
}

async function handleCutTableClick(e) {
    const targetCell = e.target.closest('td');
    if (!targetCell || !targetCell.dataset.recordId) return;

    const recordId = targetCell.dataset.recordId;
    if (!recordId) return;

    ui.showFeedback('Cargando registro para editar...', 'info', 'admin-');

    try {
        const recordData = await dbService.getRecordById(recordId);
        if (recordData) {
            ui.showAdminPage('registros');
            ui.openEditModal(recordData, { ...catalogos, empleadas: adminData.users }, currentUserData);
        } else {
            ui.showFeedback('No se pudo encontrar el registro para editar.', 'error', 'admin-');
        }
    } catch (error) {
        console.error("Error al buscar registro para editar desde corte:", error);
        ui.showFeedback('Error al cargar datos del registro.', 'error', 'admin-');
    }
}


// --- App Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeAuthListener();
});
