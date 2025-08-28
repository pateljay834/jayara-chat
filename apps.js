// Firebase Configuration
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

let currentUser = "", currentRoom = "", currentMode = "";
let messagesRef = null, roomKey = null;

// ----------------- Crypto -----------------
async function generateKeyFromPassphrase(passphrase) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("jayara_salt_" + currentRoom), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt","decrypt"]
  );
}

async function encryptMessage(text) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, roomKey, enc.encode(text));
  return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(cipherBuffer)) };
}

async function decryptMessage(data) {
  const dec = new TextDecoder();
  try {
    const plainBuffer = await crypto.subtle.decrypt({ name:"AES-GCM", iv: new Uint8Array(data.iv) }, roomKey, new Uint8Array(data.ciphertext));
    return dec.decode(plainBuffer);
  } catch { return "🔒 Unable to decrypt message"; }
}

// ----------------- Join Room -----------------
async function joinRoom() {
  const username = document.getElementById("username").value.trim();
  const room = document