const attachBtn = document.getElementById("attachBtn");
const dropdown = document.getElementById("optionsDropdown");
const sendBtn = document.querySelector(".send-btn");
const chatText = document.getElementById("chatText");
const messages = document.querySelector(".chat-container");


// Mostrar/ocultar el dropdown de opciones
attachBtn.addEventListener("click", () => {
    dropdown.style.display = (dropdown.style.display === "flex") ? "none" : "flex";
});

// Cierra el dropdown si clicas fuera
document.addEventListener("click", (e) => {
    if (!attachBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = "none";
    }
});


const usuarios = document.querySelectorAll(".usuario");
const leftSide = document.querySelector(".left-side");
const rightSide = document.querySelector(".right-side");
const volverBtn = document.getElementById("volverLista");


volverBtn.addEventListener("click", () => {
    leftSide.classList.remove("inactive");
    rightSide.classList.remove("active");
    volverBtn.style.display = "none";
});

// En caso de redimensionar
window.addEventListener("resize", () => {
    if (window.innerWidth > 595) {
        leftSide.classList.remove("inactive");
        rightSide.classList.remove("active");
        volverBtn.style.display = "none";
    }
});

