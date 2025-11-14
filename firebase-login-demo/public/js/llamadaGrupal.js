// llamadaGrupal.js (REFINAL)
// Reemplaza completamente tu archivo actual con éste.
// Mejores prácticas: reuso del <video id="localVideo">, audio playback control, nombres correctos.

import {
    getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
    getFirestore, collection, doc, setDoc, addDoc, onSnapshot, getDocs, deleteDoc, query, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

let grupoId = localStorage.getItem("grupoSeleccionado");
if (!grupoId) console.warn("No hay grupoSeleccionado en localStorage.");

const btnVoice = document.getElementById("btn-voice");
const btnVideo = document.getElementById("btn-video");
const btnChat = document.getElementById("btn-chat");
const chatContainer = document.querySelector(".chat-container");
const callInterface = document.getElementById("call-interface");
const videosArea = document.getElementById("videos-area");
const incomingModal = document.getElementById("incomingModal");
const callerNameEl = document.getElementById("callerName");
const callerAvatarEl = document.getElementById("callerAvatar");
const callerTypeEl = document.getElementById("callerType");
const acceptBtn = document.getElementById("acceptCall");
const rejectBtn = document.getElementById("rejectCall");
const chatInput = document.getElementById("chatinput");

const muteBtn = document.getElementById("muteBtn");
const camBtn = document.getElementById("camBtn");
const leaveBtn = document.getElementById("leaveBtn");
const callCount = document.getElementById("call-count");
const callSubtitle = document.getElementById("call-subtitle");

let localStream = null;
let pcMap = {}; // remoteUid => RTCPeerConnection
let currentCallId = null;
let user = null;
let isMuted = false;
let camOff = false;
let unsubscribeSignals = null;
let participantsUnsub = null;
let initiatorUid = null; // quien creó la llamada

// cache de nombres
const nameCache = new Map();
// audio elements per remote
const remoteAudioEls = new Map();

// ICE servers
const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ---------- UI toggles ----------
function showCallUI() {
    chatContainer.classList.add("hidden");
    if (chatInput) chatInput.classList.add("hidden");
    callInterface.classList.remove("hidden");
}
function showChatUI() {
    chatContainer.classList.remove("hidden");
    if (chatInput) chatInput.classList.remove("hidden");
    callInterface.classList.add("hidden");
}

// ---------- Helpers ----------
async function getParticipantName(callId, uid) {
    if (nameCache.has(uid)) return nameCache.get(uid);

    try {
        const pDoc = await getDoc(doc(db, "grupos", grupoId, "llamadas", callId, "participantes", uid));
        if (pDoc.exists()) {
            const n = pDoc.data().name || pDoc.data().displayName || uid;
            nameCache.set(uid, n);
            return n;
        }
    } catch (e) {
        console.warn("Error leyendo participantes:", e);
    }

    try {
        const uDoc = await getDoc(doc(db, "users", uid));
        if (uDoc.exists()) {
            const n = uDoc.data().name || uDoc.data().displayName || uDoc.data().email || uid;
            nameCache.set(uid, n);
            return n;
        }
    } catch (e) {
        console.warn("Error leyendo users:", e);
    }

    nameCache.set(uid, uid);
    return uid;
}

// create or reuse video card and an audio element (audio element hidden)
function createVideoElementFor(uid, name, isLocal = false) {
    // prevent creating remote card for ourselves
    if (!isLocal && user && uid === user.uid) return null;

    // reuse static local video element/card when isLocal
    if (isLocal) {
        const staticLocalVideo = document.getElementById("localVideo");
        if (staticLocalVideo) {
            const localCard = document.querySelector(".video-card.local-card");
            if (localCard) {
                const nameTag = localCard.querySelector(".video-name");
                if (nameTag) nameTag.innerText = name || "Tú";
            }
            return { card: localCard, video: staticLocalVideo, nameTag: (localCard ? localCard.querySelector(".video-name") : null) };
        }
    }

    // existing remote card?
    let existing = document.getElementById(`card-${uid}`);
    if (existing) {
        return { card: existing, video: existing.querySelector("video"), nameTag: existing.querySelector(".video-name") };
    }

    // create remote card
    const card = document.createElement("div");
    card.className = "video-card";
    card.id = `card-${uid}`;

    const video = document.createElement("video");
    video.id = `video-${uid}`;
    video.autoplay = true;
    video.playsInline = true;
    // remote video must not be muted so audio can come through the video element if needed
    video.muted = false;

    const nameTag = document.createElement("div");
    nameTag.className = "video-name";
    nameTag.innerText = name || uid;

    // hidden audio element for browsers that autoplay audio only on <audio> or to be safe
    const audio = document.createElement("audio");
    audio.id = `audio-${uid}`;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.style.display = "none"; // visually hidden
    audio.volume = 1;
    audio.muted = false;

    card.appendChild(video);
    card.appendChild(nameTag);
    card.appendChild(audio);
    videosArea.appendChild(card);

    // store audio element
    remoteAudioEls.set(uid, audio);

    return { card, video, nameTag, audio };
}

function removeVideoElement(uid) {
    const card = document.getElementById(`card-${uid}`);
    if (card) card.remove();
    nameCache.delete(uid);
    // remove audio element ref
    if (remoteAudioEls.has(uid)) remoteAudioEls.delete(uid);
}

// force play on all remote media elements — must be called from a user gesture (start/accept)
async function playAllMedia() {
    // try to play local video (muted) — safe
    try {
        const localVideo = document.getElementById("localVideo");
        if (localVideo && localVideo.srcObject) await localVideo.play().catch(() => { });
    } catch (e) { /* ignore */ }

    // play remote videos and audios
    const videoEls = videosArea.querySelectorAll("video");
    for (const v of videoEls) {
        try { await v.play().catch(() => { }); } catch (e) { }
    }
    for (const [uid, audioEl] of remoteAudioEls.entries()) {
        try { await audioEl.play().catch(() => { }); } catch (e) { }
    }
}

// Start local stream (audio only or audio+video)
async function startLocalStream(withVideo) {
    try {
        if (localStream) {
            localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
            localStream.getVideoTracks().forEach(t => t.enabled = !camOff);
            return localStream;
        }

        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });

        // ensure audio tracks are enabled
        localStream.getAudioTracks().forEach(t => { t.enabled = true; });

        // attach to local video element in DOM
        const localVideo = document.getElementById("localVideo");
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.muted = true; // avoid feedback
        }

        // do not create duplicate local card, just ensure name updated
        createVideoElementFor(user.uid, "Tú", true);

        return localStream;
    } catch (err) {
        console.error("Error obteniendo medios:", err);
        alert("No se pudo acceder al micrófono/cámara. Revisa permisos y que el navegador tenga acceso.");
        throw err;
    }
}

// ---------- Signaling helpers (Firestore) ----------
function signalsCollectionRef(callId) {
    return collection(db, "grupos", grupoId, "llamadas", callId, "signals");
}

function participantsCollectionRef(callId) {
    return collection(db, "grupos", grupoId, "llamadas", callId, "participantes");
}

async function createCallDoc(type) {
    const callDocRef = doc(collection(db, "grupos", grupoId, "llamadas"));
    await setDoc(callDocRef, {
        iniciador: user.uid,
        type,
        startedAt: Date.now(),
        active: true
    });
    currentCallId = callDocRef.id;
    initiatorUid = user.uid;
    return callDocRef.id;
}

async function joinCallDoc(callId) {
    currentCallId = callId;
    const partRef = doc(participantsCollectionRef(callId), user.uid);
    await setDoc(partRef, { joinedAt: Date.now(), uid: user.uid, name: user.displayName || user.email || user.uid });
    nameCache.set(user.uid, user.displayName || user.email || user.uid);
}

// --------- PeerConnection / signaling per remote ----------
async function crearConexion(remoteUid, remoteName) {
    if (pcMap[remoteUid]) return pcMap[remoteUid];

    if (user && remoteUid === user.uid) return null;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcMap[remoteUid] = pc;

    // add local tracks if available
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    // when a remote track arrives
    pc.ontrack = (ev) => {
        if (!ev || !ev.track) return;
        console.log("TRACK RECIBIDO:", ev.track.kind, "from", remoteUid);

        const stream = ev.streams && ev.streams[0] ? ev.streams[0] : null;

        // avoid creating card for our own local stream
        if (stream && localStream && stream.id === localStream.id) {
            // it's our own stream, ignore
            return;
        }

        (async () => {
            const displayName = remoteName || await getParticipantName(currentCallId, remoteUid);
            const created = createVideoElementFor(remoteUid, displayName, false);
            if (!created) return;

            // attach stream to both video and audio elements (video can emit sound, but audio element is more reliable for autoplay)
            if (stream) {
                // attach to video
                if (created.video) {
                    try { created.video.srcObject = stream; } catch (e) { console.warn(e); }
                }
                // attach to audio
                const audioEl = created.audio || remoteAudioEls.get(remoteUid);
                if (audioEl) {
                    try { audioEl.srcObject = stream; } catch (e) { console.warn(e); }
                }
            }
        })();

        updateCallSubtitleIfConnected();
    };

    pc.onconnectionstatechange = () => {
        console.log("PC state for", remoteUid, pc.connectionState);
        updateCallSubtitleIfConnected();
    };
    pc.oniceconnectionstatechange = () => {
        console.log("ICE state for", remoteUid, pc.iceConnectionState);
        updateCallSubtitleIfConnected();
    };

    pc.onicecandidate = async (event) => {
        if (!event.candidate) return;
        try {
            await addDoc(signalsCollectionRef(currentCallId), {
                from: user.uid,
                to: remoteUid,
                type: "candidate",
                candidate: event.candidate.toJSON(),
                ts: Date.now()
            });
        } catch (e) {
            console.error("Error guardando candidate:", e);
        }
    };

    return pc;
}

// send offers to existing participants (used by initiator)
async function sendOffersToAll() {
    if (!currentCallId) return;
    const partsSnap = await getDocs(participantsCollectionRef(currentCallId));
    for (const p of partsSnap.docs) {
        const otherUid = p.id;
        if (otherUid === user.uid) continue;
        const name = p.data().name || await getParticipantName(currentCallId, otherUid);
        const pc = await crearConexion(otherUid, name);
        if (!pc) continue;
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await addDoc(signalsCollectionRef(currentCallId), {
                from: user.uid,
                to: otherUid,
                type: "offer",
                sdp: offer.sdp,
                ts: Date.now()
            });
        } catch (e) {
            console.error("Error creando offer en sendOffersToAll:", e);
        }
    }
}

// Listener global para señales
function listenSignals() {
    if (!currentCallId) return;
    const q = query(signalsCollectionRef(currentCallId));
    if (unsubscribeSignals) unsubscribeSignals();
    unsubscribeSignals = onSnapshot(q, async (snap) => {
        snap.docChanges().forEach(async (change) => {
            const sig = change.doc.data();
            if (!sig) return;

            if (sig.to && sig.to !== user.uid) return;

            if (sig.type === "offer" && sig.to === user.uid) {
                const fromUid = sig.from;
                const remoteName = sig.fromName || await getParticipantName(currentCallId, fromUid);
                const pc = await crearConexion(fromUid, remoteName);
                if (!pc) return;

                try {
                    await pc.setRemoteDescription({ type: "offer", sdp: sig.sdp });
                } catch (e) {
                    console.error("Error setRemoteDescription offer:", e);
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                await addDoc(signalsCollectionRef(currentCallId), {
                    from: user.uid,
                    to: fromUid,
                    type: "answer",
                    sdp: answer.sdp,
                    ts: Date.now()
                });
            }

            else if (sig.type === "answer" && sig.to === user.uid) {
                const fromUid = sig.from;
                const pc = pcMap[fromUid];
                if (pc) {
                    try {
                        await pc.setRemoteDescription({ type: "answer", sdp: sig.sdp });
                    } catch (e) {
                        console.error("Error setRemoteDescription answer:", e);
                    }
                }
            }

            else if (sig.type === "candidate") {
                if (sig.to === user.uid) {
                    const fromUid = sig.from;
                    const pc = pcMap[fromUid];
                    if (pc) {
                        try {
                            const cand = new RTCIceCandidate(sig.candidate);
                            await pc.addIceCandidate(cand);
                        } catch (e) {
                            console.warn("Error addIceCandidate:", e);
                        }
                    }
                }
            }
        });
    });
}

// Cleanup
async function cleanupCall() {
    for (const k in pcMap) {
        try { pcMap[k].close(); } catch (e) { console.warn(e); }
        removeVideoElement(k);
    }
    pcMap = {};
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
        const localVideoEl = document.getElementById("localVideo");
        if (localVideoEl) localVideoEl.srcObject = null;
    }
    if (currentCallId) {
        try {
            const callDoc = doc(db, "grupos", grupoId, "llamadas", currentCallId);
            await updateDoc(callDoc, { active: false, endedAt: Date.now() });
        } catch (e) { /* ignore */ }
    }
    if (unsubscribeSignals) { unsubscribeSignals(); unsubscribeSignals = null; }
    if (participantsUnsub) { participantsUnsub(); participantsUnsub = null; }
    currentCallId = null;
    initiatorUid = null;
    showChatUI();
    callSubtitle.innerText = "Conectando...";
    callCount.innerText = "0 participantes";
}

// ---------- UI actions ----------
async function startCall(type) {
    if (!user) return alert("No autenticado.");
    showCallUI();

    await startLocalStream(type === "video");

    const callId = await createCallDoc(type);
    await joinCallDoc(callId);

    callCount.innerText = `1 participante`;
    callSubtitle.innerText = "Conectando...";

    await sendOffersToAll();
    listenSignals();

    // participants listener
    participantsUnsub = onSnapshot(participantsCollectionRef(callId), async (snap) => {
        const count = snap.size;
        callCount.innerText = `${count} participante${count > 1 ? "s" : ""}`;

        snap.docChanges().forEach(async (change) => {
            const uid = change.doc.id;
            if (change.type === "added") {
                if (uid === user.uid) return;
                if (!pcMap[uid]) {
                    const name = change.doc.data().name || await getParticipantName(callId, uid);
                    const pc = await crearConexion(uid, name);
                    if (!pc) return;
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        await addDoc(signalsCollectionRef(callId), {
                            from: user.uid,
                            to: uid,
                            type: "offer",
                            sdp: offer.sdp,
                            ts: Date.now()
                        });
                    } catch (e) {
                        console.error("Error creando offer al nuevo participante:", e);
                    }
                }
            } else if (change.type === "removed") {
                if (pcMap[uid]) {
                    try { pcMap[uid].close(); } catch (e) { /* ignore */ }
                    delete pcMap[uid];
                }
                removeVideoElement(uid);
            }
        });
    });

    // ensure playback after the user action that started call
    await playAllMedia();

    leaveBtn.onclick = async () => {
        try {
            await deleteDoc(doc(participantsCollectionRef(callId), user.uid));
        } catch (e) { console.warn(e); }
        if (participantsUnsub) participantsUnsub();
        await cleanupCall();
    };
}

async function joinExistingCall(callId) {
    showCallUI();

    try {
        const callDocRef = doc(db, "grupos", grupoId, "llamadas", callId);
        const callSnap = await getDoc(callDocRef);
        if (callSnap.exists()) {
            const data = callSnap.data();
            initiatorUid = data.iniciador || null;
            const wantVideo = data.type === "video";
            await startLocalStream(wantVideo);
        } else {
            await startLocalStream(true);
        }
    } catch (e) {
        console.warn("Error leyendo call doc:", e);
        await startLocalStream(true);
    }

    await joinCallDoc(callId);
    listenSignals();

    participantsUnsub = onSnapshot(participantsCollectionRef(callId), (snap) => {
        const count = snap.size;
        callCount.innerText = `${count} participante${count > 1 ? "s" : ""}`;
    });

    // ensure playback after user accepted the incoming call
    await playAllMedia();

    leaveBtn.onclick = async () => {
        try {
            await deleteDoc(doc(participantsCollectionRef(callId), user.uid));
        } catch (e) { console.warn(e); }
        if (participantsUnsub) participantsUnsub();
        await cleanupCall();
    };
}

// ---------- Incoming call modal ----------
let unsubCallList = null;
function listenCallOffers() {
    const callsRef = collection(db, "grupos", grupoId, "llamadas");
    if (unsubCallList) unsubCallList();
    unsubCallList = onSnapshot(callsRef, async (snap) => {
        snap.docChanges().forEach(async (change) => {
            const data = change.doc.data();
            const id = change.doc.id;
            if (change.type === "added" && data.active) {
                if (!currentCallId && data.iniciador !== user.uid) {
                    const initiName = await getParticipantName(id, data.iniciador).catch(() => data.iniciador);
                    callerNameEl.innerText = initiName || data.iniciador || "Usuario";
                    callerAvatarEl.src = './assets/img/default-avatar.png';
                    callerTypeEl.innerText = data.type === "video" ? "te está invitando a una videollamada" : "te está invitando a una llamada de voz";

                    incomingModal.classList.remove("hidden");

                    acceptBtn.onclick = async () => {
                        incomingModal.classList.add("hidden");
                        await joinExistingCall(id);
                    };
                    rejectBtn.onclick = async () => {
                        incomingModal.classList.add("hidden");
                    };
                }
            }
        });
    });
}

// subtitle helper
function updateCallSubtitleIfConnected() {
    for (const k in pcMap) {
        const pc = pcMap[k];
        if (!pc) continue;
        const s = pc.connectionState || pc.iceConnectionState;
        if (s === "connected" || s === "completed") {
            callSubtitle.innerText = "Conectado";
            return;
        }
    }
    callSubtitle.innerText = "Conectando...";
}

// ---------- auth state & binding botones ----------
onAuthStateChanged(auth, (u) => {
    if (!u) return;
    user = u;

    btnVoice.addEventListener("click", async () => { await startCall("audio"); });
    btnVideo.addEventListener("click", async () => { await startCall("video"); });
    btnChat.addEventListener("click", () => {
        if (currentCallId) cleanupCall(); else showChatUI();
    });

    muteBtn.onclick = () => {
        if (!localStream) return;
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
        muteBtn.innerText = isMuted ? "🔈" : "🔇";
    };
    camBtn.onclick = () => {
        if (!localStream) return;
        camOff = !camOff;
        localStream.getVideoTracks().forEach(t => t.enabled = !camOff);
        camBtn.innerText = camOff ? "📷" : "🎥";
    };

    // incoming call listener
    listenCallOffers();
});
