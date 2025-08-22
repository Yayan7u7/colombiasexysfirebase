// This module handles all direct DOM manipulation and UI updates.

import * as dbService from './firestore-service.js';

const colorPalette = ['#c3a137', '#34a853', '#4285f4', '#ea4335', '#fbbc05', '#8e24aa', '#00796b', '#d81b60'];
let assignedColors = {};
let rankingChart = null;

// --- DOM Element References ---
export const dom = {
    // Loading
    loadingContainer: document.getElementById('loading-container'),

    // Auth
    authContainer: document.getElementById('auth-container'),
    loginButton: document.getElementById('login-button'),
    mainContainer: document.getElementById('main-container'),
    logoutButton: document.getElementById('logout-button'),
    userNameDisplay: document.getElementById('user-name-display'),
    userRoleDisplay: document.getElementById('user-role-display'),

    // Contenido No-Admin
    nonAdminContent: document.getElementById('non-admin-content'),
    serviceForm: document.getElementById('service-form'),
    empleadaField: document.getElementById('empleada-field'),
    empleadaButtonsContainer: document.getElementById('empleada-buttons-container'),
    empleadaUidSelectedInput: document.getElementById('empleada-uid-selected'),
    feedbackMessage: document.getElementById('feedback-message'),
    recordsSection: document.getElementById('records-section'),
    recordsList: document.getElementById('records-list'),
    officeRecordsView: document.getElementById('office-records-view'),
    employeeColumns: document.querySelector('.employee-columns'),

    // Nueva Interfaz Admin
    adminInterface: document.getElementById('admin-interface'),
    adminNav: document.getElementById('admin-nav'),
    adminMainContent: document.getElementById('admin-main-content'),

    // Página 1: Dashboard
    dashboardDateControls: document.getElementById('dashboard-date-controls'),
    dashboardFilterType: document.getElementById('dashboard-filter-type'),
    dashboardNavContainer: document.getElementById('dashboard-nav-container'),
    dashboardDateDisplay: document.getElementById('dashboard-date-display'),
    kpiIngresosTotales: document.getElementById('kpi-ingresos-totales'),
    kpiIngresosBancos: document.getElementById('kpi-ingresos-bancos'),
    kpiGastosTotales: document.getElementById('kpi-gastos-totales'),
    rankingChartCanvas: document.getElementById('ranking-chart'),
    analiticasTableContainer: document.getElementById('analiticas-table-container'),

    // Página 2: Registros Admin
    adminServiceForm: document.getElementById('admin-service-form'),
    adminFeedbackMessage: document.getElementById('admin-feedback-message'),
    adminWeekSelector: document.getElementById('admin-week-selector'),
    adminCurrentWeekDisplay: document.getElementById('admin-current-week-display'),
    adminPrevWeekBtn: document.getElementById('admin-prev-week-btn'),
    adminNextWeekBtn: document.getElementById('admin-next-week-btn'),
    recordsAccordionContainer: document.getElementById('records-accordion-container'),
    adminRegisterAsRadios: document.querySelectorAll('input[name="register_as"]'),
    adminJefeSelectors: document.getElementById('admin-jefe-selectors'),
    adminEmpleadaSelector: document.getElementById('admin-empleada-selector'),
    adminJefeSelect: document.getElementById('admin-jefe-select'),
    adminEmpleadaOfJefeSelect: document.getElementById('admin-empleada-of-jefe-select'),
    adminEmpleadaSelect: document.getElementById('admin-empleada-select'),


    // Página 3: Corte Semanal
    cutWeekSelect: document.getElementById('cut-week-select'),
    cutEmployeeSelect: document.getElementById('cut-employee-select'),
    generateCutButton: document.getElementById('generate-cut-button'),
    cutReportOutput: document.getElementById('cut-report-output'),

    // Página 4: Ajustes
    ajustesContent: document.getElementById('ajustes-content'),

    // Modal
    editRecordModal: document.getElementById('editRecordModal'),
    editRecordForm: document.getElementById('edit-record-form'),
    editFeedbackMessage: document.getElementById('edit-feedback-message'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
};

// --- UI State Functions ---

export function showLoadingScreen() {
    if (dom.loadingContainer) dom.loadingContainer.style.display = 'flex';
    if (dom.authContainer) dom.authContainer.style.display = 'none';
    if (dom.mainContainer) dom.mainContainer.style.display = 'none';
}

export function showLoginUI() {
    if (dom.loadingContainer) dom.loadingContainer.style.display = 'none';
    if (dom.authContainer) dom.authContainer.style.display = 'block';
    if (dom.mainContainer) dom.mainContainer.style.display = 'none';
}

export function showAppUI(userData) {
    if (dom.loadingContainer) dom.loadingContainer.style.display = 'none';
    if (dom.authContainer) dom.authContainer.style.display = 'none';
    if (dom.mainContainer) dom.mainContainer.style.display = 'block';
    dom.userNameDisplay.textContent = userData.nombre || userData.email;
    dom.userRoleDisplay.textContent = (userData.rol || 'empleada').charAt(0).toUpperCase() + (userData.rol || 'empleada').slice(1);
}

export function handleUserRoleUI(userRole) {
    const isAdmin = userRole === 'admin';
    const isJefe = userRole === 'jefe';

    dom.nonAdminContent.style.display = isAdmin ? 'none' : 'block';
    dom.adminInterface.style.display = isAdmin ? 'flex' : 'none';

    if (dom.empleadaField) {
        dom.empleadaField.style.display = isJefe ? 'block' : 'none';
    }
    if(dom.officeRecordsView) {
        dom.officeRecordsView.style.display = isJefe ? 'flex' : 'none';
    }
    if(dom.recordsList) {
        dom.recordsList.style.display = isJefe ? 'none' : 'block';
    }
}

// --- Admin Navigation ---
export function showAdminPage(pageId) {
    document.querySelectorAll('.admin-page').forEach(page => page.classList.add('hidden'));
    document.getElementById(`admin-page-${pageId}`).classList.remove('hidden');

    document.querySelectorAll('.admin-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.admin-nav-btn[data-page="${pageId}"]`).classList.add('active');
}


// --- Message Display ---
export function showFeedback(message, type = 'success', prefix = '', duration = 4000) {
    let feedbackElement;
    if (prefix === 'admin-') feedbackElement = dom.adminFeedbackMessage;
    else if (prefix === 'edit-') feedbackElement = dom.editFeedbackMessage;
    else feedbackElement = dom.feedbackMessage;

    if (!feedbackElement) return;
    feedbackElement.className = type;
    feedbackElement.textContent = message;
    feedbackElement.style.display = 'block';
    setTimeout(() => { feedbackElement.style.display = 'none'; }, duration);
}

// --- Form and Input Handling ---

export function handlePaymentMethodChange(prefix = '') {
    let form;
    let metodoPagoName;

    if (prefix === 'admin-') {
        form = document.getElementById('admin-service-form');
        metodoPagoName = 'admin_metodo_pago';
    } else if (prefix === 'edit-') {
        form = document.getElementById('edit-record-form');
        metodoPagoName = 'edit_metodo_pago';
    } else {
        form = document.getElementById('service-form');
        metodoPagoName = 'metodo_pago';
    }

    if (!form) return;

    const metodoPago = form.querySelector(`input[name="${metodoPagoName}"]:checked`)?.value;

    const tarjeta1Fields = document.getElementById(`${prefix}tarjeta-1-fields`);
    const montoTarjetaField = document.getElementById(`${prefix}monto-tarjeta-field`);
    const tarjeta2Fields = document.getElementById(`${prefix}tarjeta-2-fields`);
    const addCardBtn = document.getElementById(`${prefix}add-card-btn`);
    const montoEfectivoField = document.getElementById(`${prefix}monto-efectivo-field`);
    const membresiaField = document.getElementById(`${prefix}membresia-field`);

    const isTwoCardMode = tarjeta2Fields && tarjeta2Fields.style.display === 'block';

    if (tarjeta1Fields) tarjeta1Fields.style.display = 'none';
    if (montoEfectivoField) montoEfectivoField.style.display = 'none';
    if (membresiaField) membresiaField.style.display = 'none';
    if (addCardBtn) addCardBtn.style.display = 'none';
    if (montoTarjetaField) montoTarjetaField.style.display = 'none';

    if (metodoPago === 'tarjeta') {
        if (tarjeta1Fields) tarjeta1Fields.style.display = 'block';
        if (isTwoCardMode) {
            if (montoTarjetaField) montoTarjetaField.style.display = 'block';
        } else {
            if (addCardBtn) addCardBtn.style.display = 'block';
        }
    } else if (metodoPago === 'mixto') {
        if (tarjeta1Fields) tarjeta1Fields.style.display = 'block';
        if (montoTarjetaField) montoTarjetaField.style.display = 'block';
        if (montoEfectivoField) montoEfectivoField.style.display = 'block';
    } else if (metodoPago === 'membresia') {
        if (membresiaField) membresiaField.style.display = 'block';
    }
}

export function setupAddCardButton(prefix = '') {
    const addCardBtn = document.getElementById(`${prefix}add-card-btn`);
    const tarjeta2Fields = document.getElementById(`${prefix}tarjeta-2-fields`);
    const montoTarjetaField = document.getElementById(`${prefix}monto-tarjeta-field`);

    if (addCardBtn && tarjeta2Fields && montoTarjetaField) {
        addCardBtn.addEventListener('click', () => {
            tarjeta2Fields.style.display = 'block';
            montoTarjetaField.style.display = 'block';
            addCardBtn.style.display = 'none';
        });
    }
}

export function setupRemoveCardButton(prefix = '') {
    const form = document.getElementById(prefix ? `${prefix}service-form` : 'service-form') || document.getElementById('edit-record-form');
    if (!form) return;

    const removeBtn = form.querySelector(`.remove-card-btn[data-prefix="${prefix}"]`);
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            const tarjeta2Fields = document.getElementById(`${prefix}tarjeta-2-fields`);
            const addCardBtn = document.getElementById(`${prefix}add-card-btn`);
            const montoTarjetaField = document.getElementById(`${prefix}monto-tarjeta-field`);

            if (tarjeta2Fields) {
                tarjeta2Fields.style.display = 'none';
                tarjeta2Fields.querySelector(`input[name="monto_tarjeta_2"]`).value = '';
                tarjeta2Fields.querySelector(`select[name="banco_2"]`).value = '';
            }
            if (montoTarjetaField) {
                montoTarjetaField.style.display = 'none';
                montoTarjetaField.querySelector('input').value = '';
            }
            if (addCardBtn) {
                addCardBtn.style.display = 'block';
            }
        });
    }
}


function populateSelectWithOptions(selectElement, data, placeholder, valueKey = 'id', textKey = 'nombre') {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    data.forEach(item => {
        const displayText = typeof textKey === 'function' ? textKey(item) : item[textKey];
        const value = item[valueKey];
        if (value !== undefined && displayText !== undefined) {
            selectElement.innerHTML += `<option value="${value}">${displayText}</option>`;
        }
    });
}

export function populateAllForms(catalogos, userRole) {
    const isAdminOrJefe = userRole === 'admin' || userRole === 'jefe';
    const membresiasParaCreacion = isAdminOrJefe ? catalogos.membresiasActivas : catalogos.membresias;

    populateSelectWithOptions(document.getElementById('lugar'), catalogos.lugares, 'Selecciona un lugar', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('banco'), catalogos.bancos, 'Selecciona un banco', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('banco_2'), catalogos.bancos, 'Selecciona un banco', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('chofer_ida'), catalogos.choferes, 'Selecciona un chofer', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('chofer_regreso'), catalogos.choferes, 'Selecciona un chofer', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('membresia_id'), membresiasParaCreacion, 'Selecciona una membresía', 'id', 'nombre');

    populateSelectWithOptions(document.getElementById('admin-lugar'), catalogos.lugares, 'Selecciona un lugar', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('admin-banco'), catalogos.bancos, 'Selecciona un banco', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('admin-banco_2'), catalogos.bancos, 'Selecciona un banco', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('admin-chofer_ida'), catalogos.choferes, 'Selecciona un chofer', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('admin-chofer_regreso'), catalogos.choferes, 'Selecciona un chofer', 'nombre', 'nombre');
    populateSelectWithOptions(document.getElementById('admin-membresia_id'), membresiasParaCreacion, 'Selecciona una membresía', 'id', 'nombre');
}

export function handleRegisterAsChange() {
    const selectedValue = document.querySelector('input[name="register_as"]:checked').value;
    if (selectedValue === 'jefe') {
        dom.adminJefeSelectors.style.display = 'block';
        dom.adminEmpleadaSelector.style.display = 'none';
    } else {
        dom.adminJefeSelectors.style.display = 'none';
        dom.adminEmpleadaSelector.style.display = 'block';
    }
}

export function populateAdminFormSelectors(adminData) {
    populateSelectWithOptions(dom.adminJefeSelect, adminData.jefes, 'Selecciona un jefe');
    populateSelectWithOptions(dom.adminEmpleadaSelect, adminData.empleadas, 'Selecciona una empleada');
}

export function populateEmpleadasOfJefeSelect(empleadas) {
    populateSelectWithOptions(dom.adminEmpleadaOfJefeSelect, empleadas, 'Selecciona una empleada');
}


export function setupAdminFormDate() {
    const dateInput = document.getElementById('admin-fecha_servicio');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
}


export function renderEmployeeButtons(employees) {
    if (!dom.empleadaButtonsContainer || !dom.empleadaUidSelectedInput) return;
    dom.empleadaButtonsContainer.innerHTML = '';
    dom.empleadaUidSelectedInput.value = '';

    if (employees.length === 0) {
        dom.empleadaButtonsContainer.innerHTML = '<p>No hay empleadas asignadas a tu oficina.</p>';
        return;
    }

    employees.forEach((employee, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = employee.nombre || employee.email.split('@')[0];
        button.className = 'empleada-btn';
        button.dataset.uid = employee.id;
        const color = colorPalette[index % colorPalette.length];
        assignedColors[employee.id] = color;
        button.style.backgroundColor = color;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            dom.empleadaButtonsContainer.querySelectorAll('.empleada-btn').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            dom.empleadaUidSelectedInput.value = employee.id;
        });
        dom.empleadaButtonsContainer.appendChild(button);
    });
}

export function clearEmployeeButtonSelection() {
    if (dom.empleadaButtonsContainer) {
        dom.empleadaButtonsContainer.querySelectorAll('.empleada-btn').forEach(btn => btn.classList.remove('selected'));
    }
    if (dom.empleadaUidSelectedInput) {
        dom.empleadaUidSelectedInput.value = '';
    }
}

// --- PÁGINA 1: DASHBOARD RENDERING ---

export function updateDashboardControlsUI(filterType) {
    if (!dom.dashboardNavContainer) return;
    if (filterType === 'all') {
        dom.dashboardNavContainer.classList.add('hidden');
    } else {
        dom.dashboardNavContainer.classList.remove('hidden');
    }
}

export function renderDashboardDateDisplay(filter) {
    if (!dom.dashboardDateDisplay) return;
    const { type, date } = filter;
    let displayString = '';

    if (type === 'all') {
        displayString = 'Mostrando Histórico (Todos los registros)';
    } else if (type === 'month') {
        const monthName = date.toLocaleString('es-ES', { month: 'long' });
        displayString = `Mes: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${date.getFullYear()}`;
    } else { // week
        const { start, end } = dbService.getStartAndEndOfWeek(new Date(date));
        const weekNumber = dbService.getWeekNumber(start);
        displayString = `Semana ${weekNumber}: del ${start.toLocaleDateString()} al ${end.toLocaleDateString()}`;
    }
    dom.dashboardDateDisplay.textContent = displayString;
}

export function renderDashboard(data) {
    dom.kpiIngresosTotales.innerHTML = `
        <h4>Ingresos Totales</h4>
        <div class="kpi-value">$${data.kpis.ingresos.total.toLocaleString('es-CO')}</div>
        <div class="kpi-breakdown">
            Efectivo: <span>$${data.kpis.ingresos.efectivo.toLocaleString('es-CO')}</span> | 
            Tarjeta: <span>$${data.kpis.ingresos.tarjeta.toLocaleString('es-CO')}</span>
        </div>`;
    dom.kpiIngresosBancos.innerHTML = `
        <h4>Ingresos por Banco</h4>
        <div class="kpi-breakdown">${Object.entries(data.kpis.bancos).map(([banco, total]) => `${banco}: <span>$${total.toLocaleString('es-CO')}</span>`).join('<br>')}</div>`;
    dom.kpiGastosTotales.innerHTML = `
        <h4>Gastos Totales</h4>
        <div class="kpi-value">$${(data.kpis.gastos.uber + data.kpis.gastos.extras + data.kpis.gastos.membresias + data.kpis.gastos.promociones).toLocaleString('es-CO')}</div>
        <div class="kpi-breakdown">
            Uber: <span>$${data.kpis.gastos.uber.toLocaleString('es-CO')}</span> | 
            Extras: <span>$${data.kpis.gastos.extras.toLocaleString('es-CO')}</span><br>
            Membresías: <span>$${data.kpis.gastos.membresias.toLocaleString('es-CO')}</span> | 
            Promociones: <span>$${data.kpis.gastos.promociones.toLocaleString('es-CO')}</span>
        </div>`;

    renderRankingChart(data.ranking);

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Nombre</th><th># Servicios</th><th>Venta Total</th><th>Total Tarjeta</th>
                    <th>Total Efectivo</th><th>Gasto Uber</th><th>Extras</th>
                </tr>
            </thead>
            <tbody>
                ${data.analiticas.map(emp => `
                    <tr>
                        <td>${emp.nombre}</td><td>${emp.servicios}</td>
                        <td>$${emp.ventaTotal.toLocaleString('es-CO')}</td><td>$${emp.totalTarjeta.toLocaleString('es-CO')}</td>
                        <td>$${emp.totalEfectivo.toLocaleString('es-CO')}</td><td>$${emp.gastoUber.toLocaleString('es-CO')}</td>
                        <td>$${emp.extras.toLocaleString('es-CO')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    dom.analiticasTableContainer.innerHTML = tableHTML;
}

function renderRankingChart(rankingData) {
    if (!dom.rankingChartCanvas) return;
    const ctx = dom.rankingChartCanvas.getContext('2d');
    const labels = rankingData.map(emp => emp.nombre);
    const data = rankingData.map(emp => emp.ventaTotal);

    const third = Math.ceil(rankingData.length / 3);
    const backgroundColors = rankingData.map((_, index) => {
        if (index < third) return 'rgba(76, 175, 80, 0.7)';
        if (index < third * 2) return 'rgba(251, 188, 5, 0.7)';
        return 'rgba(255, 82, 82, 0.7)';
    });

    if (rankingChart) rankingChart.destroy();

    rankingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ingresos Totales', data: data, backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.replace('0.7', '1')), borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, plugins: { legend: { display: false } },
            scales: { x: { ticks: { callback: value => '$' + (value / 1000) + 'k' } } }
        }
    });
}

// --- PÁGINA 2: GESTIÓN DE REGISTROS ---

export function updateAdminWeekDisplay(weekNumber, start, end) {
    if (dom.adminCurrentWeekDisplay) {
        dom.adminCurrentWeekDisplay.textContent = `Semana ${weekNumber}: del ${start.toLocaleDateString()} al ${end.toLocaleDateString()}`;
    }
}

function renderAccordionGroup(container, records, oficinas, empleadas, user) {
    container.innerHTML = '';
    if (records.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">No hay registros de este tipo.</p>';
        return;
    }

    const recordsByOffice = records.reduce((acc, record) => {
        const officeId = record.oficina_info?.id || 'sin-oficina';
        if (!acc[officeId]) acc[officeId] = [];
        acc[officeId].push(record);
        return acc;
    }, {});

    for (const officeId in recordsByOffice) {
        const officeRecords = recordsByOffice[officeId];
        const officeInfo = oficinas.find(o => o.id === officeId);
        const officeName = officeInfo ? `OFICINA ${officeInfo.nombre}` : 'SIN OFICINA';
        const officeTotalVentas = officeRecords.reduce((sum, r) => sum + (r.total_servicio || 0), 0);

        const officeDiv = document.createElement('div');
        officeDiv.className = 'accordion-office';
        officeDiv.innerHTML = `
            <div class="accordion-summary">
                <h4>${officeName}</h4>
                <span class="summary-details">${officeRecords.length} registros | $${officeTotalVentas.toLocaleString('es-CO')} en ventas</span>
            </div>
            <div class="accordion-content"></div>`;

        const employeeContent = officeDiv.querySelector('.accordion-content');

        const recordsByEmployee = officeRecords.reduce((acc, record) => {
            const key = record.nombre_empleada;
            if (!key) return acc;

            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(record);
            return acc;
        }, {});

        for (const key in recordsByEmployee) {
            const employeeRecords = recordsByEmployee[key];
            const empName = key;
            const empTotalVentas = employeeRecords.reduce((sum, r) => sum + (r.total_servicio || 0), 0);

            const employeeDiv = document.createElement('div');
            employeeDiv.className = 'accordion-employee';
            employeeDiv.innerHTML = `
                <div class="accordion-summary"><h5>${empName}</h5><span class="summary-details">${employeeRecords.length} registros | $${empTotalVentas.toLocaleString('es-CO')}</span></div>
                <div class="accordion-content"></div>`;

            const recordsContent = employeeDiv.querySelector('.accordion-content');
            employeeRecords.forEach(record => recordsContent.appendChild(createRecordItemElement(record, user)));
            employeeContent.appendChild(employeeDiv);
        }
        container.appendChild(officeDiv);
    }
}


export function renderRecordsAccordion(records, oficinas, empleadas, user) {
    if (!dom.recordsAccordionContainer) return;

    dom.recordsAccordionContainer.innerHTML = `
        <div class="records-column-view">
            <div class="records-column">
                <h3>Registros de Oficina</h3>
                <div id="office-records-accordion"></div>
            </div>
            <div class="records-column">
                <h3>Registros de Empleadas</h3>
                <div id="employee-records-accordion"></div>
            </div>
        </div>
    `;

    const officeAccordionContainer = document.getElementById('office-records-accordion');
    const employeeAccordionContainer = document.getElementById('employee-records-accordion');

    const officeCreatedRecords = records.filter(r => r.rol_registrador === 'jefe' || r.rol_registrador === 'admin');
    const employeeCreatedRecords = records.filter(r => r.rol_registrador === 'empleada');

    renderAccordionGroup(officeAccordionContainer, officeCreatedRecords, oficinas, empleadas, user);
    renderAccordionGroup(employeeAccordionContainer, employeeCreatedRecords, oficinas, empleadas, user);

    document.querySelectorAll('.accordion-summary').forEach(summary => {
        summary.addEventListener('click', () => {
            const content = summary.nextElementSibling;
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        });
    });
}


// --- PÁGINA 3: CORTE SEMANAL RENDERING ---

export function updateCutSelectors(weeks, employees) {
    populateSelectWithOptions(dom.cutWeekSelect, weeks.map(w => ({id: w, nombre: w})), 'Selecciona una semana');
    populateSelectWithOptions(dom.cutEmployeeSelect, employees, 'Selecciona una empleada');
}

export function renderCutReport(data) {
    if (!dom.cutReportOutput) return;

    if (data.error) {
        dom.cutReportOutput.innerHTML = `<p class="error">${data.error}</p>`;
        return;
    }

    const { officeCut, employeeCut, officeRecords, employeeRecords, membresias } = data;

    const createResultTable = (title, cutData) => {
        const resultClass = cutData.result >= 0 ? 'favorable' : 'unfavorable';
        const resultText = cutData.result >= 0 ? `A FAVOR DE LA EMPRESA` : `A FAVOR DE LA EMPLEADA`;

        return `
            <div class="cut-result-table">
                <h4>${title}</h4>
                <table>
                    <tr><td>Venta Total:</td><td>$${cutData.ventaTotal.toLocaleString('es-CO')}</td></tr>
                    <tr><td>Extras (Calculado):</td><td>-$${cutData.extrasCalculados.toLocaleString('es-CO')}</td></tr>
                    <tr><td>Ubers:</td><td>-$${cutData.gastoUberTotal.toLocaleString('es-CO')}</td></tr>
                    <tr><td>Tarjetas:</td><td>-$${cutData.ventaTarjetaTotal.toLocaleString('es-CO')}</td></tr>
                    <tr><td>Membresías:</td><td>-$${cutData.membresiaTotal.toLocaleString('es-CO')}</td></tr>
                    <tr><td>Promociones:</td><td>+$${cutData.promocionTotal.toLocaleString('es-CO')}</td></tr>
                    <tr class="final-result ${resultClass}">
                        <td><strong>${resultText}</strong></td>
                        <td><strong>$${Math.abs(cutData.result).toLocaleString('es-CO')}</strong></td>
                    </tr>
                </table>
            </div>
        `;
    };

    let reportHTML = '<h2>Resultados del Corte</h2>';
    reportHTML += `<div class="cut-results-container">`;
    reportHTML += createResultTable('Cálculo con Registros de Oficina', officeCut);
    reportHTML += createResultTable('Cálculo con Registros de Empleada', employeeCut);
    reportHTML += `</div>`;

    reportHTML += '<h3>Comparativa Detallada de Registros</h3>';
    reportHTML += '<div class="table-container"><table class="comparison-table">';
    reportHTML += `
        <thead>
            <tr>
                <th>#</th>
                <th colspan="5">Registro Oficina</th>
                <th colspan="5">Registro Empleada</th>
            </tr>
            <tr>
                <th></th>
                <th>Total</th><th>Extra</th><th>Uber</th><th>Método/Detalle</th><th>Fecha</th>
                <th>Total</th><th>Extra</th><th>Uber</th><th>Método/Detalle</th><th>Fecha</th>
            </tr>
        </thead>
        <tbody>`;

    const maxRows = Math.max(officeRecords.length, employeeRecords.length);
    for (let i = 0; i < maxRows; i++) {
        const oRec = officeRecords[i] || {};
        const eRec = employeeRecords[i] || {};

        const oTotal = oRec.total_servicio || 0, eTotal = eRec.total_servicio || 0;
        const oExtra = oRec.extra || 0, eExtra = eRec.extra || 0;
        const oUber = (oRec.uber_ida || 0) + (oRec.uber_regreso || 0), eUber = (eRec.uber_ida || 0) + (eRec.uber_regreso || 0);
        const oDate = oRec.fecha ? oRec.fecha.toDate().toLocaleDateString() : '-', eDate = eRec.fecha ? eRec.fecha.toDate().toLocaleDateString() : '-';

        const formatPayment = (rec) => {
            if (!rec.metodo_pago) return '-';
            let payment = rec.metodo_pago.charAt(0).toUpperCase() + rec.metodo_pago.slice(1);
            if ((rec.metodo_pago === 'tarjeta' || rec.metodo_pago === 'mixto')) {
                let detalles = [];
                if (rec.banco) detalles.push(rec.banco);
                if (rec.banco_2) detalles.push(rec.banco_2);
                if (detalles.length > 0) payment += ` (${detalles.join(', ')})`;
            }
            if (rec.metodo_pago === 'membresia' && rec.membresia_id) {
                const membresiaInfo = membresias.find(m => m.id === rec.membresia_id);
                payment += ` (${membresiaInfo ? membresiaInfo.nombre : 'ID Desc.'})`;
            }
            return payment;
        };
        const oPayment = formatPayment(oRec);
        const ePayment = formatPayment(eRec);

        reportHTML += `
            <tr>
                <td>${i + 1}</td>
                <td data-record-id="${oRec.id || ''}" class="${oTotal !== eTotal ? 'mismatch' : ''}">$${oTotal.toLocaleString('es-CO')}</td>
                <td data-record-id="${oRec.id || ''}" class="${oExtra !== eExtra ? 'mismatch' : ''}">$${oExtra.toLocaleString('es-CO')}</td>
                <td data-record-id="${oRec.id || ''}" class="${oUber !== eUber ? 'mismatch' : ''}">$${oUber.toLocaleString('es-CO')}</td>
                <td data-record-id="${oRec.id || ''}" class="${oPayment !== ePayment ? 'mismatch' : ''}">${oPayment}</td>
                <td data-record-id="${oRec.id || ''}">${oDate}</td>
                <td data-record-id="${eRec.id || ''}" class="${oTotal !== eTotal ? 'mismatch' : ''}">$${eTotal.toLocaleString('es-CO')}</td>
                <td data-record-id="${eRec.id || ''}" class="${oExtra !== eExtra ? 'mismatch' : ''}">$${eExtra.toLocaleString('es-CO')}</td>
                <td data-record-id="${eRec.id || ''}" class="${oUber !== eUber ? 'mismatch' : ''}">$${eUber.toLocaleString('es-CO')}</td>
                <td data-record-id="${eRec.id || ''}" class="${oPayment !== ePayment ? 'mismatch' : ''}">${ePayment}</td>
                <td data-record-id="${eRec.id || ''}">${eDate}</td>
            </tr>`;
    }
    reportHTML += '</tbody></table></div>';
    dom.cutReportOutput.innerHTML = reportHTML;
}


// --- PÁGINA 4: AJUSTES RENDERING (CORREGIDO) ---

export function renderAdminSettings(adminData, catalogos) {
    if (!dom.ajustesContent) return;
    const { users, membresias } = adminData;
    const { oficinas, lugares, bancos, choferes } = catalogos;

    const usersByOffice = { 'admins': [], 'sin-oficina': [], };
    oficinas.forEach(o => usersByOffice[o.id] = []);

    users.forEach(user => {
        if (user.rol === 'admin') {
            usersByOffice.admins.push(user);
        } else if (user.oficina && usersByOffice[user.oficina.id]) {
            usersByOffice[user.oficina.id].push(user);
        } else {
            usersByOffice['sin-oficina'].push(user);
        }
    });

    const createUserAccordion = (title, userList) => {
        if (userList.length === 0) return '';
        return `
            <div class="user-list-group">
                 <div class="settings-accordion-header">${title} (${userList.length})</div>
                 <div class="settings-accordion-content">
                    <ul class="admin-list">
                        ${userList.map(user => `
                            <li data-user-id="${user.id}">
                                <div class="item-info">
                                    <span>${user.nombre || user.email} (${user.rol || 'N/A'})</span>
                                    <small>Estado: ${user.estado || 'Activo'}</small>
                                </div>
                                <div class="item-actions">
                                    <button class="edit-user-btn" data-id="${user.id}">Editar</button>
                                    <button class="delete-btn" data-id="${user.id}" data-type="usuarios">Eliminar</button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>`;
    };

    const userManagementHTML = `
        <div class="admin-section user-creation-section">
            <h3>Gestionar Usuarios</h3>
            <form id="create-user-form">
                <label for="create-user-name">Nombre:</label><input type="text" id="create-user-name" required>
                <label for="create-user-email">Email:</label><input type="email" id="create-user-email" required>
                <label for="create-user-oficina">Oficina:</label><select id="create-user-oficina" required></select>
                <button type="button" class="create-user-btn">Crear Usuario</button>
            </form>
        </div>
        <div class="admin-section user-list-section">
             <h3>Lista de Usuarios</h3>
             ${createUserAccordion('Administradores', usersByOffice.admins)}
             ${oficinas.map(o => createUserAccordion(`Oficina: ${o.nombre}`, usersByOffice[o.id])).join('')}
             ${createUserAccordion('Sin Oficina Asignada', usersByOffice['sin-oficina'])}
        </div>
        `;

    dom.ajustesContent.innerHTML = `
        ${userManagementHTML}
        ${createCatalogSectionHTML('Membresías', 'membresias', 'nueva-membresia-nombre', membresias, true)}
        ${createCatalogSectionHTML('Oficinas', 'oficinas', 'nueva-oficina-nombre', oficinas)}
        ${createCatalogSectionHTML('Lugares', 'lugares', 'nuevo-lugar-nombre', lugares)}
        ${createCatalogSectionHTML('Bancos', 'bancos', 'nuevo-banco-nombre', bancos)}
        ${createCatalogSectionHTML('Choferes', 'choferes', 'nuevo-chofer-nombre', choferes)}
    `;

    populateSelectWithOptions(document.getElementById('create-user-oficina'), oficinas, 'Seleccionar Oficina');
}

function createCatalogSectionHTML(title, collectionName, inputId, items, isMembresia = false) {
    let formHTML = `
        <form>
            <label for="${inputId}">Nombre:</label><input type="text" id="${inputId}">
            <button type="button" class="add-catalog-btn" data-collection="${collectionName}" data-input="${inputId}">Agregar ${title.slice(0, -1)}</button>
        </form>`;
    if (isMembresia) {
        formHTML = `
            <form id="add-membresia-form">
                <label for="nueva-membresia-nombre">Nombre:</label><input type="text" id="nueva-membresia-nombre" required>
                <label for="nueva-membresia-horas">Horas:</label><input type="number" id="nueva-membresia-horas" min="1" required>
                <button type="button" class="add-membresia-btn">Agregar Membresía</button>
            </form>`;
    }

    const listItems = items.map(item => {
        let details = '';
        if (isMembresia) {
            details = `<small>(${item.horas_restantes}/${item.horas_totales} hrs)</small>`;
        }
        return `
            <li data-item-id="${item.id}">
                <div class="item-info"><span>${item.nombre}</span>${details}</div>
                <div class="item-actions">
                    ${isMembresia ? `<button class="edit-membresia-btn" data-id="${item.id}">Editar</button>` : ''}
                    <button class="delete-btn" data-id="${item.id}" data-type="${collectionName}">Eliminar</button>
                </div>
            </li>`;
    }).join('');

    return `
        <div class="admin-section">
            <div class="settings-accordion-header">${title} (${items.length})</div>
            <div class="settings-accordion-content">
                ${formHTML}
                <ul class="admin-list">${listItems}</ul>
            </div>
        </div>`;
}


export function showUserEditForm(userId, user, offices) {
    removeUserEditForm(userId);
    const li = document.querySelector(`li[data-user-id="${userId}"]`);
    if (!li) return;
    const editForm = document.createElement('div');
    editForm.className = 'edit-user-form';
    editForm.innerHTML = `
        <label>Nombre:</label><input type="text" id="edit-user-name-${userId}" value="${user.nombre || ''}">
        <label>Rol:</label><select id="edit-user-rol-${userId}">
            <option value="empleada" ${user.rol === 'empleada' ? 'selected' : ''}>Empleada</option>
            <option value="jefe" ${user.rol === 'jefe' ? 'selected' : ''}>Jefe</option>
            <option value="admin" ${user.rol === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
        <label>Oficina:</label><select id="edit-user-oficina-${userId}"><option value="">Sin Oficina</option>${offices.map(o => `<option value="${o.id}" ${user.oficina && user.oficina.id === o.id ? 'selected' : ''}>${o.nombre}</option>`).join('')}</select>
        <label>Estado:</label><select id="edit-user-estado-${userId}">
            <option value="activo" ${!user.estado || user.estado === 'activo' ? 'selected' : ''}>Activo</option>
            <option value="inactivo" ${user.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
        </select>
        <button class="save-user-btn" data-id="${userId}">Guardar</button>
        <button type="button" class="cancel-edit-user-btn" data-id="${userId}">Cancelar</button>`;
    li.appendChild(editForm);
}


export function removeUserEditForm(userId) {
    const li = document.querySelector(`li[data-user-id="${userId}"]`);
    const form = li?.querySelector('.edit-user-form');
    if (form) form.remove();
}

export function showMembresiaEditForm(membresiaId, membresia) {
    removeMembresiaEditForm(membresiaId);
    const li = document.querySelector(`li[data-item-id="${membresiaId}"]`);
    if (!li) return;
    const editForm = document.createElement('div');
    editForm.className = 'edit-membresia-form';
    editForm.innerHTML = `
        <label>Nombre:</label><input type="text" id="edit-membresia-name-${membresiaId}" value="${membresia.nombre || ''}">
        <label>Horas Restantes:</label><input type="number" id="edit-membresia-horas-${membresiaId}" value="${membresia.horas_restantes}" min="0">
        <button class="save-membresia-btn" data-id="${membresiaId}">Guardar</button>
        <button type="button" class="cancel-edit-membresia-btn" data-id="${membresiaId}">Cancelar</button>`;
    li.appendChild(editForm);
}

export function removeMembresiaEditForm(membresiaId) {
    const li = document.querySelector(`li[data-item-id="${membresiaId}"]`);
    const form = li?.querySelector('.edit-membresia-form');
    if (form) form.remove();
}


// --- Record Rendering (Jefe y Empleada) ---

export function renderJefeColumns(records, user) {
    if (!dom.employeeColumns) return;
    dom.employeeColumns.innerHTML = '';

    if (records.length === 0) {
        dom.employeeColumns.innerHTML = '<p>No has creado registros todavía.</p>';
        return;
    }

    const recordsByEmployee = records.reduce((acc, record) => {
        const employeeId = record.uid_empleada;
        if (!acc[employeeId]) acc[employeeId] = { name: record.nombre_empleada, records: [] };
        acc[employeeId].records.push(record);
        return acc;
    }, {});

    for (const employeeId in recordsByEmployee) {
        const employeeData = recordsByEmployee[employeeId];
        const column = document.createElement('div');
        column.className = 'employee-column';
        const header = document.createElement('h3');
        header.textContent = employeeData.name;
        header.style.backgroundColor = assignedColors[employeeId] || '#555';
        column.appendChild(header);
        employeeData.records.forEach((record, index) => {
            column.appendChild(createRecordItemElement(record, user, employeeData.records.length - index));
        });
        dom.employeeColumns.appendChild(column);
    }
}

export function renderRecordsList(records, user) {
    if (!dom.recordsList) return;
    dom.recordsList.innerHTML = '';
    if (records.length === 0) {
        dom.recordsList.innerHTML = '<li><p>No has creado ningún registro todavía.</p></li>';
        return;
    }
    records.forEach(record => {
        dom.recordsList.appendChild(createRecordItemElement(record, user));
    });
}

function createRecordItemElement(record, user, serviceCounter = null) {
    const date = record.fecha ? record.fecha.toDate().toLocaleString() : 'N/A';
    const isAdmin = user.customRole === 'admin';
    const isOwner = record.uid_registrador === user.uid;
    const canEditDelete = isAdmin || isOwner;

    const item = document.createElement('div');
    item.className = `record-item ${record.cancelado ? 'cancelado' : ''}`;
    item.dataset.id = record.id;

    let detailsHTML = '';
    if (serviceCounter) detailsHTML += `<p class="service-counter"><strong>Servicio #${serviceCounter}</strong></p>`;
    if (isAdmin) detailsHTML += `<p><strong>Trabajadora:</strong> <span class="record-value">${record.nombre_empleada || 'N/A'}</span></p>`;

    detailsHTML += `
        <p><strong>Horas:</strong> <span class="record-value">${record.horas_servicio}</span></p>
        <p><strong>Total:</strong> <span class="record-value">$${(record.total_servicio || 0).toLocaleString('es-CO')}</span></p>
        <p><strong>Método:</strong> <span class="record-value">${record.metodo_pago || 'N/A'}</span></p>
        <p><strong>Lugar:</strong> <span class="record-value">${record.lugar || 'N/A'}</span></p>
        ${record.promocion ? `<p style="color:var(--accent-gold); font-weight:bold;">PROMOCIÓN</p>` : ''}
        ${record.cancelado ? `<p style="color:var(--error-color); font-weight:bold;">CANCELADO</p>` : ''}`;

    item.innerHTML = `
        <div class="record-details">${detailsHTML}</div>
        <div class="record-meta"><span>Registrado por: ${record.nombre_registrador || 'N/A'} el ${date}</span></div>
        ${canEditDelete ? `<div class="record-actions"><button class="edit-record-btn" data-id="${record.id}">Editar</button><button class="delete-record-btn" data-id="${record.id}">Borrar</button></div>` : ''}
    `;
    return item;
}

// --- Modal Functions ---

export function openEditModal(record, catalogos, user) {
    if (!dom.editRecordForm || !dom.editRecordModal) return;
    const form = dom.editRecordForm;
    form.reset();

    const isAdmin = user.customRole === 'admin';
    const editEmpleadoField = form.querySelector('#edit-empleada-field');
    if (editEmpleadoField) editEmpleadoField.style.display = isAdmin ? 'block' : 'none';

    if (isAdmin) populateSelectWithOptions(form.querySelector('#edit-empleada'), catalogos.empleadas, 'Selecciona empleada');
    populateSelectWithOptions(form.querySelector('#edit-lugar'), catalogos.lugares, 'Selecciona lugar', 'nombre', 'nombre');
    populateSelectWithOptions(form.querySelector('#edit-banco'), catalogos.bancos, 'Selecciona banco', 'nombre', 'nombre');
    populateSelectWithOptions(form.querySelector('#edit-banco_2'), catalogos.bancos, 'Selecciona banco', 'nombre', 'nombre');
    populateSelectWithOptions(form.querySelector('#edit-chofer_ida'), catalogos.choferes, 'Selecciona chofer', 'nombre', 'nombre');
    populateSelectWithOptions(form.querySelector('#edit-chofer_regreso'), catalogos.choferes, 'Selecciona chofer', 'nombre', 'nombre');
    populateSelectWithOptions(form.querySelector('#edit-membresia_id'), catalogos.membresias, 'Selecciona membresía');

    form.querySelector('#edit-record-id').value = record.id;
    if (isAdmin) form.querySelector('#edit-empleada').value = record.uid_empleada || '';
    form.querySelector('#edit-horas_servicio').value = record.horas_servicio || '';
    form.querySelector('#edit-total_servicio').value = record.total_servicio || '';
    form.querySelector('#edit-lugar').value = record.lugar || '';
    form.querySelector('#edit-banco').value = record.banco || '';
    form.querySelector('#edit-banco_2').value = record.banco_2 || '';
    form.querySelector('#edit-monto_tarjeta').value = record.monto_tarjeta || '';
    form.querySelector('#edit-monto_tarjeta_2').value = record.monto_tarjeta_2 || '';
    form.querySelector('#edit-monto_efectivo').value = record.monto_efectivo || '';
    form.querySelector('#edit-extra').value = record.extra || '';
    form.querySelector('#edit-uber_ida').value = record.uber_ida || '';
    form.querySelector('#edit-uber_regreso').value = record.uber_regreso || '';
    form.querySelector('#edit-chofer_ida').value = record.chofer_ida || '';
    form.querySelector('#edit-chofer_regreso').value = record.chofer_regreso || '';
    form.querySelector('#edit-cancelado').checked = record.cancelado || false;
    form.querySelector('#edit-promocion').checked = record.promocion || false;
    form.querySelector('#edit-membresia_id').value = record.membresia_id || '';

    const metodoPago = record.metodo_pago || 'efectivo';
    form.querySelector(`input[name="edit_metodo_pago"][value="${metodoPago}"]`).checked = true;

    const tarjeta2Fields = form.querySelector('#edit-tarjeta-2-fields');
    const addCardBtn = form.querySelector('#edit-add-card-btn');
    const montoTarjetaField = form.querySelector('#edit-monto-tarjeta-field');

    if (record.monto_tarjeta_2 && record.monto_tarjeta_2 > 0) {
        tarjeta2Fields.style.display = 'block';
        addCardBtn.style.display = 'none';
    } else {
        tarjeta2Fields.style.display = 'none';
        addCardBtn.style.display = 'block';
    }

    handlePaymentMethodChange('edit-');

    dom.editRecordModal.style.display = 'flex';
}


export function closeEditModal() {
    if (dom.editRecordModal) dom.editRecordModal.style.display = 'none';
    if (dom.editRecordForm) dom.editRecordForm.reset();
}
