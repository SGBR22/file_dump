// Глобальное состояние приложения
let currentTab = 'bookmarks';
let isAdmin = false;
let currentUser = null;
let quillEditor = null;
let allItems = [];

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    
    try {
        // Инициализируем Firebase если настроен
        await initFirebase();
        
        // Проверяем состояние авторизации
        checkAuthState();
        
        // Инициализируем подписку на изменения
        initRealtimeUpdates();
        
        // Настраиваем UI
        setupTabs();
        setupModals();
        setupForms();
        setupArticleEditor();
        
        console.log('Приложение инициализировано');
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    } finally {
        hideLoader();
    }
});

// Проверить состояние авторизации
function checkAuthState() {
    // Проверяем localStorage
    const savedAdmin = window.getCurrentAdmin ? window.getCurrentAdmin() : null;
    if (savedAdmin) {
        isAdmin = true;
        currentUser = savedAdmin;
        updateAdminUI();
    }
    
    // Если Firebase настроен, проверяем его состояние
    if (window.isFirebaseReady && window.isFirebaseReady()) {
        window.onAuthStateChanged((user) => {
            if (user) {
                isAdmin = true;
                currentUser = user;
                window.saveAdminState(user);
                updateAdminUI();
            } else {
                // Если не авторизован в Firebase, используем localStorage
                const saved = window.getCurrentAdmin ? window.getCurrentAdmin() : null;
                if (saved) {
                    isAdmin = true;
                    currentUser = saved;
                    updateAdminUI();
                }
            }
        });
    }
}

// Инициализировать real-time обновления
function initRealtimeUpdates() {
    if (window.isFirebaseReady && window.isFirebaseReady()) {
        // Подписка на Firestore
        window.subscribeToItems((items) => {
            allItems = items;
            renderContent();
        });
    } else {
        // Используем локальное хранилище
        allItems = window.getFromLocal ? window.getFromLocal() : [];
        renderContent();
        
        // Показываем уведомление
        showNotification('Firebase не настроен. Используется локальное хранилище.', 'warning');
    }
}

// Настроить вкладки
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            renderContent();
        });
    });
}

// Настроить модальные окна
function setupModals() {
    const adminToggle = document.getElementById('adminToggle');
    const adminModal = document.getElementById('adminModal');
    
    adminToggle.addEventListener('click', () => {
        adminModal.classList.remove('hidden');
    });
    
    const addContentBtn = document.getElementById('addContentBtn');
    const addContentModal = document.getElementById('addContentModal');
    
    addContentBtn.addEventListener('click', () => {
        addContentModal.classList.remove('hidden');
    });
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.add('hidden');
        });
    });
    
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            backdrop.closest('.modal').classList.add('hidden');
        });
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', handleLogout);
}

// Настроить формы
function setupForms() {
    const adminLoginForm = document.getElementById('adminLoginForm');
    adminLoginForm.addEventListener('submit', handleLogin);
    
    const addContentForm = document.getElementById('addContentForm');
    addContentForm.addEventListener('submit', handleAddContent);
    
    const contentType = document.getElementById('contentType');
    contentType.addEventListener('change', () => {
        const urlFieldGroup = document.getElementById('urlFieldGroup');
        const articleEditorGroup = document.getElementById('articleEditorGroup');
        const urlInput = document.getElementById('contentUrl');
        
        if (contentType.value === 'articles') {
            urlFieldGroup.classList.add('hidden');
            articleEditorGroup.classList.remove('hidden');
            urlInput.required = false;
        } else {
            urlFieldGroup.classList.remove('hidden');
            articleEditorGroup.classList.add('hidden');
            if (contentType.value !== 'articles') {
                urlInput.required = true;
            }
        }
    });
}

// Инициализировать редактор статей
function setupArticleEditor() {
    if (!window.Quill) {
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.6/quill.js';
        script.onload = () => {
            initQuillEditor();
        };
        document.head.appendChild(script);
    } else {
        initQuillEditor();
    }
}

function initQuillEditor() {
    quillEditor = new Quill('#articleEditor', {
        theme: 'snow',
        placeholder: 'Напишите вашу статью здесь...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['clean']
            ]
        }
    });
}

// Обработка входа
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');
    const adminStatus = document.getElementById('adminStatus');
    const adminLoginForm = document.getElementById('adminLoginForm');
    
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';
    
    try {
        if (window.isFirebaseReady && window.isFirebaseReady()) {
            // Используем Firebase Auth
            const user = await window.loginAdmin(email, password);
            currentUser = {
                uid: user.uid,
                email: user.email,
                isAdmin: true
            };
            window.saveAdminState(currentUser);
        } else {
            // Используем localStorage для тестирования
            const storedPass = localStorage.getItem('adminPassword');
            const storedEmail = localStorage.getItem('adminEmail');
            
            if (!storedPass) {
                // Создаём нового админа
                localStorage.setItem('adminEmail', email);
                localStorage.setItem('adminPassword', password);
                currentUser = { email, isAdmin: true };
                window.saveAdminState(currentUser);
            } else if (email === storedEmail && password === storedPass) {
                currentUser = { email, isAdmin: true };
                window.saveAdminState(currentUser);
            } else {
                throw new Error('Неверный email или пароль');
            }
        }
        
        isAdmin = true;
        updateAdminUI();
        
        adminLoginForm.classList.add('hidden');
        adminStatus.classList.remove('hidden');
        
        showNotification('Вход выполнен успешно!', 'success');
        
    } catch (error) {
        errorDiv.textContent = getErrorMessage(error);
        errorDiv.classList.remove('hidden');
    }
}

// Обработка выхода
async function handleLogout() {
    try {
        if (window.isFirebaseReady && window.isFirebaseReady()) {
            await window.logoutAdmin();
        }
        
        window.clearAdminState();
        isAdmin = false;
        currentUser = null;
        
        const adminStatus = document.getElementById('adminStatus');
        const adminLoginForm = document.getElementById('adminLoginForm');
        const adminPassword = document.getElementById('adminPassword');
        
        adminStatus.classList.add('hidden');
        adminLoginForm.classList.remove('hidden');
        adminPassword.value = '';
        
        updateAdminUI();
        document.getElementById('adminModal').classList.add('hidden');
        
        showNotification('Вы вышли из системы', 'info');
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// Обработка добавления контента
async function handleAddContent(e) {
    e.preventDefault();
    
    const type = document.getElementById('contentType').value;
    const title = document.getElementById('contentTitle').value.trim();
    const url = document.getElementById('contentUrl').value.trim();
    const description = document.getElementById('contentDescription').value.trim();
    
    if (!title) {
        showNotification('Введите название!', 'error');
        return;
    }
    
    if (type !== 'articles' && !url) {
        showNotification('Введите URL адрес!', 'error');
        return;
    }
    
    const itemData = {
        type,
        title,
        url: type === 'articles' ? '' : url,
        description,
        content: type === 'articles' && quillEditor ? quillEditor.root.innerHTML : ''
    };
    
    try {
        if (window.isFirebaseReady && window.isFirebaseReady()) {
            // Добавляем в Firestore
            await window.addItem(itemData);
        } else {
            // Добавляем в локальное хранилище
            const items = window.getFromLocal ? window.getFromLocal() : [];
            items.unshift({
                id: 'local_' + Date.now(),
                ...itemData,
                createdAt: new Date().toISOString()
            });
            window.saveToLocal(items);
            allItems = items;
        }
        
        document.getElementById('addContentModal').classList.add('hidden');
        e.target.reset();
        if (quillEditor) {
            quillEditor.setContents([]);
        }
        
        renderContent();
        showNotification('Контент добавлен!', 'success');
        
    } catch (error) {
        console.error('Ошибка добавления:', error);
        showNotification('Ошибка добавления контента', 'error');
    }
}

// Удалить контент
async function deleteItem(itemId) {
    if (!confirm('Вы уверены, что хотите удалить этот контент?')) {
        return;
    }
    
    try {
        if (window.isFirebaseReady && window.isFirebaseReady()) {
            // Удаляем из Firestore
            await window.deleteItem(itemId);
        } else {
            // Удаляем из локального хранилища
            const items = window.getFromLocal ? window.getFromLocal().filter(item => item.id !== itemId) : [];
            window.saveToLocal(items);
            allItems = items;
        }
        
        renderContent();
        showNotification('Контент удалён', 'success');
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showNotification('Ошибка удаления контента', 'error');
    }
}

// Отрендерить контент
function renderContent() {
    const grid = document.getElementById('contentGrid');
    const emptyState = document.getElementById('emptyState');
    
    let filteredItems = allItems;
    
    if (currentTab !== 'all') {
        const tabToTypeMap = {
            'bookmarks': 'bookmarks',
            'photos': 'photos',
            'videos': 'videos',
            'articles': 'articles'
        };
        
        filteredItems = allItems.filter(item => item.type === tabToTypeMap[currentTab]);
    }
    
    if (filteredItems.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    grid.innerHTML = filteredItems.map(item => createCardHTML(item)).join('');
    
    setupCardEvents();
}

// Создать HTML карточки
function createCardHTML(item) {
    const typeIcons = {
        'bookmarks': 'fa-bookmark',
        'photos': 'fa-image',
        'videos': 'fa-video',
        'articles': 'fa-newspaper'
    };
    
    const typeLabels = {
        'bookmarks': 'Закладка',
        'photos': 'Фото',
        'videos': 'Видео',
        'articles': 'Статья'
    };
    
    let domain = '';
    if (item.url) {
        try {
            const urlObj = new URL(item.url);
            domain = urlObj.hostname.replace('www.', '');
        } catch (e) {
            domain = item.url;
        }
    }
    
    let date = '';
    if (item.createdAt) {
        const dateObj = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        date = dateObj.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    
    let previewClass = 'card-preview';
    let previewContent = '';
    
    if (item.type === 'photos') {
        previewContent = `<img src="${item.url}" alt="${item.title}" onerror="this.parentElement.innerHTML='<div class=\\'placeholder-icon\\'><i class=\\'fas fa-image\\'></i></div>'">`;
    } else if (item.type === 'videos') {
        previewContent = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;">
                <i class="fas fa-play-circle" style="font-size:48px;color:white;opacity:0.8;"></i>
            </div>
        `;
    } else if (item.type === 'articles') {
        previewContent = `<div class="placeholder-icon"><i class="fas fa-newspaper"></i></div>`;
    } else {
        previewContent = `<div class="placeholder-icon"><i class="fas fa-link"></i></div>`;
    }
    
    const deleteButton = isAdmin ? 
        `<button class="card-delete-btn" data-id="${item.id}" title="Удалить">
            <i class="fas fa-times"></i>
        </button>` : '';
    
    return `
        <div class="card" data-id="${item.id}" data-type="${item.type}" data-url="${item.url || ''}">
            <div class="${previewClass}">
                ${previewContent}
                <div class="card-type-badge">
                    <i class="fas ${typeIcons[item.type]}"></i>
                    ${typeLabels[item.type]}
                </div>
                ${deleteButton}
            </div>
            <div class="card-body">
                <div class="card-title">${escapeHTML(item.title)}</div>
                ${item.description ? `<div class="card-description">${escapeHTML(item.description)}</div>` : ''}
                <div class="card-meta">
                    ${domain ? `<span class="card-domain"><i class="fas fa-link"></i> ${escapeHTML(domain)}</span>` : ''}
                    <span class="card-date">${date}</span>
                </div>
            </div>
        </div>
    `;
}

// Настроить события карточек
function setupCardEvents() {
    document.querySelectorAll('.card-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            deleteItem(itemId);
        });
    });
    
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            const url = card.dataset.url;
            const item = allItems.find(i => i.id === card.dataset.id);
            
            if (type === 'articles' && item) {
                openArticle(item);
            } else if (url) {
                window.open(url, '_blank');
            }
        });
    });
}

// Открыть статью
function openArticle(item) {
    const modal = document.getElementById('articleViewModal');
    const title = document.getElementById('articleTitle');
    const content = document.getElementById('articleContent');
    
    title.textContent = item.title;
    content.innerHTML = item.content || item.description || '';
    
    modal.classList.remove('hidden');
}

// Обновить UI админа
function updateAdminUI() {
    const adminToggle = document.getElementById('adminToggle');
    const addContentBtn = document.getElementById('addContentBtn');
    
    if (isAdmin) {
        adminToggle.classList.add('unlocked');
        adminToggle.querySelector('span').textContent = 'Админ';
        addContentBtn.classList.remove('hidden');
    } else {
        adminToggle.classList.remove('unlocked');
        adminToggle.querySelector('span').textContent = 'Админ';
        addContentBtn.classList.add('hidden');
    }
    
    renderContent();
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                bottom: 24px;
                right: 24px;
                padding: 16px 24px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                gap: 12px;
                color: white;
                font-weight: 500;
                z-index: 2000;
                animation: slideIn 0.3s ease;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            }
            .notification-success { background: #10b981; }
            .notification-error { background: #ef4444; }
            .notification-warning { background: #f59e0b; }
            .notification-info { background: #2563eb; }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Показать/скрыть лоадер
function showLoader() {
    document.getElementById('loader').classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
}

// Получить сообщение об ошибке
function getErrorMessage(error) {
    const errorCodes = {
        'auth/user-not-found': 'Пользователь с таким email не найден',
        'auth/wrong-password': 'Неверный пароль',
        'auth/invalid-email': 'Некорректный email',
        'auth/weak-password': 'Пароль должен содержать минимум 6 символов',
        'auth/email-already-in-use': 'Email уже используется'
    };
    
    return errorCodes[error.code] || error.message || 'Произошла ошибка';
}

// Экранировать HTML
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
