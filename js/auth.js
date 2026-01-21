// Операции аутентификации Firebase Auth

// Войти как администратор
window.loginAdmin = async function(email, password) {
    const auth = window.auth;
    if (!auth) {
        throw new Error('Firebase Auth не инициализирован');
    }
    
    try {
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Вход выполнен:', user.email);
        return user;
    } catch (error) {
        console.error('Ошибка входа:', error);
        throw error;
    }
};

// Выйти из аккаунта
window.logoutAdmin = async function() {
    const auth = window.auth;
    if (!auth) {
        return;
    }
    
    try {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        await signOut(auth);
        console.log('Выход выполнен');
    } catch (error) {
        console.error('Ошибка выхода:', error);
        throw error;
    }
};

// Подписаться на изменения состояния авторизации
window.onAuthStateChanged = function(callback) {
    const auth = window.auth;
    if (!auth) {
        // Firebase не настроен, используем localStorage
        const savedAdmin = localStorage.getItem('contentVaultAdmin');
        callback(savedAdmin ? JSON.parse(savedAdmin) : null);
        return () => {};
    }
    
    return new Promise(async () => {
        try {
            const { onAuthStateChanged: firebaseOnAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            
            const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
                if (user) {
                    callback({
                        uid: user.uid,
                        email: user.email,
                        isAdmin: true
                    });
                } else {
                    callback(null);
                }
            });
            
            return unsubscribe;
        } catch (error) {
            console.error('Ошибка подписки на auth:', error);
            callback(null);
            return () => {};
        }
    });
};

// Сохранить состояние админа в localStorage (для офлайн режима)
window.saveAdminState = function(adminData) {
    localStorage.setItem('contentVaultAdmin', JSON.stringify(adminData));
};

// Очистить состояние админа
window.clearAdminState = function() {
    localStorage.removeItem('contentVaultAdmin');
};

// Проверить, авторизован ли пользователь
window.isAuthenticated = function() {
    return localStorage.getItem('contentVaultAdmin') !== null;
};

// Получить данные текущего админа
window.getCurrentAdmin = function() {
    const saved = localStorage.getItem('contentVaultAdmin');
    return saved ? JSON.parse(saved) : null;
};
