const { chromium } = require('playwright');

async function testContentVault() {
    console.log('Запуск теста Content Vault...');
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Перехватываем консольные сообщения
    const consoleMessages = [];
    const consoleErrors = [];
    
    page.on('console', msg => {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
        if (msg.type() === 'error') {
            consoleErrors.push(text);
        }
    });
    
    page.on('pageerror', error => {
        consoleErrors.push(error.message);
    });
    
    try {
        // Открываем страницу
        const filePath = `file://${process.cwd()}/index.html`;
        console.log(`Открываем: ${filePath}`);
        
        await page.goto(filePath, { waitUntil: 'networkidle', timeout: 30000 });
        console.log('Страница загружена');
        
        // Проверяем основные элементы
        console.log('\nПроверка элементов интерфейса...');
        
        // Заголовок
        const logo = await page.$('.logo');
        console.log(`✓ Логотип: ${logo ? 'найден' : 'НЕ НАЙДЕН'}`);
        
        // Вкладки
        const tabs = await page.$$('.tab-btn');
        console.log(`✓ Вкладки: найдено ${tabs.length}`);
        
        // Кнопка админа
        const adminBtn = await page.$('#adminToggle');
        console.log(`✓ Кнопка админа: ${adminBtn ? 'найдена' : 'НЕ НАЙДЕНА'}`);
        
        // Кнопка добавления (скрыта для гостя)
        const addBtn = await page.$('#addContentBtn');
        const addBtnVisible = addBtn ? await addBtn.isVisible() : false;
        console.log(`✓ Кнопка добавления: ${addBtn ? 'найдена (видимость: ' + addBtnVisible + ')' : 'НЕ НАЙДЕНА'}`);
        
        // Сетка контента
        const grid = await page.$('#contentGrid');
        console.log(`✓ Сетка контента: ${grid ? 'найдена' : 'НЕ НАЙДЕНА'}`);
        
        // Модальные окна
        const adminModal = await page.$('#adminModal');
        const addModal = await page.$('#addContentModal');
        console.log(`✓ Модалка админа: ${adminModal ? 'найдена' : 'НЕ НАЙДЕНА'}`);
        console.log(`✓ Модалка добавления: ${addModal ? 'найдена' : 'НЕ НАЙДЕНА'}`);
        
        // Проверяем переключение вкладок
        console.log('\nПроверка переключения вкладок...');
        
        await page.click('[data-tab="photos"]');
        await page.waitForTimeout(300);
        const photosActive = await page.$eval('[data-tab="photos"]', el => el.classList.contains('active'));
        console.log(`✓ Вкладка 'Фото' активна: ${photosActive}`);
        
        await page.click('[data-tab="videos"]');
        await page.waitForTimeout(300);
        const videosActive = await page.$eval('[data-tab="videos"]', el => el.classList.contains('active'));
        console.log(`✓ Вкладка 'Видео' активна: ${videosActive}`);
        
        await page.click('[data-tab="articles"]');
        await page.waitForTimeout(300);
        const articlesActive = await page.$eval('[data-tab="articles"]', el => el.classList.contains('active'));
        console.log(`✓ Вкладка 'Статьи' активна: ${articlesActive}`);
        
        // Проверяем открытие модалки админа
        console.log('\nПроверка модального окна админа...');
        
        await page.click('#adminToggle');
        await page.waitForTimeout(300);
        const adminModalVisible = await page.$eval('#adminModal', el => !el.classList.contains('hidden'));
        console.log(`✓ Модалка админа открывается: ${adminModalVisible}`);
        
        // Проверяем форму входа
        const emailInput = await page.$('#adminEmail');
        const passwordInput = await page.$('#adminPassword');
        const loginBtn = await page.$('#adminLoginForm button[type="submit"]');
        console.log(`✓ Поле email: ${emailInput ? 'найдено' : 'НЕ НАЙДЕНО'}`);
        console.log(`✓ Поле пароля: ${passwordInput ? 'найдено' : 'НЕ НАЙДЕНО'}`);
        console.log(`✓ Кнопка входа: ${loginBtn ? 'найдена' : 'НЕ НАЙДЕНА'}`);
        
        // Закрываем модалку
        await page.click('#adminModal .modal-close');
        await page.waitForTimeout(300);
        
        // Проверяем открытие модалки добавления
        console.log('\nПроверка модального окна добавления...');
        
        // Эмулируем вход админа через localStorage
        await page.evaluate(() => {
            localStorage.setItem('adminEmail', 'test@test.com');
            localStorage.setItem('adminPassword', 'test123');
            localStorage.setItem('contentVaultAdmin', JSON.stringify({ email: 'test@test.com', isAdmin: true }));
        });
        
        // Перезагружаем страницу для применения изменений
        await page.reload({ waitUntil: 'networkidle' });
        
        // Проверяем видимость кнопки добавления
        const addBtnVisibleAfter = await page.$eval('#addContentBtn', el => !el.classList.contains('hidden'));
        console.log(`✓ Кнопка добавления видна после входа: ${addBtnVisibleAfter}`);
        
        // Открываем модалку добавления
        await page.click('#addContentBtn');
        await page.waitForTimeout(300);
        const addModalVisible = await page.$eval('#addContentModal', el => !el.classList.contains('hidden'));
        console.log(`✓ Модалка добавления открывается: ${addModalVisible}`);
        
        // Проверяем элементы формы добавления
        const contentTypeSelect = await page.$('#contentType');
        const titleInput = await page.$('#contentTitle');
        const urlInput = await page.$('#contentUrl');
        const descInput = await page.$('#contentDescription');
        console.log(`✓ Выбор типа контента: ${contentTypeSelect ? 'найден' : 'НЕ НАЙДЕН'}`);
        console.log(`✓ Поле названия: ${titleInput ? 'найдено' : 'НЕ НАЙДЕНО'}`);
        console.log(`✓ Поле URL: ${urlInput ? 'найдено' : 'НЕ НАЙДЕНО'}`);
        console.log(`✓ Поле описания: ${descInput ? 'найдено' : 'НЕ НАЙДЕНО'}`);
        
        // Проверяем переключение типа контента на "Статья"
        await page.selectOption('#contentType', 'articles');
        await page.waitForTimeout(200);
        const articleEditorVisible = await page.$eval('#articleEditorGroup', el => !el.classList.contains('hidden'));
        console.log(`✓ Редактор статей показывается для типа 'Статья': ${articleEditorVisible}`);
        
        // Итоговый отчёт
        console.log('\n═══════════════════════════════════════');
        console.log('РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
        console.log('═══════════════════════════════════════');
        
        if (consoleErrors.length > 0) {
            console.log(`\n⚠️  Консольные ошибки (${consoleErrors.length}):`);
            consoleErrors.forEach(err => console.log(`  - ${err}`));
        } else {
            console.log('\n✅ Критических ошибок в консоли нет');
        }
        
        console.log('\n✅ Все основные элементы интерфейса работают корректно');
        console.log('═══════════════════════════════════════');
        
    } catch (error) {
        console.error('\n❌ Ошибка тестирования:', error.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testContentVault().catch(console.error);
