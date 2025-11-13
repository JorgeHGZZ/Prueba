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

// Import Firebase modules (usando importmap en el HTML)
import { initializeApp } from "firebase/app";
import {getAuth,createUserWithEmailAndPassword,updateProfile} from "firebase/auth";
import {getStorage,ref,uploadBytes,getDownloadURL} from "firebase/storage";
import {getFirestore,doc,setDoc,serverTimestamp} from "firebase/firestore";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

const nombre = document.getElementById('nombre');
const apellido = document.getElementById('apellido');
const usuario = document.getElementById('usuario');
const edad = document.getElementById('edad');
const email = document.getElementById('email');
const password = document.getElementById('password');
const foto = document.getElementById('foto');
const registerBtn = document.getElementById('registerBtn');
const errorEl = document.getElementById('error');

function showError(msg) {
    errorEl.textContent = msg;
}

registerBtn.addEventListener('click', async () => {
    try {
        if (!email.value || !password.value) {
            return showError('Correo y contraseña requeridos.');
        }

        const userCred = await createUserWithEmailAndPassword(auth, email.value, password.value);
        const user = userCred.user;

        let photoURL = "";
        if (foto.files && foto.files[0]) {
            const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);
            await uploadBytes(storageRef, foto.files[0]);
            photoURL = await getDownloadURL(storageRef);
        }

        // Actualiza el perfil en Auth
        await updateProfile(user, {
            displayName: `${nombre.value} ${apellido.value}`,
            photoURL
        });

        // Guarda en Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            nombre: nombre.value,
            apellido: apellido.value,
            usuario: usuario.value,
            edad: edad.value ? parseInt(edad.value, 10) : null,
            correo: email.value,
            foto: photoURL,
            creado: serverTimestamp()
        });

        window.location.href = "login.html";
    } catch (e) {
        console.error(e);
        showError(e.message || 'Error al registrar');
    }
});