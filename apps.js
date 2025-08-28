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

// ----------------- Global Variables -----------------
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
    return "🔒 Unable to decrypt message";
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

  let passphrase = prompt("Enter passphrase for room:");
  if (!passphrase) return;

  roomKey = await generateRoomKey(passphrase, currentRoom);

  // Save device-specific storage
  if (currentMode === "storage") {
    localStorage.setItem("jayara_user_" + currentRoom, currentUser);
    localStorage.setItem("jayara_pass_" + currentRoom, passphrase);
    localStorage.setItem("jayara_mode_" + currentRoom, currentMode);
  }

  setupChatListeners();
  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  if (currentMode === "storage") document.getElementById("deleteBtn").style.display = "inline-block";
}

// ----------------- Auto-Join -----------------
async function autoJoinRoom() {
  const savedRooms = Object.keys(localStorage).filter(k => k.startsWith("jayara_user_"));
  for (const key of savedRooms) {
    const roomCode = key.replace("jayara_user_", "");
    const savedUser = localStorage.getItem("jayara_user_" + roomCode);
    const savedPass = localStorage.getItem("jayara_pass_" + roomCode);
    const savedMode = localStorage.getItem("jayara_mode_" + roomCode);

    if (savedUser && savedPass && savedMode) {
      currentUser = savedUser;
      currentRoom = roomCode;
      currentMode = savedMode;
      roomKey = await generateRoomKey(savedPass, currentRoom);

      setupChatListeners();
      document.getElementById("chatArea