// Глобальное состояние приложения
let currentTab = 'links';
let isAdmin = false;
let currentUser = null;
let quillEditor = null;
let quillContentEditor = null;
let editingItemId = null;
let allItems = [];
let currentTags = []; // Теги текущего элемента
let selectedTagFilter = null; // Выбранный тег для фильтрации

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
    const contentGrid = document.getElementById('contentGrid');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            
            // Добавляем класс list-view для вкладок ссылок и файлов
            if (currentTab === 'links' || currentTab === 'files') {
                contentGrid.classList.add('list-view');
            } else {
                contentGrid.classList.remove('list-view');
            }
            
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
    
    // Настройка тегов
    setupTagInput();
    
    // Настройка загрузки файлов
    setupFileUpload();
    
    // Очистка тегов и файла при сбросе формы
    addContentForm.addEventListener('reset', () => {
        setTimeout(() => {
            currentTags = [];
            renderTagsContainer();
            clearSelectedFile();
        }, 0);
    });
    
    // Настройка очистки фильтров тегов
    const clearFiltersBtn = document.getElementById('clearTagFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            selectedTagFilter = null;
            renderContent();
            updateTagFiltersUI();
        });
    }
}

// Настройка ввода тегов с автодополнением
function setupTagInput() {
    const tagInput = document.getElementById('contentTags');
    const autocomplete = document.getElementById('tagsAutocomplete');
    
    tagInput.addEventListener('input', (e) => {
        const value = e.target.value.trim().toLowerCase();
        
        if (value.length < 1) {
            autocomplete.classList.add('hidden');
            return;
        }
        
        // Получаем все существующие теги из базы
        const allTags = getAllTags();
        const filteredTags = allTags.filter(tag => 
            tag.toLowerCase().includes(value) && 
            !currentTags.includes(tag)
        );
        
        if (filteredTags.length > 0) {
            autocomplete.innerHTML = filteredTags.map(tag => 
                `<div class="autocomplete-item" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</div>`
            ).join('');
            autocomplete.classList.remove('hidden');
        } else {
            autocomplete.classList.add('hidden');
        }
    });
    
    // Клик по элементу автодополнения
    autocomplete.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-item')) {
            const tag = e.target.dataset.tag;
            addTag(tag);
            tagInput.value = '';
            autocomplete.classList.add('hidden');
        }
    });
    
    // Закрытие автодополнения при клике вне
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tags-input-container')) {
            autocomplete.classList.add('hidden');
        }
    });
    
    // Enter для добавления нового тега
    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = tagInput.value.trim();
            if (value && !currentTags.includes(value)) {
                addTag(value);
                tagInput.value = '';
            }
        }
        if (e.key === 'Backspace' && !tagInput.value && currentTags.length > 0) {
            removeTag(currentTags[currentTags.length - 1]);
        }
    });
}

// Получить все существующие теги из базы
function getAllTags() {
    const tags = new Set();
    allItems.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => tags.add(tag));
        }
    });
    return Array.from(tags).sort();
}

// Добавить тег
function addTag(tag) {
    const normalizedTag = tag.trim();
    if (normalizedTag && !currentTags.includes(normalizedTag)) {
        currentTags.push(normalizedTag);
        renderTagsContainer();
    }
}

// Удалить тег
function removeTag(tag) {
    currentTags = currentTags.filter(t => t !== tag);
    renderTagsContainer();
}

// Отрендерить контейнер тегов
function renderTagsContainer() {
    const container = document.getElementById('tagsContainer');
    container.innerHTML = currentTags.map(tag => `
        <span class="tag-chip">
            ${escapeHTML(tag)}
            <i class="fas fa-times" onclick="removeTagFromOutside('${escapeHTML(tag)}')"></i>
        </span>
    `).join('');
}

window.removeTagFromOutside = function(tag) {
    removeTag(tag);
};

// ═══ File Upload Functions ═══
let selectedFile = null;

// Настройка загрузки файлов
function setupFileUpload() {
    const dropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('fileInput');
    const removeFileBtn = document.getElementById('removeFile');
    const sourceUrl = document.getElementById('sourceUrl');
    const sourceFile = document.getElementById('sourceFile');
    
    if (!dropZone || !fileInput) return;
    
    // Клик по drop zone открывает выбор файла
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    // Выбор файла через input
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
    
    // Удаление выбранного файла
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearSelectedFile();
        });
    }
    
    // Переключение между URL и файлом
    if (sourceUrl && sourceFile) {
        sourceUrl.addEventListener('change', () => {
            document.getElementById('urlFieldGroup').classList.remove('hidden');
            document.getElementById('fileFieldGroup').classList.add('hidden');
        });
        
        sourceFile.addEventListener('change', () => {
            document.getElementById('urlFieldGroup').classList.add('hidden');
            document.getElementById('fileFieldGroup').classList.remove('hidden');
        });
    }
}

// Обработка выбранного файла
function handleFileSelect(file) {
    selectedFile = file;
    
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const dropZone = document.getElementById('fileDropZone');
    
    if (fileInfo && fileName) {
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');
    }
}

// Очистить выбранный файл
function clearSelectedFile() {
    selectedFile = null;
    
    const fileInfo = document.getElementById('fileInfo');
    const dropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('fileInput');
    
    if (fileInfo) fileInfo.classList.add('hidden');
    if (dropZone) dropZone.classList.remove('hidden');
    if (fileInput) fileInput.value = '';
    
    // Сбрасываем прогресс
    const progressBar = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    if (progressBar) progressBar.classList.add('hidden');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
}

// Показать прогресс загрузки
function showUploadProgress(percent) {
    const progressBar = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const submitBtn = document.getElementById('submitBtn');
    
    if (progressBar) progressBar.classList.remove('hidden');
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${Math.round(percent)}%`;
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Загрузка ${Math.round(percent)}%`;
    }
}

// Скрыть прогресс загрузки
function hideUploadProgress() {
    const progressBar = document.getElementById('uploadProgress');
    const submitBtn = document.getElementById('submitBtn');
    
    if (progressBar) progressBar.classList.add('hidden');
    
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fas fa-save"></i> Сохранить`;
    }
}

// Обновить видимость полей в зависимости от типа контента
function updateFormFields() {
    const contentType = document.getElementById('contentType').value;
    const urlFieldGroup = document.getElementById('urlFieldGroup');
    const fileFieldGroup = document.getElementById('fileFieldGroup');
    const contentEditorGroup = document.getElementById('contentEditorGroup');
    const urlInput = document.getElementById('contentUrl');
    const sourceToggle = document.querySelector('.source-toggle');
    
    // Скрываем все дополнительные поля по умолчанию
    if (urlFieldGroup) urlFieldGroup.classList.add('hidden');
    if (fileFieldGroup) fileFieldGroup.classList.add('hidden');
    if (contentEditorGroup) contentEditorGroup.classList.add('hidden');
    if (sourceToggle) sourceToggle.classList.add('hidden');
    
    if (contentType === 'articles') {
        // Для статей показываем редактор контента
        if (contentEditorGroup) contentEditorGroup.classList.remove('hidden');
        if (sourceToggle) sourceToggle.classList.remove('hidden');
        if (urlFieldGroup) urlFieldGroup.classList.add('hidden');
        if (fileFieldGroup) fileFieldGroup.classList.add('hidden');
        if (urlInput) urlInput.required = false;
    } else if (contentType === 'files') {
        // Для файлов показываем загрузку файлов
        if (fileFieldGroup) fileFieldGroup.classList.remove('hidden');
        if (sourceToggle) sourceToggle.classList.remove('hidden');
        if (urlFieldGroup) urlFieldGroup.classList.add('hidden');
        if (urlInput) urlInput.required = false;
    } else {
        // Для остальных типов показываем URL
        if (urlFieldGroup) urlFieldGroup.classList.remove('hidden');
        if (sourceToggle) sourceToggle.classList.remove('hidden');
        if (fileFieldGroup) fileFieldGroup.classList.add('hidden');
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
    contentType.value = 'links';
    updateFormFields();
    
    // Сбрасываем теги
    currentTags = [];
    renderTagsContainer();
    
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
    
    // Загружаем теги
    currentTags = item.tags && Array.isArray(item.tags) ? [...item.tags] : [];
    renderTagsContainer();
    
    updateFormFields();
    
    // Обновляем заголовок и кнопку
    formTitle.innerHTML = '<i class="fas fa-edit"></i> Редактировать контент';
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Обновить';
    
    addContentModal.classList.remove('hidden');
}

// Инициализировать редактор статей
function setupArticleEditor() {
    initQuillEditors();
}

function initQuillEditors() {
    // Ждём небольшую задержку чтобы DOM был готов
    setTimeout(() => {
        const editorContainer = document.querySelector('#contentEditor');
        if (!editorContainer) {
            console.error('Контейнер редактора не найден');
            return;
        }
        
        // Проверяем, что Quill доступен
        if (typeof Quill === 'undefined') {
            console.error('Quill.js не загружен');
            return;
        }
        
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
        console.log('Редактор Quill инициализирован');
    }, 100);
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
    const sourceFile = document.getElementById('sourceFile').checked;
    
    if (!title) {
        showNotification('Введите название!', 'error');
        return;
    }
    
    // Проверка источника контента
    let finalUrl = url;
    let storagePath = null;
    let fileData = null;
    
    if (sourceFile && selectedFile) {
        // Загружаем файл
        try {
            const result = await window.uploadFile(selectedFile, (progress) => {
                showUploadProgress(progress);
            });
            finalUrl = result.url;
            storagePath = result.storagePath;
            fileData = {
                fileName: result.fileName,
                fileSize: result.fileSize,
                fileType: result.fileType,
                storagePath: result.storagePath
            };
            hideUploadProgress();
        } catch (error) {
            console.error('Ошибка загрузки файла:', error);
            showNotification('Ошибка загрузки файла', 'error');
            return;
        }
    } else if (type !== 'articles' && type !== 'files' && !url) {
        showNotification('Введите URL адрес!', 'error');
        return;
    }
    
    const itemData = {
        type,
        title,
        url: (type === 'articles' || type === 'files') ? '' : finalUrl,
        description,
        content: type === 'articles' && quillContentEditor ? quillContentEditor.root.innerHTML : '',
        tags: [...currentTags],
        storagePath: storagePath,
        fileData: fileData
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
        
        // Сбрасываем теги и файл
        currentTags = [];
        renderTagsContainer();
        clearSelectedFile();
        
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
        // Находим элемент для получения storagePath
        const item = allItems.find(i => i.id === itemId);
        
        if (window.isFirebaseReady && window.isFirebaseReady()) {
            // Сначала удаляем файл из Storage, затем документ из Firestore
            if (item && item.storagePath) {
                await window.deleteFile(item.storagePath);
            }
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
        filteredItems = allItems.filter(item => {
            if (currentTab === 'links') {
                // Для вкладки ссылок показываем оба типа: links и bookmarks
                return item.type === 'links' || item.type === 'bookmarks';
            }
            if (currentTab === 'files') {
                // Для вкладки файлов показываем загруженные файлы
                return item.type === 'files';
            }
            return item.type === currentTab;
        });
    }
    
    // Фильтрация по тегу
    if (selectedTagFilter) {
        filteredItems = filteredItems.filter(item => 
            item.tags && Array.isArray(item.tags) && 
            item.tags.includes(selectedTagFilter)
        );
    }
    
    // Обновляем UI фильтров тегов
    updateTagFiltersUI();
    
    if (filteredItems.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    grid.innerHTML = filteredItems.map(item => createCardHTML(item)).join('');
    
    setupCardEvents();
}

// Обновить UI фильтров тегов
function updateTagFiltersUI() {
    const filtersContainer = document.getElementById('tagFilters');
    const filtersList = document.getElementById('tagFiltersList');
    
    // Получаем все теги из текущей вкладки
    let relevantItems = allItems;
    if (currentTab !== 'all') {
        const tabToTypeMap = {
            'links': 'links',
            'photos': 'photos',
            'videos': 'videos',
            'articles': 'articles',
            'files': 'files'
        };
        relevantItems = allItems.filter(item => {
            if (currentTab === 'links') {
                return item.type === 'links' || item.type === 'bookmarks';
            }
            if (currentTab === 'files') {
                return item.type === 'files';
            }
            return item.type === currentTab;
        });
    }
    
    // Собираем уникальные теги
    const allTags = new Set();
    relevantItems.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => allTags.add(tag));
        }
    });
    
    const tags = Array.from(allTags).sort();
    
    if (tags.length === 0) {
        filtersContainer.classList.add('hidden');
        return;
    }
    
    filtersContainer.classList.remove('hidden');
    
    filtersList.innerHTML = tags.map(tag => `
        <button class="tag-filter-btn ${selectedTagFilter === tag ? 'active' : ''}" 
                data-tag="${escapeHTML(tag)}">
            ${escapeHTML(tag)}
        </button>
    `).join('');
    
    // Добавляем обработчики
    filtersList.querySelectorAll('.tag-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            if (selectedTagFilter === tag) {
                selectedTagFilter = null;
            } else {
                selectedTagFilter = tag;
            }
            renderContent();
        });
    });
}

// ═══ File Helper Functions ═══

// Получить иконку для типа файла
function getFileIcon(fileName) {
    if (!fileName) return 'fa-file';
    
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        // Документы
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'xls': 'fa-file-excel',
        'xlsx': 'fa-file-excel',
        'ppt': 'fa-file-powerpoint',
        'pptx': 'fa-file-powerpoint',
        'txt': 'fa-file-alt',
        'md': 'fa-file-alt',
        // Архивы
        'zip': 'fa-file-archive',
        'rar': 'fa-file-archive',
        '7z': 'fa-file-archive',
        'tar': 'fa-file-archive',
        'gz': 'fa-file-archive',
        // Изображения
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image',
        'svg': 'fa-file-image',
        'webp': 'fa-file-image',
        // Видео
        'mp4': 'fa-file-video',
        'mov': 'fa-file-video',
        'avi': 'fa-file-video',
        'mkv': 'fa-file-video',
        'webm': 'fa-file-video',
        // Аудио
        'mp3': 'fa-file-audio',
        'wav': 'fa-file-audio',
        'ogg': 'fa-file-audio',
        'flac': 'fa-file-audio',
        // Код
        'js': 'fa-file-code',
        'ts': 'fa-file-code',
        'py': 'fa-file-code',
        'html': 'fa-file-code',
        'css': 'fa-file-code',
        'json': 'fa-file-code',
        'xml': 'fa-file-code',
    };
    
    return iconMap[ext] || 'fa-file';
}

// Форматировать размер файла
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Создать HTML карточки
function createCardHTML(item) {
    const typeIcons = {
        'links': 'fa-link',
        'photos': 'fa-image',
        'videos': 'fa-video',
        'files': 'fa-file',
        'articles': 'fa-newspaper'
    };
    
    const typeLabels = {
        'links': 'Ссылка',
        'photos': 'Фото',
        'videos': 'Видео',
        'files': 'Файл',
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
    
    // Компактный вид для ссылок
    let cardClass = 'card';
    let cardLayout = '';
    
    if (item.type === 'links' || item.type === 'bookmarks') {
        cardClass += ' card-link-compact';
        // Превью ссылки: favicon + название + миниатюра если есть
        const faviconUrl = item.url ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';
        const hasImage = item.imageUrl || item.thumbnail;
        const thumbnailUrl = item.imageUrl || item.thumbnail || '';
        
        cardLayout = `
            <div class="link-preview">
                <div class="link-favicon">
                    <img src="${faviconUrl}" alt="" onerror="this.style.display='none'">
                </div>
                <div class="link-info">
                    <div class="link-title">${escapeHTML(item.title)}</div>
                    <div class="link-domain">${escapeHTML(domain)}</div>
                </div>
                ${hasImage ? `<div class="link-thumbnail"><img src="${escapeHTML(thumbnailUrl)}" alt="" onerror="this.parentElement.remove()"></div>` : ''}
            </div>
        `;
    } else if (item.type === 'files') {
        // Компактный вид для загруженных файлов
        cardClass += ' card-link-compact';
        const fileData = item.fileData || {};
        const fileIcon = getFileIcon(fileData.fileName || '');
        const fileSize = formatFileSize(fileData.fileSize || 0);
        const fileName = fileData.fileName || 'Файл';
        
        cardLayout = `
            <div class="link-preview">
                <div class="link-favicon">
                    <i class="${fileIcon}"></i>
                </div>
                <div class="link-info">
                    <div class="link-title">${escapeHTML(item.title)}</div>
                    <div class="link-domain">${fileName} • ${fileSize}</div>
                </div>
            </div>
        `;
    } else {
        // Обычный вид для фото, видео, статей
        let previewClass = 'card-preview';
        let previewContent = '';
        
        if (item.type === 'photos') {
            previewContent = `<img src="${item.url}" alt="${item.title}" onerror="this.parentElement.innerHTML='<div class=\\'placeholder-icon\\'><i class=\\'fas fa-image\\'></i></div>'">`;
        } else if (item.type === 'videos') {
            previewContent = `
                <div class="video-preview">
                    <i class="fas fa-play-circle"></i>
                </div>
            `;
        } else if (item.type === 'articles') {
            previewContent = `<div class="placeholder-icon"><i class="fas fa-newspaper"></i></div>`;
        } else {
            previewContent = `<div class="placeholder-icon"><i class="fas fa-file"></i></div>`;
        }
        
        cardLayout = `
            <div class="${previewClass}">
                ${previewContent}
                <div class="card-type-badge">
                    <i class="fas ${typeIcons[item.type]}"></i>
                    ${typeLabels[item.type]}
                </div>
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
        `;
    }
    
    // Теги
    let tagsHTML = '';
    if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
        tagsHTML = `<div class="card-tags">${item.tags.map(tag => `<span class="card-tag">${escapeHTML(tag)}</span>`).join('')}</div>`;
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
        <div class="${cardClass}" data-id="${item.id}" data-type="${item.type}" data-url="${item.url || ''}">
            ${cardLayout}
            ${adminButtons}
            ${tagsHTML}
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
    modal.className = 'modal modal-options';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-cog"></i> ${escapeHTML(item.title)}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div style="padding: 24px;">
                <button class="btn btn-primary" style="margin-bottom: 12px;" onclick="openEditModalFromOutside('${item.id}', this)">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
                ${item.type === 'articles' ? `
                    <button class="btn btn-secondary" style="margin-bottom: 12px;" onclick="openArticleFromOutside('${item.id}', this)">
                        <i class="fas fa-book-open"></i> Читать статью
                    </button>
                ` : item.url ? `
                    <button class="btn btn-secondary" style="margin-bottom: 12px;" onclick="window.open('${escapeHTML(item.url)}', '_blank'); closeOptionsModal(this)">
                        <i class="fas fa-external-link-alt"></i> Открыть ссылку
                    </button>
                ` : ''}
                <button class="btn btn-danger" onclick="deleteItemFromOutside('${item.id}', this)">
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

// Закрыть модалку опций
function closeOptionsModal(button) {
    const modal = button.closest('.modal-options');
    if (modal) modal.remove();
}

// Функции для вызова из HTML (для модалок)
window.openEditModalFromOutside = function(itemId, button) {
    const item = allItems.find(i => i.id === itemId);
    if (item) {
        // Закрываем модалку опций перед открытием новой
        const optionsModal = button.closest('.modal-options');
        if (optionsModal) optionsModal.remove();
        
        openEditModal(item);
    }
};

window.openArticleFromOutside = function(itemId, button) {
    const item = allItems.find(i => i.id === itemId);
    if (item) {
        // Закрываем модалку опций перед открытием новой
        const optionsModal = button.closest('.modal-options');
        if (optionsModal) optionsModal.remove();
        
        openArticle(item);
    }
};

window.deleteItemFromOutside = function(itemId, button) {
    // Закрываем модалку опций перед удалением
    const optionsModal = button.closest('.modal-options');
    if (optionsModal) optionsModal.remove();
    
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
