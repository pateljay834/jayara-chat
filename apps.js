// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.firebasestorage.app",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};

// init firebase (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// globals
let currentRoom = null;
let currentMode = null;
let currentUser = null;
let currentPass = null;
let msgRef = null;

// helpers
function logDebug(msg) {
  const dbg = document.getElementById("debugLog");
  dbg.innerText += msg + "\n";
  dbg.scrollTop = dbg.scrollHeight;
}

// ---------- CLEANUP OLD ROOMS & MESSAGES ----------
function cleanupRooms() {
  const roomsRef = db.ref("rooms");
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  roomsRef.once("value", snap => {
    snap.forEach(roomSnap => {
      const roomKey = roomSnap.key;
      let hasMessages = false;

      roomSnap.forEach(modeSnap => {
        modeSnap.forEach(msgSnap => {
          hasMessages = true;
          const msg = msgSnap.val();
          if (msg.time && now - msg.time > sevenDays) {
            msgSnap.ref.remove(); // delete old messages
          }
        });
      });

      if (!hasMessages) {
        // delete empty room if inactive for 7+ days
        const roomMeta = roomSnap.child("meta").val();
        if (roomMeta && roomMeta.lastActive && now - roomMeta.lastActive > sevenDays) {
          roomsRef.child(roomKey).remove();
          logDebug(`🧹 Removed empty room: ${roomKey}`);
        }
      }
    });
  });
}

// ---------- JOIN ROOM ----------
function joinRoom() {
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  currentPass = document.getElementById("passphrase").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!currentUser || !currentRoom || !currentPass) {
    alert("Enter all details (name, room, passphrase)");
    return;
  }

  // room reference
  msgRef = db.ref("rooms/" + currentRoom + "/" + currentMode);

  // update meta
  db.ref("rooms/" + currentRoom + "/meta").set({
    lastActive: Date.now()
  });

  // cleanup on join
  cleanupRooms();

  // UI switch
  document.getElementById("joinPanel").style.display = "none";
  document.getElementById("chatPanel").style.display = "block";
  document.getElementById("roomLabel").innerText = currentRoom;
  document.getElementById("modeBadge").innerText = currentMode;
  document.getElementById("messages").innerHTML = "";

  // start listening
  msgRef.off();
  msgRef.on("child_added", snap => {
    try {
      const enc = snap.val();
      if (!enc.text) return;

      const bytes = CryptoJS.AES.decrypt(enc.text, currentPass);
      const plain = bytes.toString(CryptoJS.enc.Utf8);

      if (!plain) {
        logDebug("⚠️ Decryption failed");
        return;
      }

      addMessage(enc.user, plain, enc.user === currentUser);
    } catch (e) {
      logDebug("error decrypting: " + e.message);
    }
  });

  logDebug("✅ Joined room " + currentRoom + " (" + currentMode + ")");
}

// ---------- SEND MESSAGE ----------
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

  // update meta
  db.ref("rooms/" + currentRoom + "/meta").set({
    lastActive: Date.now()
  });

  // cleanup on send
  cleanupRooms();

  msgBox.value = "";
}

// ---------- ADD MESSAGE TO UI ----------
function addMessage(user, text, isMe) {
  const div = document.createElement("div");
  div.className = "msg " + (isMe ? "me" : "other");
  div.innerHTML = `<span class="username">${user}:</span> ${text}`;
  const box = document.getElementById("messages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// ---------- LEAVE ROOM ----------
function leaveRoom() {
  if (msgRef) msgRef.off();
  currentRoom = null;
  msgRef = null;
  document.getElementById("chatPanel").style.display = "none";
  document.getElementById("joinPanel").style.display = "block";
}

// ---------- CLEAR LOCAL ----------
function clearLocalMessages() {
  document.getElementById("messages").innerHTML = "";
}