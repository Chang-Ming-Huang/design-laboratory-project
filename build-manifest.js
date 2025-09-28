#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

class ManifestBuilder {
    constructor() {
        this.prototypesDir = path.join(__dirname, 'prototypes');
        this.outputPath = path.join(__dirname, 'files-manifest.json');
    }

    async build() {
        console.log('🔨 開始建立檔案清單...');

        try {
            // 檢查 prototypes 目錄是否存在
            await this.checkPrototypesDirectory();

            // 掃描檔案
            const files = await this.scanFiles();

            // 提取檔案元數據
            const filesWithMetadata = await this.extractMetadata(files);

            // 生成清單
            const manifest = await this.generateManifest(filesWithMetadata);

            // 寫入檔案
            await this.writeManifest(manifest);

            console.log('✅ 檔案清單建立完成！');
            console.log(`📄 生成檔案: ${this.outputPath}`);
            console.log(`📊 包含 ${filesWithMetadata.length} 個 HTML 檔案`);

        } catch (error) {
            console.error('❌ 建立檔案清單失敗:', error.message);
            process.exit(1);
        }
    }

    async checkPrototypesDirectory() {
        try {
            await fs.access(this.prototypesDir);
            console.log(`📁 找到 prototypes 目錄: ${this.prototypesDir}`);
        } catch (error) {
            throw new Error(`prototypes 目錄不存在: ${this.prototypesDir}`);
        }
    }

    async scanFiles() {
        console.log('🔍 掃描 HTML 檔案...');

        const allFiles = await fs.readdir(this.prototypesDir);

        // 過濾 HTML 檔案，排除 index.html
        const htmlFiles = allFiles.filter(file =>
            file.endsWith('.html') &&
            file !== 'index.html'
        );

        console.log(`🎯 找到 ${htmlFiles.length} 個 HTML 檔案`);

        if (htmlFiles.length === 0) {
            console.warn('⚠️  未找到任何 HTML 檔案');
        } else {
            console.log('📄 檔案列表:');
            htmlFiles.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file}`);
            });
        }

        return htmlFiles;
    }

    async extractMetadata(files) {
        console.log('📋 提取檔案元數據...');

        const filesWithMetadata = [];

        for (const filename of files) {
            try {
                const metadata = await this.extractFileMetadata(filename);

                // 檢查是否有對應的截圖檔案
                const screenshotName = filename.replace('.html', '.png');
                const screenshotPath = path.join(__dirname, 'screenshots', screenshotName);

                try {
                    await fs.access(screenshotPath);
                    metadata.screenshot = screenshotName;
                    console.log(`   ✓ ${filename} - ${metadata.title} (有截圖)`);
                } catch {
                    console.log(`   ✓ ${filename} - ${metadata.title} (無截圖)`);
                }

                filesWithMetadata.push(metadata);
            } catch (error) {
                console.warn(`   ⚠️  ${filename} - 無法提取元數據: ${error.message}`);
                // 使用基本元數據
                const basicMetadata = {
                    name: filename,
                    title: this.extractTitleFromFilename(filename),
                    description: '獨立 HTML 藝術作品',
                    lastModified: null,
                    size: 0
                };

                // 也檢查基本元數據的截圖
                const screenshotName = filename.replace('.html', '.png');
                const screenshotPath = path.join(__dirname, 'screenshots', screenshotName);

                try {
                    await fs.access(screenshotPath);
                    basicMetadata.screenshot = screenshotName;
                } catch {
                    // 無截圖檔案
                }

                filesWithMetadata.push(basicMetadata);
            }
        }

        return filesWithMetadata;
    }

    async extractFileMetadata(filename) {
        const filePath = path.join(this.prototypesDir, filename);

        try {
            // 獲取檔案統計資訊
            const stats = await fs.stat(filePath);

            // 讀取檔案內容
            const content = await fs.readFile(filePath, 'utf-8');

            // 提取標題
            const title = this.extractTitle(content, filename);

            // 提取描述
            const description = this.extractDescription(content, title);

            return {
                name: filename,
                title,
                description,
                lastModified: stats.mtime.toISOString(),
                size: Math.round(stats.size / 1024) // KB
            };

        } catch (error) {
            throw new Error(`無法讀取檔案 ${filename}: ${error.message}`);
        }
    }

    extractTitle(content, filename) {
        // 嘗試從 <title> 標籤提取
        const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) {
            let title = titleMatch[1]
                .replace(/🎨|AI 創意作品|-/g, '')
                .trim();

            if (title && title.length > 0) {
                return title;
            }
        }

        // 嘗試從第一個 h1 標籤提取
        const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
        if (h1Match) {
            let title = h1Match[1]
                .replace(/<[^>]*>/g, '') // 移除 HTML 標籤
                .replace(/🎨|✨|🚀|💎|🔥|🌟|⚡|🎯|🌈|🔮|🌿|🏗️|🔤|🌌|💥|🌋|🧬|🌊|🥃|🎭|📝|🎖️|💫|🏆|🎪|🎨/g, '') // 移除 emoji
                .trim();

            if (title && title.length > 0) {
                return title;
            }
        }

        // 使用檔名生成標題
        return this.extractTitleFromFilename(filename);
    }

    extractDescription(content, title) {
        // 嘗試從 meta description 提取
        const metaMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i);
        if (metaMatch) {
            return metaMatch[1];
        }

        // 嘗試從第一個 p 標籤提取
        const pMatch = content.match(/<p[^>]*>(.*?)<\/p>/i);
        if (pMatch) {
            let description = pMatch[1]
                .replace(/<[^>]*>/g, '') // 移除 HTML 標籤
                .trim();

            if (description && description.length > 10 && description.length < 200) {
                return description;
            }
        }

        // 使用預設描述
        return `${title} - 獨立 HTML 藝術作品`;
    }

    extractTitleFromFilename(filename) {
        return filename
            .replace('.html', '')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    async generateManifest(files) {
        // 按修改時間排序（最新的在前）
        const sortedFiles = files.sort((a, b) => {
            if (!a.lastModified && !b.lastModified) return 0;
            if (!a.lastModified) return 1;
            if (!b.lastModified) return -1;
            return new Date(b.lastModified) - new Date(a.lastModified);
        });

        const manifest = {
            metadata: {
                version: '1.0.0',
                generated: new Date().toISOString(),
                generator: 'build-manifest.js',
                description: 'AI 創意實驗室檔案清單 - 供 GitHub Pages 使用',
                totalFiles: files.length
            },
            environment: {
                isStatic: true,
                supportsFileManagement: false,
                platform: 'GitHub Pages'
            },
            files: sortedFiles,
            statistics: {
                totalSize: files.reduce((sum, file) => sum + file.size, 0),
                averageSize: Math.round(files.reduce((sum, file) => sum + file.size, 0) / files.length) || 0,
                newestFile: sortedFiles[0]?.name || null,
                oldestFile: sortedFiles[sortedFiles.length - 1]?.name || null
            }
        };

        return manifest;
    }

    async writeManifest(manifest) {
        const manifestJson = JSON.stringify(manifest, null, 2);
        await fs.writeFile(this.outputPath, manifestJson, 'utf-8');
    }

    // 靜態方法供外部呼叫
    static async build() {
        const builder = new ManifestBuilder();
        await builder.build();
    }
}

// 命令行執行
if (require.main === module) {
    ManifestBuilder.build().catch(error => {
        console.error('❌ 執行失敗:', error);
        process.exit(1);
    });
}

module.exports = ManifestBuilder;