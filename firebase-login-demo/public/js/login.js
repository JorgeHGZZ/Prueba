const firebaseConfig = {
    apiKey: "AIzaSyCmKS915zbGQSuWcB0Ww_AfJarsEitCWGs",
    authDomain: "classhub-7fcb1.firebaseapp.com",
    databaseURL: "https://classhub-7fcb1-default-rtdb.firebaseio.com",
    projectId: "classhub-7fcb1",
    storageBucket: "classhub-7fcb1.appspot.com",
    messagingSenderId: "900567668775",
    appId: "1:900567668775:web:40b5af38f8a85113d75602",
    measurementId: "G-VG4Y7LDZF6"
};

// Firebase imports
import { initializeApp } from "firebase/app";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase, ref, onDisconnect, onValue, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const database = getDatabase(app);

// Elements
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const btnLogin = document.getElementById("btn-login");
const btnGoogle = document.getElementById("btn-google");
const errEl = document.getElementById("error");

// Utilidades
function showError(msg) {
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
}
function clearError() {
    errEl.textContent = "";
    errEl.classList.add("hidden");
}

// ✅ Función reutilizable: asegura que el usuario exista en Firestore
async function ensureUserInFirestore(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        console.log("Creando perfil en Firestore...");
        console.log(userRef);
        await setDoc(userRef, {
            uid: user.uid,
            nombre: user.displayName?.split(" ")[0] || "",
            apellido: user.displayName?.split(" ")[1] || "",
            usuario: user.email.split("@")[0],
            correo: user.email,
            foto: user.photoURL || "",
            edad: null,
            creado: serverTimestamp()
        });
    } else {
        console.log("Usuario ya registrado en Firestore.");
    }
}

// 🔹 Login con correo y contraseña
btnLogin.addEventListener("click", async () => {
    clearError();
    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) return showError("Ingresa correo y contraseña.");

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Redirigir tras login
        window.location.href = "dashboard.html";
    } catch (e) {
        console.error("Login error", e);
        showError("Correo o contraseña incorrectos.");
    }
});

// 🔹 Login con Google
btnGoogle.addEventListener("click", async () => {
    clearError();
    const provider = new GoogleAuthProvider();

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        await ensureUserInFirestore(user);

        alert(`Bienvenido ${user.displayName || "Usuario"}!`);
        //window.location.href = "dashboard.html";
    } catch (e) {
        console.error("Google sign in error", e);
        showError(e.message || "Error al iniciar con Google");
    }
});

// 🔹 Detectar si el usuario ya está logueado
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuario logueado:", user.email);
        // Puedes redirigirlo automáticamente si ya está autenticado
        window.location.href = "dashboard.html";
    } else {
        console.log("No hay usuario activo");
    }
});
