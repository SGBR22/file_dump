// Конфигурация Firebase
// ВАЖНО: Замените значения ниже на свои из Firebase Console
// Инструкция: https://console.firebase.google.com/ -> Проект -> Настройки -> General -> Your apps

const firebaseConfig = {
    apiKey: "AIzaSyAIaL-kSIuy1GfnEXeDdeP92shDdbqT0tI",
    authDomain: "file-dump-2a5ba.firebaseapp.com",
    projectId: "file-dump-2a5ba",
    storageBucket: "file-dump-2a5ba.firebasestorage.app",
  messagingSenderId: "626874517340",
  appId: "1:626874517340:web:24b542f773926277172399",
};

// Глобальные переменные
let app = null;
let db = null;
let auth = null;

// Проверка конфигурации
function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== "YOUR_API_KEY";
}

// Инициализация Firebase
async function initFirebase() {
    if (!isFirebaseConfigured()) {
        console.warn('Firebase не настроен. Будет использоваться localStorage.');
        return false;
    }
    
    try {
        // Динамический импорт Firebase SDK
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        app = initializeApp(firebaseConfig);
        
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        db = getFirestore(app);
        window.db = db;
        console.log('Firebase Firestore инициализирован');
        
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        auth = getAuth(app);
        window.auth = auth;
        console.log('Firebase Auth инициализирован');
        
        return true;
    } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        return false;
    }
}

// Геттеры
window.getDb = function() { return db; };
window.getAuth = function() { return auth; };
window.isFirebaseReady = function() { return db !== null && db !== undefined; };
window.isFirebaseConfigured = isFirebaseConfigured;
window.initFirebase = initFirebase;
