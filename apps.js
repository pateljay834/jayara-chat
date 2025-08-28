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
const messaging = firebase.messaging();

let currentUser = "";
let currentRoom = "";
let currentMode = "";
let roomKey = null;
let messagesRef = null;

// ----------------- Crypto Functions -----------------
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
    return "🔒 Unable to decrypt message";
  }
}

// ----------------- Join / Auto-Join -----------------
async function joinRoom() {
  const username = document.getElementById("username").value.trim();
  const room = document.getElementById("room").value.trim();
  const mode = document.getElementById("mode").value;

  if (!username || !room) return alert("Enter name and room code.");

  currentUser = username;
  currentRoom = room;
  currentMode = mode;

  // Prompt for passphrase
  let passphrase = prompt("Enter passphrase for room:");
  if (!passphrase) return;

  // Generate deterministic room key
  roomKey = await generateRoomKey(passphrase, currentRoom);

  // Save for Storage Mode persistence
  if (currentMode === "storage") {
    localStorage.setItem("jayara_passphrase_" + currentRoom, passphrase);
    localStorage.setItem("jayara_currentRoom", currentRoom);
    localStorage.setItem("jayara_currentUser", currentUser);
    localStorage.setItem("jayara_mode", currentMode);
  }

  setupChatListeners();
  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  if (currentMode === "storage") document.getElementById("deleteBtn").style.display = "inline-block";
}

// Auto-join if stored
async function autoJoinRoom() {
  const savedRoom = localStorage.getItem("jayara_currentRoom");
  const savedUser = localStorage.getItem("jayara_currentUser");
  const savedMode = localStorage.getItem("jayara_mode");
  const savedPass = localStorage.getItem("jayara_passphrase_" + savedRoom);

  if (savedRoom && savedUser && savedMode && savedPass) {
    currentUser = savedUser;
    currentRoom = savedRoom;
    currentMode = savedMode;
    roomKey = await generateRoomKey(savedPass, currentRoom);
    setupChatListeners();
    document.getElementById("chatArea").style.display = "block";
    document.getElementById("leaveBtn").style.display = "inline-block";
    if (currentMode === "storage") document.getElementById("deleteBtn").style.display = "inline-block";
  }
}

// ----------------- Firebase Listeners -----------------
function setupChatListeners() {
  messagesRef = db.ref("rooms/" + currentRoom + "/messages");

  messagesRef.off(); // Clear previous listeners

  messagesRef.on("child_added", async snapshot => {
    const data = snapshot.val();
    const text = await decryptMessage(data);
    displayMessage(data.sender, text, data.sender === currentUser);
  });
}

// ----------------- Sending / Display -----------------
async function sendMessage() {
  const msgBox = document.getElementById("msgBox");
  const text = msgBox.value.trim();
  if (!text) return;

  const encrypted = await encryptMessage(text);
  messagesRef.push({ sender: currentUser, ...encrypted, timestamp: Date.now() });
  msgBox.value = "";

  // Optional: send push notifications via Firebase Cloud Function later
}

function displayMessage(sender, text, isMe) {
  const messagesDiv = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg " + (isMe ? "me" : "other");
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
  localStorage.clear();
  document.getElementById("chatArea").style.display = "none";
}

function deleteAllMessages() {
  if (!messagesRef) return;
  messagesRef.remove();
}

// ----------------- Push Notifications -----------------
async function requestNotificationPermission() {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') initFCM();
  }
}

async function initFCM() {
  try {
    const token = await messaging.getToken({
      vapidKey: "BP2a0ozwY3d0DW3eEih0c_Ai0iaNngCyhDWIzzIM2umb5ZWrMwAXaDVw4yjbPSKYYuNDUAYg-U3nDGmumBMt7i0"
    });
    console.log("FCM Token:", token);
  } catch (err) {
    console.error("Error getting FCM token:", err);
  }

  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    if (title && body) new Notification(title, { body, icon: 'icon-192.png' });
  });
}

// ----------------- Startup -----------------
autoJoinRoom();
requestNotificationPermission();