import { db } from './firebase-config.js';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp, runTransaction, increment, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Helper para obtener una referencia de documento fácilmente
export function getDocRef(collectionName, docId) {
    return doc(db, collectionName, docId);
}

// --- Funciones de Usuario ---

export async function createProvisionalUser(email, nombre, oficinaId) {
    const userDocRef = doc(db, 'usuarios', email);
    const oficinaRef = doc(db, 'oficinas', oficinaId);

    const userData = {
        email: email,
        nombre: nombre,
        rol: 'empleada',
        oficina: oficinaRef,
        estado: 'activo',
        createdAt: serverTimestamp()
    };
    await setDoc(userDocRef, userData);
}

export async function getUserProfile(userId, email) {
    const userDocRef = doc(db, 'usuarios', userId);
    let userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
        const userDocByEmailRef = doc(db, 'usuarios', email);
        const userDocByEmail = await getDoc(userDocByEmailRef);

        if (userDocByEmail.exists()) {
            console.log("Usuario provisional encontrado por email. Realizando migración a UID.");
            const provisionalData = userDocByEmail.data();
            await setDoc(userDocRef, provisionalData, { merge: true });
            await deleteDoc(userDocByEmailRef);
            userDoc = await getDoc(userDocRef);
        }
    }

    if (!userDoc.exists()) return null;

    const userData = userDoc.data();
    let oficinaData = null;
    if (userData.oficina && typeof userData.oficina.id === 'string') {
        const oficinaDoc = await getDoc(userData.oficina);
        if (oficinaDoc.exists()) {
            oficinaData = { id: oficinaDoc.id, ...oficinaDoc.data() };
        }
    }

    return { uid: userDoc.id, ...userData, oficina: oficinaData };
}


export async function updateUser(userId, dataToUpdate) {
    const userDocRef = doc(db, 'usuarios', userId);
    const finalData = { ...dataToUpdate };

    if (finalData.oficinaId && finalData.oficinaId !== "") {
        finalData.oficina = doc(db, 'oficinas', finalData.oficinaId);
    } else {
        finalData.oficina = null;
    }
    delete finalData.oficinaId;

    await updateDoc(userDocRef, finalData);
}

// CORRECCIÓN: Se simplifica la consulta para mayor robustez.
export async function getEmployeesByOffice(officeData) {
    if (!officeData || !officeData.id) {
        console.error("getEmployeesByOffice: No se proporcionó ID de oficina.");
        return [];
    }
    const officeRef = doc(db, 'oficinas', officeData.id);
    const q = query(collection(db, 'usuarios'),
        where('oficina', '==', officeRef),
        where('rol', '==', 'empleada'),
        orderBy('nombre')
    );
    const querySnapshot = await getDocs(q);
    const allEmployees = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Se filtra por estado en el lado del cliente para evitar consultas complejas.
    return allEmployees.filter(emp => emp.estado !== 'inactivo');
}

// --- Funciones de Registros ---

export async function addServiceRecord(recordData, registradorRole) {
    try {
        const { fecha, ...formData } = recordData;

        // La lógica de membresía solo se aplica si el que registra es jefe o admin
        if (formData.metodo_pago === 'membresia' && formData.membresia_id && (registradorRole === 'jefe' || registradorRole === 'admin')) {
            const membresiaRef = doc(db, 'membresias', formData.membresia_id);
            const horasADeducir = formData.horas_servicio;

            await runTransaction(db, async (transaction) => {
                const membresiaDoc = await transaction.get(membresiaRef);
                if (!membresiaDoc.exists()) throw "La membresía seleccionada ya no existe.";

                const horasActuales = membresiaDoc.data().horas_restantes;
                if (horasActuales < horasADeducir) throw "La membresía no tiene suficientes horas restantes.";

                transaction.update(membresiaRef, { horas_restantes: increment(-horasADeducir) });
            });
        }

        const finalData = {
            ...formData,
            fecha: fecha ? Timestamp.fromDate(fecha) : serverTimestamp()
        };

        await addDoc(collection(db, 'registros'), finalData);

        return { success: true };
    } catch (error) {
        console.error("Error al añadir registro o actualizar membresía: ", error);
        return { success: false, error: error.toString() };
    }
}


export function setupRecordsListener(user, callback) {
    let recordsQuery;
    const recordsCollection = collection(db, 'registros');

    if (user.customRole === 'admin') {
        recordsQuery = query(recordsCollection, orderBy('fecha', 'desc'));
    } else if (user.customRole === 'jefe') {
        recordsQuery = query(recordsCollection,
            where('uid_registrador', '==', user.uid),
            orderBy('fecha', 'desc'));
    } else { // Empleada
        recordsQuery = query(recordsCollection,
            where('uid_registrador', '==', user.uid),
            orderBy('fecha', 'desc'));
    }

    return onSnapshot(recordsQuery, callback, (error) => {
        console.error("Error listening to records:", error);
        callback({ docs: [] });
    });
}

export async function getRecordById(recordId) {
    const docRef = doc(db, "registros", recordId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function updateRecord(recordId, dataToUpdate) {
    const recordDocRef = doc(db, "registros", recordId);

    try {
        await runTransaction(db, async (transaction) => {
            const recordDoc = await transaction.get(recordDocRef);
            if (!recordDoc.exists()) throw "El registro que intentas editar ya no existe.";

            const originalData = recordDoc.data();
            const wasMembresia = originalData.metodo_pago === 'membresia';
            const isMembresia = dataToUpdate.metodo_pago === 'membresia';

            const canAffectMembresia = originalData.rol_registrador === 'jefe' || originalData.rol_registrador === 'admin';

            if (canAffectMembresia) {
                if (wasMembresia && !isMembresia && originalData.membresia_id) {
                    const membresiaRef = doc(db, 'membresias', originalData.membresia_id);
                    transaction.update(membresiaRef, { horas_restantes: increment(originalData.horas_servicio || 0) });
                }

                if (!wasMembresia && isMembresia && dataToUpdate.membresia_id) {
                    const membresiaRef = doc(db, 'membresias', dataToUpdate.membresia_id);
                    transaction.update(membresiaRef, { horas_restantes: increment(-(dataToUpdate.horas_servicio || 0)) });
                }

                if (wasMembresia && isMembresia) {
                    const originalHoras = originalData.horas_servicio || 0;
                    const nuevasHoras = dataToUpdate.horas_servicio || 0;
                    const diferenciaHoras = nuevasHoras - originalHoras;

                    if (originalData.membresia_id === dataToUpdate.membresia_id && diferenciaHoras !== 0) {
                        const membresiaRef = doc(db, 'membresias', originalData.membresia_id);
                        transaction.update(membresiaRef, { horas_restantes: increment(-diferenciaHoras) });
                    } else if (originalData.membresia_id !== dataToUpdate.membresia_id) {
                        if(originalData.membresia_id) {
                            const membresiaAntiguaRef = doc(db, 'membresias', originalData.membresia_id);
                            transaction.update(membresiaAntiguaRef, { horas_restantes: increment(originalHoras) });
                        }
                        if(dataToUpdate.membresia_id) {
                            const membresiaNuevaRef = doc(db, 'membresias', dataToUpdate.membresia_id);
                            transaction.update(membresiaNuevaRef, { horas_restantes: increment(-nuevasHoras) });
                        }
                    }
                }
            }

            transaction.update(recordDocRef, dataToUpdate);
        });
        return { success: true };
    } catch (error) {
        console.error("Error al actualizar el registro:", error);
        return { success: false, error: error.toString() };
    }
}


export async function deleteRecord(recordId) {
    const recordDocRef = doc(db, "registros", recordId);
    await deleteDoc(recordDocRef);
}

// --- Funciones de Catálogos ---

export async function getCatalog(collectionName, filters = null, sort = true) {
    let constraints = [];
    let inequalityField = null;

    if (filters) {
        const filterArray = Array.isArray(filters) ? filters : [filters];
        filterArray.forEach(filter => {
            constraints.push(where(filter.field, filter.operator, filter.value));
            if (['<', '<=', '!=', 'not-in', '>', '>='].includes(filter.operator)) {
                inequalityField = filter.field;
            }
        });
    }

    if (sort) {
        if (inequalityField) {
            constraints.push(orderBy(inequalityField));
        }
        constraints.push(orderBy('nombre'));
    }

    const q = query(collection(db, collectionName), ...constraints);

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


export async function addCatalogItem(collectionName, data) {
    const id = data.nombre.toUpperCase().replace(/\s/g, '_');
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, data);
}

export async function addMembership(nombre, horas) {
    const id = nombre.toUpperCase().replace(/\s/g, '_') + '_' + Date.now();
    const docRef = doc(db, 'membresias', id);
    await setDoc(docRef, {
        nombre: nombre,
        horas_totales: horas,
        horas_restantes: horas,
        fecha_creacion: serverTimestamp()
    });
}

export async function updateMembership(membresiaId, dataToUpdate) {
    const membresiaDocRef = doc(db, "membresias", membresiaId);
    await updateDoc(membresiaDocRef, dataToUpdate);
}


export async function deleteCatalogItem(collectionName, docId) {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
}

// --- Funciones de Ayuda para Fechas ---
export function getStartAndEndOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(d.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { start: startOfWeek, end: endOfWeek };
}

export function getStartAndEndOfMonth(date) {
    const d = new Date(date);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

export function getWeekInfoFromString(weekString) {
    const year = new Date().getFullYear();
    const weekNumber = parseInt(weekString.replace('Semana ', ''), 10);
    if (isNaN(weekNumber)) return null;

    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = (weekNumber - 1) * 7;
    let date = new Date(firstDayOfYear.getTime() + daysOffset * 86400000);
    date.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1));

    return getStartAndEndOfWeek(date);
}
