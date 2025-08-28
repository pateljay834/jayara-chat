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

// IndexedDB setup for local messages
let localDB;
const request = indexedDB.open("JayaraDB", 1);
request.onupgradeneeded = e => {
  localDB = e.target.result;
  const store = localDB.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
  store.createIndex("roomID", "room", { unique: false });
};
request.onsuccess = e => { localDB = e.target.result; };

// Generate AES key from room + passphrase
function deriveKey(room, passphrase) {
  return CryptoJS.SHA256(room + passphrase).toString();
}

// Join a room
function joinRoom() {
  username = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  const passphrase = document.getElementById("passphrase").value.trim();
  mode = document.getElementById("mode").value;

  if (!username || !currentRoom || !passphrase) { alert("Enter all fields!"); return; }

  encryptionKey = deriveKey(currentRoom, passphrase);
  document.getElementById("chatArea").style.display = "block";
  listenMessages();
}

// Create invite link
function createInviteLink() {
  const room = document.getElementById("room").value.trim();
  const pass = document.getElementById("passphrase").value.trim();
  if (!room || !pass) { alert("Enter room & passphrase!"); return; }
  const link = `${location.origin}/index.html?room=${room}&pass=${pass}`;
  document.getElementById("inviteLink").innerText = link;
  navigator.clipboard.writeText(link);
  alert("Invite link copied!");
}

// Encrypt/Decrypt messages
function encryptMessage(msg) {
  return CryptoJS.AES.encrypt(msg, encryptionKey).toString();
}
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
  msgRef.set({
    senderDevice: username + "_" + Date.now(),
    ciphertext: encrypted,
    timestamp: Date.now(),
    deliveredTo: { [username]: false }
  });

  msgBox.value = "";
  storeLocalMessage(text, username);
}

// Listen for new messages
function listenMessages() {
  const msgRef = db.ref(`rooms/${currentRoom}/messages`);
  msgRef.on("child_added", snapshot => {
    const data = snapshot.val();
    if (!data.deliveredTo[username]) {
      const decrypted = decryptMessage(data.ciphertext);
      storeLocalMessage(decrypted, data.senderDevice);
      snapshot.ref.child("deliveredTo").child(username).set(true);
    }
  });
  displayMessages();
}

// Store message locally in IndexedDB
function storeLocalMessage(text, senderID) {
  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  store.add({ room: currentRoom, sender: senderID, text, timestamp: Date.now() });
  tx.oncomplete = displayMessages;
}

// Display messages in chat area
function displayMessages() {
  const container = document.getElementById("messages");
  container.innerHTML = "";
  const tx = localDB.transaction(["messages"], "readonly");
  const store = tx.objectStore("messages");
  const request = store.getAll();
  request.onsuccess = e => {
    e.target.result.forEach(msg => {
      const div = document.createElement("div");
      div.className = "msg " + (msg.sender.startsWith(username) ? "me" : "other");
      div.innerHTML = `<span class="username">${msg.sender}</span>: ${msg.text} 
        <button onclick="deleteMessage(${msg.id})">🗑️</button>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  };
}

// Delete single local message
function deleteMessage(id) {
  const tx = localDB.transaction(["messages"], "readwrite");
  tx.objectStore("messages").delete(id);
  tx.oncomplete = displayMessages;
}

// Delete all local messages
function clearLocalMessages() {
  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  const request = store.getAll();
  request.onsuccess = e => {
    e.target.result.forEach(msg => store.delete(msg.id));
  };
  tx.oncomplete = displayMessages;
}

// Leave room
function leaveRoom() {
  document.getElementById("chatArea").style.display = "none";
  currentRoom = "";
  username = "";
  encryptionKey = "";
}