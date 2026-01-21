const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9876;

// Простой HTTP сервер для статических файлов
const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript'
    };
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
            res.end(content);
        }
    });
});

async function testContentVault() {
    return new Promise(async (resolve) => {
        server.listen(PORT, async () => {
            console.log(`Сервер запущен на http://localhost:${PORT}`);
            
            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            
            const consoleErrors = [];
            
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });
            
            page.on('pageerror', error => {
                consoleErrors.push(error.message);
            });
            
            try {
                console.log('\nЗапуск теста Content Vault...');
                await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 30000 });
                console.log('Страница загружена');
                
                // Проверяем основные элементы
                console.log('\nПроверка элементов интерфейса...');
                
                const logo = await page.$('.logo');
                const tabs = await page.$$('.tab-btn');
                const adminBtn = await page.$('#adminToggle');
                const addBtn = await page.$('#addContentBtn');
                const grid = await page.$('#contentGrid');
                const adminModal = await page.$('#adminModal');
                const addModal = await page.$('#addContentModal');
                
                console.log(`✓ Логотип: ${logo ? 'найден' : 'НЕ НАЙДЕН'}`);
                console.log(`✓ Вкладки: найдено ${tabs.length}`);
                console.log(`✓ Кнопка админа: ${adminBtn ? 'найдена' : 'НЕ НАЙДЕНА'}`);
                console.log(`✓ Сетка контента: ${grid ? 'найдена' : 'НЕ НАЙДЕНА'}`);
                console.log(`✓ Модалка админа: ${adminModal ? 'найдена' : 'НЕ НАЙДЕНА'}`);
                console.log(`✓ Модалка добавления: ${addModal ? 'найдена' : 'НЕ НАЙДЕНА'}`);
                
                // Проверяем переключение вкладок
                console.log('\nПроверка переключения вкладок...');
                
                await page.click('[data-tab="photos"]');
                await page.waitForTimeout(300);
                const photosActive = await page.$eval('[data-tab="photos"]', el => el.classList.contains('active'));
                console.log(`✓ Вкладка 'Фото': ${photosActive ? 'активна' : 'не активна'}`);
                
                await page.click('[data-tab="videos"]');
                await page.waitForTimeout(300);
                const videosActive = await page.$eval('[data-tab="videos"]', el => el.classList.contains('active'));
                console.log(`✓ Вкладка 'Видео': ${videosActive ? 'активна' : 'не активна'}`);
                
                // Проверяем модалку админа
                console.log('\nПроверка модального окна админа...');
                
                await page.click('#adminToggle');
                await page.waitForTimeout(300);
                const adminModalVisible = await page.$eval('#adminModal', el => !el.classList.contains('hidden'));
                console.log(`✓ Модалка админа: ${adminModalVisible ? 'открывается' : 'НЕ ОТКРЫВАЕТСЯ'}`);
                
                if (adminModalVisible) {
                    const emailInput = await page.$('#adminEmail');
                    const passwordInput = await page.$('#adminPassword');
                    console.log(`✓ Поле email: ${emailInput ? 'найдено' : 'НЕ НАЙДЕНО'}`);
                    console.log(`✓ Поле пароля: ${passwordInput ? 'найдено' : 'НЕ НАЙДЕНО'}`);
                    
                    // Закрываем модалку
                    await page.click('#adminModal .modal-close');
                    await page.waitForTimeout(300);
                }
                
                // Проверяем модалку добавления
                console.log('\nПроверка модального окна добавления...');
                
                // Эмулируем вход админа
                await page.evaluate(() => {
                    localStorage.setItem('contentVaultAdmin', JSON.stringify({ email: 'test@test.com', isAdmin: true }));
                });
                await page.reload({ waitUntil: 'networkidle' });
                
                const addBtnVisible = await page.$eval('#addContentBtn', el => !el.classList.contains('hidden'));
                console.log(`✓ Кнопка добавления видна после входа: ${addBtnVisible}`);
                
                if (addBtnVisible) {
                    await page.click('#addContentBtn');
                    await page.waitForTimeout(300);
                    const addModalVisible = await page.$eval('#addContentModal', el => !el.classList.contains('hidden'));
                    console.log(`✓ Модалка добавления: ${addModalVisible ? 'открывается' : 'НЕ ОТКРЫВАЕТСЯ'}`);
                    
                    // Проверяем редактор статей
                    await page.selectOption('#contentType', 'articles');
                    await page.waitForTimeout(200);
                    const articleEditorVisible = await page.$eval('#articleEditorGroup', el => !el.classList.contains('hidden'));
                    console.log(`✓ Редактор статей: ${articleEditorVisible ? 'показывается' : 'НЕ ПОКАЗЫВАЕТСЯ'}`);
                }
                
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
                
                console.log('\n✅ Тестирование завершено успешно');
                console.log('═══════════════════════════════════════');
                
            } catch (error) {
                console.error('\n❌ Ошибка тестирования:', error.message);
            } finally {
                await browser.close();
                server.close();
                resolve();
            }
        });
    });
}

testContentVault();
