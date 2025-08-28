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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// App variables
let currentRoom = "";
let username = "";
let mode = "storage";
let encryptionKey = "";
let listenerAttached = false;

// IndexedDB setup
let localDB;
function initDB(callback) {
  const request = indexedDB.open("JayaraDB", 1);
  request.onupgradeneeded = e => {
    localDB = e.target.result;
    const store = localDB.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
    store.createIndex("roomID", "room", { unique: false });
  };
  request.onsuccess = e => {
    localDB = e.target.result;
    if (callback) callback();
  };
  request.onerror = () => alert("IndexedDB failed to open");
}

// AES Key
function deriveKey(room, passphrase) {
  return CryptoJS.SHA256(room + passphrase).toString();
}

// Join room
function joinRoom() {
  username = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  const passphrase = document.getElementById("passphrase").value.trim();
  mode = document.getElementById("mode").value;

  if (!username || !currentRoom || !passphrase) { alert("Enter all fields!"); return; }

  encryptionKey = deriveKey(currentRoom, passphrase);

  initDB(() => startChat());
}

// Start chat
function startChat() {
  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";

  listenMessages();
  displayMessages();
}

// Encrypt / Decrypt
function encryptMessage(msg) { return CryptoJS.AES.encrypt(msg, encryptionKey).toString(); }
function decryptMessage(cipher) {
  try { return CryptoJS.AES.decrypt(cipher, encryptionKey).toString(CryptoJS.enc.Utf8); }
  catch { return "[Cannot decrypt]"; }
}

// Send message
function sendMessage() {
  const msgBox = document.getElementById("msgBox");
  let text = msgBox.value.trim();
  if (!text) return;

  const encrypted = encryptMessage(text);
  const msgRef = db.ref(`rooms/${currentRoom}/messages`).push();

  const msgObj = {
    senderDevice: username + "_" + Date.now(),
    ciphertext: encrypted,
    timestamp: Date.now(),
    deliveredTo: { [username]: false },
    vanish: (mode === "vanish")
  };

  msgRef.set(msgObj);

  if (mode === "storage") storeLocalMessage(text, username);

  msgBox.value = "";
}

// Listen messages
function listenMessages() {
  if (listenerAttached) return;
  listenerAttached = true;

  const msgRef = db.ref(`rooms/${currentRoom}/messages`);
  msgRef.on("child_added", snapshot => {
    const data = snapshot.val();
    const decrypted = decryptMessage(data.ciphertext);

    if (mode === "storage") storeLocalMessage(decrypted, data.senderDevice);

    snapshot.ref.child("deliveredTo").child(username).set(true);

    if ((mode === "vanish" && data.deliveredTo[username]) || (data.vanish && Date.now() - data.timestamp > 24*60*60*1000)) {
      snapshot.ref.remove();
    }

    displayMessages();
  });
}

// Store locally
function storeLocalMessage(text, senderID) {
  if (!localDB) return;
  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  store.add({ room: currentRoom, sender: senderID, text, timestamp: Date.now() });
  tx.oncomplete = displayMessages;
}

// Display messages
function displayMessages() {
  if (!localDB) return;
  const container = document.getElementById("messages");
  container.innerHTML = "";

  const tx = localDB.transaction(["messages"], "readonly");
  const store = tx.objectStore("messages");
  const req = store.getAll();
  req.onsuccess = e => {
    const msgs = e.target.result.filter(msg => msg.room === currentRoom);
    msgs.forEach(msg => {
      const div = document.createElement("div");
      div.className = "msg " + (msg.sender.startsWith(username) ? "me" : "other");
      div.innerHTML = `<span class="username">${msg.sender}</span>: ${msg.text} 
        <button onclick="deleteMessage(${msg.id})">🗑️</button>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  };
}

// Delete one message locally
function deleteMessage(id) {
  if (!localDB) return;
  const tx = localDB.transaction(["messages"], "readwrite");
  tx.objectStore("messages").delete(id);
  tx.oncomplete = displayMessages;
}

// Delete all local messages
function clearLocalMessages() {
  if (!localDB) return;
  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  store.clear();
  tx.oncomplete = displayMessages;
}

// Leave room
function leaveRoom() {
  if (currentRoom) db.ref(`rooms/${currentRoom}/messages`).off();
  listenerAttached = false;
  document.getElementById("chatArea").style.display = "none";
  document.getElementById("leaveBtn").style.display = "none";
  currentRoom = "";
  username = "";
  encryptionKey = "";
}

// Vanish mode cleanup every 1 hour
setInterval(() => {
  if (!currentRoom) return;
  const msgRef = db.ref(`rooms/${currentRoom}/messages`);
  msgRef.once("value", snapshot => {
    snapshot.forEach(child => {
      const msg = child.val();
      if (msg.vanish && Date.now() - msg.timestamp > 24*60*60*1000) child.ref.remove();
    });
  });
}, 60*60*1000);