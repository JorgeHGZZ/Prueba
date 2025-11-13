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
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, doc, getDoc, updateDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getDatabase, ref, onDisconnect, onValue, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import { startAt, endAt, limit, where, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

let currentUser = null;
let currentUserId = null;
let currentChatId = null;
let destinatarioId = null;

// Obtener usuario actual
onAuthStateChanged(auth, async (user) => {
    if (user) {
        escucharLlamadasEntrantes(user.uid);
        currentUser = user;
        actualizarPresencia(user);

        btnLogout.style.display = "inline-block";
        try {
            const userDocRef = doc(db, "users", user.uid);
            const snap = await getDoc(userDocRef);
            if (snap.exists()) {
                const data = snap.data();
                // si Firestore tiene foto, úsala
                currentUser = data;
                if (data.foto) userAvatar.src = data.foto;
            }
        } catch (e) {
            console.error("Error leyendo Firestore user doc:", e);
        }
        cargarListaChats(user.uid);
        currentUserId = user.uid;
    } else {
        console.log("No hay usuario autenticado");
    }
});

function escucharLlamadasEntrantes(uid) {
    const llamadasRef = collection(db, "llamadas");
    const q = query(llamadasRef, where("offer.to", "==", uid));

    const modal = document.getElementById("modalLlamada");
    const titulo = document.getElementById("modalTitulo");
    const descripcion = document.getElementById("modalDescripcion");
    const btnAceptar = document.getElementById("btnAceptarLlamada");
    const btnRechazar = document.getElementById("btnRechazarLlamada");

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const callId = change.doc.id;
                const data = change.doc.data();
                if (data?.answer || data?.rechazado) return; // ya procesada

                // Mostrar modal
                const foto = document.createElement("img");
                foto.src = data.offer.fromFoto || "./assets/img/default-avatar.png";
                foto.style.width = "70px";
                foto.style.height = "70px";
                foto.style.borderRadius = "50%";
                foto.style.marginBottom = "10px";
                descripcion.innerHTML = ""; // limpiar antes
                descripcion.appendChild(foto);
                descripcion.append(`${data.offer.fromName || "Alguien"} te está llamando`);
                titulo.textContent = data.offer.tipo === "video" ? "📹 Videollamada entrante" : "📞 Llamada entrante";
                descripcion.textContent = `${data.offer.fromName || "Alguien"} te está llamando`;
                modal.style.display = "flex";

                btnAceptar.onclick = async () => {
                    modal.style.display = "none";
                    await responderLlamada(callId);
                };

                btnRechazar.onclick = async () => {
                    modal.style.display = "none";
                    await updateDoc(change.doc.ref, { rechazado: true });
                };
            }
        });
    });
}

// Generar ID único de chat
function generarChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

// Seleccionar elementos
const chatContainer = document.querySelector(".chat-container");
const chatText = document.querySelector("#chatText");
const sendBtn = document.querySelector(".send-btn");
const fileInput = document.querySelector("#fileInput");
const imagenInput = document.querySelector("#imagenInput");
const locationBtn = document.querySelector("#locationBtn");
const buscador = document.getElementById("buscador");
const listaUsuarios = document.getElementById("listaBuscador");

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

let searchTimeout = null;

buscador.addEventListener("input", e => {
    const search = e.target.value.trim();

    // limpiar resultados si el campo está vacío
    if (search.length === 0) {
        listaUsuarios.innerHTML = "";
        return;
    }

    // evitar muchas consultas seguidas (debounce)
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => buscarUsuarios(search), 400);
});

async function buscarUsuarios(search) {
    const usuariosRef = collection(db, "users");

    // Consulta indexada (requiere que "nombre" esté indexado en Firestore)
    const q = query(
        usuariosRef,
        orderBy("usuario"),
        startAt(search),
        endAt(search + "\uf8ff"),
        limit(10)
    );

    listaUsuarios.innerHTML = `<p class="buscando">Buscando...</p>`;

    try {
        const snapshot = await getDocs(q);

        listaUsuarios.innerHTML = "";

        if (snapshot.empty) {
            listaUsuarios.innerHTML = `<p class="sin-resultados">Sin resultados</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.uid === currentUser?.uid) return;

            const div = document.createElement("div");
            div.classList.add("usuario");
            div.innerHTML = `
                <div class="listado-avatar">
                    <img src="${data.foto || "./assets/img/default-avatar.png"}" alt="Avatar Usuario">
                    <span class="status ${data.online ? "online" : "offline"}"></span>
                </div>
                <div class="info-usuario">
                    <h3>${data.usuario}</h3>
                    <p>${data.correo || ""}</p>
                </div>
            `;
            div.addEventListener("click", () => abrirChat(data));
            listaUsuarios.appendChild(div);
        });
    } catch (err) {
        console.error("Error al buscar usuarios:", err);
        listaUsuarios.innerHTML = `<p class="error">Error al buscar usuarios</p>`;
    }
}

let destinatario = null;
async function abrirChat(usuarioSeleccionado) {
    if (!currentUser) return console.warn("Usuario actual no autenticado");
    if (!usuarioSeleccionado?.uid) return console.warn("El usuario seleccionado no tiene UID");

    destinatario = usuarioSeleccionado;
    currentChatId = generarChatId(currentUser.uid, destinatario.uid);

    //  Mostrar el nombre del usuario en el header del chat
    const chatHeader = document.querySelector(".chat-header h2");
    if (chatHeader) chatHeader.textContent = destinatario.usuario || "Usuario";

    //  Limpiar el buscador
    listaUsuarios.innerHTML = "";
    buscador.value = "";
    //  Crear o actualizar los registros de chat para ambos usuarios
    const chatDataActual = {
        otroUsuarioId: destinatario.uid,
        otroUsuarioNombre: destinatario.usuario || "Desconocido",
        timestamp: serverTimestamp(),
    };

    const chatDataDestinatario = {
        otroUsuarioId: currentUser.uid,
        otroUsuarioNombre: currentUser.displayName || "Desconocido",
        timestamp: serverTimestamp(),
    };

    await Promise.all([
        setDoc(doc(db, "users", currentUser.uid, "chats", currentChatId), chatDataActual, { merge: true }),
        setDoc(doc(db, "users", destinatario.uid, "chats", currentChatId), chatDataDestinatario, { merge: true }),
    ]);

    //  Agregar a lista lateral (solo si no existe)
    agregarUsuarioALista(destinatario);

    //  Cargar mensajes del chat
    cargarMensajes(currentChatId);

    // --- Cambiar vista en modo móvil ---
    if (window.innerWidth <= 595) {
        const leftSide = document.querySelector(".left-side");
        const rightSide = document.querySelector(".right-side");
        const volverBtn = document.getElementById("volverLista");

        leftSide.classList.add("inactive");
        rightSide.classList.add("active");
        if (volverBtn) volverBtn.style.display = "inline-block";
    }

}



function agregarUsuarioALista(usuario) {
    const listaLateral = document.querySelector(".lista-usuarios");
    if (listaLateral.querySelector(`[data-uid="${usuario.uid}"]`)) return;

    const div = document.createElement("div");
    div.classList.add("usuario");
    div.setAttribute("data-uid", usuario.uid);

    div.innerHTML = `
        <div class="listado-avatar">
            <img src="${usuario.foto}" alt="Avatar">
            <span class="status"></span>
        </div>
        <div class="info-usuario">
            <h3>${usuario.usuario}</h3>
            <p>${usuario.correo}</p>
        </div>
    `;

    // Estado online/offline
    const estadoRef = ref(rtdb, `estado_usuarios/${usuario.uid}`);
    onValue(estadoRef, (snap) => {
        const data = snap.val();
        const statusEl = div.querySelector(".status");
        if (data?.estado === "online") statusEl.classList.add("online");
        else statusEl.classList.remove("online");
    });

    // Al hacer clic, abrir chat
    div.addEventListener("click", () => abrirChat(usuario));

    listaLateral.appendChild(div);
}

async function cargarListaChats(uid) {
    const listaLateral = document.querySelector(".lista-usuarios");
    listaLateral.innerHTML = "<p class='cargando'>Cargando chats...</p>";

    const chatsRef = collection(db, "users", uid, "chats");
    const q = query(chatsRef, orderBy("timestamp", "desc"));

    onSnapshot(q, async (snapshot) => {
        listaLateral.innerHTML = ""; // limpiar y volver a llenar

        //  Si no hay ningún chat
        if (snapshot.empty) {
            listaLateral.innerHTML = "<p class='sin-chats'>Aún no has iniciado chats</p>";
            return;
        }

        //  Procesar cada chat existente
        for (const docSnap of snapshot.docs) {
            const chatData = docSnap.data();
            // Evitar datos mal formados o incompletos
            if (!chatData || !chatData.otroUsuarioId) continue;
            const otroUsuarioId = chatData.otroUsuarioId;
            try {
                const userRef = doc(db, "users", otroUsuarioId);
                const userSnap = await getDoc(userRef);
                // Verificar que el usuario exista en Firestore
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    console.log("Cargando usuario del chat:", otroUsuarioId, data);
                    agregarUsuarioALista(data);
                } else {
                    console.warn(`El usuario con UID ${otroUsuarioId} no existe en 'users'`);
                }
            } catch (err) {
                console.error("Error cargando usuario del chat:", err);
            }
        }

        // Si después de procesar todo no se agregó nada
        if (!listaLateral.querySelector(".usuario")) {
            listaLateral.innerHTML = "<p class='sin-chats'>Aún no has iniciado chats</p>";
        }
    });
}


// 🔹 Cargar conversación al hacer clic en un usuario
document.querySelectorAll(".usuario").forEach(userEl => {
    userEl.addEventListener("click", () => {
        destinatarioId = userEl.querySelector("h3").textContent.trim(); // Aquí usarías el uid real del usuario
        currentChatId = generarChatId(currentUser.uid, destinatarioId);
        cargarMensajes(currentChatId);
        document.querySelector(".chat-header h2").textContent = destinatarioId;
    });
});

// 🔹 Enviar mensaje de texto
sendBtn.addEventListener("click", async () => {
    const texto = chatText.value.trim();
    if (!texto || !currentChatId) return;

    const mensajesRef = collection(db, "chats", currentChatId, "mensajes");
    await addDoc(mensajesRef, {
        uid: currentUser.uid,
        usuarioImg: currentUser.photoURL,
        texto,
        tipo: "texto",
        timestamp: serverTimestamp()
    });

    chatText.value = "";
});

function cargarMensajes(chatId) {
    const mensajesRef = collection(db, "chats", chatId, "mensajes");
    const q = query(mensajesRef, orderBy("timestamp"));

    onSnapshot(q, async (snapshot) => {
        chatContainer.innerHTML = "";

        // Escuchar presencia en tiempo real del destinatario
        if (destinatario && destinatario.uid) {
            const estadoRef = ref(rtdb, `estado_usuarios/${destinatario.uid}`);
            onValue(estadoRef, (snap) => {
                const data = snap.val();
                const estadoEl = document.querySelector(".chat-header .status");
                if (estadoEl) {
                    if (data?.estado === "online") {
                        estadoEl.textContent = "En línea";
                        estadoEl.classList.add("online");
                    } else {
                        const fecha = new Date(data?.ultimoVisto || 0);
                        estadoEl.textContent = `Visto: ${fecha.toLocaleString()}`;
                        estadoEl.classList.remove("online");
                    }
                }
            });
        }

        snapshot.forEach((docSnap) => {
            mostrarMensaje(docSnap.data());
        });

        // Scrollear al final
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}


//  Mostrar mensaje
function mostrarMensaje(data) {
    const esMio = data.uid === currentUser.uid;
    const div = document.createElement("div");
    div.classList.add("message", esMio ? "right" : "left");

    let contenido = "";
    switch (data.tipo) {
        case "imagen":
            contenido = `<img src="${data.url}" alt="imagen" class="img-msg" style="max-width:250px;border-radius:10px;">`;
            break;
        case "archivo":
            contenido = `<a href="${data.url}" target="_blank" class="file-link">
                            <i class="fa-solid fa-paperclip"></i> ${data.nombre || "Archivo adjunto"}
                        </a>`;
            break;
        case "ubicacion":
            contenido = `<iframe src="${data.url}&output=embed" width="250" height="150" 
                            style="border-radius:10px;border:none;"></iframe>`;
            break;
        default:
            contenido = `<p>${data.texto}</p>`;
    }

    const hora = data.timestamp?.toDate?.()?.toLocaleTimeString() || "";
    console.log(data);
    div.innerHTML = `
        <div class="bubble ${esMio ? "propio" : "ajeno"}">
            ${contenido}
            <time>${hora}</time>
        </div>
        <div class="avatar-container">
            <img src="${data.usuarioImg}" class="avatar" alt="avatar">
        </div>
    `;

    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}


function actualizarPresencia(user) {
    const userRef = ref(rtdb, `estado_usuarios/${user.uid}`);
    set(userRef, { estado: "online", ultimoVisto: Date.now() });
    onDisconnect(userRef).set({ estado: "offline", ultimoVisto: Date.now() });
}


//  Enviar imagen
imagenInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;

    const storageRef = sRef(storage, `chats/${currentChatId}/imagenes/${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const mensajesRef = collection(db, "chats", currentChatId, "mensajes");
    await addDoc(mensajesRef, {
        uid: currentUser.uid,
        usuarioImg: currentUser.foto,
        tipo: "imagen",
        url,
        timestamp: serverTimestamp()
    });
});
//  Enviar archivo
fileInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;

    const storageRef = sRef(storage, `chats/${currentChatId}/archivos/${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const mensajesRef = collection(db, "chats", currentChatId, "mensajes");
    await addDoc(mensajesRef, {
        uid: currentUser.uid,
        usuarioImg: currentUser.foto,
        tipo: "archivo",
        nombre: file.name,
        url,
        timestamp: serverTimestamp()
    });
});
//  Enviar ubicación
locationBtn.addEventListener("click", async () => {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización");
        return;
    }

    navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude, longitude } = pos.coords;
        const url = `https://www.google.com/maps?q=${latitude},${longitude}`;

        const mensajesRef = collection(db, "chats", currentChatId, "mensajes");
        await addDoc(mensajesRef, {
            uid: currentUser.uid,
            usuarioImg: currentUser.foto,
            tipo: "ubicacion",
            url,
            timestamp: serverTimestamp()
        });
    });
});

// ===================== 🔊 LLAMADAS / VIDEOLLAMADAS =====================

const pcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let pc;
let localStream;
let remoteStream;
let currentCallDoc;

// Elementos
const btnLlamada = document.getElementById("btnLlamada");
const btnVideo = document.getElementById("btnVideo");
const videoContainer = document.getElementById("videoCall");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const btnColgar = document.getElementById("btnColgar");

async function iniciarLlamada(tipo = "voz") {
    if (!destinatario) {
        alert("Selecciona un usuario para llamar.");
        return;
    }

    pc = new RTCPeerConnection(pcConfig);
    remoteStream = new MediaStream();

    document.getElementById("remoteVideo").srcObject = remoteStream;

    // Capturar audio/video
    localStream = await navigator.mediaDevices.getUserMedia({
        video: tipo === "video",
        audio: true
    });

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    localVideo.srcObject = localStream;

    // Mostrar interfaz
    videoContainer.style.display = "flex";

    // 🔹 ICE Candidates del que llama
    const callDoc = doc(collection(db, "llamadas"));
    currentCallDoc = callDoc;
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");

    pc.onicecandidate = event => {
        if (event.candidate) addDoc(offerCandidates, event.candidate.toJSON());
    };

    // 🔹 Cuando llega un track remoto
    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    };

    // 🔹 Crear y guardar la oferta
    const offerDesc = await pc.createOffer();
    await pc.setLocalDescription(offerDesc);

    const offer = {
        sdp: offerDesc.sdp,
        type: offerDesc.type,
        from: currentUser.uid,
        fromName: currentUser.displayName || "Desconocido",
        fromFoto: currentUser.photoURL || "./assets/img/default-avatar.png",
        to: destinatario.uid,
        toName: destinatario.usuario || "Desconocido",
        tipo
    };

    await setDoc(callDoc, { offer });

    // 🔹 Escuchar respuesta
    onSnapshot(callDoc, async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && !pc.currentRemoteDescription) {
            const answerDesc = new RTCSessionDescription(data.answer);
            await pc.setRemoteDescription(answerDesc);
        }
    });

    // 🔹 Escuchar ICE candidates del receptor
    onSnapshot(answerCandidates, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
}

// 🔹 Responder una llamada entrante
async function responderLlamada(callId) {
    const callDoc = doc(db, "llamadas", callId);
    const answerCandidates = collection(callDoc, "answerCandidates");
    const offerCandidates = collection(callDoc, "offerCandidates");

    const callData = (await getDoc(callDoc)).data();
    if (!callData?.offer) return;

    pc = new RTCPeerConnection(pcConfig);
    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    // Capturar medios según tipo
    localStream = await navigator.mediaDevices.getUserMedia({
        video: callData.offer.tipo === "video",
        audio: true
    });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    videoContainer.style.display = "flex";

    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    };

    pc.onicecandidate = event => {
        if (event.candidate) addDoc(answerCandidates, event.candidate.toJSON());
    };

    const offerDesc = new RTCSessionDescription(callData.offer);
    await pc.setRemoteDescription(offerDesc);

    const answerDesc = await pc.createAnswer();
    await pc.setLocalDescription(answerDesc);

    const answer = {
        type: answerDesc.type,
        sdp: answerDesc.sdp
    };
    await updateDoc(callDoc, { answer });

    // Escuchar ICE candidates del que llama
    onSnapshot(offerCandidates, snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
}

// 🔹 Finalizar llamada
btnColgar.addEventListener("click", () => {
    pc.close();
    localStream.getTracks().forEach(track => track.stop());
    remoteStream.getTracks().forEach(track => track.stop());
    videoContainer.style.display = "none";
    if (currentCallDoc) deleteDoc(currentCallDoc);
});

// Eventos de los botones
btnLlamada.addEventListener("click", () => iniciarLlamada("voz"));
btnVideo.addEventListener("click", () => iniciarLlamada("video"));

// Escuchar llamadas entrantes
onSnapshot(collection(db, "llamadas"), (snapshot) => {
    snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
            const data = change.doc.data();
        }
    });
});

