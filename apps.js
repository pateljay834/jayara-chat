// -------------------- Firebase --------------------
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

// -------------------- App State --------------------
let currentRoom = "";
let username = "";
let mode = "storage";
let encryptionKey = "";
let listenerAttached = false;

// -------------------- IndexedDB --------------------
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

// -------------------- Encryption --------------------
function deriveKey(room, passphrase) {
  return CryptoJS.SHA256(room + passphrase).toString();
}
function encryptMessage(msg) { return CryptoJS.AES.encrypt(msg, encryptionKey).toString(); }
function decryptMessage(cipher) {
  try { return CryptoJS.AES.decrypt(cipher, encryptionKey).toString(CryptoJS.enc.Utf8); }
  catch { return "[Cannot decrypt]"; }
}

// -------------------- Join Room --------------------
function joinRoom() {
  username = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  const passphrase = document.getElementById("passphrase").value.trim();
  mode = document.getElementById("mode").value;

  if (!username || !currentRoom || !passphrase) { alert("Enter all fields!"); return; }

  encryptionKey = deriveKey(currentRoom, passphrase);

  initDB(() => startChat());
}

// -------------------- Start Chat --------------------
function startChat() {
  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  if (mode === "storage") document.getElementById("deleteBtn").style.display = "inline-block";
  attachListener();
  displayMessages();
}

// -------------------- Firebase Listener --------------------
function attachListener() {
  if (listenerAttached) return;
  listenerAttached = true;

  const msgRef = db.ref(`rooms/${currentRoom}/messages`);
  msgRef.off(); // Remove old listeners to prevent duplicates

  msgRef.on("child_added", snapshot => {
    const data = snapshot.val();
    if (!data || !data.ciphertext) return;

    const decrypted = decryptMessage(data.ciphertext);
    const senderName = data.senderName || "Unknown";

    // Store locally only in storage mode
    if (mode === "storage" && !data.vanish) storeLocalMessage(decrypted, data.senderID, senderName);

    // Update delivered status
    snapshot.ref.child("deliveredTo").child(username).set(true);

    // Vanish mode: auto-delete after 24h or if delivered
    if (data.vanish && (data.deliveredTo && data.deliveredTo[username] || Date.now() - data.timestamp > 24*60*60*1000)) {
      snapshot.ref.remove();
    }

    displayMessages();
  });
}

// -------------------- Send Message --------------------
function sendMessage() {
  const msgBox = document.getElementById("msgBox");
  let text = msgBox.value.trim();
  if (!text) return;

  const encrypted = encryptMessage(text);
  const msgRef = db.ref(`rooms/${currentRoom}/messages`).push();
  const msgObj = {
    senderID: username + "_" + Date.now(),
    senderName: username,
    ciphertext: encrypted,
    timestamp: Date.now(),
    deliveredTo: { [username]: false },
    vanish: (mode === "vanish")
  };
  msgRef.set(msgObj);

  // Store locally if storage mode
  if (mode === "storage") storeLocalMessage(text, msgObj.senderID, username);

  msgBox.value = "";
}

// -------------------- IndexedDB Operations --------------------
function storeLocalMessage(text, senderID, senderName) {
  if (!localDB) return;
  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  store.add({ room: currentRoom, senderID, senderName, text, timestamp: Date.now() });
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
    const msgs = e.target.result.filter