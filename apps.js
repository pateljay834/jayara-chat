// -------------------------
// Firebase Setup
// -------------------------
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.appspot.com",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -------------------------
// Globals
// -------------------------
let currentRoom = null;
let currentMode = null;
let username = null;
let passphrase = null;
let listenerRef = null;

// Debug log
function logDebug(msg) {
  console.log(msg);
  const dbg = document.getElementById("debugLog");
  dbg.innerText += msg + "\n";
}

// -------------------------
// Encryption
// -------------------------
function encryptMessage(text, key) {
  return CryptoJS.AES.encrypt(text, key).toString();
}
function decryptMessage(cipher, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return "[decrypt failed]";
  }
}

// -------------------------
// IndexedDB
// -------------------------
let dbLocal;
const DB_NAME = "JayaraChat";
const STORE_NAME = "messages";

function openLocalDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = (e) => {
      dbLocal = e.target.result;
      resolve();
    };
    req.onerror = () => reject("IndexedDB error");
  });
}

function saveLocalMessage(msg) {
  if (!dbLocal) return;
  const tx = dbLocal.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).add(msg);
}

function getLocalMessages(room, cb) {
  if (!dbLocal) return;
  const tx = dbLocal.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const req = store.openCursor();
  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const m = cursor.value;
      if (m.room === room) cb(m);
      cursor.continue();
    }
  };
}

function clearLocalMessages() {
  if (!dbLocal) return;
  const tx = dbLocal.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  document.getElementById("messages").innerHTML = "";
  logDebug("🧹 Local messages cleared.");
}

// -------------------------
// UI
// -------------------------
function renderMessage(msg, isMine) {
  const div = document.createElement("div");
  div.className = "msg " + (isMine ? "me" : "other");
  div.innerHTML = `<span class="username">${msg.user}:</span> ${msg.text}`;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
}

// -------------------------
// Join / Leave
// -------------------------
async function joinRoom() {
  username = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  passphrase = document.getElementById("passphrase").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!username || !currentRoom || !passphrase) {
    alert("⚠ Please fill name, room and passphrase");
    return;
  }

  await openLocalDB();

  // Remove old listener
  if (listenerRef) {
    listenerRef.off();
    listenerRef = null;
  }

  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  document.getElementById("deleteBtn").style.display = currentMode === "storage" ? "inline-block" : "none";
  document.getElementById("messages").innerHTML = "";

  const path = `rooms/${currentRoom}/${currentMode}`;
  listenerRef = db.ref(path);

  listenerRef.on("child_added", (snap) => {
    const data = snap.val();
    if (!data) return;
    const text = decryptMessage(data.text, passphrase);
    const msg = { user: data.user, text, room: currentRoom, time: data.time };

    renderMessage(msg, msg.user === username);

    if (currentMode === "storage") saveLocalMessage(msg);

    // Vanish cleanup
    if (currentMode === "vanish" && Date.now() - data.time > 24 * 60 * 60 * 1000) {
      snap.ref.remove();
    }
  });

  if (currentMode === "storage") {
    getLocalMessages(currentRoom, (msg) => renderMessage(msg, msg.user === username));
  }

  logDebug(`✅ Joined ${currentRoom} (${currentMode})`);
}

function leaveRoom() {
  if (listenerRef) listenerRef.off();
  listenerRef = null;
  currentRoom = null;
  currentMode = null;
  document.getElementById("chatArea").style.display = "none";
  logDebug("🚪 Left room");
}

// -------------------------
// Sending
// -------------------------
function sendMessage() {
  const box = document.getElementById("msgBox");
  const text = box.value.trim();
  if (!text || !currentRoom) return;

  const cipher = encryptMessage(text, passphrase);
  const msgObj = { user: username, text: cipher, time: Date.now(), room: currentRoom };

  db.ref(`rooms/${currentRoom}/${currentMode}`).push(msgObj);
  box.value = "";
}