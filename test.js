const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const errors = [];
    
    // Collect console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });
    
    // Collect page errors
    page.on('pageerror', err => {
        errors.push(err.message);
    });
    
    try {
        // Load the page
        await page.goto(`file://${process.cwd()}/index.html`, { waitUntil: 'networkidle' });
        console.log('Page loaded successfully');
        
        // Wait for content to render
        await page.waitForSelector('.content-card', { timeout: 5000 });
        console.log('Content cards rendered');
        
        // Check if sidebar is visible
        const sidebar = await page.$('.sidebar');
        console.log('Sidebar exists:', !!sidebar);
        
        // Check if header is visible
        const header = await page.$('.header');
        console.log('Header exists:', !!header);
        
        // Check if content grid has cards
        const cards = await page.$$('.content-card');
        console.log(`Content cards found: ${cards.length}`);
        
        // Test search functionality
        await page.fill('#searchInput', 'JavaScript');
        await page.waitForTimeout(500);
        const filteredCards = await page.$$('.content-card');
        console.log(`Cards after search: ${filteredCards.length}`);
        
        // Clear search
        await page.fill('#searchInput', '');
        await page.waitForTimeout(500);
        
        // Test modal opening
        await page.click('#addBtn');
        await page.waitForSelector('.modal-overlay.active', { timeout: 3000 });
        console.log('Modal opens correctly');
        
        // Close modal
        await page.click('#cancelBtn');
        await page.waitForTimeout(300);
        
        // Test navigation filter
        await page.click('[data-filter="video"]');
        await page.waitForTimeout(500);
        const videoCards = await page.$$('.content-card');
        console.log(`Video cards: ${videoCards.length}`);
        
        // Report errors
        if (errors.length > 0) {
            console.log('\nConsole errors found:');
            errors.forEach(e => console.log(`  - ${e}`));
            process.exit(1);
        } else {
            console.log('\nNo console errors detected');
            console.log('\nAll tests passed!');
        }
        
    } catch (err) {
        console.error('Test failed:', err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
