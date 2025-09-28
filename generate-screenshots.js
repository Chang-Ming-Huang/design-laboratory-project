const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class ScreenshotGenerator {
    constructor() {
        this.browser = null;
        this.screenshotsDir = path.join(__dirname, 'screenshots');
        this.prototypesDir = path.join(__dirname, 'prototypes');
        this.manifestPath = path.join(__dirname, 'files-manifest.json');
    }

    async init() {
        // 確保截圖資料夾存在
        try {
            await fs.access(this.screenshotsDir);
        } catch {
            await fs.mkdir(this.screenshotsDir, { recursive: true });
            console.log(`✅ 已建立 screenshots 資料夾`);
        }

        // 啟動瀏覽器
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log(`🚀 Puppeteer 瀏覽器已啟動`);
    }

    async getPrototypeFiles() {
        try {
            const files = await fs.readdir(this.prototypesDir);
            return files.filter(file => file.endsWith('.html'));
        } catch (error) {
            console.error('❌ 無法讀取 prototypes 資料夾:', error);
            return [];
        }
    }

    async captureScreenshot(filename) {
        const page = await this.browser.newPage();

        try {
            // 設定桌機視窗大小
            await page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });

            // 載入頁面
            const filePath = path.join(this.prototypesDir, filename);
            const fileUrl = `file://${filePath}`;

            await page.goto(fileUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // 等待頁面完全載入
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 截圖設定
            const screenshotName = filename.replace('.html', '.png');
            const screenshotPath = path.join(this.screenshotsDir, screenshotName);

            await page.screenshot({
                path: screenshotPath,
                type: 'png',
                clip: {
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080
                }
            });

            console.log(`📸 已截圖: ${filename} -> ${screenshotName}`);
            return screenshotName;

        } catch (error) {
            console.error(`❌ 截圖失敗 ${filename}:`, error.message);
            return null;
        } finally {
            await page.close();
        }
    }

    async generateAllScreenshots() {
        const files = await this.getPrototypeFiles();
        console.log(`📂 發現 ${files.length} 個原型文件`);

        const results = [];
        const batchSize = 5; // 一次處理 5 個檔案，避免內存問題

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            console.log(`\n📦 處理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)} (${batch.length} 個檔案)`);

            for (const filename of batch) {
                console.log(`   🎯 處理: ${filename}`);
                const screenshotName = await this.captureScreenshot(filename);
                results.push({
                    filename,
                    screenshot: screenshotName,
                    success: screenshotName !== null
                });
            }

            // 批次間稍作停頓
            if (i + batchSize < files.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results;
    }

    async updateManifest(screenshotResults) {
        try {
            // 讀取現有的 manifest
            const manifestData = await fs.readFile(this.manifestPath, 'utf8');
            const manifest = JSON.parse(manifestData);

            // 建立截圖對應表
            const screenshotMap = {};
            screenshotResults.forEach(result => {
                if (result.success) {
                    screenshotMap[result.filename] = result.screenshot;
                }
            });

            // 更新檔案列表，添加截圖資訊
            manifest.files = manifest.files.map(file => ({
                ...file,
                screenshot: screenshotMap[file.name] || null
            }));

            // 更新元數據
            manifest.metadata.lastScreenshotUpdate = new Date().toISOString();
            manifest.metadata.screenshotsGenerated = Object.keys(screenshotMap).length;

            // 寫回檔案
            await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
            console.log(`✅ 已更新 files-manifest.json，包含 ${Object.keys(screenshotMap).length} 個截圖`);

        } catch (error) {
            console.error('❌ 更新 manifest 失敗:', error);
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log(`🔚 Puppeteer 瀏覽器已關閉`);
        }
    }

    async run() {
        console.log(`🎨 開始生成截圖...`);

        try {
            await this.init();
            const results = await this.generateAllScreenshots();
            await this.updateManifest(results);

            const successCount = results.filter(r => r.success).length;
            console.log(`\n🎉 截圖生成完成！`);
            console.log(`   成功: ${successCount} 個`);
            console.log(`   失敗: ${results.length - successCount} 個`);

        } catch (error) {
            console.error('❌ 截圖生成過程出錯:', error);
        } finally {
            await this.cleanup();
        }
    }
}

// 執行截圖生成
if (require.main === module) {
    const generator = new ScreenshotGenerator();
    generator.run().catch(console.error);
}

module.exports = ScreenshotGenerator;