# Playwright MCP 設定指南

## 安裝狀態 ✅
- ✅ **Microsoft 官方 Playwright MCP** v0.0.39 已安裝
- ✅ **Playwright** v1.55.1 已安裝並配置
- ✅ **Chromium 瀏覽器** 已下載就緒
- ✅ **本地 MCP 配置** 已設定完成

## 🎭 Playwright MCP 特色

### **Microsoft 官方支援**
- 由 Playwright 官方團隊維護
- 穩定可靠，定期更新
- 完全免費開源

### **先進技術**
- ✨ **無需截圖**: 使用結構化無障礙樹，不依賴像素
- ⚡ **輕量快速**: 純數據操作，無需視覺模型
- 🎯 **LLM 友善**: 專為 AI 對話優化的介面

### **功能特色**
- 🌐 **網頁導航**: 自動訪問任何 URL
- 📱 **元素互動**: 點擊、填表、捲動等操作
- 📋 **內容提取**: 獲取頁面文字和結構化資料
- 🔍 **元素查找**: 智慧定位頁面元素
- ⚙️ **JavaScript 執行**: 在頁面中執行自定義程式碼

## 🚀 使用方式

### 本地測試 MCP 伺服器
```bash
npm run mcp
```

### Claude Desktop 配置

#### Windows 配置檔案位置:
`%APPDATA%\\Claude\\claude_desktop_config.json`

#### 實際路徑範例:
`C:\\Users\\TIM_PC\\AppData\\Roaming\\Claude\\claude_desktop_config.json`

#### 配置內容:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp"],
      "cwd": "C:\\Users\\TIM_PC\\Desktop\\book"
    }
  }
}
```

**重要提醒**:
- 將 `cwd` 路徑調整為您的專案實際路徑
- 重新啟動 Claude Desktop 以載入配置

## 🛠️ 可用指令

配置完成後，您可以在 Claude Code 中使用：

```
請幫我瀏覽 https://example.com 並擷取主要標題
```

```
請在 Google 搜尋 "playwright tutorial" 並截圖
```

```
請幫我填寫這個表單：[URL] 並提交
```

## 🔧 故障排除

### 如果 MCP 伺服器啟動失敗:
1. 檢查 Node.js 版本 (需要 >= 14)
2. 確認 Playwright 瀏覽器已安裝: `npx playwright install`
3. 檢查防火牆設定

### 如果 Claude Desktop 無法連接:
1. 確認配置檔案路徑正確
2. 重新啟動 Claude Desktop
3. 檢查 Claude Desktop 控制台錯誤訊息

## 📚 技術優勢

### vs. 傳統截圖方式:
- ❌ **截圖方式**: 需要視覺模型分析，慢且不準確
- ✅ **Playwright MCP**: 直接獲取結構化資料，快速準確

### vs. 付費服務:
- ❌ **付費服務**: 需要 API 密鑰和額外費用
- ✅ **Playwright MCP**: 完全免費，本地執行保護隱私

## 🎯 最佳實踐

1. **本地優先**: 所有操作在本機執行，保護隱私
2. **結構化操作**: 利用無障礙樹精確定位元素
3. **錯誤處理**: 內建重試機制，提高可靠性
4. **效能優化**: 避免不必要的視覺處理，專注數據操作

---

🎉 **恭喜！您現在擁有企業級的免費瀏覽器自動化能力！**