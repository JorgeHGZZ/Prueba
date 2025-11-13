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


const modal = document.getElementById("miModal");
const abrir = document.getElementById("abrir");
const cerrar = document.getElementById("cerrar");

abrir.addEventListener("click", () => {
    modal.showModal(); // abre como modal (bloquea fondo)
});

cerrar.addEventListener("click", () => {
    modal.close(); // cierra el modal
});

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// inicializa
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// elementos UI

const userAvatar = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// modal handlers (existentes)
if (abrir) abrir.addEventListener("click", () => modal?.showModal());
if (cerrar) cerrar.addEventListener("click", () => modal?.close());

// logout
if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
        try {
            await signOut(auth);
        } catch (e) {
            console.error(e);
        }
    });
}

const inputNombre = document.querySelector('.modal-body input[type="text"]');
const inputDescripcion = document.querySelector('.modal-body textarea');
const uploadBox = document.querySelector('.upload-box');
let imagenArchivo = null;

let colorAsignado = null;
let iniciales = null;

// Generar color aleatorio
function colorAleatorio() {
    const colores = ['#FF6B6B', '#6BCB77', '#4D96FF', '#FFD93D', '#845EC2', '#00C9A7', '#F9F871'];
    return colores[Math.floor(Math.random() * colores.length)];
}

// Mostrar iniciales si no hay imagen
function mostrarIniciales() {
    const nombre = inputNombre.value.trim();
    if (!nombre) {
        uploadBox.textContent = "↑";
        uploadBox.style.background = "";
        uploadBox.style.color = "";
        iniciales = null;
        colorAsignado = null;
        return;
    }
    const primera = nombre.charAt(0).toUpperCase();
    const ultima = nombre.charAt(nombre.length - 1).toUpperCase();
    iniciales = `${primera}${ultima}`;
    colorAsignado = colorAleatorio();

    uploadBox.textContent = iniciales;
    uploadBox.style.background = colorAsignado;
    uploadBox.style.color = "#fff";
    uploadBox.style.fontSize = "2rem";
    uploadBox.style.display = "flex";
    uploadBox.style.alignItems = "center";
    uploadBox.style.justifyContent = "center";
}

// Escucha cambios en el nombre
inputNombre.addEventListener('input', () => {
    if (!imagenArchivo) mostrarIniciales();
});

// Subida y previsualización de imagen
uploadBox.addEventListener('click', () => {
    const inputFile = document.createElement('input');
    inputFile.type = 'file';
    inputFile.accept = 'image/*';
    inputFile.click();

    inputFile.addEventListener('change', (e) => {
        imagenArchivo = e.target.files[0];
        if (imagenArchivo) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                uploadBox.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
            };
            reader.readAsDataURL(imagenArchivo);
        } else {
            mostrarIniciales();
        }
    });
});


const btnGuardar = document.getElementById('btn-guardar');

btnGuardar.addEventListener('click', async () => {
    const nombre = inputNombre.value.trim();
    const descripcion = inputDescripcion.value.trim();

    if (!nombre) {
        alert('El nombre del grupo es obligatorio');
        return;
    }

    const user = auth.currentUser;
    if (!user) return alert('Debes iniciar sesión');

    let imagenURL = "";

    try {
        // Subir imagen si se eligió
        if (imagenArchivo) {
            const storageRef = ref(storage, `groups/${Date.now()}_${imagenArchivo.name}`);
            await uploadBytes(storageRef, imagenArchivo);
            imagenURL = await getDownloadURL(storageRef);
        }
        console.log(nombre, descripcion, imagenURL);
        console.log("Creando grupo para usuario:", user.uid);

        // Crear documento en Firestore
        await addDoc(collection(db, "grupos"), {
            nombre,
            descripcion,
            imagenURL,
            miembros: [user.uid], // 👈 AQUI se guarda el usuario
            creadoPor: user.uid,
            creadoEn: new Date()
        });

        alert(" Grupo creado correctamente");
        modal.close();

        // Limpia campos
        inputNombre.value = "";
        inputDescripcion.value = "";
        uploadBox.textContent = "↑";
        uploadBox.style.background = "";
        imagenArchivo = null;
    } catch (e) {
        console.error("Error al crear grupo:", e);
        alert(" Error al crear el grupo");
    }
});

// observador de auth: actualiza UI y trae documento Firestore "users/{uid}" si existe
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("✅ Usuario logueado:", user.uid);
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
    } else {
        // Si no hay usuario, lo manda al login
        window.location.href = "login.html";
    }
});