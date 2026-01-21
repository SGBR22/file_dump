// Операции с базой данных Firestore

// Получить URL видео для встраивания
window.getEmbedUrl = function(url) {
    if (!url) return null;
    
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    
    // Vimeo
    const vimeoRegex = /vimeo\.com\/(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    return url;
};

// Добавить документ в коллекцию items
window.addItem = async function(itemData) {
    const db = window.db;
    if (!db) {
        throw new Error('Firebase не инициализирован');
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const docRef = await addDoc(collection(db, 'items'), {
            ...itemData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log('Документ добавлен с ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Ошибка добавления документа:', error);
        throw error;
    }
};

// Удалить документ из коллекции items
window.deleteItem = async function(itemId) {
    const db = window.db;
    if (!db) {
        throw new Error('Firebase не инициализирован');
    }
    
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        await deleteDoc(doc(db, 'items', itemId));
        console.log('Документ удалён:', itemId);
    } catch (error) {
        console.error('Ошибка удаления документа:', error);
        throw error;
    }
};

// Получить все документы из коллекции items
window.getAllItems = async function() {
    const db = window.db;
    if (!db) {
        throw new Error('Firebase не инициализирован');
    }
    
    try {
        const { collection, getDocs, query, orderBy, getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocsFromServer ? getDocsFromServer(q) : getDocs(q);
        
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return items;
    } catch (error) {
        console.error('Ошибка получения документов:', error);
        throw error;
    }
};

// Подписаться на изменения в коллекции items (real-time)
window.subscribeToItems = function(callback) {
    const db = window.db;
    if (!db) {
        console.warn('Firebase не инициализирован, используем локальное хранилище');
        const localItems = JSON.parse(localStorage.getItem('contentVaultItems') || '[]');
        callback(localItems);
        return () => {};
    }
    
    return new Promise(async () => {
        try {
            const { collection, query, orderBy, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => {
                    items.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                callback(items);
            }, (error) => {
                console.error('Ошибка подписки:', error);
                const localItems = JSON.parse(localStorage.getItem('contentVaultItems') || '[]');
                callback(localItems);
            });
            
            return unsubscribe;
        } catch (error) {
            console.error('Ошибка подписки на изменения:', error);
            const localItems = JSON.parse(localStorage.getItem('contentVaultItems') || '[]');
            callback(localItems);
            return () => {};
        }
    });
};

// Сохранить в локальное хранилище (для офлайн режима)
window.saveToLocal = function(items) {
    localStorage.setItem('contentVaultItems', JSON.stringify(items));
};

// Получить из локального хранилища
window.getFromLocal = function() {
    return JSON.parse(localStorage.getItem('contentVaultItems') || '[]');
};
