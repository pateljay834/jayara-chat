// Firebase config (replace with your own values)
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
let msgRef = null; // database ref

// helpers
function logDebug(msg) {
  const dbg = document.getElementById("debugLog");
  dbg.innerText += msg + "\n";
  dbg.scrollTop = dbg.scrollHeight;
}

// join a room
function joinRoom() {
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  currentPass = document.getElementById("passphrase").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!currentUser || !currentRoom || !currentPass) {
    alert("Enter all details (name, room, passphrase)");
    return;
  }

  // path: rooms/{room}/{mode}
  msgRef = db.ref("rooms/" + currentRoom + "/" + currentMode);

  // UI switch
  document.getElementById("joinPanel").style.display = "none";
  document.getElementById("chatPanel").style.display = "block";
  document.getElementById("roomLabel").innerText = currentRoom;
  document.getElementById("modeBadge").innerText = currentMode;

  // clear messages
  document.getElementById("messages").innerHTML = "";

  // start listening
  msgRef.off(); // remove previous listeners if any
  msgRef.on("child_added", snap => {
    try {
      const enc = snap.val();
      const bytes = CryptoJS.AES.decrypt(enc.text, currentPass);
      const plain = bytes.toString(CryptoJS.enc.Utf8);

      if (!plain) {
        logDebug("⚠️ decryption failed for message");
        return;
      }

      addMessage(enc.user, plain, enc.user === currentUser);
    } catch (e) {
      logDebug("error decrypting: " + e.message);
    }
  });

  logDebug("✅ joined room " + currentRoom + " in " + currentMode + " mode");
}

// send message
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

// add message to UI
function addMessage(user, text, isMe) {
  const div = document.createElement("div");
  div.className = "msg " + (isMe ? "me" : "other");
  div.innerHTML = `<span class="username">${user}:</span> ${text}`;
  const box = document.getElementById("messages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// leave room
function leaveRoom() {
  if (msgRef) msgRef.off();
  currentRoom = null;
  msgRef = null;
  document.getElementById("chatPanel").style.display = "none";
  document.getElementById("joinPanel").style.display = "block";
}

// clear local UI (doesn’t touch Firebase)
function clearLocalMessages() {
  document.getElementById("messages").innerHTML = "";
}