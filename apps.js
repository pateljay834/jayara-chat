// ----------------- Firebase Config -----------------
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

// ----------------- Globals -----------------
let currentUser = "";
let currentRoom = "";
let currentMode = "";
let roomKey = null;
let messagesRef = null;

// ----------------- Crypto -----------------
const SALT_PREFIX = "jayara_salt_";
async function generateRoomKey(passphrase, roomCode) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(SALT_PREFIX + roomCode), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptMessage(text) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    roomKey,
    enc.encode(text)
  );
  return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(cipherBuffer)) };
}

async function decryptMessage(data) {
  const dec = new TextDecoder();
  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(data.iv) },
      roomKey,
      new Uint8Array(data.ciphertext)
    );
    return dec.decode(plainBuffer);
  } catch {
    return "🔒 Unable to decrypt";
  }
}

// ----------------- Join Room -----------------
async function joinRoom() {
  const username = document.getElementById("username").value.trim();
  const room = document.getElementById("room").value.trim();
  const mode = document.getElementById("mode").value;

  if (!username || !room) return alert("Enter name and room code.");
  currentUser = username;
  currentRoom = room;
  currentMode = mode;

  const passphrase = prompt("Enter room passphrase:");
  if (!passphrase) return alert("Passphrase required.");
  roomKey = await generateRoomKey(passphrase, currentRoom);

  // Store username & mode only
  if (currentMode === "storage") {
    localStorage.setItem(`jayara_user_${currentRoom}`, currentUser);
    localStorage.setItem(`jayara_mode_${currentRoom}`, currentMode);
  }

  setupChatListeners();

  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  document.getElementById("deleteBtn").style.display = currentMode === "storage" ? "inline-block" : "none";
}

// ----------------- Firebase Chat -----------------
function setupChatListeners() {
  messagesRef = db.ref(`rooms/${currentRoom}/messages`);
  messagesRef.off();

  messagesRef.on("child_added", async snapshot => {
    const data = snapshot.val();
    const text = await decryptMessage(data);
    displayMessage(data.sender, text, data.sender === currentUser);
  });

  if (currentMode === "vanish") {
    // Delete messages when leaving
    window.addEventListener("beforeunload", () => {
      messagesRef.remove();
    });
  }
}

async function sendMessage() {
  const msgBox = document.getElementById("msgBox");
  const text = msgBox.value.trim();
  if (!text || !roomKey) return;
  const encrypted = await encryptMessage(text);
  messagesRef.push({ sender: currentUser, ...encrypted, timestamp: Date.now() });
  msgBox.value = "";
}

// ----------------- Display -----------------
function displayMessage(sender, text, isMe) {
  const messagesDiv = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = `msg ${isMe ? "me" : "other"}`;
  div.innerHTML = `<span class="username">${sender}</span>: ${text}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ----------------- Leave / Delete -----------------
function leaveRoom() {
  if (!currentRoom) return;
  messagesRef = null;
  roomKey = null;
  currentRoom = null;
  currentUser = null;
  currentMode = null;
  document.getElementById("chatArea").style.display = "none";

  localStorage.removeItem(`jayara_user_${currentRoom}`);
  localStorage.removeItem(`jayara_mode_${currentRoom}`);
}

function deleteAllMessages() {
  if (!messagesRef) return;
  messagesRef.remove();
}