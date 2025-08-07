// app.js

// Firebase configuration (replace with your actual config)
// La configuración ya está en el archivo HTML, así que se inicializa allí.

const firebaseConfig = {
    apiKey: "AIzaSyCUKWvB1_gs61H8Y58-swqfAl9Oujv7ARA",
    authDomain: "colombiasexysventas.firebaseapp.com",
    projectId: "colombiasexysventas",
    storageBucket: "colombiasexysventas.firebasestorage.app",
    messagingSenderId: "710382376679",
    appId: "1:710382376679:web:9f69c61dcba4c24140b442",
    measurementId: "G-HXG6XCCJ6X"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Elementos del DOM
const authContainer = document.getElementById('auth-container');
const loginButton = document.getElementById('login-button');
const mainContainer = document.getElementById('main-container');
const logoutButton = document.getElementById('logout-button');
const userEmailSpan = document.getElementById('user-email');
const userRoleSpan = document.getElementById('user-role');
const serviceForm = document.getElementById('service-form');
const feedbackMessage = document.getElementById('feedback-message');
const adminPanel = document.getElementById('admin-panel');

// Elementos del nuevo formulario
const totalServicioInput = document.getElementById('total_servicio');
const metodoPagoRadios = document.querySelectorAll('input[name="metodo_pago"]');
const pagoTarjetaContainer = document.getElementById('pago-tarjeta-container');
const pagoMixtoContainer = document.getElementById('pago-mixto-container');
const montoTarjetaInput = document.getElementById('monto_tarjeta');
const montoMixtoTarjetaInput = document.getElementById('monto_mixto_tarjeta');
const montoMixtoEfectivoInput = document.getElementById('monto_mixto_efectivo');
const bancoSelect = document.getElementById('banco');
const bancoMixtoSelect = document.getElementById('banco_mixto');
const extraInput = document.getElementById('extra');
const extraBancoContainer = document.getElementById('extra-banco-container');
const extraBancoSelect = document.getElementById('extra_banco');
const canceladoToggle = document.getElementById('cancelado-toggle');

// Elementos para la sección de registros semanales
const weeklyRecordsList = document.getElementById('weekly-records-list');

// Elementos del modal de edición
const editRecordModal = document.getElementById('editRecordModal');
const editRecordForm = document.getElementById('edit-record-form');
const editRecordIdInput = document.getElementById('edit-record-id');
const editEmpleadaSelect = document.getElementById('edit-empleada');
const editHorasServicioInput = document.getElementById('edit-horas_servicio');
const editTotalServicioInput = document.getElementById('edit-total_servicio');
const editMontoEfectivoInput = document.getElementById('edit-monto_efectivo');
const editMontoTarjetaInput = document.getElementById('edit-monto_tarjeta');
const editBancoSelect = document.getElementById('edit-banco');
const editExtraInput = document.getElementById('edit-extra');
const editLugarSelect = document.getElementById('edit-lugar');
const editUberIdaInput = document.getElementById('edit-uber_ida');
const editChoferIdaSelect = document.getElementById('edit-chofer_ida');
const editUberRegresoInput = document.getElementById('edit-uber_regreso');
const editChoferRegresoSelect = document.getElementById('edit-chofer_regreso');
const editFeedbackMessage = document.getElementById('edit-feedback-message');
const editCanceladoToggle = document.getElementById('edit-cancelado-toggle');

// Elementos para la sección de corte
const cutSection = document.getElementById('cut-section');
const cutWeekSelect = document.getElementById('cut-week-select');
const cutEmployeeSelect = document.getElementById('cut-employee-select');
const generateCutButton = document.getElementById('generate-cut-button');
const cutReportOutput = document.getElementById('cut-report-output');

// Panel de administración
const userList = document.getElementById('user-list');
const oficinaList = document.getElementById('oficina-list');
const lugaresListAdmin = document.getElementById('lugares-list');
const bancosListAdmin = document.getElementById('bancos-list');
const choferesListAdmin = document.getElementById('choferes-list');

// Variables globales
let oficinasDisponibles = [];
let usuariosDisponibles = [];
let unsubscribeFromRecords = null;
let allRecordsData = [];
const assignedColors = {}; // Para almacenar los colores de las empleadas

// --- Funciones de Autenticación ---
loginButton.addEventListener('click', () => {
    auth.signInWithPopup(googleProvider);
});

logoutButton.addEventListener('click', () => {
    auth.signOut();
});

// Listener de estado de Autenticación
auth.onAuthStateChanged(async user => {
    if (user) {
        authContainer.style.display = 'none';
        mainContainer.style.display = 'flex';
        userEmailSpan.textContent = user.email;

        try {
            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const rol = userData.rol || 'empleada';
                userRoleSpan.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);
                user.customRole = rol;
                user.oficinaRef = userData.oficina;

                handleUserRole(user);
                await cargarDatosFormulario(user);

                setupRecordsListener(user);

                if (user.customRole === 'admin') {
                    await loadCutSectionData();
                }

            } else {
                user.customRole = 'empleada';
                userRoleSpan.textContent = 'Empleada (Pendiente de Asignación)';
                handleUserRole(user);
                await db.collection('usuarios').doc(user.uid).set({
                    email: user.email,
                    nombre: user.displayName || user.email.split('@')[0],
                    rol: 'empleada',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                mostrarMensaje('error', 'Tu rol no está configurado. Contacta al administrador.');
                await cargarDatosFormulario(user);
                setupRecordsListener(user);
            }
        } catch (error) {
            console.error("Error al obtener o configurar el rol del usuario:", error);
            mostrarMensaje('error', 'Error al cargar tu perfil. Inténtalo de nuevo.');
            auth.signOut();
        }
    } else {
        authContainer.style.display = 'flex';
        mainContainer.style.display = 'none';
        userEmailSpan.textContent = '';
        userRoleSpan.textContent = '';
        serviceForm.reset();
        feedbackMessage.style.display = 'none';
        if (unsubscribeFromRecords) {
            unsubscribeFromRecords();
            unsubscribeFromRecords = null;
        }
        weeklyRecordsList.innerHTML = '';
        cutReportOutput.innerHTML = '<p>Selecciona una semana y una empleada para generar el reporte de corte.</p>';
        cutSection.style.display = 'none';
    }
});

// --- Lógica de interfaz basada en el rol del usuario ---
function handleUserRole(user) {
    // Título del formulario
    document.getElementById('form-title').textContent = (user.customRole === 'jefe') ? 'Registro de Servicio (Oficina)' : 'Registro de Servicio (Empleada)';

    // Si es jefe, mostrar botones de empleadas
    if (user.customRole === 'jefe') {
        document.getElementById('empleada-selection').style.display = 'block';
    } else {
        document.getElementById('empleada-selection').style.display = 'none';
    }

    // Si es admin, mostrar el panel de administración y la sección de corte
    if (user.customRole === 'admin') {
        adminPanel.style.display = 'block';
        cutSection.style.display = 'block';
        cargarPanelAdministracion();
    } else {
        adminPanel.style.display = 'none';
        cutSection.style.display = 'none';
    }
}

// --- Lógica del nuevo formulario de pago ---
document.addEventListener('DOMContentLoaded', () => {
    // Listener para los radios de método de pago
    metodoPagoRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const metodo = document.querySelector('input[name="metodo_pago"]:checked').value;
            pagoTarjetaContainer.style.display = metodo === 'tarjeta' ? 'block' : 'none';
            pagoMixtoContainer.style.display = metodo === 'mixto' ? 'block' : 'none';

            // Limpiar los campos si se ocultan
            if (metodo !== 'tarjeta') montoTarjetaInput.value = '';
            if (metodo !== 'mixto') {
                montoMixtoTarjetaInput.value = '';
                montoMixtoEfectivoInput.value = '';
            }
        });
    });

    // Listener para el campo de extra
    extraInput.addEventListener('input', () => {
        const extraValue = parseFloat(extraInput.value) || 0;
        extraBancoContainer.style.display = extraValue > 0 ? 'block' : 'none';
    });
});

// --- Cargar opciones para los menús desplegables del formulario de servicio ---
async function cargarDatosFormulario(user) {
    try {
        // Cargar Lugares
        const lugaresSelect = document.getElementById('lugar');
        lugaresSelect.innerHTML = '<option value="">Selecciona un lugar</option>';
        const lugaresSnapshot = await db.collection('lugares').orderBy('nombre').get();
        lugaresSnapshot.forEach(doc => {
            lugaresSelect.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`;
        });

        // Cargar Bancos para todos los selects de bancos
        const bancosSnapshot = await db.collection('bancos').orderBy('nombre').get();
        const bancosHtml = '<option value="">Selecciona un banco</option>' +
            bancosSnapshot.docs.map(doc => `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`).join('');
        bancoSelect.innerHTML = bancosHtml;
        bancoMixtoSelect.innerHTML = bancosHtml;
        extraBancoSelect.innerHTML = bancosHtml;

        // Cargar Choferes
        const choferesSelectIda = document.getElementById('chofer_ida');
        const choferesSelectRegreso = document.getElementById('chofer_regreso');
        const choferesSnapshot = await db.collection('choferes').orderBy('nombre').get();
        const choferesHtml = '<option value="">Selecciona un chofer</option>' +
            choferesSnapshot.docs.map(doc => `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`).join('');
        choferesSelectIda.innerHTML = choferesHtml;
        choferesSelectRegreso.innerHTML = choferesHtml;

        // Cargar Empleadas (solo si el rol es 'jefe')
        if (user.customRole === 'jefe') {
            const empleadaButtonsContainer = document.getElementById('empleada-buttons');
            empleadaButtonsContainer.innerHTML = '';
            if (user.oficinaRef) {
                const empleadasSnapshot = await db.collection('usuarios')
                    .where('oficina', '==', user.oficinaRef)
                    .where('rol', '==', 'empleada')
                    .orderBy('nombre')
                    .get();

                empleadasSnapshot.forEach(doc => {
                    const empleadaId = doc.id;
                    const empleadaName = doc.data().nombre || doc.data().email.split('@')[0];
                    let color = assignedColors[empleadaId];
                    if (!color) {
                        color = getRandomColor();
                        assignedColors[empleadaId] = color;
                    }
                    const button = document.createElement('button');
                    button.textContent = empleadaName;
                    button.className = 'empleada-button';
                    button.setAttribute('data-uid', empleadaId);
                    button.style.backgroundColor = color;
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        document.querySelectorAll('.empleada-button').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                    });
                    empleadaButtonsContainer.appendChild(button);
                });
            } else {
                mostrarMensaje('error', 'Tu oficina no está asignada. No puedes ver empleadas.');
            }
        }
    } catch (error) {
        console.error("Error al cargar datos del formulario:", error);
        mostrarMensaje('error', 'Error al cargar los datos. Inténtalo de nuevo.');
    }
}

// --- Generar un color aleatorio para los botones de empleadas ---
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// --- Lógica de Envío del Formulario de Servicio ---
serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    const userRole = user.customRole;

    const totalServicio = parseFloat(totalServicioInput.value) || 0;
    const extra = parseFloat(extraInput.value) || 0;
    const metodoPago = document.querySelector('input[name="metodo_pago"]:checked').value;

    let montoEfectivo = 0;
    let montoTarjeta = 0;
    let banco = '';
    let extraBanco = '';

    if (metodoPago === 'efectivo') {
        montoEfectivo = totalServicio;
    } else if (metodoPago === 'tarjeta') {
        montoTarjeta = totalServicio;
        banco = bancoSelect.value;
    } else if (metodoPago === 'mixto') {
        montoEfectivo = parseFloat(montoMixtoEfectivoInput.value) || 0;
        montoTarjeta = parseFloat(montoMixtoTarjetaInput.value) || 0;
        banco = bancoMixtoSelect.value;
    }

    if (extra > 0) {
        extraBanco = extraBancoSelect.value;
    }

    const formData = {
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        horas_servicio: parseFloat(document.getElementById('horas_servicio').value) || 0,
        total_servicio: totalServicio,
        monto_efectivo: montoEfectivo,
        monto_tarjeta: montoTarjeta,
        banco: banco,
        extra: extra,
        extra_banco: extraBanco, // Nuevo campo para el banco del extra
        lugar: document.getElementById('lugar').value,
        uber_ida: parseFloat(document.getElementById('uber_ida').value) || 0,
        chofer_ida: document.getElementById('chofer_ida').value,
        uber_regreso: parseFloat(document.getElementById('uber_regreso').value) || 0,
        chofer_regreso: document.getElementById('chofer_regreso').value,
        cancelado: canceladoToggle.checked, // Nuevo campo
        uid: user.uid,
        email_registrador: user.email,
        rol_registrador: userRole,
        nombre_registrador: user.displayName || user.email.split('@')[0],
        metodo_pago: metodoPago // Nuevo campo para el método de pago
    };

    let empleadaUidSeleccionada = '';

    if (userRole === 'jefe') {
        const activeEmpleadaButton = document.querySelector('.empleada-button.active');
        if (!activeEmpleadaButton) {
            mostrarMensaje('error', 'Por favor, selecciona una empleada.');
            return;
        }
        empleadaUidSeleccionada = activeEmpleadaButton.getAttribute('data-uid');
        const empleadaDoc = await db.collection('usuarios').doc(empleadaUidSeleccionada).get();
        if (!empleadaDoc.exists) {
            mostrarMensaje('error', 'La empleada seleccionada no es válida.');
            return;
        }
        const empleadaData = empleadaDoc.data();
        formData.uid_empleada = empleadaUidSeleccionada;
        formData.email_empleada = empleadaData.email;
        formData.nombre_empleada = empleadaData.nombre || empleadaData.email.split('@')[0];
    } else {
        formData.uid_empleada = user.uid;
        formData.email_empleada = user.email;
        formData.nombre_empleada = user.displayName || user.email.split('@')[0];
    }

    try {
        await db.collection('registros').add(formData);
        serviceForm.reset();
        canceladoToggle.checked = false; // Resetear el toggle
        pagoTarjetaContainer.style.display = 'none';
        pagoMixtoContainer.style.display = 'none';
        extraBancoContainer.style.display = 'none';
        document.querySelector('input[name="metodo_pago"][value="efectivo"]').checked = true;

        mostrarMensaje('success', '✅ Servicio registrado con éxito!');
        if (userRole === 'jefe') {
            document.querySelectorAll('.empleada-button').forEach(btn => btn.classList.remove('active'));
        }
    } catch (error) {
        console.error("Error al registrar el servicio:", error);
        mostrarMensaje('error', '❌ Error al registrar el servicio. Inténtalo de nuevo.');
    }
});

// --- Funciones auxiliares ---
function mostrarMensaje(tipo, mensaje) {
    feedbackMessage.textContent = mensaje;
    feedbackMessage.className = '';
    feedbackMessage.classList.add(tipo);
    feedbackMessage.style.display = 'block';
    setTimeout(() => {
        feedbackMessage.style.display = 'none';
    }, 5000);
}

// --- Lógica del Panel de Administración ---
async function cargarPanelAdministracion() {
    try {
        oficinasDisponibles = [];
        const oficinasSnapshot = await db.collection('oficinas').orderBy('nombre').get();
        oficinasSnapshot.forEach(doc => {
            oficinasDisponibles.push({ id: doc.id, ...doc.data() });
        });
        renderOficinaList();

        usuariosDisponibles = [];
        const usersSnapshot = await db.collection('usuarios').get();
        usersSnapshot.forEach(doc => {
            usuariosDisponibles.push({ id: doc.id, ...doc.data() });
        });
        renderUserList();

        await cargarYRenderizarCatalogo('lugares', lugaresListAdmin);
        await cargarYRenderizarCatalogo('bancos', bancosListAdmin);
        await cargarYRenderizarCatalogo('choferes', choferesListAdmin);
    } catch (error) {
        console.error("Error al cargar el panel de administración:", error);
        mostrarMensaje('error', 'Error al cargar el panel de administración.');
    }
}

function renderUserList() {
    userList.innerHTML = '';
    usuariosDisponibles.forEach(user => {
        const li = document.createElement('li');
        const oficinaNombre = user.oficina ? oficinasDisponibles.find(o => o.id === user.oficina.id)?.nombre || 'Sin Oficina' : 'Sin Oficina';
        li.innerHTML = `
            <span>${user.email} (${user.rol || 'Sin Rol'}) - Oficina: ${oficinaNombre}</span>
            <button onclick="mostrarEditarUsuario('${user.id}')">Editar</button>
        `;
        userList.appendChild(li);
    });
}

function renderOficinaList() {
    oficinaList.innerHTML = '';
    oficinasDisponibles.forEach(oficina => {
        oficinaList.innerHTML += `
            <li>
                <span>${oficina.nombre}</span>
                <button onclick="eliminarOficina('${oficina.id}')">Eliminar</button>
            </li>
        `;
    });
}

async function cargarYRenderizarCatalogo(coleccion, ulElement) {
    ulElement.innerHTML = '';
    const snapshot = await db.collection(coleccion).orderBy('nombre').get();
    snapshot.forEach(doc => {
        ulElement.innerHTML += `
            <li>
                <span>${doc.data().nombre}</span>
                <button onclick="eliminarCatalogo('${coleccion}', '${doc.id}')">Eliminar</button>
            </li>
        `;
    });
}

let usuarioEditandoId = null;
function mostrarEditarUsuario(userId) {
    usuarioEditandoId = userId;
    const user = usuariosDisponibles.find(u => u.id === userId);
    if (!user) return;
    const li = userList.querySelector(`li button[onclick="mostrarEditarUsuario('${userId}')"]`).parentNode;
    const existingForm = li.querySelector('.edit-user-form');
    if (existingForm) existingForm.remove();
    const editForm = document.createElement('div');
    editForm.className = 'edit-user-form';
    editForm.innerHTML = `
        <label for="edit-rol-${userId}">Rol:</label>
        <select id="edit-rol-${userId}">
            <option value="empleada" ${user.rol === 'empleada' ? 'selected' : ''}>Empleada</option>
            <option value="jefe" ${user.rol === 'jefe' ? 'selected' : ''}>Jefe</option>
            <option value="admin" ${user.rol === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
        <label for="edit-oficina-${userId}">Oficina:</label>
        <select id="edit-oficina-${userId}">
            <option value="">Sin Oficina</option>
            ${oficinasDisponibles.map(oficina => `
                <option value="${oficina.id}" ${user.oficina && user.oficina.id === oficina.id ? 'selected' : ''}>
                    ${oficina.nombre}
                </option>
            `).join('')}
        </select>
        <button onclick="guardarCambiosUsuario('${userId}')">Guardar</button>
        <button onclick="cancelarEdicionUsuario('${userId}')" style="background-color: #6c757d;">Cancelar</button>
    `;
    li.appendChild(editForm);
}

async function guardarCambiosUsuario(userId) {
    const newRol = document.getElementById(`edit-rol-${userId}`).value;
    const newOficinaId = document.getElementById(`edit-oficina-${userId}`).value;
    let oficinaRef = null;
    if (newOficinaId) {
        oficinaRef = db.collection('oficinas').doc(newOficinaId);
    }
    try {
        await db.collection('usuarios').doc(userId).update({
            rol: newRol,
            oficina: oficinaRef
        });
        mostrarMensaje('success', `Usuario ${usuariosDisponibles.find(u => u.id === userId).email} actualizado.`);
        await cargarPanelAdministracion();
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        mostrarMensaje('error', 'Error al actualizar usuario.');
    } finally {
        usuarioEditandoId = null;
    }
}

function cancelarEdicionUsuario(userId) {
    const li = userList.querySelector(`li button[onclick="mostrarEditarUsuario('${userId}')"]`).parentNode;
    const editForm = li.querySelector('.edit-user-form');
    if (editForm) editForm.remove();
    usuarioEditandoId = null;
}

async function agregarOficina() {
    const nombre = document.getElementById('nueva-oficina-nombre').value.trim();
    if (!nombre) {
        mostrarMensaje('error', 'El nombre de la oficina es obligatorio.');
        return;
    }
    const oficinaId = nombre.toUpperCase().replace(/\s/g, '_');
    try {
        await db.collection('oficinas').doc(oficinaId).set({ nombre: nombre });
        mostrarMensaje('success', `Oficina "${nombre}" agregada.`);
        document.getElementById('nueva-oficina-nombre').value = '';
        await cargarPanelAdministracion();
    } catch (error) {
        console.error("Error al agregar oficina:", error);
        mostrarMensaje('error', 'Error al agregar oficina. Podría ya existir o haber un error de permisos.');
    }
}

async function eliminarOficina(oficinaId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta oficina? Esto NO eliminará a los usuarios asociados, solo desvinculará su referencia.')) return;
    try {
        await db.collection('oficinas').doc(oficinaId).delete();
        mostrarMensaje('success', `Oficina eliminada.`);
        await cargarPanelAdministracion();
    } catch (error) {
        console.error("Error al eliminar oficina:", error);
        mostrarMensaje('error', 'Error al eliminar oficina.');
    }
}

async function agregarCatalogo(coleccion, nombreInputId) {
    const inputElement = document.getElementById(nombreInputId);
    if (!inputElement) {
        console.error(`Error: Elemento con ID '${nombreInputId}' no encontrado.`);
        mostrarMensaje('error', `Error interno: No se encontró el campo de entrada para ${coleccion}.`);
        return;
    }
    const nombreTrimmed = inputElement.value.trim();
    if (!nombreTrimmed) {
        mostrarMensaje('error', `El nombre para ${coleccion} es obligatorio.`);
        return;
    }
    const itemId = nombreTrimmed.toUpperCase().replace(/\s/g, '_');
    try {
        await db.collection(coleccion).doc(itemId).set({ nombre: nombreTrimmed });
        mostrarMensaje('success', `"${nombreTrimmed}" agregado a ${coleccion}.`);
        inputElement.value = '';
        await cargarDatosFormulario(auth.currentUser);
        await cargarYRenderizarCatalogo(coleccion, document.getElementById(`${coleccion}-list`));
    } catch (error) {
        console.error(`Error al agregar a ${coleccion}:`, error);
        mostrarMensaje('error', `Error al agregar a ${coleccion}. Podría ya existir o haber un error de permisos.`);
    }
}

async function eliminarCatalogo(coleccion, id) {
    if (!confirm(`¿Estás seguro de que quieres eliminar este elemento de ${coleccion}?`)) return;
    try {
        await db.collection(coleccion).doc(id).delete();
        mostrarMensaje('success', `Elemento de ${coleccion} eliminado.`);
        await cargarDatosFormulario(auth.currentUser);
        await cargarYRenderizarCatalogo(coleccion, document.getElementById(`${coleccion}-list`));
    } catch (error) {
        console.error(`Error al eliminar de ${coleccion}:`, error);
        mostrarMensaje('error', `Error al eliminar de ${coleccion}.`);
    }
}

// --- Función para obtener el inicio y fin de la semana actual ---
function getStartAndEndOfCurrentWeek() {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Establecer la hora a la medianoche

    // Obtener el día de la semana (0=Domingo, 1=Lunes, ...)
    const dayOfWeek = now.getDay();

    // Calcular el inicio de la semana (Lunes)
    // Ajuste para que 0 (Domingo) se trate como 7
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToSubtract);

    // Calcular el final de la semana (Domingo)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return {
        start: startOfWeek,
        end: endOfWeek
    };
}


// --- Función para configurar el listener de registros ---
async function setupRecordsListener(user) {
    if (unsubscribeFromRecords) {
        unsubscribeFromRecords();
    }

    // Obtener el inicio y fin de la semana actual
    const { start, end } = getStartAndEndOfCurrentWeek();
    let recordsQuery = db.collection('registros')
        .where('fecha', '>=', start)
        .where('fecha', '<=', end)
        .orderBy('fecha', 'desc');

    if (user.customRole === 'empleada') {
        recordsQuery = recordsQuery.where('uid_empleada', '==', user.uid);
    } else if (user.customRole === 'jefe') {
        // La regla de seguridad ya se encarga de filtrar lo que el jefe puede leer.
        // No añadimos aquí un filtro adicional porque `registros` no tiene un campo de oficina.
        // El filtro de la semana es suficiente.
    }

    unsubscribeFromRecords = recordsQuery.onSnapshot(async (snapshot) => {
        weeklyRecordsList.innerHTML = '';
        allRecordsData = [];

        const allUsersSnapshot = await db.collection('usuarios').get();
        const allUsersMap = new Map();
        allUsersSnapshot.forEach(doc => {
            allUsersMap.set(doc.id, doc.data());
        });

        snapshot.forEach(doc => {
            const record = doc.data();
            const recordId = doc.id;
            const date = record.fecha ? record.fecha.toDate().toLocaleString() : 'Fecha no disponible';

            const empleadaData = allUsersMap.get(record.uid_empleada);
            const nombreEmpleada = empleadaData ? (empleadaData.nombre || empleadaData.email) : 'Desconocida';

            allRecordsData.push({ id: recordId, ...record, nombre_empleada_display: nombreEmpleada });

            const li = document.createElement('li');
            li.className = `record-item ${record.cancelado ? 'canceled' : ''}`;
            li.innerHTML = `
                <p><strong>Trabajadora:</strong> <span class="record-value">${nombreEmpleada}</span></p>
                <p><strong>Total del Servicio:</strong> <span class="record-value">$${record.total_servicio.toFixed(2)}</span></p>
                <p><strong>Método de Pago:</strong> <span class="record-value">${record.metodo_pago}</span></p>
                ${record.monto_efectivo > 0 ? `<p><strong>Monto Efectivo:</strong> <span class="record-value">$${record.monto_efectivo.toFixed(2)}</span></p>` : ''}
                ${record.monto_tarjeta > 0 ? `<p><strong>Monto Tarjeta:</strong> <span class="record-value">$${record.monto_tarjeta.toFixed(2)} (${record.banco || 'N/A'})</span></p>` : ''}
                <p><strong>Extra:</strong> <span class="record-value">$${record.extra.toFixed(2)} ${record.extra > 0 ? `(${record.extra_banco || 'N/A'})` : ''}</span></p>
                <p><strong>Lugar:</strong> <span class="record-value">${record.lugar}</span></p>
                <p><strong>Uber Ida:</strong> <span class="record-value">$${record.uber_ida.toFixed(2)} (${record.chofer_ida || 'N/A'})</span></p>
                <p><strong>Uber Regreso:</strong> <span class="record-value">$${record.uber_regreso.toFixed(2)} (${record.chofer_regreso || 'N/A'})</span></p>
                ${record.cancelado ? `<p><strong>Estado:</strong> <span class="record-value">CANCELADO</span></p>` : ''}
                <div class="record-meta">
                    <p>Registrado por: ${record.nombre_registrador} el ${date}</p>
                </div>
                <!-- Solo el autor del registro puede editarlo en la semana actual -->
                ${user.uid === record.uid ? `<button onclick="editRecord('${recordId}')">Editar</button>` : ''}
            `;
            weeklyRecordsList.appendChild(li);
        });

        if (snapshot.empty) {
            weeklyRecordsList.innerHTML = '<p>No hay registros de servicios para esta semana.</p>';
        }

        if (user.customRole === 'admin') {
            updateCutSelectors();
        }

    }, (error) => {
        console.error("Error al cargar registros:", error);
        mostrarMensaje('error', 'Error al cargar los registros de servicios. Permisos insuficientes.');
        weeklyRecordsList.innerHTML = '<p>Error al cargar los registros. Verifica tus permisos.</p>';
    });
}


// --- Lógica para la sección de Corte (solo para Administradores) ---
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() + 6) % 7);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `Semana ${weekNo}`;
}

async function loadCutSectionData() {
    // Para el corte, el admin puede ver todos los registros, sin filtro semanal
    const allRecordsSnapshot = await db.collection('registros').orderBy('fecha', 'desc').get();
    allRecordsData = [];
    allRecordsSnapshot.forEach(doc => {
        allRecordsData.push({ id: doc.id, ...doc.data() });
    });
    updateCutSelectors();
}

function updateCutSelectors() {
    const weeks = new Set();
    const employees = new Set();

    allRecordsData.forEach(record => {
        if (record.fecha && record.fecha.toDate) {
            weeks.add(getWeekNumber(record.fecha.toDate()));
        }
        if (record.nombre_empleada_display && record.nombre_empleada_display !== 'Desconocida') {
            employees.add(record.nombre_empleada_display);
        }
        if (record.nombre_registrador && record.nombre_registrador !== 'Desconocida') {
            employees.add(record.nombre_registrador);
        }
    });

    const sortedWeeks = Array.from(weeks).sort((a, b) => {
        const numA = parseInt(a.replace('Semana ', ''), 10);
        const numB = parseInt(b.replace('Semana ', ''), 10);
        return numA - numB;
    });

    const sortedEmployees = Array.from(employees).sort();

    cutWeekSelect.innerHTML = '<option value="">Selecciona una semana</option>';
    sortedWeeks.forEach(week => {
        cutWeekSelect.innerHTML += `<option value="${week}">${week}</option>`;
    });

    cutEmployeeSelect.innerHTML = '<option value="">Selecciona una empleada</option>';
    sortedEmployees.forEach(employee => {
        cutEmployeeSelect.innerHTML += `<option value="${employee}">${employee}</option>`;
    });

    // Seleccionar valores por defecto y generar reporte inicial
    if (sortedWeeks.length > 0 && sortedEmployees.length > 0) {
        cutWeekSelect.value = sortedWeeks[sortedWeeks.length - 1];
        cutEmployeeSelect.value = sortedEmployees[0];
        generateCutReport();
    } else {
        cutReportOutput.innerHTML = '<p>No hay suficientes datos para generar un reporte de corte.</p>';
    }
}

generateCutButton.addEventListener('click', generateCutReport);

async function generateCutReport() {
    const selectedWeek = cutWeekSelect.value;
    const selectedEmployee = cutEmployeeSelect.value;

    if (!selectedWeek || !selectedEmployee) {
        cutReportOutput.innerHTML = '<p>Por favor, selecciona una semana y una empleada.</p>';
        return;
    }

    const filteredRecords = allRecordsData.filter(record => {
        const recordWeek = record.fecha && record.fecha.toDate ? getWeekNumber(record.fecha.toDate()) : null;
        return recordWeek === selectedWeek &&
            (record.nombre_empleada_display === selectedEmployee || record.nombre_registrador === selectedEmployee);
    });

    if (filteredRecords.length === 0) {
        cutReportOutput.innerHTML = `<p>No se encontraron transacciones para "${selectedEmployee}" en "${selectedWeek}".</p>`;
        return;
    }

    let oficinaTotals = {
        servicios: 0, tarjetas: 0, uber: 0, extras: 0, efectivo: 0, pagosPorTipo: {}
    };

    let empleadaTotals = {
        servicios: 0, tarjetas: 0, uber: 0, extras: 0, efectivo: 0, pagosPorTipo: {}
    };

    const transactionsForComparison = [];

    filteredRecords.forEach(record => {
        if (record.cancelado) return; // Ignorar registros cancelados para el corte

        const total = record.total_servicio || 0;
        const montoTarjetas = record.monto_tarjeta || 0;
        const uber = (record.uber_ida || 0) + (record.uber_regreso || 0);
        const efectivo = record.monto_efectivo || 0;
        const banco = record.banco || 'N/A';

        let extrasOriginal = record.extra || 0;
        let extrasAjustados = extrasOriginal;
        if (extrasOriginal >= 1000) {
            extrasAjustados = extrasOriginal * 0.85;
        }

        if (record.rol_registrador === 'admin' || record.rol_registrador === 'jefe') {
            oficinaTotals.servicios += total;
            oficinaTotals.tarjetas += montoTarjetas;
            oficinaTotals.uber += uber;
            oficinaTotals.extras += extrasAjustados;
            oficinaTotals.efectivo += efectivo;
            oficinaTotals.pagosPorTipo[banco] = (oficinaTotals.pagosPorTipo[banco] || 0) + total;
        }

        if (record.nombre_empleada_display === selectedEmployee) {
            empleadaTotals.servicios += total;
            empleadaTotals.tarjetas += montoTarjetas;
            empleadaTotals.uber += uber;
            empleadaTotals.extras += extrasAjustados;
            empleadaTotals.efectivo += efectivo;
            empleadaTotals.pagosPorTipo[banco] = (empleadaTotals.pagosPorTipo[banco] || 0) + total;
        }

        transactionsForComparison.push(record);
    });

    let outputHtml = '';

    // Aquí iría el resto de la lógica de renderizado del reporte de corte
    // ... para mantener este ejemplo conciso y centrado en la nueva funcionalidad.
    // Usaremos el mismo HTML de renderizado del reporte que ya tenías
    outputHtml += `
        <div class="cut-report-summary">
            <h3>Corte Comparativo (Oficina vs Empleada)</h3>
            <table>
                <tr><th>Concepto</th><th>Oficina</th><th>Empleada</th><th>Diferencia</th></tr>
                <tr>
                    <td>Total Servicios (100%):</td>
                    <td>$${oficinaTotals.servicios.toFixed(2)}</td>
                    <td>$${empleadaTotals.servicios.toFixed(2)}</td>
                    <td class="${(empleadaTotals.servicios - oficinaTotals.servicios) >= 0 ? 'positive-diff' : 'negative-diff'}">$${(empleadaTotals.servicios - oficinaTotals.servicios).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Total Servicios (60% para la empleada):</td>
                    <td>$${(oficinaTotals.servicios * 0.60).toFixed(2)}</td>
                    <td>$${(empleadaTotals.servicios * 0.60).toFixed(2)}</td>
                    <td class="${((empleadaTotals.servicios * 0.60) - (oficinaTotals.servicios * 0.60)) >= 0 ? 'positive-diff' : 'negative-diff'}">$${((empleadaTotals.servicios * 0.60) - (oficinaTotals.servicios * 0.60)).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Total Tarjetas/Transferencias:</td>
                    <td>$${oficinaTotals.tarjetas.toFixed(2)}</td>
                    <td>$${empleadaTotals.tarjetas.toFixed(2)}</td>
                    <td class="${(empleadaTotals.tarjetas - oficinaTotals.tarjetas) >= 0 ? 'positive-diff' : 'negative-diff'}">$${(empleadaTotals.tarjetas - oficinaTotals.tarjetas).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Total Uber:</td>
                    <td>$${oficinaTotals.uber.toFixed(2)}</td>
                    <td>$${empleadaTotals.uber.toFixed(2)}</td>
                    <td class="${(empleadaTotals.uber - oficinaTotals.uber) >= 0 ? 'positive-diff' : 'negative-diff'}">$${(empleadaTotals.uber - oficinaTotals.uber).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Total Extras (ajustados):</td>
                    <td>$${oficinaTotals.extras.toFixed(2)}</td>
                    <td>$${empleadaTotals.extras.toFixed(2)}</td>
                    <td class="${(empleadaTotals.extras - oficinaTotals.extras) >= 0 ? 'positive-diff' : 'negative-diff'}">$${(empleadaTotals.extras - oficinaTotals.extras).toFixed(2)}</td>
                </tr>
            </table>
        </div>
    `;

    const calcSinDeudaOficina = (oficinaTotals.servicios * 0.40) - oficinaTotals.tarjetas - oficinaTotals.uber - oficinaTotals.extras;
    const calcSinDeudaEmpleada = (empleadaTotals.servicios * 0.40) - empleadaTotals.tarjetas - empleadaTotals.uber - empleadaTotals.extras;
    const diffCorteSinDeuda = calcSinDeudaEmpleada - calcSinDeudaOficina;

    let oficinaFinalText = '';
    let empleadaFinalText = '';
    let oficinaFinalClass = '';
    let empleadaFinalClass = '';

    if (calcSinDeudaOficina < 0) {
        oficinaFinalText = `La empresa regresa: $${Math.abs(calcSinDeudaOficina).toFixed(2)}`;
        oficinaFinalClass = 'negative';
    } else {
        oficinaFinalText = `Empleada regresa: $${calcSinDeudaOficina.toFixed(2)}`;
        oficinaFinalClass = 'positive';
    }

    if (calcSinDeudaEmpleada < 0) {
        empleadaFinalText = `La empresa regresa: $${Math.abs(calcSinDeudaEmpleada).toFixed(2)}`;
        empleadaFinalClass = 'negative';
    } else {
        empleadaFinalText = `Empleada regresa: $${calcSinDeudaEmpleada.toFixed(2)}`;
        empleadaFinalClass = 'positive';
    }

    outputHtml += `
        <div class="cut-report-summary">
            <h3>Corte Final (Efectivo a entregar - Sin Deuda)</h3>
            <p><strong>Oficina:</strong> <span class="final-cut ${oficinaFinalClass}">${oficinaFinalText}</span></p>
            <p><strong>Empleada:</strong> <span class="final-cut ${empleadaFinalClass}">${empleadaFinalText}</span></p>
            <p><strong>Diferencia (Empleada - Oficina):</strong> <span class="final-cut ${diffCorteSinDeuda >= 0 ? 'positive' : 'negative'}">$${diffCorteSinDeuda.toFixed(2)}</span></p>
        </div>
    `;

    outputHtml += `
        <h3>Comparativa de Transacciones para ${selectedEmployee} (${selectedWeek})</h3>
        <div class="cut-transactions-container">
            <table class="cut-transactions-table">
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Fecha</th>
                        <th>Horas (Oficina)</th><th>Horas (Empleada)</th>
                        <th>Total (Oficina)</th><th>Total (Empleada)</th>
                        <th>Efectivo (Oficina)</th><th>Efectivo (Empleada)</th>
                        <th>Tarjeta (Oficina)</th><th>Tarjeta (Empleada)</th>
                        <th>Extras (Oficina)</th><th>Extras (Empleada)</th>
                        <th>Lugar (Oficina)</th><th>Lugar (Empleada)</th>
                        <th>Uber (Oficina)</th><th>Uber (Empleada)</th>
                        <th>Banco (Oficina)</th><th>Banco (Empleada)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    transactionsForComparison.sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime());

    transactionsForComparison.forEach((record, index) => {
        const fecha = record.fecha ? record.fecha.toDate().toLocaleDateString() : 'N/A';
        const horas = record.horas_servicio?.toFixed(2) || '0.00';
        const total = record.total_servicio?.toFixed(2) || '0.00';
        const efectivo = record.monto_efectivo?.toFixed(2) || '0.00';
        const tarjeta = record.monto_tarjeta?.toFixed(2) || '0.00';
        const extras = record.extra?.toFixed(2) || '0.00';
        const lugar = record.lugar || 'N/A';
        const uber = ((record.uber_ida || 0) + (record.uber_regreso || 0))?.toFixed(2) || '0.00';
        const banco = record.banco || 'N/A';

        const isOfficeRecord = (record.rol_registrador === 'admin' || record.rol_registrador === 'jefe');
        const isEmployeeRecord = (record.nombre_empleada_display === selectedEmployee);

        outputHtml += `
            <tr>
                <td>${index + 1}</td>
                <td>${fecha}</td>
                <td class="office-col">${isOfficeRecord ? horas : ''}</td><td class="employee-col">${isEmployeeRecord ? horas : ''}</td>
                <td class="office-col">$${isOfficeRecord ? total : ''}</td><td class="employee-col">$${isEmployeeRecord ? total : ''}</td>
                <td class="office-col">$${isOfficeRecord ? efectivo : ''}</td><td class="employee-col">$${isEmployeeRecord ? efectivo : ''}</td>
                <td class="office-col">$${isOfficeRecord ? tarjeta : ''}</td><td class="employee-col">$${isEmployeeRecord ? tarjeta : ''}</td>
                <td class="office-col">$${isOfficeRecord ? extras : ''}</td><td class="employee-col">$${isEmployeeRecord ? extras : ''}</td>
                <td class="office-col">${isOfficeRecord ? lugar : ''}</td><td class="employee-col">${isEmployeeRecord ? lugar : ''}</td>
                <td class="office-col">$${isOfficeRecord ? uber : ''}</td><td class="employee-col">$${isEmployeeRecord ? uber : ''}</td>
                <td class="office-col">${isOfficeRecord ? banco : ''}</td><td class="employee-col">${isEmployeeRecord ? banco : ''}</td>
            </tr>
        `;
    });

    outputHtml += `
                </tbody>
            </table>
        </div>
    `;

    cutReportOutput.innerHTML = outputHtml;
}

// --- Función para la edición de registros (admin) ---
async function editRecord(recordId) {
    const recordToEdit = allRecordsData.find(record => record.id === recordId);
    if (!recordToEdit) {
        mostrarMensaje('error', 'Registro no encontrado para editar.');
        return;
    }

    editRecordIdInput.value = recordToEdit.id;
    editHorasServicioInput.value = recordToEdit.horas_servicio;
    editTotalServicioInput.value = recordToEdit.total_servicio;
    editMontoEfectivoInput.value = recordToEdit.monto_efectivo;
    editMontoTarjetaInput.value = recordToEdit.monto_tarjeta;
    editExtraInput.value = recordToEdit.extra;
    editUberIdaInput.value = recordToEdit.uber_ida;
    editUberRegresoInput.value = recordToEdit.uber_regreso;
    editCanceladoToggle.checked = recordToEdit.cancelado;

    await cargarOpcionesModalEdicion(recordToEdit);
    editRecordModal.style.display = 'flex';
    editFeedbackMessage.style.display = 'none';
}

async function cargarOpcionesModalEdicion(record) {
    editEmpleadaSelect.innerHTML = '<option value="">Selecciona una empleada</option>';
    const empleadasSnapshot = await db.collection('usuarios').where('rol', '==', 'empleada').orderBy('nombre').get();
    empleadasSnapshot.forEach(doc => {
        const selected = (doc.id === record.uid_empleada) ? 'selected' : '';
        editEmpleadaSelect.innerHTML += `<option value="${doc.id}" ${selected}>${doc.data().nombre || doc.data().email}</option>`;
    });

    editBancoSelect.innerHTML = '<option value="">Selecciona un banco</option>';
    const bancosSnapshot = await db.collection('bancos').orderBy('nombre').get();
    bancosSnapshot.forEach(doc => {
        const selected = (doc.data().nombre === record.banco) ? 'selected' : '';
        editBancoSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });

    editLugarSelect.innerHTML = '<option value="">Selecciona un lugar</option>';
    const lugaresSnapshot = await db.collection('lugares').orderBy('nombre').get();
    lugaresSnapshot.forEach(doc => {
        const selected = (doc.data().nombre === record.lugar) ? 'selected' : '';
        editLugarSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });

    editChoferIdaSelect.innerHTML = '<option value="">Selecciona un chofer</option>';
    const choferesSnapshotIda = await db.collection('choferes').orderBy('nombre').get();
    choferesSnapshotIda.forEach(doc => {
        const selected = (doc.data().nombre === record.chofer_ida) ? 'selected' : '';
        editChoferIdaSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });

    editChoferRegresoSelect.innerHTML = '<option value="">Selecciona un chofer</option>';
    const choferesSnapshotRegreso = await db.collection('choferes').orderBy('nombre').get();
    choferesSnapshotRegreso.forEach(doc => {
        const selected = (doc.data().nombre === record.chofer_regreso) ? 'selected' : '';
        editChoferRegresoSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });
}

function closeEditRecordModal() {
    editRecordModal.style.display = 'none';
    editRecordForm.reset();
    editFeedbackMessage.style.display = 'none';
}

editRecordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const recordId = editRecordIdInput.value;
    const user = auth.currentUser;

    const updatedData = {
        horas_servicio: parseFloat(editHorasServicioInput.value) || 0,
        total_servicio: parseFloat(editTotalServicioInput.value) || 0,
        monto_efectivo: parseFloat(editMontoEfectivoInput.value) || 0,
        monto_tarjeta: parseFloat(editMontoTarjetaInput.value) || 0,
        banco: editBancoSelect.value,
        extra: parseFloat(editExtraInput.value) || 0,
        lugar: editLugarSelect.value,
        uber_ida: parseFloat(editUberIdaInput.value) || 0,
        chofer_ida: editChoferIdaSelect.value,
        uber_regreso: parseFloat(editUberRegresoInput.value) || 0,
        chofer_regreso: editChoferRegresoSelect.value,
        uid_empleada: editEmpleadaSelect.value,
        cancelado: editCanceladoToggle.checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.email
    };

    try {
        const newEmpleadaUid = editEmpleadaSelect.value;
        const currentRecord = allRecordsData.find(r => r.id === recordId);

        if (newEmpleadaUid && newEmpleadaUid !== currentRecord.uid_empleada) {
            const newEmpleadaDoc = await db.collection('usuarios').doc(newEmpleadaUid).get();
            if (newEmpleadaDoc.exists) {
                const newEmpleadaData = newEmpleadaDoc.data();
                updatedData.email_empleada = newEmpleadaData.email;
                updatedData.nombre_empleada = newEmpleadaData.nombre || newEmpleadaData.email.split('@')[0];
            } else {
                mostrarMensajeModal('error', 'La nueva empleada seleccionada no es válida.');
                return;
            }
        } else if (!newEmpleadaUid) {
            updatedData.uid_empleada = '';
            updatedData.email_empleada = '';
            updatedData.nombre_empleada = '';
        }

        await db.collection('registros').doc(recordId).update(updatedData);
        mostrarMensajeModal('success', 'Registro actualizado con éxito!');
        setTimeout(() => {
            closeEditRecordModal();
        }, 1000);

    } catch (error) {
        console.error("Error al actualizar registro:", error);
        mostrarMensajeModal('error', 'Error al actualizar registro. Inténtalo de nuevo.');
    }
});

function mostrarMensajeModal(tipo, mensaje) {
    editFeedbackMessage.textContent = mensaje;
    editFeedbackMessage.className = '';
    editFeedbackMessage.classList.add(tipo);
    editFeedbackMessage.style.display = 'block';
    setTimeout(() => {
        editFeedbackMessage.style.display = 'none';
    }, 4000);
}
