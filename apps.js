// ==============================
// Firebase Configuration
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.firebasestorage.app",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};

// Init Firebase (Compat SDK)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==============================
// Globals
// ==============================
let currentRoom = null;
let currentMode = null;
let currentUser = null;
let currentPass = null;
let msgRef = null; // active database reference

// ==============================
// Debug Logger
// ==============================
function logDebug(msg) {
  const dbg = document.getElementById("debugLog");
  dbg.innerText += msg + "\n";
  dbg.scrollTop = dbg.scrollHeight;
}

// ==============================
// Join Room
// ==============================
function joinRoom() {
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  currentPass = document.getElementById("passphrase").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!currentUser || !currentRoom || !currentPass) {
    alert("⚠️ Please enter name, room and passphrase");
    return;
  }

  // Firebase path: rooms/{room}/{mode}
  msgRef = db.ref("rooms/" + currentRoom + "/" + currentMode);

  // Switch UI
  document.getElementById("joinPanel").style.display = "none";
  document.getElementById("chatPanel").style.display = "block";
  document.getElementById("roomLabel").innerText = currentRoom;
  document.getElementById("modeBadge").innerText = currentMode;

  // Clear old messages
  document.getElementById("messages").innerHTML = "";

  // Stop previous listeners
  msgRef.off();

  // Start listening
  msgRef.on("child_added", snap => {
    try {
      const enc = snap.val();
      if (!enc || !enc.text) return;

      // decrypt
      const bytes = CryptoJS.AES.decrypt(enc.text, currentPass);
      const plain = bytes.toString(CryptoJS.enc.Utf8);

      if (!plain) {
        logDebug("⚠️ Failed to decrypt a message");
        return;
      }

      addMessage(enc.user, plain, enc.user === currentUser);

      // vanish mode → delete from firebase after showing
      if (currentMode === "vanish") {
        snap.ref.remove();
      }
    } catch (e) {
      logDebug("❌ Error decrypting: " + e.message);
    }
  });

  logDebug("✅ Joined room '" + currentRoom + "' in " + currentMode + " mode");
}
// ==============================
// Send Message
// ==============================
function sendMessage() {
  if (!msgRef) return;

  const msgBox = document.getElementById("msgBox");
  const text = msgBox.value.trim();
  if (!text) return;

  try {
    const ciphertext = CryptoJS.AES.encrypt(text, currentPass).toString();

    msgRef.push({
      user: currentUser,
      text: ciphertext,
      time: Date.now()
    });

    msgBox.value = "";
  } catch (e) {
    logDebug("❌ Error encrypting: " + e.message);
  }
}

// ==============================
// Add Message to UI
// ==============================
function addMessage(user, text, isMe) {
  const div = document.createElement("div");
  div.className = "msg " + (isMe ? "me" : "other");
  div.innerHTML = `<span class="username">${user}:</span> ${text}`;
  const box = document.getElementById("messages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// ==============================
// Leave Room
// ==============================
function leaveRoom() {
  if (msgRef) msgRef.off();
  currentRoom = null;
  msgRef = null;

  document.getElementById("chatPanel").style.display = "none";
  document.getElementById("joinPanel").style.display = "block";

  logDebug("👋 Left room");
}

// ==============================
// Clear Local Messages (UI only)
// ==============================
function clearLocalMessages() {
  document.getElementById("messages").innerHTML = "";
  logDebug("🧹 Local messages cleared");
}

// ==============================
// Manual Cleanup Button
// ==============================
// Deletes messages older than 7 days OR entire empty room older than 7 days
function cleanupOldMessages() {
  if (!currentRoom) {
    alert("⚠️ Join a room first");
    return;
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  const roomPath = db.ref("rooms/" + currentRoom + "/storage");

  roomPath.once("value", snap => {
    if (!snap.exists()) {
      logDebug("No data in room to cleanup");
      return;
    }

    let hasMessages = false;
    snap.forEach(child => {
      const val = child.val();
      if (val.time && val.time < cutoff) {
        child.ref.remove(); // remove old message
      } else {
        hasMessages = true;
      }
    });

    if (!hasMessages) {
      roomPath.remove(); // delete empty room
      logDebug("🗑️ Deleted empty room " + currentRoom);
    } else {
      logDebug("🧹 Old messages cleaned in " + currentRoom);
    }
  });
}