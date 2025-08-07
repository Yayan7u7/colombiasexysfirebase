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
const feedbackMessage = document.getElementById('feedback-message');
const adminPanel = document.getElementById('admin-panel');

// Elementos para la sección de registros
const recordsList = document.getElementById('records-list');

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


// Listas para el panel de administración
const userList = document.getElementById('user-list');
const oficinaList = document.getElementById('oficina-list');
const lugaresListAdmin = document.getElementById('lugares-list');
const bancosListAdmin = document.getElementById('bancos-list');
const choferesListAdmin = document.getElementById('choferes-list');

// Variables globales para almacenar las opciones de los dropdowns
let oficinasDisponibles = [];
let usuariosDisponibles = []; // Para el admin panel
let unsubscribeFromRecords = null; // Para desuscribirse de los listeners de registros
let allRecordsData = []; // Para almacenar todos los registros para los cálculos de corte

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
        // Usuario logueado
        authContainer.style.display = 'none';
        mainContainer.style.display = 'block';
        userEmailSpan.textContent = user.email;

        try {
            // Obtener el rol del usuario desde Firestore
            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const rol = userData.rol || 'empleada'; // Default a empleada si no hay rol
                userRoleSpan.textContent = rol.charAt(0).toUpperCase() + rol.slice(1); // Capitalizar rol

                // Adjuntar el rol y la referencia de oficina al objeto de usuario para fácil acceso
                user.customRole = rol;
                user.oficinaRef = userData.oficina; // Esto es una DocumentReference de Firestore

                handleUserRole(user);
                await cargarDatosFormulario(user); // Cargar datos del formulario según el rol

                // Iniciar el listener de registros después de que el rol y la oficina estén cargados
                setupRecordsListener(user);

                // Cargar datos para la sección de corte si es admin
                if (user.customRole === 'admin') {
                    await loadCutSectionData();
                }

            } else {
                // Si el usuario no tiene un documento en Firestore, es un nuevo inicio de sesión.
                // Se le asigna un rol por defecto y se crea su documento.
                user.customRole = 'empleada';
                userRoleSpan.textContent = 'Empleada (Pendiente de Asignación)';
                handleUserRole(user);
                await db.collection('usuarios').doc(user.uid).set({
                    email: user.email,
                    nombre: user.displayName || user.email.split('@')[0],
                    rol: 'empleada', // Rol por defecto
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }); // Usar merge para no sobrescribir si ya existe
                mostrarMensaje('error', 'Tu rol no está configurado. Contacta al administrador.');
                await cargarDatosFormulario(user); // Cargar formulario con rol por defecto

                // Iniciar el listener de registros después de crear el documento
                setupRecordsListener(user);
            }
        } catch (error) {
            console.error("Error al obtener o configurar el rol del usuario:", error);
            mostrarMensaje('error', 'Error al cargar tu perfil. Inténtalo de nuevo.');
            auth.signOut(); // Cerrar sesión si hay un error crítico
        }
    } else {
        // Usuario no logueado
        authContainer.style.display = 'block';
        mainContainer.style.display = 'none';
        userEmailSpan.textContent = '';
        userRoleSpan.textContent = '';
        serviceForm.reset();
        feedbackMessage.style.display = 'none';
        // Desuscribirse de los listeners de registros al cerrar sesión
        if (unsubscribeFromRecords) {
            unsubscribeFromRecords();
            unsubscribeFromRecords = null;
        }
        recordsList.innerHTML = ''; // Limpiar la lista de registros
        cutReportOutput.innerHTML = '<p>Selecciona una semana y una empleada para generar el reporte de corte.</p>';
        cutSection.style.display = 'none'; // Ocultar sección de corte
    }
});

// --- Lógica de interfaz basada en el rol del usuario ---
function handleUserRole(user) {
    // Si es jefe, mostrar el campo de "Trabajadora"
    if (user.customRole === 'jefe') {
        empleadaField.style.display = 'block';
    } else {
        empleadaField.style.display = 'none';
    }

    // Si es admin, mostrar el panel de administración y la sección de corte
    if (user.customRole === 'admin') {
        adminPanel.style.display = 'block';
        cutSection.style.display = 'block';
        cargarPanelAdministracion(); // Cargar datos específicos del admin
    } else {
        adminPanel.style.display = 'none';
        cutSection.style.display = 'none';
    }
}

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

        // Cargar Bancos
        const bancosSelect = document.getElementById('banco');
        bancosSelect.innerHTML = '<option value="">Selecciona un banco</option>';
        const bancosSnapshot = await db.collection('bancos').orderBy('nombre').get();
        bancosSnapshot.forEach(doc => {
            bancosSelect.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`;
        });

        // Cargar Choferes
        const choferesSelectIda = document.getElementById('chofer_ida');
        const choferesSelectRegreso = document.getElementById('chofer_regreso');
        choferesSelectIda.innerHTML = '<option value="">Selecciona un chofer</option>';
        choferesSelectRegreso.innerHTML = '<option value="">Selecciona un chofer</option>';
        const choferesSnapshot = await db.collection('choferes').orderBy('nombre').get();
        choferesSnapshot.forEach(doc => {
            choferesSelectIda.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`;
            choferesSelectRegreso.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`;
        });

        // Cargar Empleadas (solo si el rol es 'jefe')
        if (user.customRole === 'jefe') {
            const empleadasSelect = document.getElementById('empleada');
            empleadasSelect.innerHTML = '<option value="">Selecciona una empleada</option>';
            if (user.oficinaRef) { // Asegurarse de que el jefe tiene una oficina asignada
                // Obtener las empleadas de la misma oficina que el jefe
                const empleadasSnapshot = await db.collection('usuarios')
                    .where('oficina', '==', user.oficinaRef) // Filtrar por la referencia de la oficina
                    .where('rol', '==', 'empleada')
                    .orderBy('nombre')
                    .get();
                empleadasSnapshot.forEach(doc => {
                    empleadasSelect.innerHTML += `<option value="${doc.id}">${doc.data().nombre || doc.data().email}</option>`;
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

// --- Lógica de Envío del Formulario de Servicio ---
serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    const userRole = user.customRole; // Usar el rol personalizado

    // Obtener los datos del formulario
    const formData = {
        fecha: firebase.firestore.FieldValue.serverTimestamp(), // Fecha del servidor
        horas_servicio: parseFloat(document.getElementById('horas_servicio').value) || 0,
        total_servicio: parseFloat(document.getElementById('total_servicio').value) || 0,
        monto_efectivo: parseFloat(document.getElementById('monto_efectivo').value) || 0,
        monto_tarjeta: parseFloat(document.getElementById('monto_tarjeta').value) || 0,
        banco: document.getElementById('banco').value,
        extra: parseFloat(document.getElementById('extra').value) || 0,
        lugar: document.getElementById('lugar').value,
        uber_ida: parseFloat(document.getElementById('uber_ida').value) || 0,
        chofer_ida: document.getElementById('chofer_ida').value,
        uber_regreso: parseFloat(document.getElementById('uber_regreso').value) || 0,
        chofer_regreso: document.getElementById('chofer_regreso').value,
        uid: user.uid, // ID del usuario que registra el servicio (registrador)
        email_registrador: user.email,
        rol_registrador: userRole,
        nombre_registrador: user.displayName || user.email.split('@')[0]
    };

    // Si el rol es jefe, se registra el servicio a nombre de la empleada seleccionada
    if (userRole === 'jefe') {
        const empleadaUidSeleccionada = document.getElementById('empleada').value;
        if (!empleadaUidSeleccionada) {
            mostrarMensaje('error', 'Por favor, selecciona una trabajadora.');
            return;
        }
        // Obtener datos de la empleada seleccionada
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
        // Si el rol es empleado, el servicio se registra a su propio nombre
        formData.uid_empleada = user.uid;
        formData.email_empleada = user.email;
        formData.nombre_empleada = user.displayName || user.email.split('@')[0];
    }

    // Guardar en Firestore
    try {
        await db.collection('registros').add(formData);
        serviceForm.reset();
        mostrarMensaje('success', '✅ Servicio registrado con éxito!');
        // Volver a cargar los datos para limpiar el formulario de Jefes (si aplica)
        if (userRole === 'jefe') {
            await cargarDatosFormulario(user); // Recargar para limpiar el selector de empleadas
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
        // Cargar oficinas disponibles primero, ya que se usan en la lista de usuarios
        oficinasDisponibles = [];
        const oficinasSnapshot = await db.collection('oficinas').orderBy('nombre').get();
        oficinasSnapshot.forEach(doc => {
            oficinasDisponibles.push({ id: doc.id, ...doc.data() });
        });
        renderOficinaList(); // Renderizar lista de oficinas

        // Cargar usuarios
        usuariosDisponibles = []; // Reiniciar la lista de usuarios
        const usersSnapshot = await db.collection('usuarios').get();
        usersSnapshot.forEach(doc => {
            usuariosDisponibles.push({ id: doc.id, ...doc.data() });
        });
        renderUserList(); // Renderizar lista de usuarios

        // Cargar y renderizar catálogos
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
        // Buscar el nombre de la oficina usando la referencia
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

// --- Funciones de Gestión de Usuarios (Admin) ---
let usuarioEditandoId = null; // Para saber qué usuario estamos editando

function mostrarEditarUsuario(userId) {
    usuarioEditandoId = userId;
    const user = usuariosDisponibles.find(u => u.id === userId);
    if (!user) return;

    const li = userList.querySelector(`li button[onclick="mostrarEditarUsuario('${userId}')"]`).parentNode;

    // Remover cualquier formulario de edición existente
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
        await cargarPanelAdministracion(); // Recargar la lista de usuarios y oficinas
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

// --- Funciones de Gestión de Oficinas (Admin) ---
async function agregarOficina() {
    const nombre = document.getElementById('nueva-oficina-nombre').value.trim();
    if (!nombre) {
        mostrarMensaje('error', 'El nombre de la oficina es obligatorio.');
        return;
    }
    const oficinaId = nombre.toUpperCase().replace(/\s/g, '_'); // Generar ID consistente
    try {
        await db.collection('oficinas').doc(oficinaId).set({ nombre: nombre });
        mostrarMensaje('success', `Oficina "${nombre}" agregada.`);
        document.getElementById('nueva-oficina-nombre').value = '';
        await cargarPanelAdministracion(); // Recargar el panel para actualizar listas
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
        await cargarPanelAdministracion(); // Recargar el panel
    } catch (error) {
        console.error("Error al eliminar oficina:", error);
        mostrarMensaje('error', 'Error al eliminar oficina.');
    }
}

// --- Funciones de Gestión de Catálogos (Admin) ---
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
    const itemId = nombreTrimmed.toUpperCase().replace(/\s/g, '_'); // Generar ID consistente
    try {
        await db.collection(coleccion).doc(itemId).set({ nombre: nombreTrimmed });
        mostrarMensaje('success', `"${nombreTrimmed}" agregado a ${coleccion}.`);
        inputElement.value = ''; // Limpiar input
        await cargarDatosFormulario(auth.currentUser); // Recargar dropdowns del formulario principal
        await cargarYRenderizarCatalogo(coleccion, document.getElementById(`${coleccion}-list`)); // Recargar lista del admin panel
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
        await cargarDatosFormulario(auth.currentUser); // Recargar dropdowns del formulario principal
        await cargarYRenderizarCatalogo(coleccion, document.getElementById(`${coleccion}-list`)); // Recargar lista del admin panel
    } catch (error) {
        console.error(`Error al eliminar de ${coleccion}:`, error);
        mostrarMensaje('error', `Error al eliminar de ${coleccion}.`);
    }
}

// --- Función para configurar el listener de registros ---
async function setupRecordsListener(user) {
    // Si ya hay un listener activo, desuscribirse primero para evitar duplicados
    if (unsubscribeFromRecords) {
        unsubscribeFromRecords();
    }

    let recordsQuery = db.collection('registros').orderBy('fecha', 'desc');

    // Aplicar filtros según el rol del usuario
    if (user.customRole === 'empleada') {
        // La empleada solo ve sus propios registros (los que tienen su UID como uid_empleada)
        recordsQuery = recordsQuery.where('uid_empleada', '==', user.uid);
    } else if (user.customRole === 'jefe') {
        // El jefe ve los registros de las empleadas en su misma oficina
        // La regla de seguridad ya se encarga de filtrar lo que el jefe puede leer.
        // No añadimos aquí un where('oficina', '==', user.oficinaRef) porque 'registros' no tiene ese campo.
        // Solo necesitamos el UID del jefe para la regla de seguridad, no para la consulta aquí.
    }
    // Para el admin, la consulta no necesita filtros adicionales, ya que ve todo.

    // Escuchar los cambios en tiempo real
    unsubscribeFromRecords = recordsQuery.onSnapshot(async (snapshot) => {
        recordsList.innerHTML = ''; // Limpiar la lista actual
        allRecordsData = []; // Limpiar y rellenar los datos para el corte

        // Obtener los UIDs de todas las empleadas para poder buscar sus nombres si es necesario
        const allUsersSnapshot = await db.collection('usuarios').get();
        const allUsersMap = new Map();
        allUsersSnapshot.forEach(doc => {
            allUsersMap.set(doc.id, doc.data());
        });

        snapshot.forEach(doc => {
            const record = doc.data();
            const recordId = doc.id;
            const date = record.fecha ? record.fecha.toDate().toLocaleString() : 'Fecha no disponible';

            // Determinar el nombre de la empleada a cargo
            const empleadaData = allUsersMap.get(record.uid_empleada);
            const nombreEmpleada = empleadaData ? (empleadaData.nombre || empleadaData.email) : 'Desconocida';

            // Añadir el registro a la lista de todos los registros (para el corte)
            allRecordsData.push({ id: recordId, ...record, nombre_empleada_display: nombreEmpleada });

            const li = document.createElement('li');
            li.className = 'record-item';
            li.innerHTML = `
                <p><strong>Trabajadora:</strong> <span class="record-value">${nombreEmpleada}</span></p>
                <p><strong>Horas de Servicio:</strong> <span class="record-value">${record.horas_servicio}</span></p>
                <p><strong>Total del Servicio:</strong> <span class="record-value">$${record.total_servicio.toFixed(2)}</span></p>
                <p><strong>Monto Efectivo:</strong> <span class="record-value">$${record.monto_efectivo.toFixed(2)}</span></p>
                <p><strong>Monto Tarjeta:</strong> <span class="record-value">$${record.monto_tarjeta.toFixed(2)}</span></p>
                <p><strong>Banco:</strong> <span class="record-value">${record.banco || 'N/A'}</span></p>
                <p><strong>Extra:</strong> <span class="record-value">$${record.extra.toFixed(2)}</span></p>
                <p><strong>Lugar:</strong> <span class="record-value">${record.lugar}</span></p>
                <p><strong>Uber Ida:</strong> <span class="record-value">$${record.uber_ida.toFixed(2)}</span></p>
                <p><strong>Chofer Ida:</strong> <span class="record-value">${record.chofer_ida || 'N/A'}</span></p>
                <p><strong>Uber Regreso:</strong> <span class="record-value">$${record.uber_regreso.toFixed(2)}</span></p>
                <p><strong>Chofer Regreso:</strong> <span class="record-value">${record.chofer_regreso || 'N/A'}</span></p>
                <div class="record-meta">
                    <p>Registrado por: ${record.nombre_registrador} (${record.rol_registrador}) el ${date}</p>
                </div>
                ${user.customRole === 'admin' ? `<button onclick="editRecord('${recordId}')" style="background-color: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-top: 10px;">Editar</button>` : ''}
            `;
            recordsList.appendChild(li);
        });

        if (snapshot.empty) {
            recordsList.innerHTML = '<p>No hay registros de servicios disponibles.</p>';
        }

        // Si el usuario es admin, actualizar los selectores de corte
        if (user.customRole === 'admin') {
            updateCutSelectors();
        }

    }, (error) => {
        console.error("Error al cargar registros:", error);
        mostrarMensaje('error', 'Error al cargar los registros de servicios. Permisos insuficientes.');
        recordsList.innerHTML = '<p>Error al cargar los registros. Verifica tus permisos.</p>';
    });
}

// --- Lógica para la sección de Corte (solo para Administradores) ---

// Helper para calcular la semana del año
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - (current day number + 3) % 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() + 6) % 7);
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `Semana ${weekNo}`;
}

async function loadCutSectionData() {
    // Los datos ya están en allRecordsData gracias al setupRecordsListener
    // Solo necesitamos poblar los selectores
    updateCutSelectors();
}

function updateCutSelectors() {
    const weeks = new Set();
    const employees = new Set();

    allRecordsData.forEach(record => {
        if (record.fecha && record.fecha.toDate) {
            weeks.add(getWeekNumber(record.fecha.toDate()));
        }
        // Incluir tanto registradores como empleadas a cargo en la lista de empleados para el corte
        if (record.nombre_empleada_display && record.nombre_empleada_display !== 'Desconocida') {
            employees.add(record.nombre_empleada_display);
        }
        if (record.nombre_registrador && record.nombre_registrador !== 'Desconocida') { // También el registrador
            employees.add(record.nombre_registrador);
        }
    });

    const sortedWeeks = Array.from(weeks).sort((a, b) => {
        const numA = parseInt(a.replace('Semana ', ''), 10);
        const numB = parseInt(b.replace('Semana ', ''), 10);
        return numA - numB;
    });

    const sortedEmployees = Array.from(employees).sort();

    // Poblar selector de semanas
    cutWeekSelect.innerHTML = '<option value="">Selecciona una semana</option>';
    sortedWeeks.forEach(week => {
        cutWeekSelect.innerHTML += `<option value="${week}">${week}</option>`;
    });
    if (sortedWeeks.length > 0) {
        cutWeekSelect.value = sortedWeeks[sortedWeeks.length - 1]; // Seleccionar la última semana por defecto
    }

    // Poblar selector de empleadas
    cutEmployeeSelect.innerHTML = '<option value="">Selecciona una empleada</option>';
    sortedEmployees.forEach(employee => {
        cutEmployeeSelect.innerHTML += `<option value="${employee}">${employee}</option>`;
    });
    if (sortedEmployees.length > 0) {
        cutEmployeeSelect.value = sortedEmployees[0]; // Seleccionar la primera empleada por defecto
    }

    // Generar corte inicial si hay datos
    if (sortedWeeks.length > 0 && sortedEmployees.length > 0) {
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

    // Filtrar registros para la semana y empleada seleccionadas
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
        servicios: 0,
        tarjetas: 0,
        uber: 0,
        extras: 0, // Este total acumulará los extras ya ajustados
        efectivo: 0,
        pagosPorTipo: {}
    };

    let empleadaTotals = {
        servicios: 0,
        tarjetas: 0,
        uber: 0,
        extras: 0, // Este total acumulará los extras ya ajustados
        efectivo: 0,
        pagosPorTipo: {}
    };

    // Usaremos un mapa para agrupar transacciones por un identificador único,
    // y para la tabla comparativa, mostraremos un contador secuencial.
    const transactionsForComparison = []; // Almacenará los datos para la tabla comparativa

    filteredRecords.forEach(record => {
        const total = record.total_servicio || 0;
        const montoTarjetas = record.monto_tarjeta || 0;
        const uber = (record.uber_ida || 0) + (record.uber_regreso || 0); // Sumar ambos ubers
        const efectivo = record.monto_efectivo || 0;
        const banco = record.banco || 'N/A'; // Usar banco como medio de pago si no hay otro más específico

        // --- LÓGICA DE AJUSTE DE EXTRAS POR SERVICIO (PARA TOTALES) ---
        let extrasOriginal = record.extra || 0;
        let extrasAjustados = extrasOriginal;
        if (extrasOriginal >= 1000) {
            extrasAjustados = extrasOriginal * 0.85;
        }
        // --- FIN LÓGICA DE AJUSTE (PARA TOTALES) ---

        // Asignar a totales de oficina o empleada
        // Si el registrador es el admin o jefe, se considera "Oficina".
        if (record.rol_registrador === 'admin' || record.rol_registrador === 'jefe') {
            oficinaTotals.servicios += total;
            oficinaTotals.tarjetas += montoTarjetas;
            oficinaTotals.uber += uber;
            oficinaTotals.extras += extrasAjustados;
            oficinaTotals.efectivo += efectivo;
            oficinaTotals.pagosPorTipo[banco] = (oficinaTotals.pagosPorTipo[banco] || 0) + total;
        }

        // Si el registro es atribuido a la empleada seleccionada para el corte
        if (record.nombre_empleada_display === selectedEmployee) {
            empleadaTotals.servicios += total;
            empleadaTotals.tarjetas += montoTarjetas;
            empleadaTotals.uber += uber;
            empleadaTotals.extras += extrasAjustados;
            empleadaTotals.efectivo += efectivo;
            empleadaTotals.pagosPorTipo[banco] = (empleadaTotals.pagosPorTipo[banco] || 0) + total;
        }

        // Para la tabla comparativa de transacciones, necesitamos los datos de cada registro
        // Aquí no agrupamos por "No. de Trabajo" sino que listamos cada registro relevante.
        transactionsForComparison.push(record);
    });

    // --- Renderizar el reporte ---
    let outputHtml = '';

    // Sección: Corte Comparativo (Oficina vs Empleada)
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

    // Cálculo final del corte
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

    // Sección: Tabla Comparativa de Transacciones
    outputHtml += `
        <h3>Comparativa de Transacciones para ${selectedEmployee} (${selectedWeek})</h3>
        <div class="cut-transactions-container"> <!-- Contenedor para scroll horizontal -->
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

    // Ordenar transacciones por fecha para un reporte más coherente
    transactionsForComparison.sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime());

    transactionsForComparison.forEach((record, index) => {
        // Usamos el mismo registro para ambas columnas si no hay un par explícito
        // En tu script de Sheets, el "No. de Trabajo" agrupaba. Aquí, cada fila es un registro.
        // Si necesitas comparar un registro de "Jefe" con un registro de "Empleado" que son el MISMO servicio,
        // necesitarías un campo común (como el "No. de Trabajo" original) en Firestore.
        // Por ahora, mostraremos cada registro individualmente en la tabla.

        const fecha = record.fecha ? record.fecha.toDate().toLocaleDateString() : 'N/A';
        const horas = record.horas_servicio?.toFixed(2) || '0.00';
        const total = record.total_servicio?.toFixed(2) || '0.00';
        const efectivo = record.monto_efectivo?.toFixed(2) || '0.00';
        const tarjeta = record.monto_tarjeta?.toFixed(2) || '0.00';
        const extras = record.extra?.toFixed(2) || '0.00'; // Mostrar el original para la tabla
        const lugar = record.lugar || 'N/A';
        const uber = ((record.uber_ida || 0) + (record.uber_regreso || 0))?.toFixed(2) || '0.00';
        const banco = record.banco || 'N/A';

        // Determinar si el registro actual es de "Oficina" o "Empleada" para esta tabla
        const isOfficeRecord = (record.rol_registrador === 'admin' || record.rol_registrador === 'jefe');
        const isEmployeeRecord = (record.nombre_empleada_display === selectedEmployee);

        outputHtml += `
            <tr>
                <td>${index + 1}</td> <!-- Contador secuencial para la tabla -->
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
// Esta función mostrará un modal o un formulario inline para editar el registro.
async function editRecord(recordId) {
    const recordToEdit = allRecordsData.find(record => record.id === recordId);
    if (!recordToEdit) {
        mostrarMensaje('error', 'Registro no encontrado para editar.');
        return;
    }

    // Precargar los datos en el formulario del modal
    editRecordIdInput.value = recordToEdit.id;
    editHorasServicioInput.value = recordToEdit.horas_servicio;
    editTotalServicioInput.value = recordToEdit.total_servicio;
    editMontoEfectivoInput.value = recordToEdit.monto_efectivo;
    editMontoTarjetaInput.value = recordToEdit.monto_tarjeta;
    editExtraInput.value = recordToEdit.extra;
    editUberIdaInput.value = recordToEdit.uber_ida;
    editUberRegresoInput.value = recordToEdit.uber_regreso;

    // Cargar y seleccionar opciones para los dropdowns del modal
    await cargarOpcionesModalEdicion(recordToEdit);

    // Mostrar el modal
    editRecordModal.style.display = 'flex'; // Usar flex para centrar

    // Mostrar mensaje de feedback del modal (oculto por defecto)
    editFeedbackMessage.style.display = 'none';
}

// Función para cargar las opciones de los selectores dentro del modal de edición
async function cargarOpcionesModalEdicion(record) {
    // Cargar Empleadas
    editEmpleadaSelect.innerHTML = '<option value="">Selecciona una empleada</option>';
    const empleadasSnapshot = await db.collection('usuarios').where('rol', '==', 'empleada').orderBy('nombre').get();
    empleadasSnapshot.forEach(doc => {
        const selected = (doc.id === record.uid_empleada) ? 'selected' : '';
        editEmpleadaSelect.innerHTML += `<option value="${doc.id}" ${selected}>${doc.data().nombre || doc.data().email}</option>`;
    });

    // Cargar Bancos
    editBancoSelect.innerHTML = '<option value="">Selecciona un banco</option>';
    const bancosSnapshot = await db.collection('bancos').orderBy('nombre').get();
    bancosSnapshot.forEach(doc => {
        const selected = (doc.data().nombre === record.banco) ? 'selected' : '';
        editBancoSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });

    // Cargar Lugares
    editLugarSelect.innerHTML = '<option value="">Selecciona un lugar</option>';
    const lugaresSnapshot = await db.collection('lugares').orderBy('nombre').get();
    lugaresSnapshot.forEach(doc => {
        const selected = (doc.data().nombre === record.lugar) ? 'selected' : '';
        editLugarSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });

    // Cargar Choferes Ida
    editChoferIdaSelect.innerHTML = '<option value="">Selecciona un chofer</option>';
    const choferesSnapshotIda = await db.collection('choferes').orderBy('nombre').get();
    choferesSnapshotIda.forEach(doc => {
        const selected = (doc.data().nombre === record.chofer_ida) ? 'selected' : '';
        editChoferIdaSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });

    // Cargar Choferes Regreso
    editChoferRegresoSelect.innerHTML = '<option value="">Selecciona un chofer</option>';
    const choferesSnapshotRegreso = await db.collection('choferes').orderBy('nombre').get();
    choferesSnapshotRegreso.forEach(doc => {
        const selected = (doc.data().nombre === record.chofer_regreso) ? 'selected' : '';
        editChoferRegresoSelect.innerHTML += `<option value="${doc.data().nombre}" ${selected}>${doc.data().nombre}</option>`;
    });
}

// Función para cerrar el modal de edición
function closeEditRecordModal() {
    editRecordModal.style.display = 'none';
    editRecordForm.reset(); // Limpiar el formulario al cerrar
    editFeedbackMessage.style.display = 'none';
}

// Listener para guardar los cambios del formulario del modal
editRecordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const recordId = editRecordIdInput.value;
    const user = auth.currentUser; // El usuario actual (admin)

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
        // Actualizar la empleada a cargo si se cambió
        uid_empleada: editEmpleadaSelect.value,
        // No se actualiza la fecha ni el registrador original
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), // Añadir timestamp de actualización
        updatedBy: user.email // Registrar quién lo actualizó
    };

    try {
        // Obtener datos de la nueva empleada seleccionada (si cambió)
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
            // Si se deselecciona la empleada, limpiar los campos relacionados
            updatedData.uid_empleada = '';
            updatedData.email_empleada = '';
            updatedData.nombre_empleada = '';
        }


        await db.collection('registros').doc(recordId).update(updatedData);
        mostrarMensajeModal('success', 'Registro actualizado con éxito!');
        // CERRAR EL MODAL DESPUÉS DE UN SEGUNDO
        setTimeout(() => {
            closeEditRecordModal();
        }, 1000); // Cierra después de 1 segundo para que el usuario vea el mensaje

    } catch (error) {
        console.error("Error al actualizar registro:", error);
        mostrarMensajeModal('error', 'Error al actualizar registro. Inténtalo de nuevo.');
    }
});

// Función para mostrar mensajes dentro del modal
function mostrarMensajeModal(tipo, mensaje) {
    editFeedbackMessage.textContent = mensaje;
    editFeedbackMessage.className = '';
    editFeedbackMessage.classList.add(tipo);
    editFeedbackMessage.style.display = 'block';
    // Opcional: ocultar después de un tiempo
    setTimeout(() => {
        editFeedbackMessage.style.display = 'none';
    }, 4000);
}


// --- Parseo de valores monetarios (para asegurar que sean números) ---
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
