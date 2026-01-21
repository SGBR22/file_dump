// Глобальное состояние приложения
let currentTab = 'bookmarks';
let isAdmin = false;
let currentUser = null;
let quillEditor = null;
let quillContentEditor = null;
let editingItemId = null;
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
    const savedAdmin = window.getCurrentAdmin ? window.getCurrentAdmin() : null;
    if (savedAdmin) {
        isAdmin = true;
        currentUser = savedAdmin;
        updateAdminUI();
    }
    
    if (window.isFirebaseReady && window.isFirebaseReady()) {
        window.onAuthStateChanged((user) => {
            if (user) {
                isAdmin = true;
                currentUser = user;
                window.saveAdminState(user);
                updateAdminUI();
            } else {
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
        window.subscribeToItems((items) => {
            allItems = items;
            renderContent();
        });
    } else {
        allItems = window.getFromLocal ? window.getFromLocal() : [];
        renderContent();
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
        openAddModal();
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
    addContentForm.addEventListener('submit', handleAddOrUpdateContent);
    
    const contentType = document.getElementById('contentType');
    contentType.addEventListener('change', () => {
        updateFormFields();
    });
}

// Обновить видимость полей в зависимости от типа контента
function updateFormFields() {
    const contentType = document.getElementById('contentType').value;
    const urlFieldGroup = document.getElementById('urlFieldGroup');
    const contentEditorGroup = document.getElementById('contentEditorGroup');
    const urlInput = document.getElementById('contentUrl');
    
    // Скрываем все дополнительные поля по умолчанию
    if (urlFieldGroup) urlFieldGroup.classList.add('hidden');
    if (contentEditorGroup) contentEditorGroup.classList.add('hidden');
    
    if (contentType === 'articles') {
        // Для статей показываем редактор контента
        if (contentEditorGroup) contentEditorGroup.classList.remove('hidden');
        if (urlFieldGroup) urlFieldGroup.classList.add('hidden');
        if (urlInput) urlInput.required = false;
    } else {
        // Для остальных типов показываем URL
        if (urlFieldGroup) urlFieldGroup.classList.remove('hidden');
        if (contentEditorGroup) contentEditorGroup.classList.add('hidden');
        if (urlInput) urlInput.required = true;
    }
}

// Открыть модалку добавления
function openAddModal() {
    editingItemId = null;
    const addContentModal = document.getElementById('addContentModal');
    const formTitle = addContentModal.querySelector('h2');
    const submitBtn = addContentForm.querySelector('button[type="submit"]');
    const contentType = document.getElementById('contentType');
    
    // Сбрасываем форму
    document.getElementById('addContentForm').reset();
    
    // Сбрасываем редактор статей
    if (quillContentEditor) {
        quillContentEditor.setContents([]);
    }
    
    // Сбрасываем тип на первый
    contentType.value = 'bookmarks';
    updateFormFields();
    
    // Обновляем заголовок и кнопку
    formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить контент';
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';
    
    addContentModal.classList.remove('hidden');
}

// Открыть модалку редактирования
function openEditModal(item) {
    editingItemId = item.id;
    const addContentModal = document.getElementById('addContentModal');
    const formTitle = addContentModal.querySelector('h2');
    const submitBtn = addContentForm.querySelector('button[type="submit"]');
    const contentType = document.getElementById('contentType');
    
    // Заполняем форму данными элемента
    contentType.value = item.type;
    document.getElementById('contentTitle').value = item.title || '';
    document.getElementById('contentUrl').value = item.url || '';
    document.getElementById('contentDescription').value = item.description || '';
    
    // Заполняем редактор статей
    if (item.type === 'articles' && quillContentEditor) {
        quillContentEditor.root.innerHTML = item.content || '';
    }
    
    updateFormFields();
    
    // Обновляем заголовок и кнопку
    formTitle.innerHTML = '<i class="fas fa-edit"></i> Редактировать контент';
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Обновить';
    
    addContentModal.classList.remove('hidden');
}

// Инициализировать редактор статей
function setupArticleEditor() {
    if (!window.Quill) {
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.6/quill.js';
        script.onload = () => {
            initQuillEditors();
        };
        document.head.appendChild(script);
    } else {
        initQuillEditors();
    }
}

function initQuillEditors() {
    // Редактор для добавления/редактирования статей
    quillContentEditor = new Quill('#contentEditor', {
        theme: 'snow',
        placeholder: 'Напишите полный текст вашей статьи здесь...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, 4, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'indent': '-1'}, { 'indent': '+1' }],
                ['blockquote', 'code-block'],
                ['link', 'image', 'video'],
                ['clean']
            ]
        }
    });
}

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
            const user = await window.loginAdmin(email, password);
            currentUser = {
                uid: user.uid,
                email: user.email,
                isAdmin: true
            };
            window.saveAdminState(currentUser);
        } else {
            const storedPass = localStorage.getItem('adminPassword');
            const storedEmail = localStorage.getItem('adminEmail');
            
            if (!storedPass) {
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

// Добавить или обновить контент
async function handleAddOrUpdateContent(e) {
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
        content: type === 'articles' && quillContentEditor ? quillContentEditor.root.innerHTML : ''
    };
    
    try {
        if (editingItemId) {
            // Редактирование существующего элемента
            await updateItem(editingItemId, itemData);
            showNotification('Контент обновлён!', 'success');
        } else {
            // Добавление нового элемента
            await window.addItem(itemData);
            showNotification('Контент добавлен!', 'success');
        }
        
        document.getElementById('addContentModal').classList.add('hidden');
        e.target.reset();
        if (quillContentEditor) {
            quillContentEditor.setContents([]);
        }
        
        editingItemId = null;
        renderContent();
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка сохранения контента', 'error');
    }
}

// Обновить существующий элемент
async function updateItem(itemId, itemData) {
    if (window.isFirebaseReady && window.isFirebaseReady()) {
        // Обновляем в Firestore
        const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = window.db;
        await updateDoc(doc(db, 'items', itemId), {
            ...itemData,
            updatedAt: serverTimestamp()
        });
        console.log('Документ обновлён:', itemId);
    } else {
        // Обновляем в локальном хранилище
        const items = window.getFromLocal ? window.getFromLocal() : [];
        const index = items.findIndex(item => item.id === itemId);
        if (index !== -1) {
            items[index] = {
                ...items[index],
                ...itemData,
                updatedAt: new Date().toISOString()
            };
            window.saveToLocal(items);
            allItems = items;
        }
    }
}

// Удалить контент
async function deleteItem(itemId) {
    if (!confirm('Вы уверены, что хотите удалить этот контент?')) {
        return;
    }
    
    try {
        if (window.isFirebaseReady && window.isFirebaseReady()) {
            await window.deleteItem(itemId);
        } else {
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
    
    // Кнопки для админа
    let adminButtons = '';
    if (isAdmin) {
        adminButtons = `
            <button class="card-edit-btn" data-id="${item.id}" title="Редактировать">
                <i class="fas fa-pencil-alt"></i>
            </button>
            <button class="card-delete-btn" data-id="${item.id}" title="Удалить">
                <i class="fas fa-times"></i>
            </button>
        `;
    }
    
    return `
        <div class="card" data-id="${item.id}" data-type="${item.type}" data-url="${item.url || ''}">
            <div class="${previewClass}">
                ${previewContent}
                <div class="card-type-badge">
                    <i class="fas ${typeIcons[item.type]}"></i>
                    ${typeLabels[item.type]}
                </div>
                ${adminButtons}
            </div>
            <div class="card-body">
                <div class="card-title">${escapeHTML(item.title)}</div>
                ${item.description ? `<div class="card-description">${escapeHTML(item.description)}</div>` : ''}
                ${item.type === 'articles' && item.content ? `<div class="card-excerpt">${escapeHTML(item.content.replace(/<[^>]*>/g, '').substring(0, 100))}...</div>` : ''}
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
    // Кнопки удаления
    document.querySelectorAll('.card-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            deleteItem(itemId);
        });
    });
    
    // Кнопки редактирования
    document.querySelectorAll('.card-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            const item = allItems.find(i => i.id === itemId);
            if (item) {
                openEditModal(item);
            }
        });
    });
    
    // Клик по карточке
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            const url = card.dataset.url;
            const item = allItems.find(i => i.id === card.dataset.id);
            
            if (isAdmin) {
                // Если админ - показываем меню с опциями
                showItemOptions(item);
            } else {
                // Если гость - просто открываем статью или ссылку
                if (type === 'articles' && item) {
                    openArticle(item);
                } else if (url) {
                    window.open(url, '_blank');
                }
            }
        });
    });
}

// Показать опции для элемента (для админа)
function showItemOptions(item) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-cog"></i> ${escapeHTML(item.title)}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div style="padding: 24px;">
                <button class="btn btn-primary" style="margin-bottom: 12px;" onclick="openEditModalFromOutside('${item.id}')">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
                ${item.type === 'articles' ? `
                    <button class="btn btn-secondary" style="margin-bottom: 12px;" onclick="openArticleFromOutside('${item.id}')">
                        <i class="fas fa-book-open"></i> Читать статью
                    </button>
                ` : item.url ? `
                    <button class="btn btn-secondary" style="margin-bottom: 12px;" onclick="window.open('${escapeHTML(item.url)}', '_blank')">
                        <i class="fas fa-external-link-alt"></i> Открыть ссылку
                    </button>
                ` : ''}
                <button class="btn btn-danger" onclick="deleteItemFromOutside('${item.id}')">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Закрытие модалки
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
}

// Функции для вызова из HTML (для модалок)
window.openEditModalFromOutside = function(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (item) {
        openEditModal(item);
        // Удаляем модалку опций
        const modal = document.querySelector('.modal');
        if (modal) modal.remove();
    }
};

window.openArticleFromOutside = function(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (item) {
        openArticle(item);
        const modal = document.querySelector('.modal');
        if (modal) modal.remove();
    }
};

window.deleteItemFromOutside = function(itemId) {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
    deleteItem(itemId);
};

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
