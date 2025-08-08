// app.js

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const empleadaField = document.getElementById('empleada-field');
const empleadaButtonsContainer = document.getElementById('empleada-buttons-container');
const empleadaUidSelectedInput = document.getElementById('empleada-uid-selected');
const feedbackMessage = document.getElementById('feedback-message');
const adminPanel = document.getElementById('admin-panel');
const weekSelectorContainer = document.getElementById('week-selector-container');
const currentWeekDisplay = document.getElementById('current-week-display');
const prevWeekBtn = document.getElementById('prev-week-btn');
const nextWeekBtn = document.getElementById('next-week-btn');

// Elementos del formulario dinámico de pagos
const pagoEfectivoRadio = document.getElementById('pago-efectivo');
const pagoTarjetaRadio = document.getElementById('pago-tarjeta');
const pagoMixtoRadio = document.getElementById('pago-mixto');
const montoEfectivoField = document.getElementById('monto-efectivo-field');
const montoTarjetaField = document.getElementById('monto-tarjeta-field');
const montoExtraInput = document.getElementById('extra');
const bancoField = document.getElementById('banco-field');
const totalServicioInput = document.getElementById('total_servicio');

// Elementos para la sección de registros
const recordsSectionTitle = document.getElementById('records-section-title');
const recordsList = document.getElementById('records-list');
const officeRecordsView = document.getElementById('office-records-view');

// Elementos para la sección de corte
const cutSection = document.getElementById('cut-section');
const cutWeekSelect = document.getElementById('cut-week-select');
const cutEmployeeSelect = document.getElementById('cut-employee-select');
const generateCutButton = document.getElementById('generate-cut-button');
const cutReportOutput = document.getElementById('cut-report-output');

// Elementos del modal de edición
const editRecordModal = document.getElementById('editRecordModal');
const editRecordForm = document.getElementById('edit-record-form');
const editRecordIdInput = document.getElementById('edit-record-id');
const editEmpleadaSelect = document.getElementById('edit-empleada');
const editHorasServicioInput = document.getElementById('edit-horas_servicio');
const editTotalServicioInput = document.getElementById('edit-total_servicio');
// Campos dinámicos del modal de edición
const editPagoRadios = document.querySelectorAll('input[name="edit_metodo_pago"]');
const editMontoEfectivoField = document.getElementById('edit-monto-efectivo-field');
const editMontoTarjetaField = document.getElementById('edit-monto-tarjeta-field');
const editMontoEfectivoInput = document.getElementById('edit-monto_efectivo');
const editMontoTarjetaInput = document.getElementById('edit-monto_tarjeta');
const editExtraInput = document.getElementById('edit-extra');
const editBancoField = document.getElementById('edit-banco-field');
const editBancoSelect = document.getElementById('edit-banco');
const editLugarSelect = document.getElementById('edit-lugar');
const editUberIdaInput = document.getElementById('edit-uber_ida');
const editChoferIdaSelect = document.getElementById('edit-chofer_ida');
const editUberRegresoInput = document.getElementById('edit-uber_regreso');
const editChoferRegresoSelect = document.getElementById('edit-chofer_regreso');
const editCanceladoCheckbox = document.getElementById('edit-cancelado');
const editFeedbackMessage = document.getElementById('edit-feedback-message');

// Listas para el panel de administración
const userList = document.getElementById('user-list');
const oficinaList = document.getElementById('oficina-list');
const lugaresListAdmin = document.getElementById('lugares-list');
const bancosListAdmin = document.getElementById('bancos-list');
const choferesListAdmin = document.getElementById('choferes-list');

// NUEVOS ELEMENTOS para el formulario de creación de usuarios
const createUserForm = document.getElementById('create-user-form');
const createUserNameInput = document.getElementById('create-user-name');
const createUserEmailInput = document.getElementById('create-user-email');
const createUserOficinaSelect = document.getElementById('create-user-oficina');
const createUserFeedback = document.getElementById('create-user-feedback');

// Variables globales para almacenar las opciones de los dropdowns y datos
let oficinasDisponibles = [];
let empleadosPorOficina = {};
let usuariosDisponibles = [];
let unsubscribeFromRecords = null;
let allRecordsData = [];
let selectedEmpleadaUid = null;
let currentWeek = null;
let colorPalette = ['#34a853', '#4285f4', '#ea4335', '#fbbc05', '#8e24aa', '#00796b', '#d81b60', '#f48fb1', '#81c784'];
let assignedColors = {};
let currentUserData = null; // Variable global para almacenar los datos del usuario logueado

// --- Funciones de Autenticación ---
loginButton.addEventListener('click', () => {
    auth.signInWithPopup(googleProvider);
});

logoutButton.addEventListener('click', () => {
    auth.signOut();
});

auth.onAuthStateChanged(async user => {
    if (user) {
        authContainer.style.display = 'none';
        mainContainer.style.display = 'block';
        userEmailSpan.textContent = user.email;

        try {
            const userDocRef = db.collection('usuarios').doc(user.uid);
            let userDoc = await userDocRef.get();
            let userData = userDoc.data();

            if (!userDoc.exists) {
                const userDocByEmailRef = db.collection('usuarios').doc(user.email);
                let userDocByEmail = await userDocByEmailRef.get();

                if (userDocByEmail.exists) {
                    userData = userDocByEmail.data();
                    await userDocRef.set(userData, { merge: true });
                    await userDocByEmailRef.delete();
                    userDoc = await userDocRef.get();
                } else {
                    userData = {
                        email: user.email,
                        nombre: user.displayName || user.email.split('@')[0],
                        rol: 'empleada',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await userDocRef.set(userData);
                    mostrarMensaje('error', 'Tu rol no está configurado. Contacta al administrador.');
                }
            }

            const rol = userData.rol || 'empleada';
            userRoleSpan.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);
            user.customRole = rol;
            user.oficinaRef = userData.oficina;

            // Almacenar los datos del usuario en una variable global
            currentUserData = userData;

            handleUserRole(user);
            await cargarDatosFormulario(user);
            currentWeek = getStartAndEndOfWeek(new Date());
            setupRecordsListener(user);

            if (user.customRole === 'admin') {
                loadCutSectionData();
            }

        } catch (error) {
            console.error("Error al obtener o configurar el rol del usuario:", error);
            mostrarMensaje('error', 'Error al cargar tu perfil. Inténtalo de nuevo.');
            auth.signOut();
        }
    } else {
        authContainer.style.display = 'block';
        mainContainer.style.display = 'none';
        userEmailSpan.textContent = '';
        userRoleSpan.textContent = '';
        serviceForm.reset();
        feedbackMessage.style.display = 'none';
        if (unsubscribeFromRecords) {
            unsubscribeFromRecords();
            unsubscribeFromRecords = null;
        }
        recordsList.innerHTML = '';
        officeRecordsView.innerHTML = '';
        cutReportOutput.innerHTML = '<p>Selecciona una semana y una empleada para generar el reporte de corte.</p>';
        cutSection.style.display = 'none';
        weekSelectorContainer.style.display = 'none';
        recordsList.style.display = 'block';
        officeRecordsView.style.display = 'none';
        currentUserData = null; // Limpiar los datos del usuario al cerrar sesión
    }
});

function handleUserRole(user) {
    if (user.customRole === 'jefe') {
        empleadaField.style.display = 'block';
        recordsList.style.display = 'none';
        officeRecordsView.style.display = 'block';
        recordsSectionTitle.textContent = 'Registros de la Oficina';
    } else {
        empleadaField.style.display = 'none';
        recordsList.style.display = 'block';
        officeRecordsView.style.display = 'none';
        recordsSectionTitle.textContent = 'Registros de la Semana Actual';
    }

    if (user.customRole === 'admin') {
        adminPanel.style.display = 'block';
        cutSection.style.display = 'block';
        weekSelectorContainer.style.display = 'flex';
        recordsList.style.display = 'block';
        officeRecordsView.style.display = 'none';
        recordsSectionTitle.textContent = 'Registros de Servicios';
        cargarPanelAdministracion();
    } else {
        adminPanel.style.display = 'none';
        cutSection.style.display = 'none';
        weekSelectorContainer.style.display = 'none';
    }
}

async function cargarDatosFormulario(user) {
    try {
        const lugaresSelect = document.getElementById('lugar');
        lugaresSelect.innerHTML = '<option value="">Selecciona un lugar</option>';
        const bancosSelect = document.getElementById('banco');
        bancosSelect.innerHTML = '<option value="">Selecciona un banco</option>';
        const choferesSelectIda = document.getElementById('chofer_ida');
        const choferesSelectRegreso = document.getElementById('chofer_regreso');
        choferesSelectIda.innerHTML = '<option value="">Selecciona un chofer</option>';
        choferesSelectRegreso.innerHTML = '<option value="">Selecciona un chofer</option>';

        const [lugaresSnapshot, bancosSnapshot, choferesSnapshot] = await Promise.all([
            db.collection('lugares').orderBy('nombre').get(),
            db.collection('bancos').orderBy('nombre').get(),
            db.collection('choferes').orderBy('nombre').get()
        ]);

        lugaresSnapshot.forEach(doc => lugaresSelect.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`);
        bancosSnapshot.forEach(doc => bancosSelect.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`);
        choferesSnapshot.forEach(doc => {
            choferesSelectIda.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`;
            choferesSelectRegreso.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`;
        });

        if (user.customRole === 'jefe') {
            empleadosPorOficina = {};
            empleadaButtonsContainer.innerHTML = '';
            if (user.oficinaRef) {
                const empleadasSnapshot = await db.collection('usuarios')
                    .where('oficina', '==', user.oficinaRef)
                    .where('rol', '==', 'empleada')
                    .orderBy('nombre')
                    .get();

                empleadasSnapshot.forEach(doc => {
                    const empleado = { id: doc.id, ...doc.data() };

                    let empleadoColor = localStorage.getItem(`color_${empleado.id}`);
                    if (!empleadoColor) {
                        empleadoColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                        localStorage.setItem(`color_${empleado.id}`, empleadoColor);
                    }
                    assignedColors[doc.id] = empleadoColor;

                    empleadosPorOficina[doc.id] = empleado;

                    const button = document.createElement('button');
                    button.textContent = empleado.nombre || empleado.email.split('@')[0];
                    button.classList.add('empleada-btn');
                    button.style.backgroundColor = empleadoColor;
                    button.setAttribute('data-uid', empleado.id);
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        document.querySelectorAll('.empleada-btn').forEach(btn => btn.classList.remove('selected'));
                        button.classList.add('selected');
                        empleadaUidSelectedInput.value = empleado.id;
                        selectedEmpleadaUid = empleado.id;
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

serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    const userRole = user.customRole;

    let noServicio = 1;
    let employeeUidToQuery;
    if (userRole === 'jefe') {
        employeeUidToQuery = empleadaUidSelectedInput.value;
    } else {
        employeeUidToQuery = user.uid;
    }

    if (!employeeUidToQuery) {
        mostrarMensaje('error', 'Por favor, selecciona una trabajadora.');
        return;
    }

    try {
        const querySnapshot = await db.collection('registros')
            .where('uid', '==', user.uid)
            .where('uid_empleada', '==', employeeUidToQuery)
            .where('fecha', '>=', getStartAndEndOfWeek(new Date()).start)
            .where('fecha', '<=', getStartAndEndOfWeek(new Date()).end)
            .orderBy('fecha', 'desc')
            .orderBy('no_servicio', 'desc')
            .limit(1)
            .get();

        if (!querySnapshot.empty) {
            const lastRecord = querySnapshot.docs[0].data();
            noServicio = (lastRecord.no_servicio || 0) + 1;
        }
    } catch (error) {
        console.error("Error al obtener el número de servicio consecutivo:", error);
        mostrarMensaje('error', 'Error al obtener el número de servicio. Inténtalo de nuevo.');
        return;
    }


    const metodoPago = document.querySelector('input[name="metodo_pago"]:checked').value;
    let montoEfectivo = (metodoPago === 'efectivo' || metodoPago === 'mixto') ? parseFloat(document.getElementById('monto_efectivo').value) || 0 : 0;
    let montoTarjeta = (metodoPago === 'mixto') ? parseFloat(document.getElementById('monto_tarjeta').value) || 0 : 0;
    const totalServicio = parseFloat(document.getElementById('total_servicio').value) || 0;

    if (metodoPago === 'tarjeta') {
        montoTarjeta = totalServicio;
        montoEfectivo = 0;
    }

    const banco = (metodoPago !== 'efectivo' || parseFloat(document.getElementById('extra').value) > 0) ? document.getElementById('banco').value : '';

    // CORRECCIÓN: Usar el nombre del usuario desde la variable global currentUserData
    const registradorNombre = currentUserData.nombre || user.email.split('@')[0];

    const formData = {
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        no_servicio: noServicio,
        horas_servicio: parseFloat(document.getElementById('horas_servicio').value) || 0,
        total_servicio: totalServicio,
        metodo_pago: metodoPago,
        monto_efectivo: montoEfectivo,
        monto_tarjeta: montoTarjeta,
        banco: banco,
        extra: parseFloat(document.getElementById('extra').value) || 0,
        lugar: document.getElementById('lugar').value,
        uber_ida: parseFloat(document.getElementById('uber_ida').value) || 0,
        chofer_ida: document.getElementById('chofer_ida').value,
        uber_regreso: parseFloat(document.getElementById('uber_regreso').value) || 0,
        chofer_regreso: document.getElementById('chofer_regreso').value,
        cancelado: document.getElementById('cancelado').checked,
        uid: user.uid,
        email_registrador: user.email,
        rol_registrador: userRole,
        nombre_registrador: registradorNombre,
        uid_empleada: user.uid,
        email_empleada: user.email,
        nombre_empleada: user.displayName || user.email.split('@')[0]
    };

    if (userRole === 'jefe') {
        const empleadaUidSeleccionada = empleadaUidSelectedInput.value;
        if (!empleadaUidSeleccionada) {
            mostrarMensaje('error', 'Por favor, selecciona una trabajadora.');
            return;
        }
        const empleadaData = empleadosPorOficina[empleadaUidSeleccionada];
        if (!empleadaData) {
            mostrarMensaje('error', 'La empleada seleccionada no es válida.');
            return;
        }
        formData.uid_empleada = empleadaUidSeleccionada;
        formData.email_empleada = empleadaData.email;
        formData.nombre_empleada = empleadaData.nombre || empleadaData.email.split('@')[0];
    }

    try {
        await db.collection('registros').add(formData);
        serviceForm.reset();
        pagoEfectivoRadio.checked = true;
        handlePaymentMethodChange();
        empleadaUidSelectedInput.value = '';
        selectedEmpleadaUid = null;
        document.querySelectorAll('.empleada-btn').forEach(btn => btn.classList.remove('selected'));
        mostrarMensaje('success', '✅ Servicio registrado con éxito!');
    } catch (error) {
        console.error("Error al registrar el servicio:", error);
        mostrarMensaje('error', '❌ Error al registrar el servicio. Inténtalo de nuevo.');
    }
});

document.querySelectorAll('input[name="metodo_pago"]').forEach(radio => {
    radio.addEventListener('change', handlePaymentMethodChange);
});
document.getElementById('extra').addEventListener('input', handlePaymentMethodChange);
totalServicioInput.addEventListener('input', handlePaymentMethodChange);

function handlePaymentMethodChange() {
    const metodoPago = document.querySelector('input[name="metodo_pago"]:checked').value;
    const extraValue = parseFloat(document.getElementById('extra').value) || 0;
    const totalServicio = parseFloat(document.getElementById('total_servicio').value) || 0;

    montoEfectivoField.style.display = (metodoPago === 'mixto') ? 'block' : 'none';
    montoTarjetaField.style.display = (metodoPago === 'mixto') ? 'block' : 'none';
    bancoField.style.display = (metodoPago === 'tarjeta' || metodoPago === 'mixto' || extraValue > 0) ? 'block' : 'none';

    if (metodoPago === 'tarjeta') {
        document.getElementById('monto_tarjeta').value = totalServicio;
    }
}

handlePaymentMethodChange();

function mostrarMensaje(tipo, mensaje) {
    feedbackMessage.textContent = mensaje;
    feedbackMessage.className = '';
    feedbackMessage.classList.add(tipo);
    feedbackMessage.style.display = 'block';
    setTimeout(() => {
        feedbackMessage.style.display = 'none';
    }, 5000);
}

async function cargarPanelAdministracion() {
    try {
        oficinasDisponibles = [];
        const oficinasSnapshot = await db.collection('oficinas').orderBy('nombre').get();
        oficinasSnapshot.forEach(doc => {
            oficinasDisponibles.push({ id: doc.id, ...doc.data() });
        });
        renderOficinaList();

        const oficinasSelect = createUserOficinaSelect;
        oficinasSelect.innerHTML = '<option value="">Sin Oficina</option>';
        oficinasDisponibles.forEach(oficina => {
            oficinasSelect.innerHTML += `<option value="${oficina.id}">${oficina.nombre}</option>`;
        });


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

createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = createUserNameInput.value.trim();
    const email = createUserEmailInput.value.trim();
    const oficinaId = createUserOficinaSelect.value;

    if (!nombre || !email || !oficinaId) {
        mostrarMensajeEnAdminPanel('error', 'Por favor, completa todos los campos.');
        return;
    }

    const oficinaRef = db.collection('oficinas').doc(oficinaId);

    try {
        const userDocRef = db.collection('usuarios').doc(email);
        await userDocRef.set({
            email: email,
            nombre: nombre,
            rol: 'empleada',
            oficina: oficinaRef,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensajeEnAdminPanel('success', `Usuario ${nombre} agregado con éxito.`);
        createUserForm.reset();
        await cargarPanelAdministracion();

    } catch (error) {
        console.error("Error al crear un nuevo usuario:", error);
        mostrarMensajeEnAdminPanel('error', 'Error al crear el usuario. Podría ya existir o haber un error.');
    }
});

function mostrarMensajeEnAdminPanel(tipo, mensaje) {
    createUserFeedback.textContent = mensaje;
    createUserFeedback.className = '';
    createUserFeedback.classList.add(tipo);
    createUserFeedback.style.display = 'block';
    setTimeout(() => {
        createUserFeedback.style.display = 'none';
    }, 5000);
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
        await db.collection('usuarios').doc(userId).update({ rol: newRol, oficina: oficinaRef });
        mostrarMensaje('success', `Usuario ${usuariosDisponibles.find(u => u.id === userId).email} actualizado.`);
        await cargarPanelAdministracion();
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        mostrarMensaje('error', 'Error al actualizar usuario.');
    } finally { usuarioEditandoId = null; }
}
function cancelarEdicionUsuario(userId) {
    const li = userList.querySelector(`li button[onclick="mostrarEditarUsuario('${userId}')"]`).parentNode;
    const editForm = li.querySelector('.edit-user-form');
    if (editForm) editForm.remove();
    usuarioEditandoId = null;
}
async function agregarOficina() {
    const nombre = document.getElementById('nueva-oficina-nombre').value.trim();
    if (!nombre) { mostrarMensaje('error', 'El nombre de la oficina es obligatorio.'); return; }
    const oficinaId = nombre.toUpperCase().replace(/\s/g, '_');
    try {
        await db.collection('oficinas').doc(oficinaId).set({ nombre: nombre });
        mostrarMensaje('success', `Oficina "${nombre}" agregada.`);
        document.getElementById('nueva-oficina-nombre').value = '';
        await cargarPanelAdministracion();
    } catch (error) {
        console.error(`Error al agregar oficina: ${error.message}`);
        mostrarMensaje('error', 'Error al agregar oficina. Podría ya existir o haber un error de permisos.');
    }
}
async function eliminarOficina(oficinaId) {
    showCustomModal('¿Estás seguro de que quieres eliminar esta oficina? Esto NO eliminará a los usuarios asociados, solo desvinculará su referencia.', async () => {
        try {
            await db.collection('oficinas').doc(oficinaId).delete();
            mostrarMensaje('success', `Oficina eliminada.`);
            await cargarPanelAdministracion();
        } catch (error) {
            console.error(`Error al eliminar oficina: ${error.message}`);
            mostrarMensaje('error', `Error al eliminar de ${coleccion}.`);
        }
    });
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
        console.error(`Error al agregar a ${coleccion}: ${error.message}`);
        mostrarMensaje('error', `Error al agregar a ${coleccion}. Podría ya existir o haber un error de permisos.`);
    }
}
async function eliminarCatalogo(coleccion, id) {
    showCustomModal(`¿Estás seguro de que quieres eliminar este elemento de ${coleccion}?`, async () => {
        try {
            await db.collection(coleccion).doc(id).delete();
            mostrarMensaje('success', `Elemento de ${coleccion} eliminado.`);
            await cargarDatosFormulario(auth.currentUser);
            await cargarYRenderizarCatalogo(coleccion, document.getElementById(`${coleccion}-list`));
        } catch (error) {
            console.error(`Error al eliminar de ${coleccion}: ${error.message}`);
            mostrarMensaje('error', `Error al eliminar de ${coleccion}.`);
        }
    });
}
function showCustomModal(message, callback) {
    if (window.confirm(message)) {
        callback();
    }
}
function getStartAndEndOfWeek(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(date.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { start: startOfWeek, end: endOfWeek, weekNumber: getWeekNumber(startOfWeek) };
}

prevWeekBtn.addEventListener('click', () => {
    currentWeek.start.setDate(currentWeek.start.getDate() - 7);
    currentWeek.end.setDate(currentWeek.end.getDate() - 7);
    currentWeek.weekNumber = getWeekNumber(currentWeek.start);
    const user = auth.currentUser;
    if (user && user.customRole === 'admin') {
        renderFilteredRecordsForAdmin();
    }
});

nextWeekBtn.addEventListener('click', () => {
    currentWeek.start.setDate(currentWeek.start.getDate() + 7);
    currentWeek.end.setDate(currentWeek.end.getDate() + 7);
    currentWeek.weekNumber = getWeekNumber(currentWeek.start);
    const user = auth.currentUser;
    if (user && user.customRole === 'admin') {
        renderFilteredRecordsForAdmin();
    }
});

async function setupRecordsListener(user) {
    if (unsubscribeFromRecords) {
        unsubscribeFromRecords();
    }

    let recordsQuery;
    const { start, end } = getStartAndEndOfWeek(new Date());

    if (user.customRole === 'admin') {
        recordsQuery = db.collection('registros').orderBy('fecha', 'desc');
    } else if (user.customRole === 'empleada') {
        recordsQuery = db.collection('registros')
            .where('uid', '==', user.uid)
            .where('fecha', '>=', start)
            .where('fecha', '<=', end)
            .orderBy('fecha', 'desc');
    } else if (user.customRole === 'jefe') {
        recordsQuery = db.collection('registros')
            .where('uid', '==', user.uid)
            .where('fecha', '>=', start)
            .where('fecha', '<=', end)
            .orderBy('fecha', 'desc');
    }

    if (!recordsQuery) {
        console.error("recordsQuery is not defined. This should not happen.");
        return;
    }

    unsubscribeFromRecords = recordsQuery.onSnapshot(async (snapshot) => {
        allRecordsData = [];
        const allUsersSnapshot = await db.collection('usuarios').get();
        const allUsersMap = new Map();
        allUsersSnapshot.forEach(doc => { allUsersMap.set(doc.id, doc.data()); });

        snapshot.forEach(doc => {
            const record = doc.data();
            const recordId = doc.id;
            const empleadaData = allUsersMap.get(record.uid_empleada);
            const nombreEmpleada = empleadaData ? (empleadaData.nombre || empleadaData.email) : 'Desconocida';
            allRecordsData.push({ id: recordId, ...record, nombre_empleada_display: nombreEmpleada });
        });

        if (user.customRole === 'jefe') {
            const { start, end } = getStartAndEndOfWeek(new Date());
            const filteredForJefe = allRecordsData.filter(record => {
                if (!record.fecha || !record.fecha.toDate) return false;
                const recordDate = record.fecha.toDate();
                return recordDate >= start && recordDate <= end;
            });
            renderOfficeRecords(filteredForJefe, allUsersMap);
        } else if (user.customRole === 'empleada') {
            const { start, end } = getStartAndEndOfWeek(new Date());
            const filteredForEmpleada = allRecordsData.filter(record => {
                if (!record.fecha || !record.fecha.toDate) return false;
                const recordDate = record.fecha.toDate();
                return recordDate >= start && recordDate <= end && record.uid === user.uid;
            });
            renderRecordsList(filteredForEmpleada, user, allUsersMap);
        } else if (user.customRole === 'admin') {
            renderFilteredRecordsForAdmin();
        }

        if (allRecordsData.length === 0) {
            if (user.customRole === 'jefe') {
                document.querySelector('#office-records-view .employee-columns').innerHTML = '<p style="text-align:center;">No hay registros de servicios esta semana.</p>';
            } else {
                recordsList.innerHTML = '<p>No hay registros de servicios esta semana.</p>';
            }
        }

        if (user.customRole === 'admin') {
            updateCutSelectors();
        }

    }, (error) => {
        console.error("Error al cargar registros:", error);
        mostrarMensaje('error', 'Error al cargar los registros de servicios. Permisos insuficientes.');
        recordsList.innerHTML = '<p>Error al cargar los registros. Verifica tus permisos.</p>';
    });
}

function renderFilteredRecordsForAdmin() {
    const { start, end, weekNumber } = currentWeek;
    currentWeekDisplay.textContent = `Semana ${weekNumber}: del ${start.toLocaleDateString()} al ${end.toLocaleDateString()}`;

    const filteredForDisplay = allRecordsData.filter(record => {
        if (!record.fecha || !record.fecha.toDate) return false;
        const recordDate = record.fecha.toDate();
        return recordDate >= start && recordDate <= end;
    });

    const allUsersMap = new Map();
    db.collection('usuarios').get().then(snapshot => {
        snapshot.forEach(doc => allUsersMap.set(doc.id, doc.data()));
        renderRecordsList(filteredForDisplay, auth.currentUser, allUsersMap);
    });
}

function renderRecordsList(records, user, allUsersMap) {
    recordsList.innerHTML = '';

    if (records.length === 0) {
        recordsList.innerHTML = '<p>No hay registros de servicios para la semana seleccionada.</p>';
        return;
    }

    records.forEach(record => {
        const recordId = record.id;
        const date = record.fecha ? record.fecha.toDate().toLocaleString() : 'Fecha no disponible';
        const empleadaData = allUsersMap.get(record.uid_empleada);
        const nombreEmpleada = empleadaData ? (empleadaData.nombre || empleadaData.email) : 'Desconocida';
        const canEdit = user.customRole === 'admin' || record.uid === user.uid;

        const li = document.createElement('li');
        li.className = 'record-item';
        li.innerHTML = `
            <p><strong>Trabajadora:</strong> <span class="record-value">${nombreEmpleada}</span></p>
            <p><strong>Horas:</strong> <span class="record-value">${record.horas_servicio}</span></p>
            <p><strong>Total:</strong> <span class="record-value">$${record.total_servicio.toFixed(2)}</span></p>
            <p><strong>Método:</strong> <span class="record-value">${record.metodo_pago.charAt(0).toUpperCase() + record.metodo_pago.slice(1)}</span></p>
            <p><strong>Efectivo:</strong> <span class="record-value">$${record.monto_efectivo.toFixed(2)}</span></p>
            <p><strong>Tarjeta:</strong> <span class="record-value">$${record.monto_tarjeta.toFixed(2)}</span></p>
            <p><strong>Banco:</strong> <span class="record-value">${record.banco || 'N/A'}</span></p>
            <p><strong>Extra:</strong> <span class="record-value">$${record.extra.toFixed(2)}</span></p>
            <p><strong>Lugar:</strong> <span class="record-value">${record.lugar}</span></p>
            <p><strong>Uber Ida:</strong> <span class="record-value">$${record.uber_ida.toFixed(2)}</span></p>
            <p><strong>Chofer Ida:</strong> <span class="record-value">${record.chofer_ida || 'N/A'}</span></p>
            <p><strong>Uber Regreso:</strong> <span class="record-value">$${record.uber_regreso.toFixed(2)}</span></p>
            <p><strong>Chofer Regreso:</strong> <span class="record-value">${record.chofer_regreso || 'N/A'}</span></p>
            ${record.cancelado ? '<p style="color: red; font-weight: bold; margin-top: 5px;">ESTADO: CANCELADO</p>' : ''}
            <div class="record-meta">
                <p>Registrado por: ${record.nombre_registrador} el ${date}</p>
            </div>
            ${canEdit ? `<button onclick="editRecord('${recordId}')" style="background-color: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-top: 10px;">Editar</button>` : ''}
        `;
        recordsList.appendChild(li);
    });
}

// Función para renderizar los registros en columnas (para el rol de Jefe)
function renderOfficeRecords(records, allUsersMap) {
    const employeeColumnsContainer = document.querySelector('#office-records-view .employee-columns');
    employeeColumnsContainer.innerHTML = '';

    const recordsByEmployee = {};
    // Agregamos el UID del jefe a la lista para mostrar sus propios registros en una columna separada
    recordsByEmployee[auth.currentUser.uid] = [];
    Object.values(empleadosPorOficina).forEach(empleado => recordsByEmployee[empleado.id] = []);

    records.forEach(record => {
        if (recordsByEmployee[record.uid_empleada]) {
            recordsByEmployee[record.uid_empleada].push(record);
        }
    });

    // Filtramos para asegurarnos de que solo se muestren las columnas con registros
    const employeesWithRecords = Object.keys(recordsByEmployee).filter(uid => recordsByEmployee[uid].length > 0);

    if (employeesWithRecords.length === 0) {
        employeeColumnsContainer.innerHTML = '<p style="text-align:center;">No hay registros de servicios esta semana.</p>';
        return;
    }

    employeesWithRecords.forEach(empleadoUid => {
        const empleado = empleadosPorOficina[empleadoUid] || {nombre: 'Oficina', id: auth.currentUser.uid, color_boton: '#4285f4'};
        const columna = document.createElement('div');
        columna.className = 'employee-column';

        const header = document.createElement('h3');
        header.textContent = empleado.nombre || empleado.email.split('@')[0];
        // Usamos el color asignado o un color predeterminado para la oficina
        header.style.backgroundColor = assignedColors[empleado.id] || empleado.color_boton;
        columna.appendChild(header);

        const recordList = document.createElement('ul');
        recordList.style.listStyle = 'none';
        recordList.style.padding = '0';
        recordList.style.minHeight = '150px';

        recordsByEmployee[empleadoUid].forEach(record => {
            const li = document.createElement('li');
            li.className = 'record-item';
            li.style.borderLeft = `5px solid ${assignedColors[record.uid_empleada] || empleado.color_boton}`;
            li.style.paddingLeft = '15px';
            li.style.borderRadius = '5px';

            const canEdit = record.uid === auth.currentUser.uid;
            const editButtonHtml = canEdit ? `<button onclick="editRecord('${record.id}')" style="background-color: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8em; margin-top: 5px;">Editar</button>` : '';

            li.innerHTML = `
                <p><strong>${record.no_servicio}. Horas:</strong> <span class="record-value">${record.horas_servicio}</span></p>
                <p><strong>Total:</strong> <span class="record-value">$${record.total_servicio.toFixed(2)}</span></p>
                <p><strong>Lugar:</strong> <span class="record-value">${record.lugar}</span></p>
                ${record.cancelado ? '<p style="color: red; font-weight: bold; margin-top: 5px;">ESTADO: CANCELADO</p>' : ''}
                ${editButtonHtml}
            `;
            recordList.appendChild(li);
        });
        columna.appendChild(recordList);
        employeeColumnsContainer.appendChild(columna);
    });
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() + 6) % 7);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getWeekNumberString(d) {
    const weekNo = getWeekNumber(d);
    return `Semana ${weekNo}`;
}

async function loadCutSectionData() {
    updateCutSelectors();
}

function updateCutSelectors() {
    const weeks = new Set();
    const employees = new Map();

    allRecordsData.forEach(record => {
        if (record.fecha && record.fecha.toDate) {
            weeks.add(getWeekNumberString(record.fecha.toDate()));
        }
        if (record.uid_empleada) {
            employees.set(record.uid_empleada, record.nombre_empleada_display);
        }
    });

    const sortedWeeks = Array.from(weeks).sort((a, b) => parseInt(a.replace('Semana ', ''), 10) - parseInt(b.replace('Semana ', ''), 10));
    const sortedEmployees = Array.from(employees).sort((a, b) => a[1].localeCompare(b[1]));

    cutWeekSelect.innerHTML = '<option value="">Selecciona una semana</option>';
    sortedWeeks.forEach(week => cutWeekSelect.innerHTML += `<option value="${week}">${week}</option>`);
    if (sortedWeeks.length > 0) cutWeekSelect.value = sortedWeeks[sortedWeeks.length - 1];

    cutEmployeeSelect.innerHTML = '<option value="">Selecciona una empleada</option>';
    sortedEmployees.forEach(employee => cutEmployeeSelect.innerHTML += `<option value="${employee[0]}">${employee[1]}</option>`);

    if (sortedEmployees.length > 0) cutEmployeeSelect.value = sortedEmployees[0][0];

    if (sortedWeeks.length > 0 && sortedEmployees.length > 0) {
        generateCutReport();
    } else {
        cutReportOutput.innerHTML = '<p>No hay suficientes datos para generar un reporte de corte.</p>';
    }
}

generateCutButton.addEventListener('click', generateCutReport);

async function generateCutReport() {
    const selectedWeekString = cutWeekSelect.value;
    const selectedEmployeeUid = cutEmployeeSelect.value;
    const selectedEmployeeName = allRecordsData.find(r => r.uid_empleada === selectedEmployeeUid)?.nombre_empleada_display || 'Empleada';

    if (!selectedWeekString || !selectedEmployeeUid) {
        cutReportOutput.innerHTML = '<p>Por favor, selecciona una semana y una empleada.</p>';
        return;
    }

    const filteredRecords = allRecordsData.filter(record => {
        const recordWeekString = record.fecha && record.fecha.toDate ? getWeekNumberString(record.fecha.toDate()) : null;
        return recordWeekString === selectedWeekString && record.uid_empleada === selectedEmployeeUid;
    });

    if (filteredRecords.length === 0) {
        cutReportOutput.innerHTML = `<p>No se encontraron transacciones para "${selectedEmployeeName}" en "${selectedWeekString}".</p>`;
        return;
    }

    let oficinaTotals = { servicios: 0, tarjetas: 0, uber: 0, extras: 0, efectivo: 0 };
    let empleadaTotals = { servicios: 0, tarjetas: 0, uber: 0, extras: 0, efectivo: 0 };
    const transactionsForComparison = [];

    const groupedTransactions = {};
    filteredRecords.forEach(record => {
        if (!groupedTransactions[record.no_servicio]) {
            groupedTransactions[record.no_servicio] = { oficina: null, empleada: null };
        }
        if (record.rol_registrador === 'admin' || record.rol_registrador === 'jefe') {
            groupedTransactions[record.no_servicio].oficina = record;
        } else if (record.rol_registrador === 'empleada') {
            groupedTransactions[record.no_servicio].empleada = record;
        }
    });

    Object.values(groupedTransactions).forEach(serviceGroup => {
        const oficinaRecord = serviceGroup.oficina;
        const empleadaRecord = serviceGroup.empleada;

        if (oficinaRecord && !oficinaRecord.cancelado) {
            oficinaTotals.servicios += oficinaRecord.total_servicio || 0;
            oficinaTotals.tarjetas += oficinaRecord.monto_tarjeta || 0;
            oficinaTotals.uber += (oficinaRecord.uber_ida || 0) + (oficinaRecord.uber_regreso || 0);
            let extrasAjustados = oficinaRecord.extra || 0;
            if (extrasAjustados >= 1000) {
                extrasAjustados = extrasAjustados * 0.85;
            }
            oficinaTotals.extras += extrasAjustados;
            oficinaTotals.efectivo += oficinaRecord.monto_efectivo || 0;
        }

        if (empleadaRecord && !empleadaRecord.cancelado) {
            empleadaTotals.servicios += empleadaRecord.total_servicio || 0;
            empleadaTotals.tarjetas += empleadaRecord.monto_tarjeta || 0;
            empleadaTotals.uber += (empleadaRecord.uber_ida || 0) + (empleadaRecord.uber_regreso || 0);
            let extrasAjustados = empleadaRecord.extra || 0;
            if (extrasAjustados >= 1000) {
                extrasAjustados = extrasAjustados * 0.85;
            }
            empleadaTotals.extras += extrasAjustados;
            empleadaTotals.efectivo += empleadaRecord.monto_efectivo || 0;
        }

        if (oficinaRecord || empleadaRecord) {
            transactionsForComparison.push(serviceGroup);
        }
    });

    let outputHtml = '';
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
    let oficinaFinalText = calcSinDeudaOficina < 0 ? `La empresa regresa: $${Math.abs(calcSinDeudaOficina).toFixed(2)}` : `Empleada regresa: $${calcSinDeudaOficina.toFixed(2)}`;
    let empleadaFinalText = calcSinDeudaEmpleada < 0 ? `La empresa regresa: $${Math.abs(calcSinDeudaEmpleada).toFixed(2)}` : `Empleada regresa: $${calcSinDeudaEmpleada.toFixed(2)}`;
    let oficinaFinalClass = calcSinDeudaOficina < 0 ? 'negative' : '';
    let empleadaFinalClass = calcSinDeudaEmpleada < 0 ? 'negative' : '';

    outputHtml += `
        <div class="cut-report-summary">
            <h3>Corte Final (Efectivo a entregar - Sin Deuda)</h3>
            <p><strong>Oficina:</strong> <span class="final-cut ${oficinaFinalClass}">${oficinaFinalText}</span></p>
            <p><strong>Empleada:</strong> <span class="final-cut ${empleadaFinalClass}">${empleadaFinalText}</span></p>
            <p><strong>Diferencia (Empleada - Oficina):</strong> <span class="final-cut ${diffCorteSinDeuda >= 0 ? 'positive-diff' : 'negative-diff'}">$${diffCorteSinDeuda.toFixed(2)}</span></p>
        </div>
    `;

    transactionsForComparison.sort((a, b) => (a.oficina?.no_servicio || a.empleada?.no_servicio) - (b.oficina?.no_servicio || b.empleada?.no_servicio));

    outputHtml += `
        <h3>Comparativa de Transacciones para ${selectedEmployeeName} (${selectedWeekString})</h3>
        <div class="cut-transactions-container">
            <table class="cut-transactions-table">
                <thead>
                    <tr>
                        <th>No. Servicio</th>
                        <th>Fecha</th>
                        <th>Horas (Oficina)</th>
                        <th>Horas (Empleada)</th>
                        <th>Total (Oficina)</th>
                        <th>Total (Empleada)</th>
                        <th>Efectivo (Oficina)</th>
                        <th>Efectivo (Empleada)</th>
                        <th>Tarjeta (Oficina)</th>
                        <th>Tarjeta (Empleada)</th>
                        <th>Extra (Oficina)</th>
                        <th>Extra (Empleada)</th>
                        <th>Lugar (Oficina)</th>
                        <th>Lugar (Empleada)</th>
                        <th>Uber (Oficina)</th>
                        <th>Uber (Empleada)</th>
                        <th>Chofer Ida (Oficina)</th>
                        <th>Chofer Ida (Empleada)</th>
                        <th>Chofer Regreso (Oficina)</th>
                        <th>Chofer Regreso (Empleada)</th>
                        <th>Cancelado (Oficina)</th>
                        <th>Cancelado (Empleada)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    transactionsForComparison.forEach(serviceGroup => {
        const oficina = serviceGroup.oficina;
        const empleada = serviceGroup.empleada;

        const date = (oficina?.fecha || empleada?.fecha)?.toDate().toLocaleDateString() || 'N/A';
        const noServicio = oficina?.no_servicio || empleada?.no_servicio || '';

        outputHtml += `
            <tr>
                <td>${noServicio}</td>
                <td>${date}</td>
                <td>${oficina?.horas_servicio?.toFixed(2) || ''}</td>
                <td>${empleada?.horas_servicio?.toFixed(2) || ''}</td>
                <td>$${oficina?.total_servicio?.toFixed(2) || ''}</td>
                <td>$${empleada?.total_servicio?.toFixed(2) || ''}</td>
                <td>$${oficina?.monto_efectivo?.toFixed(2) || ''}</td>
                <td>$${empleada?.monto_efectivo?.toFixed(2) || ''}</td>
                <td>$${oficina?.monto_tarjeta?.toFixed(2) || ''}</td>
                <td>$${empleada?.monto_tarjeta?.toFixed(2) || ''}</td>
                <td>$${oficina?.extra?.toFixed(2) || ''}</td>
                <td>$${empleada?.extra?.toFixed(2) || ''}</td>
                <td>${oficina?.lugar || ''}</td>
                <td>${empleada?.lugar || ''}</td>
                <td>$${((oficina?.uber_ida || 0) + (oficina?.uber_regreso || 0))?.toFixed(2) || ''}</td>
                <td>$${((empleada?.uber_ida || 0) + (empleada?.uber_regreso || 0))?.toFixed(2) || ''}</td>
                <td>${oficina?.chofer_ida || ''}</td>
                <td>${empleada?.chofer_ida || ''}</td>
                <td>${oficina?.chofer_regreso || ''}</td>
                <td>${empleada?.chofer_regreso || ''}</td>
                <td>${oficina?.cancelado ? 'Sí' : 'No'}</td>
                <td>${empleada?.cancelado ? 'Sí' : 'No'}</td>
            </tr>
        `;
    });

    outputHtml += `</tbody></table></div>`;
    cutReportOutput.innerHTML = outputHtml;
}

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
    editCanceladoCheckbox.checked = recordToEdit.cancelado;

    // Asignar el número de servicio al display
    document.getElementById('edit-no-servicio-display').textContent = recordToEdit.no_servicio || 'N/A';

    document.getElementById(`edit-pago-${recordToEdit.metodo_pago}`).checked = true;
    handleEditPaymentMethodChange();

    await cargarOpcionesModalEdicion(recordToEdit);
    editRecordModal.style.display = 'flex';
    editFeedbackMessage.style.display = 'none';
}

function handleEditPaymentMethodChange() {
    const metodoPago = document.querySelector('input[name="edit_metodo_pago"]:checked').value;
    const extraValue = parseFloat(document.getElementById('edit-extra').value) || 0;

    editMontoEfectivoField.style.display = (metodoPago === 'mixto') ? 'block' : 'none';
    editMontoTarjetaField.style.display = (metodoPago === 'mixto') ? 'block' : 'none';
    editBancoField.style.display = (metodoPago === 'tarjeta' || metodoPago === 'mixto' || extraValue > 0) ? 'block' : 'none';
}

editExtraInput.addEventListener('input', handleEditPaymentMethodChange);
editPagoRadios.forEach(radio => radio.addEventListener('change', handleEditPaymentMethodChange));

async function cargarOpcionesModalEdicion(record) {
    const [empleadasSnapshot, bancosSnapshot, lugaresSnapshot, choferesSnapshot] = await Promise.all([
        db.collection('usuarios').where('rol', '==', 'empleada').orderBy('nombre').get(),
        db.collection('bancos').orderBy('nombre').get(),
        db.collection('lugares').orderBy('nombre').get(),
        db.collection('choferes').orderBy('nombre').get()
    ]);

    editEmpleadaSelect.innerHTML = '<option value="">Selecciona una empleada</option>';
    empleadasSnapshot.forEach(doc => {
        const selected = (doc.id === record.uid_empleada) ? 'selected' : '';
        editEmpleadaSelect.innerHTML += `<option value="${doc.id}" ${selected}>${doc.data().nombre || doc.data().email}</option>`;
    });

    editBancoSelect.innerHTML = '<option value="">Selecciona un banco</option>';
    bancosSnapshot.forEach(doc => {
        const selected = (doc.data().nombre === record.banco) ? 'selected' : '';
        editBancoSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });

    editLugarSelect.innerHTML = '<option value="">Selecciona un lugar</option>';
    lugaresSnapshot.forEach(doc => {
        const selected = (doc.data().nombre === record.lugar) ? 'selected' : '';
        editLugarSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });

    editChoferIdaSelect.innerHTML = '<option value="">Selecciona un chofer</option>';
    editChoferRegresoSelect.innerHTML = '<option value="">Selecciona un chofer</option>';
    choferesSnapshot.forEach(doc => {
        const selectedIda = (doc.data().nombre === record.chofer_ida) ? 'selected' : '';
        const selectedRegreso = (doc.data().nombre === record.chofer_regreso) ? 'selected' : '';
        editChoferIdaSelect.innerHTML += `<option value="${doc.data().nombre}" ${selectedIda}>${doc.data().nombre}</option>`;
        editChoferRegresoSelect.innerHTML += `<option value="${doc.data().nombre}" ${selectedRegreso}>${doc.data().nombre}</option>`;
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

    const metodoPago = document.querySelector('input[name="edit_metodo_pago"]:checked').value;
    let montoEfectivo = (metodoPago === 'mixto' || metodoPago === 'efectivo') ? parseFloat(editMontoEfectivoInput.value) || 0 : 0;
    let montoTarjeta = (metodoPago === 'mixto') ? parseFloat(editMontoTarjetaInput.value) || 0 : 0;
    const totalServicio = parseFloat(editTotalServicioInput.value) || 0;

    if (metodoPago === 'tarjeta') {
        montoTarjeta = totalServicio;
        montoEfectivo = 0;
    }

    const banco = (metodoPago !== 'efectivo' || parseFloat(editExtraInput.value) > 0) ? editBancoSelect.value : '';

    const updatedData = {
        horas_servicio: parseFloat(editHorasServicioInput.value) || 0,
        total_servicio: totalServicio,
        metodo_pago: metodoPago,
        monto_efectivo: montoEfectivo,
        monto_tarjeta: montoTarjeta,
        banco: banco,
        extra: parseFloat(editExtraInput.value) || 0,
        lugar: editLugarSelect.value,
        uber_ida: parseFloat(editUberIdaInput.value) || 0,
        chofer_ida: editChoferIdaSelect.value,
        uber_regreso: parseFloat(editUberRegresoInput.value) || 0,
        chofer_regreso: editChoferRegresoSelect.value,
        cancelado: editCanceladoCheckbox.checked,
        uid_empleada: editEmpleadaSelect.value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.email
    };

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
    }

    try {
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


function parseMonetaryValue(value) {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ""));
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}
