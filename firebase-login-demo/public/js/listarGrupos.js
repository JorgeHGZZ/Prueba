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

//  Imports Firebase
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Elementos del DOM
const listaGrupos = document.getElementById("listaGrupos");

// -------------------------------
// FUNCIONES AUXILIARES
// -------------------------------

function obtenerIniciales(nombre) {
    const palabras = nombre.trim().split(" ");
    if (palabras.length === 1) {
        const p = palabras[0];
        return (p[0] + p.slice(-1)).toUpperCase();
    }
    return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

function randomColor() {
    const colores = [
        "#F44336", "#E91E63", "#9C27B0", "#3F51B5",
        "#03A9F4", "#009688", "#4CAF50", "#FF9800",
        "#795548", "#607D8B"
    ];
    return colores[Math.floor(Math.random() * colores.length)];
}

// -------------------------------
// RENDER DE CADA GRUPO
// -------------------------------

function crearCardGrupo(id, grupo) {
    const div = document.createElement("div");
    div.classList.add("grupo-card");

    // Avatar o imagen
    if (grupo.imagenURL) {
        const img = document.createElement("img");
        img.src = grupo.imagenURL;
        img.alt = grupo.nombre;
        div.appendChild(img);
    } else {
        const avatar = document.createElement("div");
        avatar.classList.add("card-item");
        avatar.style.background = randomColor();
        avatar.textContent = obtenerIniciales(grupo.nombre);
        div.appendChild(avatar);
    }

    // Nombre
    const nombre = document.createElement("h2");
    nombre.textContent = grupo.nombre;
    div.appendChild(nombre);

    // Click → abrir chat
    div.addEventListener("click", () => {
        localStorage.setItem("grupoSeleccionado", id);
        window.location.href = "chatGrupal.html";
    });

    return div;
}

// -------------------------------
// CARGA DE GRUPOS DEL USUARIO
// -------------------------------

async function cargarGruposUsuario(uid) {
    const gruposRef = collection(db, "grupos");
    const q = query(gruposRef, where("miembros", "array-contains", uid));
    const snapshot = await getDocs(q);

    listaGrupos.innerHTML = ""; // limpiar lista

    if (snapshot.empty) {
        listaGrupos.innerHTML = `<p class="sin-grupos">No perteneces a ningún grupo aún.</p>`;
        return;
    }

    snapshot.forEach((doc) => {
        const grupo = doc.data();
        const grupoCard = crearCardGrupo(doc.id, grupo);
        listaGrupos.appendChild(grupoCard);
    });
}

// -------------------------------
// OBSERVADOR DE SESIÓN
// -------------------------------

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    console.log("✅ Usuario logueado:", user.uid);
    await cargarGruposUsuario(user.uid);
});
