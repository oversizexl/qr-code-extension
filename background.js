// background.js - Service Worker for Chrome Extension

// QR码API列表 - 多个免费API确保可靠性
const QR_APIS = [
  {
    name: 'QR Server',
    url: (text) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`,
    timeout: 5000
  },
  {
    name: 'QuickChart',
    url: (text) => `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=200`,
    timeout: 5000
  },
  {
    name: 'API Ninjas',
    url: (text) => `https://api.api-ninjas.com/v1/qrcode?data=${encodeURIComponent(text)}&format=png&size=200`,
    timeout: 5000,
    headers: { 'X-Api-Key': 'YqERyTsTYXzceCD4a1AwpA==Mwnc0KYDglCkYSf0','Accept':'image/png'} // 每月限制 10000 次请求
  }
];

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);

  if (request.action === 'generateQR') {
    // 检查是否已经有生成好的二维码（离线生成）
    if (request.qrDataURL) {
      console.log('Using offline generated QR code');
      // 直接使用离线生成的二维码数据
      sendQRToTab(request.text, request.qrDataURL, sender.tab.id);
      sendResponse({success: true, source: 'offline'});
    } else {
      console.log('Generating QR code online');
      // 使用在线API生成二维码
      generateQRCodeWithMultipleAPIs(request.text, sender.tab.id);
      sendResponse({success: true, source: 'online'});
    }
  } else if (request.action === 'generateCustomAPI') {
    // 处理自定义API请求
    console.log('Background - Processing custom API request:', request.apiConfig);
    generateCustomAPIQR(request.text, request.apiConfig).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({success: false, error: error.message});
    });
    return true; // 保持消息通道开放用于异步响应
  } else if (request.action === 'testCustomApi') {
    // 测试自定义API
    testCustomApiEndpoint(request.apiConfig, request.testText).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({success: false, error: error.message});
    });
    return true; // 保持消息通道开放用于异步响应
  }
  return true;
});

// 使用多个API生成二维码，确保高成功率
async function generateQRCodeWithMultipleAPIs(text, tabId) {
  console.log('Generating QR with multiple APIs for:', text);
  const startTime = Date.now();

  // 检查是否使用自定义API
  const settings = await new Promise((resolve) => {
    chrome.storage.local.get([
      'useCustomApi',
      'customApiUrl',
      'customApiHeaders',
      'customApiTimeout'
    ], resolve);
  });

  console.log('Background - loaded settings:', settings);

  if (settings.useCustomApi &&
      settings.customApiUrl &&
      settings.customApiUrl.includes('{TEXT}') &&
      (settings.customApiUrl.startsWith('http://') || settings.customApiUrl.startsWith('https://'))) {
    console.log('✅ Background - Using custom API:', settings.customApiUrl);

    try {
      const result = await generateCustomAPIQR(text, {
        url: settings.customApiUrl,
        headers: settings.customApiHeaders,
        timeout: settings.customApiTimeout
      });

      if (result.success) {
        console.log(`✅ QR generated successfully with custom API in ${Date.now() - startTime}ms`);
        // 直接发送到tab，因为我们已经有了qrDataURL
        sendQRToTab(text, result.qrDataURL, tabId);
        return;
      }
      console.log('❌ Custom API returned false but did not throw error');
    } catch (error) {
      console.log(`❌ Custom API failed:`, error.message);
      // 继续使用默认API作为备用
    }
  } else {
    if (settings.useCustomApi) {
      console.log('⚠️ Background - Custom API is enabled but not properly configured:', {
        hasUrl: !!settings.customApiUrl,
        hasTextPlaceholder: settings.customApiUrl?.includes('{TEXT}'),
        hasValidProtocol: settings.customApiUrl?.startsWith('http://') || settings.customApiUrl?.startsWith('https://')
      });
    } else {
      console.log('ℹ️ Background - Custom API is disabled, using default APIs');
    }
  }

  // 依次尝试所有默认API
  for (let i = 0; i < QR_APIS.length; i++) {
    const api = QR_APIS[i];
    console.log(`Trying API ${i + 1}/${QR_APIS.length}: ${api.name}`);

    try {
      const success = await generateQRCodeAPI(text, tabId, api);
      if (success) {
        console.log(`✅ QR generated successfully with ${api.name} in ${Date.now() - startTime}ms`);
        return;
      }
    } catch (error) {
      console.log(`❌ ${api.name} failed:`, error.message);
      continue; // 尝试下一个API
    }
  }

  // 所有API都失败了，使用最后的备用方案
  console.error('All QR APIs failed, using text fallback');
  generateTextFallback(text, tabId);
}

// 单个API生成二维码
async function generateQRCodeAPI(text, tabId, api) {
  return new Promise(async (resolve, reject) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), api.timeout);

      const fetchOptions = {
        signal: controller.signal,
        method: 'GET'
      };

      // 如果API需要headers
      if (api.headers) {
        fetchOptions.headers = api.headers;
      }

      const response = await fetch(api.url(text), fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('image')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Empty response');
      }

      // 转换为DataURL并发送
      const reader = new FileReader();
      reader.onloadend = function() {
        const qrDataURL = reader.result;
        sendQRToTab(text, qrDataURL, tabId);
        resolve(true);
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);

    } catch (error) {
      if (error.name === 'AbortError') {
        reject(new Error('Request timeout'));
      } else {
        reject(error);
      }
    }
  });
}

// 发送二维码到tab
function sendQRToTab(text, qrDataURL, tabId) {
  // 存储到本地
  chrome.storage.local.set({
    lastText: text,
    lastQRCode: qrDataURL
  });

  // 发送消息给content script显示侧边栏
  chrome.tabs.sendMessage(tabId, {
    action: 'showQRSidebar',
    text: text,
    qrDataURL: qrDataURL
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to send message to tab:', chrome.runtime.lastError);
    } else {
      console.log('Message sent successfully to tab');
    }
  });
}

// 最后的备用方案：生成文本显示
function generateTextFallback(text, tabId) {
  console.log('Using text fallback display');

  const canvas = new OffscreenCanvas(250, 250);
  const ctx = canvas.getContext('2d');

  // 白色背景
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 250, 250);

  // 绘制边框
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 230, 230);

  // 标题
  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('📱 二维码', 125, 40);

  // 错误提示
  ctx.fillStyle = '#ff6b6b';
  ctx.font = '12px Arial';
  ctx.fillText('⚠️ 网络连接问题', 125, 65);
  ctx.fillText('无法生成二维码', 125, 85);

  // 分割线
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 100);
  ctx.lineTo(220, 100);
  ctx.stroke();

  // 显示文本内容
  ctx.fillStyle = '#666';
  ctx.font = '11px Arial';
  ctx.fillText('选中的文字：', 125, 125);

  const maxLength = 25;
  const lines = [];
  for (let i = 0; i < text.length; i += maxLength) {
    lines.push(text.substring(i, i + maxLength));
  }

  ctx.fillStyle = '#333';
  ctx.font = '10px monospace';
  lines.slice(0, 10).forEach((line, index) => {
    ctx.fillText(line, 125, 150 + index * 12);
  });

  if (lines.length > 10) {
    ctx.fillStyle = '#999';
    ctx.font = '9px Arial';
    ctx.fillText('...', 125, 150 + 10 * 12);
  }

  // 底部说明
  ctx.fillStyle = '#999';
  ctx.font = '9px Arial';
  ctx.fillText('请检查网络连接后重试', 125, 230);

  canvas.convertToBlob({ type: 'image/png' }).then(blob => {
    const reader = new FileReader();
    reader.onloadend = function() {
      sendQRToTab(text, reader.result, tabId);
    };
    reader.readAsDataURL(blob);
  });
}

// 处理自定义API二维码生成
async function generateCustomAPIQR(text, apiConfig) {
  console.log('🔧 Background - Starting custom API generation with config:', apiConfig);

  return new Promise(async (resolve, reject) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('⏰ Background - Custom API request timed out');
      }, apiConfig.timeout || 5000);

      const fetchOptions = {
        signal: controller.signal,
        method: 'GET'
      };

      // 添加自定义请求头
      if (apiConfig.headers) {
        try {
          fetchOptions.headers = typeof apiConfig.headers === 'string'
            ? JSON.parse(apiConfig.headers)
            : apiConfig.headers;
          console.log('📋 Background - Using custom headers:', fetchOptions.headers);
        } catch (e) {
          console.warn('⚠️ Background - Invalid custom headers, ignoring:', e);
        }
      }

      const url = apiConfig.url.replace('{TEXT}', encodeURIComponent(text));
      console.log('🌐 Background - Fetching from custom API:', url);

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      console.log('📡 Background - Custom API response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('📄 Background - Custom API content type:', contentType);

      if (!contentType || !contentType.includes('image')) {
        throw new Error(`Invalid content type: ${contentType}. Expected image/* but got ${contentType}`);
      }

      const blob = await response.blob();
      console.log('📦 Background - Custom API blob size:', blob.size);

      if (blob.size === 0) {
        throw new Error('Empty response from custom API');
      }

      // 转换为DataURL
      const reader = new FileReader();
      reader.onloadend = function() {
        const qrDataURL = reader.result;
        console.log('✅ Background - Custom API QR data URL generated, length:', qrDataURL.length);
        resolve({
          success: true,
          qrDataURL: qrDataURL,
          source: 'custom-api'
        });
      };

      reader.onerror = (error) => {
        console.error('❌ Background - Failed to read blob from custom API:', error);
        reject(new Error('Failed to read blob from custom API'));
      };

      reader.readAsDataURL(blob);

    } catch (error) {
      console.error('❌ Background - Custom API error:', error);
      if (error.name === 'AbortError') {
        reject(new Error('Custom API request timeout'));
      } else {
        reject(error);
      }
    }
  });
}

// 安装时创建右键菜单
chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: "generateQRFromSelection",
    title: "生成二维码",
    contexts: ["selection"]
  });
});

// 测试自定义API端点
async function testCustomApiEndpoint(apiConfig, testText) {
  console.log('🧪 Background - Testing custom API endpoint');

  // 重用generateCustomAPIQR函数来测试API
  try {
    const result = await generateCustomAPIQR(testText, apiConfig);
    if (result.success) {
      return {success: true, message: 'API测试成功'};
    } else {
      throw new Error('API test failed');
    }
  } catch (error) {
    throw error;
  }
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === "generateQRFromSelection") {
    console.log('Background - Right-click QR generation requested for:', info.selectionText);

    // 直接使用统一的API生成逻辑（包括自定义API支持）
    generateQRCodeWithMultipleAPIs(info.selectionText, tab.id);
  }
});