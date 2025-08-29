// -------------------------
// Firebase config
// -------------------------
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.firebasestorage.app",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};

// Init Firebase (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -------------------------
// Globals
// -------------------------
let currentRoom = null;
let currentMode = null;
let currentUser = null;
let currentPass = null;
let msgRef = null; // firebase ref
let listenerAttached = false;

const VANISH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

// -------------------------
// Debug helper
// -------------------------
function logDebug(msg) {
  console.log(msg);
  const dbg = document.getElementById("debugLog");
  if (!dbg) return;
  dbg.innerText += msg + "\n";
  dbg.scrollTop = dbg.scrollHeight;
}

// -------------------------
// UI helpers
// -------------------------
function setButtonsByMode() {
  const delBtn = document.getElementById("deleteBtn");
  if (currentMode === "storage") {
    delBtn.style.display = "inline-block";
  } else {
    delBtn.style.display = "none";
  }
}

function addMessage(user, text, isMe) {
  const div = document.createElement("div");
  div.className = "msg " + (isMe ? "me" : "other");
  div.innerHTML = `<span class="username">${user}:</span> ${text}`;
  const box = document.getElementById("messages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// -------------------------
// Join / Leave
// -------------------------
function joinRoom() {
  // read inputs
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  currentPass = document.getElementById("passphrase").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!currentUser || !currentRoom || !currentPass) {
    alert("Enter all details (name, room, passphrase)");
    return;
  }

  // prepare ref: rooms/{room}/{mode}
  msgRef = db.ref("rooms/" + currentRoom + "/" + currentMode);

  // switch UI
  document.getElementById("joinPanel").style.display = "none";
  document.getElementById("chatPanel").style.display = "block";
  document.getElementById("roomLabel").innerText = currentRoom;
  document.getElementById("modeBadge").innerText = currentMode;
  document.getElementById("messages").innerHTML = "";
  setButtonsByMode();

  // Always detach any previous listeners on this ref before attaching new
  msgRef.off();
  listenerAttached = false;

  // Attach listener once
  msgRef.on("child_added", onChildAdded);
  listenerAttached = true;

  logDebug("✅ Joined: " + currentRoom + " [" + currentMode + "]");
}

function leaveRoom() {
  if (msgRef && listenerAttached) {
    msgRef.off("child_added", onChildAdded);
  }
  msgRef = null;
  listenerAttached = false;
  currentRoom = null;

  document.getElementById("chatPanel").style.display = "none";
  document.getElementById("joinPanel").style.display = "block";
  logDebug("🚪 Left room");
}

// -------------------------
// Listener callback
// -------------------------
function onChildAdded(snap) {
  const enc = snap.val();
  if (!enc) return;

  // Clean up old vanish messages (server-side TTL recommended, but do client cleanup too)
  if (currentMode === "vanish" && enc.time && Date.now() - enc.time > VANISH_WINDOW_MS) {
    snap.ref.remove().catch(() => {});
    return;
  }

  try {
    const bytes = CryptoJS.AES.decrypt(enc.text, currentPass);
    const plain = bytes.toString(CryptoJS.enc.Utf8);

    if (!plain) {
      logDebug("⚠️ Decryption failed (wrong passphrase or corrupt message).");
      return;
    }

    addMessage(enc.user, plain, enc.user === currentUser);
  } catch (e) {
    logDebug("❌ Error decrypting: " + (e && e.message ? e.message : e));
  }
}

// -------------------------
// Send / Delete
// -------------------------
function sendMessage() {
  if (!msgRef) {
    logDebug("⚠️ Not in a room.");
    return;
  }
  const box = document.getElementById("msgBox");
  const text = box.value.trim();
  if (!text) return;

  const cipher = CryptoJS.AES.encrypt(text, currentPass).toString();

  // write once; do not render locally here to avoid duplicates.
  msgRef.push({
    user: currentUser,
    text: cipher,
    time: Date.now()
  }).catch(err => logDebug("❌ Send failed: " + (err && err.message ? err.message : err)));

  box.value = "";
}

function clearLocalMessages() {
  document.getElementById("messages").innerHTML = "";
  logDebug("🧹 Local view cleared.");
}

function deleteAllMessages() {
  if (!msgRef) return;
  if (currentMode !== "storage") {
    alert("Delete All is only for Storage mode.");
    return;
  }
  if (!confirm("Delete ALL messages in this room from Firebase?")) return;

  msgRef.remove()
    .then(() => {
      document.getElementById("messages").innerHTML = "";
      logDebug("🗑 All messages deleted from Firebase (storage mode).");
    })
    .catch(err => logDebug("❌ Delete failed: " + (err && err.message ? err.message : err)));
}

// -------------------------
// Expose globally (for inline onclick)
// -------------------------
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.sendMessage = sendMessage;
window.clearLocalMessages = clearLocalMessages;
window.deleteAllMessages = deleteAllMessages;