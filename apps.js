// ==============================
// apps.js - Jayara Chat (final cleaned)
// ==============================

// ---------- Firebase config ----------
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.firebasestorage.app",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- globals ----------
let currentRoom = null;
let currentMode = null;
let currentUser = null;
let currentPass = null;
let msgRef = null;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- debug ----------
function logDebug(msg) {
  const dbg = document.getElementById("debugLog");
  if (dbg) {
    const t = new Date().toLocaleTimeString();
    dbg.innerText += `[${t}] ${msg}\n`;
    dbg.scrollTop = dbg.scrollHeight;
  } else {
    console.log(msg);
  }
}

// ---------- helpers ----------
function savePersistentInfo() {
  if (currentMode === "storage") {
    localStorage.setItem("jayara_username", currentUser);
    localStorage.setItem("jayara_room", currentRoom);
    localStorage.setItem("jayara_passphrase", currentPass);
    localStorage.setItem("jayara_mode", currentMode);
  } else {
    localStorage.removeItem("jayara_passphrase");
    localStorage.setItem("jayara_username", currentUser);
    localStorage.setItem("jayara_room", currentRoom);
    localStorage.setItem("jayara_mode", currentMode);
  }
}

function loadPersistentInfo() {
  const uname = localStorage.getItem("jayara_username");
  const room = localStorage.getItem("jayara_room");
  const pass = localStorage.getItem("jayara_passphrase");
  const mode = localStorage.getItem("jayara_mode");
  if (uname) document.getElementById("username").value = uname;
  if (room) document.getElementById("room").value = room;
  if (mode) document.getElementById("mode").value = mode;
  if (pass && mode === "storage") document.getElementById("passphrase").value = pass;
}

// ---------- cleanup across all rooms ----------
function runCleanup() {
  logDebug("🧹 Cleanup started...");
  const roomsRef = db.ref("rooms");
  const now = Date.now();

  return roomsRef.once("value").then(snap => {
    const promises = [];
    snap.forEach(roomSnap => {
      const roomKey = roomSnap.key;
      let hasMessages = false;

      roomSnap.forEach(modeSnap => {
        if (modeSnap.key === "meta") return;
        const modeKey = modeSnap.key;
        const threshold = modeKey === "vanish" ? ONE_DAY_MS : SEVEN_DAYS_MS;
        const modeRef = db.ref(`rooms/${roomKey}/${modeKey}`);

        const p = modeRef.once("value").then(msnap => {
          msnap.forEach(msgSnap => {
            const msg = msgSnap.val();
            if (msg && msg.time) {
              hasMessages = true;
              if (now - msg.time > threshold) {
                promises.push(modeRef.child(msgSnap.key).remove());
              }
            }
          });
        });
        promises.push(p);
      });

      // delete empty room older than 7 days
      if (!hasMessages) {
        promises.push(db.ref(`rooms/${roomKey}`).remove());
      }
    });

    return Promise.all(promises).then(() => {
      logDebug("✅ Cleanup finished");
    });
  });
}

// ---------- join a room ----------
function joinRoom() {
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  currentPass = document.getElementById("passphrase").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!currentUser || !currentRoom || !currentPass) {
    alert("Enter all details (name, room, passphrase)");
    return;
  }

  msgRef = db.ref("rooms/" + currentRoom + "/" + currentMode);

  document.getElementById("joinPanel").style.display = "none";
  document.getElementById("chatPanel").style.display = "block";
  document.getElementById("roomLabel").innerText = currentRoom;
  document.getElementById("modeBadge").innerText = currentMode;

  document.getElementById("messages").innerHTML = "";

  msgRef.off();
  msgRef.on("child_added", snap => {
    try {
      const enc = snap.val();
      if (!enc || !enc.text) return;
      const bytes = CryptoJS.AES.decrypt(enc.text, currentPass);
      const plain = bytes.toString(CryptoJS.enc.Utf8);

      if (!plain) {
        logDebug("⚠️ Decryption failed for a message");
        return;
      }

      addMessage(enc.user, plain, enc.user === currentUser);
    } catch (e) {
      logDebug("error decrypting: " + e.message);
    }
  });

  savePersistentInfo();
  logDebug("✅ Joined room " + currentRoom + " in " + currentMode + " mode");
}

// ---------- send message ----------
function sendMessage() {
  if (!msgRef) return;
  const msgBox = document.getElementById("msgBox");
  const text = msgBox.value.trim();
  if (!text) return;

  const ciphertext = CryptoJS.AES.encrypt(text, currentPass).toString();

  msgRef.push({
    user: currentUser,
    text: ciphertext,
    time: Date.now()
  });

  msgBox.value = "";
}

// ---------- add message to UI ----------
function addMessage(user, text, isMe) {
  const div = document.createElement("div");
  div.className = "msg " + (isMe ? "me" : "other");
  div.innerHTML = `<span class="username">${user}:</span> ${text}`;
  const box = document.getElementById("messages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// ---------- leave room ----------
function leaveRoom() {
  if (msgRef) msgRef.off();
  currentRoom = null;
  msgRef = null;
  document.getElementById("chatPanel").style.display = "none";
  document.getElementById("joinPanel").style.display = "block";
}

// ---------- clear local UI ----------
function clearLocalMessages() {
  document.getElementById("messages").innerHTML = "";
}

// ---------- on load ----------
window.onload = () => {
  loadPersistentInfo();
  logDebug("App loaded");
};