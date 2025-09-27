const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { execSync } = require('child_process');

class DesignLabServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.prototypesDir = path.join(__dirname, 'prototypes');
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // CORS 設定
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080'],
            credentials: true
        }));

        // JSON 解析
        this.app.use(express.json());

        // 靜態檔案服務
        this.app.use(express.static(__dirname));

        // 日誌中間件
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // 首頁路由
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        // API 路由
        this.app.get('/api/files', this.getFiles.bind(this));
        this.app.delete('/api/files/:filename', this.deleteFile.bind(this));
        this.app.get('/api/files/:filename/metadata', this.getFileMetadata.bind(this));

        // 健康檢查
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                prototypesDir: this.prototypesDir
            });
        });

        // 404 處理
        this.app.use((req, res) => {
            res.status(404).json({ error: '找不到請求的資源' });
        });

        // 錯誤處理
        this.app.use((err, req, res, next) => {
            console.error('服務器錯誤:', err);
            res.status(500).json({ error: '內部服務器錯誤' });
        });
    }

    async getFiles(req, res) {
        try {
            // 檢查 prototypes 目錄是否存在
            try {
                await fs.access(this.prototypesDir);
            } catch (error) {
                return res.status(404).json({
                    error: 'prototypes 目錄不存在',
                    path: this.prototypesDir
                });
            }

            // 讀取目錄中的所有檔案
            const files = await fs.readdir(this.prototypesDir);

            // 過濾出 HTML 檔案
            const htmlFiles = files.filter(file =>
                file.endsWith('.html') &&
                file !== 'index.html' // 排除舊的 index.html
            );

            // 為每個檔案提取元數據
            const filesWithMetadata = await Promise.all(
                htmlFiles.map(async (filename) => {
                    try {
                        const metadata = await this.extractFileMetadata(filename);
                        return {
                            name: filename,
                            title: metadata.title,
                            description: metadata.description,
                            lastModified: metadata.lastModified,
                            size: metadata.size
                        };
                    } catch (error) {
                        console.warn(`無法提取 ${filename} 的元數據:`, error.message);
                        return {
                            name: filename,
                            title: this.extractTitleFromFilename(filename),
                            description: '獨立 HTML 藝術作品',
                            lastModified: null,
                            size: 0
                        };
                    }
                })
            );

            // 按修改時間排序（最新的在前）
            filesWithMetadata.sort((a, b) => {
                if (!a.lastModified && !b.lastModified) return 0;
                if (!a.lastModified) return 1;
                if (!b.lastModified) return -1;
                return new Date(b.lastModified) - new Date(a.lastModified);
            });

            res.json(filesWithMetadata);

        } catch (error) {
            console.error('獲取檔案列表失敗:', error);
            res.status(500).json({ error: '無法讀取檔案列表' });
        }
    }

    async extractFileMetadata(filename) {
        const filePath = path.join(this.prototypesDir, filename);

        try {
            // 獲取檔案統計資訊
            const stats = await fs.stat(filePath);

            // 讀取檔案內容提取 title 和 description
            const content = await fs.readFile(filePath, 'utf-8');

            // 提取 title
            const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
            const title = titleMatch
                ? titleMatch[1].replace(/🎨|AI 創意作品|-/g, '').trim()
                : this.extractTitleFromFilename(filename);

            // 提取 description (從 meta description 或第一個 h1/h2)
            let description = '';

            // 嘗試從 meta description 提取
            const metaMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i);
            if (metaMatch) {
                description = metaMatch[1];
            } else {
                // 嘗試從第一個 h1 或 h2 提取
                const headingMatch = content.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);
                if (headingMatch) {
                    description = headingMatch[1].replace(/<[^>]*>/g, '').trim();
                } else {
                    // 使用檔名生成描述
                    description = `${title} - 獨立 HTML 藝術作品`;
                }
            }

            return {
                title,
                description: description || '獨立 HTML 藝術作品',
                lastModified: stats.mtime.toISOString(),
                size: Math.round(stats.size / 1024) // KB
            };

        } catch (error) {
            throw new Error(`無法讀取檔案 ${filename}: ${error.message}`);
        }
    }

    extractTitleFromFilename(filename) {
        return filename
            .replace('.html', '')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    async deleteFile(req, res) {
        try {
            const filename = req.params.filename;

            // 驗證檔名安全性
            if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                return res.status(400).json({ error: '無效的檔案名稱' });
            }

            // 確保只能刪除 HTML 檔案
            if (!filename.endsWith('.html')) {
                return res.status(400).json({ error: '只能刪除 HTML 檔案' });
            }

            // 防止刪除 index.html
            if (filename === 'index.html') {
                return res.status(403).json({ error: '無法刪除 index.html' });
            }

            const filePath = path.join(this.prototypesDir, filename);

            // 檢查檔案是否存在
            try {
                await fs.access(filePath);
            } catch (error) {
                return res.status(404).json({ error: '檔案不存在' });
            }

            // 刪除檔案
            await fs.unlink(filePath);

            console.log(`已刪除檔案: ${filename}`);
            res.json({
                success: true,
                message: `已成功刪除 ${filename}`,
                filename
            });

        } catch (error) {
            console.error('刪除檔案失敗:', error);
            res.status(500).json({ error: '刪除檔案時發生錯誤' });
        }
    }

    async getFileMetadata(req, res) {
        try {
            const filename = req.params.filename;

            if (!filename.endsWith('.html')) {
                return res.status(400).json({ error: '只支援 HTML 檔案' });
            }

            const metadata = await this.extractFileMetadata(filename);
            res.json(metadata);

        } catch (error) {
            console.error('獲取檔案元數據失敗:', error);
            res.status(500).json({ error: '無法獲取檔案元數據' });
        }
    }

    async checkManifestFreshness() {
        const manifestPath = path.join(__dirname, 'files-manifest.json');
        const prototypesDir = this.prototypesDir;

        try {
            // 檢查 manifest 檔案是否存在
            const manifestStat = await fs.stat(manifestPath);
            const manifestTime = manifestStat.mtime;

            // 掃描 prototypes 資料夾內所有 .html 檔案
            const files = await fs.readdir(prototypesDir);
            const htmlFiles = files.filter(f => f.endsWith('.html') && f !== 'index.html');

            // 檢查是否有任何檔案比 manifest 更新
            for (const file of htmlFiles) {
                const fileStat = await fs.stat(path.join(prototypesDir, file));
                if (fileStat.mtime > manifestTime) {
                    return true; // 需要更新
                }
            }

            // 檢查檔案數量是否一致
            try {
                const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
                if (manifest.files && manifest.files.length !== htmlFiles.length) {
                    return true; // 檔案數量不同，需要更新
                }
            } catch (parseError) {
                return true; // manifest 格式錯誤，需要重建
            }

            return false; // 不需要更新
        } catch (error) {
            // manifest 不存在或其他錯誤，需要重建
            return true;
        }
    }

    async ensureManifestUpToDate() {
        console.log('🔍 檢查 manifest 狀態...');

        const needsUpdate = await this.checkManifestFreshness();

        if (needsUpdate) {
            console.log('🔄 偵測到檔案變更，重建 manifest...');
            try {
                execSync('node build-manifest.js', {
                    stdio: 'inherit',
                    cwd: __dirname
                });
                console.log('✅ Manifest 更新完成');
            } catch (error) {
                console.error('❌ Manifest 更新失敗:', error.message);
                console.log('   將繼續啟動伺服器，但網頁版可能無法正確顯示檔案列表');
            }
        } else {
            console.log('✅ Manifest 已是最新版本');
        }
    }

    async start() {
        try {
            // 開發模式下自動檢查並更新 manifest
            if (process.env.NODE_ENV !== 'production') {
                await this.ensureManifestUpToDate();
            }

            // 檢查 prototypes 目錄
            try {
                await fs.access(this.prototypesDir);
                console.log(`✅ prototypes 目錄存在: ${this.prototypesDir}`);
            } catch (error) {
                console.warn(`⚠️  prototypes 目錄不存在: ${this.prototypesDir}`);
                console.log('   請確認項目結構正確');
            }

            // 啟動服務器
            this.server = this.app.listen(this.port, () => {
                console.log(`🚀 AI 創意實驗室服務器已啟動`);
                console.log(`   本機地址: http://localhost:${this.port}`);
                console.log(`   API 端點: http://localhost:${this.port}/api/files`);
                console.log(`   健康檢查: http://localhost:${this.port}/api/health`);
                console.log('');
                console.log('📁 可用的 API 端點:');
                console.log('   GET  /api/files           - 獲取檔案列表');
                console.log('   GET  /api/files/:filename/metadata - 獲取檔案元數據');
                console.log('   DELETE /api/files/:filename - 刪除檔案');
                console.log('   GET  /api/health          - 健康檢查');
                console.log('');
                console.log('🛑 按 Ctrl+C 停止服務器');
            });

        } catch (error) {
            console.error('❌ 服務器啟動失敗:', error);
            process.exit(1);
        }
    }

    async stop() {
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
            console.log('🛑 服務器已停止');
        }
    }
}

// 優雅關閉處理
let server;

async function gracefulShutdown(signal) {
    console.log(`\n收到 ${signal} 信號，正在優雅關閉服務器...`);
    if (server) {
        await server.stop();
    }
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 啟動服務器
if (require.main === module) {
    server = new DesignLabServer();
    server.start().catch(error => {
        console.error('❌ 無法啟動服務器:', error);
        process.exit(1);
    });
}

module.exports = DesignLabServer;