// Importar as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, query, where, orderBy, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

// Sua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCBjOXFyg_6R9NnHGabhblQoF77snayIDk",
  authDomain: "mundo-maromba-fit.firebaseapp.com",
  projectId: "mundo-maromba-fit",
  storageBucket: "mundo-maromba-fit.firebasestorage.app",
  messagingSenderId: "41123756405",
  appId: "1:41123756405:web:5559be1761b0100e2c3b3c"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Disponibilizar para todo o site (window = janela do navegador)
window.db = db;
window.auth = auth;
window.collection = collection;
window.addDoc = addDoc;
window.getDocs = getDocs;
window.getDoc = getDoc;
window.doc = doc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.runTransaction = runTransaction;
window.writeBatch = writeBatch;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.onAuthStateChanged = onAuthStateChanged;
window.signOut = signOut;

console.log("🔥 Firebase configurado com sucesso!");
