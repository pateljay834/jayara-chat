// ==============================
// apps.js - Jayara Chat (final)
// ==============================

// ---------- Firebase config ----------
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

// ---------- globals ----------
let currentRoom = null;
let currentMode = null;
let currentUser = null;
let currentPass = null;
let msgRef = null;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- debug ----------
function logDebug(msg) {
  const dbg = document.getElementById("debugLog");
  if (dbg) {
    const t = new Date().toLocaleTimeString();
    dbg.innerText += `[${t}] ${msg}\n`;
    dbg.scrollTop = dbg.scrollHeight;
  } else {
    console.log(msg);
  }
}

// ---------- helpers ----------
function savePersistentInfo() {
  // persist username/room/passphrase only for storage mode
  if (currentMode === "storage") {
    localStorage.setItem("jayara_username", currentUser);
    localStorage.setItem("jayara_room", currentRoom);
    localStorage.setItem("jayara_passphrase", currentPass);
    localStorage.setItem("jayara_mode", currentMode);
  } else {
    // remove persisted passphrase for vanish mode for privacy
    localStorage.removeItem("jayara_passphrase");
    localStorage.setItem("jayara_username", currentUser);
    localStorage.setItem("jayara_room", currentRoom);
    localStorage.setItem("jayara_mode", currentMode);
  }
}

function loadPersistentInfo() {
  const uname = localStorage.getItem("jayara_username");
  const room = localStorage.getItem("jayara_room");
  const pass = localStorage.getItem("jayara_passphrase");
  const mode = localStorage.getItem("jayara_mode");
  if (uname) document.getElementById("username").value = uname;
  if (room) document.getElementById("room").value = room;
  if (mode) document.getElementById("mode").value = mode;
  if (pass && mode === "storage") document.getElementById("passphrase").value = pass;
}

// ---------- cleanup across all rooms (manual button) ----------
function runCleanup() {
  logDebug("Cleanup started (scanning rooms)...");
  const roomsRef = db.ref("rooms");
  const now = Date.now();

  return roomsRef.once("value").then(snap => {
    const promises = [];
    snap.forEach(roomSnap => {
      const roomKey = roomSnap.key;
      // iterate modes (vanish, storage, ...), skip meta if present
      roomSnap.forEach(modeSnap => {
        if (modeSnap.key === "meta") return;
        const modeKey = modeSnap.key;
        const threshold = modeKey === "vanish" ? ONE_DAY_MS : SEVEN_DAYS_MS;
        const modeRef = db.ref(`rooms/${roomKey}/${modeKey}`);

        // check messages in mode
        const p = modeRef.once("value").then(msnap => {
          const deletes = [];