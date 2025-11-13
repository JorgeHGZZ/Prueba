const firebaseConfig = {
    apiKey: "AIzaSyCmKS915zbGQSuWcB0Ww_AfJarsEitCWGs",
    authDomain: "classhub-7fcb1.firebaseapp.com",
    databaseURL: "https://classhub-7fcb1-default-rtdb.firebaseio.com",
    projectId: "classhub-7fcb1",
    storageBucket: "classhub-7fcb1.firebasestorage.app",
    messagingSenderId: "900567668775",
    appId: "1:900567668775:web:40b5af38f8a85113d75602",
    measurementId: "G-VG4Y7LDZF6"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getDatabase, ref, onDisconnect, onValue, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL }
    from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

const chatContainer = document.querySelector(".chat-container");
const chatInput = document.querySelector("#chatText");
const sendBtn = document.querySelector(".send-btn");

let grupoId = localStorage.getItem("grupoSeleccionado");

// === PRESENCIA EN TIEMPO REAL ===
function actualizarPresencia(user) {
    const userRef = ref(rtdb, `estado_usuarios/${user.uid}`);
    set(userRef, { estado: "online", ultimoVisto: Date.now() });
    onDisconnect(userRef).set({ estado: "offline", ultimoVisto: Date.now() });
}

// === ENVIAR MENSAJE ===
async function enviarMensaje(user) {
    const texto = chatInput.value.trim();
    if (texto === "") return;
    const mensajesRef = collection(db, "grupos", grupoId, "mensaje");

    await addDoc(mensajesRef, {
        texto,
        usuarioId: user.uid,
        usuarioImg: user.photoURL,
        usuarioNombre: user.displayName || user.email,
        timestamp: serverTimestamp(),
        estado: "entregado"
    });

    chatInput.value = "";
}

// === MOSTRAR MENSAJES EN TIEMPO REAL ===
function cargarMensajes() {
    const mensajesRef = collection(db, "grupos", grupoId, "mensaje");
    const q = query(mensajesRef, orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        chatContainer.innerHTML = "";
        usuariosEscuchados.clear(); // Resetea listeners al recargar

        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const esMio = msg.usuarioId === auth.currentUser.uid;
            const msgEl = document.createElement("div");
            msgEl.classList.add("message", esMio ? "right" : "left");

            const timestamp = msg.timestamp?.toDate?.()?.toLocaleTimeString() || "";

            msgEl.innerHTML = `
                <div class="bubble ${esMio ? "propio" : "ajeno"}">
                    <p>
                        ${msg.tipo === "ubicacion"
                    ? `
                    <iframe src="${msg.texto}&output=embed" width="250" height="150" style="border-radius:10px; border:none; margin-top:5px;"></iframe>`
                    : msg.tipo === "imagen"
                        ? `<img src="${msg.texto}" alt="imagen" class="img-msg" style="max-width:250px; border-radius:10px; cursor:pointer;">`
                        : msg.tipo === "archivo"
                            ? `<a href="${msg.texto}" target="_blank" class="file-link" style="display:flex;align-items:center;gap:6px;">
                        <span>${msg.nombreArchivo || "Archivo adjunto"}</span>
                        </a>`
                            : msg.texto
                }
                    </p>
                    <small>${msg.estado === "leído" ? "✔✔" : "✔"}</small>
                    <time>${timestamp}</time>
                </div>
                <div class="avatar-container">
                    <img src="${msg.usuarioImg || './assets/img/default-avatar.png'}" class="avatar" alt="avatar">
                    ${esMio ? "" : "<span class='status' id='status-" + msg.usuarioId + "'></span>"}
                </div>
            `;
            chatContainer.appendChild(msgEl);

            // Escuchar estado de ese usuario (solo una vez por usuario)
            escucharEstado(msg.usuarioId, `status-${msg.usuarioId}`);
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}


// === MARCAR MENSAJES COMO LEÍDOS ===
async function marcarLeidos() {
    const mensajesRef = collection(db, "grupos", grupoId, "mensaje");
    const q = query(mensajesRef, orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(async (docSnap) => {
            const msg = docSnap.data();
            if (msg.usuarioId !== auth.currentUser.uid && msg.estado !== "leído") {
                await updateDoc(doc(db, "grupos", grupoId, "mensaje", docSnap.id), { estado: "leído" });
            }
        });
    });
}


const usuariosEscuchados = new Set();

function escucharEstado(uid, elementId) {
    // No escuchar el estado del usuario actual
    if (uid === auth.currentUser.uid) {
        return;
    }

    // Si ya estamos escuchando este usuario, no registres otro listener
    if (usuariosEscuchados.has(uid)) {
        return;
    }
    usuariosEscuchados.add(uid);

    const estadoRef = ref(rtdb, `estado_usuarios/${uid}`);
    onValue(estadoRef, (snapshot) => {
        const data = snapshot.val();

        // Actualiza TODOS los spans con status de este usuario
        const todosLosStatus = document.querySelectorAll(`[id="status-${uid}"]`);

        todosLosStatus.forEach(statusEl => {
            if (statusEl && data) {
                statusEl.classList.remove("online", "away", "offline");

                const estado = data.estado === "online" ? "online" :
                    data.estado === "ausente" ? "away" :
                        "offline";
                statusEl.classList.add(estado);
            }
        });
    });
}

const userAvatar = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
        try {
            await signOut(auth);
        } catch (e) {
            console.error(e);
        }
    });
}



async function enviarUbicacion(user) {
    if (!navigator.geolocation) {
        alert("La geolocalización no es compatible con este navegador.");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const link = `https://www.google.com/maps?q=${lat},${lon}`;

        const mensajesRef = collection(db, "grupos", grupoId, "mensaje");
        await addDoc(mensajesRef, {
            texto: link,
            usuarioId: user.uid,
            usuarioImg: user.photoURL,
            usuarioNombre: user.displayName || user.email,
            timestamp: serverTimestamp(),
            estado: "entregado",
            tipo: "ubicacion"
        });
    }, (err) => {
        console.error("Error obteniendo ubicación:", err);
        alert("No se pudo obtener tu ubicación.");
    });
}

async function enviarImagen(user, file) {
    if (!file) return;

    const storagePath = `imagenes_chat/${grupoId}/${user.uid}_${Date.now()}_${file.name}`;
    const fileRef = sRef(storage, storagePath);

    try {
        // 🔹 Subir la imagen a Firebase Storage
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        // 🔹 Guardar mensaje en Firestore
        const mensajesRef = collection(db, "grupos", grupoId, "mensaje");
        await addDoc(mensajesRef, {
            texto: url, // el link de la imagen
            usuarioId: user.uid,
            usuarioImg: user.photoURL,
            usuarioNombre: user.displayName || user.email,
            timestamp: serverTimestamp(),
            estado: "entregado",
            tipo: "imagen"
        });

        console.log("Imagen enviada:", url);
    } catch (err) {
        console.error("Error al subir imagen:", err);
        alert("No se pudo enviar la imagen.");
    }
}

async function enviarArchivo(user, file) {
    if (!file) return;

    const storagePath = `archivos_chat/${grupoId}/${user.uid}_${Date.now()}_${file.name}`;
    const fileRef = sRef(storage, storagePath);

    try {
        // Subir archivo
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        // Guardar mensaje en Firestore
        const mensajesRef = collection(db, "grupos", grupoId, "mensaje");
        await addDoc(mensajesRef, {
            texto: url, // URL de descarga
            nombreArchivo: file.name, // Nombre original del archivo
            tipoArchivo: file.type,   // MIME type (pdf, docx, zip, etc.)
            usuarioId: user.uid,
            usuarioImg: user.photoURL,
            usuarioNombre: user.displayName || user.email,
            timestamp: serverTimestamp(),
            estado: "entregado",
            tipo: "archivo"
        });

        console.log("📎 Archivo enviado:", file.name);
    } catch (err) {
        console.error("Error al subir archivo:", err);
        alert("No se pudo enviar el archivo.");
    }
}

const btnUbicacion = document.getElementById("locationBtn");
const fileInput = document.getElementById("imagenInput");
const fileArchivo = document.getElementById("fileInput");

// === EVENTOS ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        btnLogout.style.display = "inline-block";
        try {
            const userDocRef = doc(db, "users", user.uid);
            const snap = await getDoc(userDocRef);
            if (snap.exists()) {
                const data = snap.data();
                // si Firestore tiene foto, úsala
                if (data.foto) userAvatar.src = data.foto;
            }
        } catch (e) {
            console.error("Error leyendo Firestore user doc:", e);
        }
        actualizarPresencia(user);
        cargarMensajes();
        marcarLeidos();

        fileArchivo.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) enviarArchivo(user, file);
        });
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) enviarImagen(user, file);
        });
        sendBtn.addEventListener("click", () => enviarMensaje(user));
        btnUbicacion.addEventListener("click", () => enviarUbicacion(user));
        chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") enviarMensaje(user);
        });
    } else {
        window.location.href = "login.html";
    }


});
