// -------------------- Firebase Initialization --------------------
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.appspot.com",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -------------------- Global Variables --------------------
let username, currentRoom, passphrase, mode;
let localDB;

// -------------------- IndexedDB Setup --------------------
const request = indexedDB.open("JayaraChatDB", 1);
request.onupgradeneeded = function(e) {
  localDB = e.target.result;
  if(!localDB.objectStoreNames.contains("messages")) {
    localDB.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
  }
};
request.onsuccess = function(e) { localDB = e.target.result; displayMessages(); };

// -------------------- Join Room --------------------
function joinRoom() {
  username = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  passphrase = document.getElementById("passphrase").value.trim();
  mode = document.getElementById("mode").value;

  if(!username || !currentRoom || !passphrase) { alert("Enter all fields!"); return; }

  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  if(mode === "storage") document.getElementById("deleteBtn").style.display = "inline-block";

  listenFirebaseMessages();
  displayMessages();
}

// -------------------- Send Message --------------------
function sendMessage() {
  const msgBox = document.getElementById("msgBox");
  let text = msgBox.value.trim();
  if(!text) return;

  // Encrypt message
  const encrypted = CryptoJS.AES.encrypt(text, passphrase).toString();

  const msgData = {
    room: currentRoom,
    senderName: username,
    text: encrypted,
    timestamp: Date.now(),
    vanish: (mode === "vanish")
  };

  db.ref("messages/"+currentRoom).push(msgData);

  if(mode === "storage") storeLocalMessage(text, username, username, mode);
  msgBox.value = "";
}

// -------------------- Firebase Listener --------------------
function listenFirebaseMessages() {
  const roomRef = db.ref("messages/"+currentRoom);
  roomRef.off(); // prevent duplicate listeners
  roomRef.on("child_added", snap => {
    const data = snap.val();

    // Ignore vanish messages if already handled
    if(data.vanish && mode === "vanish") {
      const decrypted = CryptoJS.AES.decrypt(data.text, passphrase).toString(CryptoJS.enc.Utf8);
      displayMessage(data.senderName, decrypted, "vanish");
      // auto-delete vanish message after 24h
      setTimeout(()=> { snap.ref.remove(); }, 24*60*60*1000);
    }

    if(!data.vanish && mode === "storage") {
      const decrypted = CryptoJS.AES.decrypt(data.text, passphrase).toString(CryptoJS.enc.Utf8);
      storeLocalMessage(decrypted, data.senderName, data.senderName, "storage");
    }
  });
}

// -------------------- Local Storage --------------------
function storeLocalMessage(text, senderID, senderName, msgMode) {
  if(!localDB || msgMode === "vanish") return;

  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  store.add({ room: currentRoom, mode: msgMode, senderID, senderName, text, timestamp: Date.now() });
  tx.oncomplete = displayMessages;
}

// -------------------- Display Messages --------------------
function displayMessages() {
  if(!localDB) return;
  const container = document.getElementById("messages");
  container.innerHTML = "";

  const tx = localDB.transaction(["messages"], "readonly");
  const store = tx.objectStore("messages");
  const req = store.getAll();
  req.onsuccess = e => {
    const msgs = e.target.result.filter(msg => msg.room === currentRoom && msg.mode === mode);
    msgs.sort((a,b)=> a.timestamp - b.timestamp);
    msgs.forEach(msg => {
      const div = document.createElement("div");
      const who = (msg.senderName === username) ? "me" : "other";
      div.className = "msg "+who;
      div.innerHTML = `<span class="username">${msg.senderName}</span>: ${msg.text}`;
      if(msg.mode === "storage") {
        const delBtn = document.createElement("button");
        delBtn.innerHTML = "🗑️";
        delBtn.onclick = () => deleteMessage(msg.id);
        div.appendChild(delBtn);
      }
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  };
}

// -------------------- Delete Message --------------------
function deleteMessage(id) {
  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  store.delete(id);
  displayMessages();
}

// -------------------- Clear Local Messages --------------------
function clearLocalMessages() {
  if(!localDB) return;
  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  const req = store.getAll();
  req.onsuccess = e => {
    const msgs = e.target.result.filter(msg => msg.room === currentRoom && msg.mode === "storage");
    msgs.forEach(msg => store.delete(msg.id));
    displayMessages();
  };
}

// -------------------- Leave Room --------------------
function leaveRoom() {
  currentRoom = null;
  document.getElementById("chatArea").style.display = "none";
  document.getElementById("leaveBtn").style.display = "none";
  document.getElementById("deleteBtn").style.display = "none";
  document.getElementById("messages").innerHTML = "";
}