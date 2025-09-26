let selectedText = '';
let qrCodeButton = null;
let qrSidebar = null;
let isButtonShowing = false;
let sidebarJustShown = false; // 添加保护标志
let isProcessingQR = false; // 全局防抖状态
let extensionSettings = {
  showSelectionButton: true,
  useCustomApi: false
};

// 检测系统主题
function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 获取主题相关的颜色值
function getThemeColors() {
  const isDark = getSystemTheme() === 'dark';
  return {
    isDark,
    background: isDark ? '#1e1e1e' : 'white',
    sidebarHeader: isDark ? '#2d2d2d' : '#f8f9fa',
    textPrimary: isDark ? '#e0e0e0' : '#333',
    textSecondary: isDark ? '#ccc' : '#555',
    border: isDark ? '#333' : '#e0e0e0',
    selectedTextBg: isDark ? '#2d2d2d' : '#f5f5f5',
    qrDisplayBg: isDark ? '#2d2d2d' : '#fafafa',
    buttonCloseBg: isDark ? '#333' : '#e0e0e0',
    toastBg: {
      success: isDark ? '#2E7D32' : '#4CAF50',
      error: isDark ? '#C62828' : '#f44336',
      warning: isDark ? '#F57C00' : '#ff9800',
      info: isDark ? '#1976D2' : '#333'
    }
  };
}

// 初始化扩展设置
function initializeExtensionSettings() {
  chrome.storage.local.get([
    'showSelectionButton',
    'useCustomApi',
    'customApiUrl',
    'customApiHeaders',
    'customApiTimeout'
  ], function(result) {
    extensionSettings = {
      showSelectionButton: result.showSelectionButton !== false, // 默认为true
      useCustomApi: result.useCustomApi || false,
      customApiUrl: result.customApiUrl || '',
      customApiHeaders: result.customApiHeaders || '',
      customApiTimeout: result.customApiTimeout || 5000
    };
    console.log('Extension settings loaded:', extensionSettings);
  });
}

// 页面加载时初始化设置
initializeExtensionSettings();

// 监听系统主题变化
if (window.matchMedia) {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeQuery.addEventListener('change', function(e) {
    console.log('System theme changed to:', e.matches ? 'dark' : 'light');

    // 如果当前有显示的侧边栏，重新应用主题
    if (qrSidebar && qrSidebar.parentNode) {
      const themeColors = getThemeColors();
      qrSidebar.style.background = themeColors.background;
      qrSidebar.style.color = themeColors.textPrimary;
      qrSidebar.style.borderLeft = `1px solid ${themeColors.border}`;
      qrSidebar.style.boxShadow = `-2px 0 10px rgba(0,0,0,${themeColors.isDark ? '0.3' : '0.1'})`;
    }
  });
}
document.addEventListener('mouseup', function(event) {
  // 延迟执行以确保选择完成
  setTimeout(() => {
    const selection = window.getSelection();

    if (selection.rangeCount === 0) {
      console.log('No selection range found');
      return;
    }

    // 获取原始文本（使用 toString()）
    let text = selection.toString();
    const originalText = text;

    // 尝试从DOM获取原始文本内容
    try {
      const range = selection.getRangeAt(0);
      const clonedContents = range.cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(clonedContents);
      const domText = tempDiv.textContent || tempDiv.innerText || '';

      console.log('Selection.toString():', JSON.stringify(originalText));
      console.log('DOM textContent:', JSON.stringify(domText));
      console.log('Are they equal?:', originalText === domText);

      // 如果DOM文本和selection文本不同，使用DOM文本
      if (domText && domText !== originalText) {
        console.log('Using DOM text instead of selection text');
        text = domText;
      }

    } catch (error) {
      console.log('Error getting DOM text, falling back to selection.toString():', error);
    }

    text = text.trim();

    console.log('Final selected text:', JSON.stringify(text));
    console.log('Text character codes:', Array.from(text).map(char => `${char}(${char.charCodeAt(0)})`).join(', '));

    if (text.length > 0) {
      selectedText = text;

      // 获取选中文本的位置
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 计算按钮位置：选中文本的右上角附近
      const buttonX = rect.right + 10; // 选中文本右边10px
      const buttonY = rect.top - 10;   // 选中文本上方10px

      showQRButton(buttonX, buttonY, rect);
    } else if (!qrSidebar) {
      // 没有选中文字且侧边栏不存在时隐藏按钮
      hideQRButton();
    }
  }, 100);
});

// 监听选择变化事件
document.addEventListener('selectionchange', function() {
  // 延迟执行避免与mouseup冲突
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length === 0 && !qrSidebar) {
      hideQRButton();
    }
  }, 150);
});

// 点击其他地方隐藏按钮和侧边栏
document.addEventListener('click', function(event) {
  // 检查是否点击了按钮或侧边栏
  if (qrCodeButton && qrCodeButton.contains(event.target)) {
    return; // 点击按钮时不隐藏
  }

  if (qrSidebar && qrSidebar.contains(event.target)) {
    return; // 点击侧边栏时不隐藏
  }

  // 延迟隐藏，给其他事件处理时间
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    // 如果有侧边栏且保护期已过，允许用户点击外部关闭
    if (qrSidebar && !sidebarJustShown) {
      hideSidebar(true); // 用户主动点击外部，强制关闭
    }
    // 如果没有选中文字且侧边栏不存在，则隐藏按钮
    else if (text.length === 0 && !qrSidebar) {
      hideQRButton();
    }
  }, 200);
});

// 阻止双击选择导致的按钮消失
document.addEventListener('dblclick', function(event) {
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      selectedText = text;

      // 获取选中文本的位置
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const buttonX = rect.right + 10;
      const buttonY = rect.top - 10;

      showQRButton(buttonX, buttonY, rect);
    }
  }, 50);
});

// 显示二维码生成按钮
function showQRButton(x, y, textRect) {
  // 检查是否启用了选择按钮功能
  if (!extensionSettings.showSelectionButton) {
    console.log('Selection button is disabled in settings');
    return;
  }

  if (isButtonShowing) {
    return; // 如果按钮正在显示，不要重复创建
  }

  hideQRButton();
  isButtonShowing = true;

  qrCodeButton = document.createElement('div');
  qrCodeButton.id = 'qr-code-btn';
  qrCodeButton.innerHTML = '📱 生成二维码';

  // 计算最佳位置
  let buttonX = x;
  let buttonY = y;
  const buttonWidth = 120;
  const buttonHeight = 35;

  // 如果按钮会超出右边界，放到文本左边
  if (buttonX + buttonWidth > window.innerWidth) {
    buttonX = textRect.left - buttonWidth - 10;
  }

  // 如果按钮会超出左边界，放到文本右边但调整X坐标
  if (buttonX < 0) {
    buttonX = Math.min(textRect.right + 10, window.innerWidth - buttonWidth - 10);
  }

  // 如果按钮会超出上边界，放到文本下方
  if (buttonY < 0) {
    buttonY = textRect.bottom + 10;
  }

  // 如果按钮会超出下边界，放到文本上方
  if (buttonY + buttonHeight > window.innerHeight) {
    buttonY = textRect.top - buttonHeight - 10;
  }

  // 确保最终位置在屏幕内
  buttonX = Math.max(10, Math.min(buttonX, window.innerWidth - buttonWidth - 10));
  buttonY = Math.max(10, Math.min(buttonY, window.innerHeight - buttonHeight - 10));

  qrCodeButton.style.cssText = `
    position: fixed;
    left: ${buttonX}px;
    top: ${buttonY}px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    user-select: none;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: auto;
    white-space: nowrap;
    border: 2px solid rgba(255,255,255,0.2);
    backdrop-filter: blur(10px);
    font-weight: 500;
  `;

  // 添加一个小箭头指向选中文本
  const arrow = document.createElement('div');
  arrow.style.cssText = `
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
  `;

  // 根据按钮相对于文本的位置决定箭头方向
  if (buttonX < textRect.left) {
    // 按钮在文本左边，箭头指向右边
    arrow.style.cssText += `
      border-left: 6px solid #4CAF50;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      right: -6px;
      top: 50%;
      transform: translateY(-50%);
    `;
  } else if (buttonY < textRect.top) {
    // 按钮在文本上方，箭头指向下方
    arrow.style.cssText += `
      border-top: 6px solid #4CAF50;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
    `;
  } else if (buttonY > textRect.bottom) {
    // 按钮在文本下方，箭头指向上方
    arrow.style.cssText += `
      border-bottom: 6px solid #4CAF50;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
    `;
  } else {
    // 按钮在文本右边，箭头指向左边
    arrow.style.cssText += `
      border-right: 6px solid #4CAF50;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      left: -6px;
      top: 50%;
      transform: translateY(-50%);
    `;
  }

  qrCodeButton.appendChild(arrow);

  // 阻止按钮上的事件冒泡
  qrCodeButton.addEventListener('mousedown', function(e) {
    e.stopPropagation();
  });

  qrCodeButton.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();

    // 防抖检查 - 使用全局状态
    if (isProcessingQR) {
      console.log('🚫 Button click ignored - already processing QR request');
      return;
    }

    console.log('Button clicked, generating QR for:', selectedText);

    // 设置全局处理状态和视觉反馈
    isProcessingQR = true;
    this.style.background = '#45a049';
    this.style.cursor = 'not-allowed';
    this.innerHTML = '⏳ 生成中...';

    // 设置标志防止其他事件干扰
    isButtonShowing = true;

    // 生成二维码
    generateQRCode(selectedText).finally(() => {
      // 2秒后重置处理状态
      setTimeout(() => {
        isProcessingQR = false;
        if (qrCodeButton && qrCodeButton.parentNode) {
          qrCodeButton.style.background = '#4CAF50';
          qrCodeButton.style.cursor = 'pointer';
          qrCodeButton.innerHTML = '📱 生成二维码';
          console.log('🔓 QR processing lock released');
        }
      }, 2000);
    });
  });

  // 增强的悬停效果
  qrCodeButton.addEventListener('mouseenter', function() {
    if (!isProcessingQR) {
      this.style.background = '#45a049';
      this.style.transform = 'translateY(-2px) scale(1.05)';
      this.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.4)';
    }
  });

  qrCodeButton.addEventListener('mouseleave', function() {
    if (!isProcessingQR) {
      this.style.background = '#4CAF50';
      this.style.transform = 'translateY(0) scale(1)';
      this.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
    }
  });

  document.body.appendChild(qrCodeButton);
  console.log('QR button shown'); // 调试日志

  // 8秒后自动隐藏按钮（但不影响侧边栏）
  setTimeout(() => {
    if (qrCodeButton && qrCodeButton.parentNode && !qrSidebar && !isProcessingQR) {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text.length === 0) {
        hideQRButton();
      }
    }
  }, 8000);
}

// 隐藏按钮
function hideQRButton() {
  if (qrCodeButton && qrCodeButton.parentNode) {
    qrCodeButton.remove();
    qrCodeButton = null;
    console.log('QR button hidden'); // 调试日志
  }
  isButtonShowing = false;
}

// 显示侧边栏二维码
function showSidebar(text, qrDataURL) {
  console.log('Showing sidebar with text:', text); // 调试日志

  // 直接清理现有侧边栏，而不是使用hideSidebar()避免动画冲突
  if (qrSidebar && qrSidebar.parentNode) {
    qrSidebar.remove();
    qrSidebar = null;
    console.log('Previous sidebar cleaned up');
  }

  // 获取主题颜色
  const themeColors = getThemeColors();

  qrSidebar = document.createElement('div');
  qrSidebar.id = 'qr-sidebar';
  qrSidebar.innerHTML = `
    <div class="qr-sidebar-header">
      <h3>📱 二维码</h3>
      <button class="qr-close-btn" id="qr-close-btn">×</button>
    </div>
    <div class="qr-sidebar-content">
      <div class="selected-text">
        <strong>选中的文字：</strong><br>
        <div class="text-content">${escapeHtml(text)}</div>
      </div>
      <div class="qr-display">
        <img src="${qrDataURL}" alt="QR Code" />
      </div>
      <div class="qr-actions">
        <button class="qr-copy-btn" id="qr-copy-btn">复制文字</button>
        <button class="qr-download-btn" id="qr-download-btn">保存二维码</button>
      </div>
    </div>
  `;

  // 使用主题适应的样式
  qrSidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: -350px;
    width: 320px;
    height: 100vh;
    background: ${themeColors.background};
    color: ${themeColors.textPrimary};
    box-shadow: -2px 0 10px rgba(0,0,0,${themeColors.isDark ? '0.3' : '0.1'});
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: right 0.3s ease;
    overflow-y: auto;
    border-left: 1px solid ${themeColors.border};
  `;

  document.body.appendChild(qrSidebar);

  // 添加事件监听器
  const closeBtn = qrSidebar.querySelector('#qr-close-btn');
  const copyBtn = qrSidebar.querySelector('#qr-copy-btn');
  const downloadBtn = qrSidebar.querySelector('#qr-download-btn');

  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    hideSidebar(true); // 强制隐藏，忽略保护期
  });

  copyBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      showToast('文字已复制');
    }).catch(err => {
      console.error('复制失败:', err);
      showToast('复制失败');
    });
  });

  downloadBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = qrDataURL;
    link.click();
    showToast('二维码已保存');
  });

  // 立即显示，避免闪现
  requestAnimationFrame(() => {
    qrSidebar.style.right = '0px';
    console.log('Sidebar animation started');
  });

  // 设置保护期，防止立即被隐藏
  sidebarJustShown = true;
  setTimeout(() => {
    sidebarJustShown = false;
    console.log('Sidebar protection period ended');
  }, 300); // 300ms保护期，足够避免意外关闭但不影响用户体验

  // 隐藏按钮并重置状态
  hideQRButton();
  isButtonShowing = false;
}

// 隐藏侧边栏
function hideSidebar(forceHide = false) {
  // 检查保护期（但允许强制隐藏）
  if (sidebarJustShown && !forceHide) {
    console.log('Sidebar hide blocked - protection period active');
    return;
  }

  if (qrSidebar && qrSidebar.parentNode) {
    // 添加调试日志来跟踪谁在调用hideSidebar
    console.trace('hideSidebar called');
    console.log('Hiding sidebar, current state:', {
      qrSidebar: !!qrSidebar,
      isButtonShowing: isButtonShowing,
      sidebarJustShown: sidebarJustShown,
      selection: window.getSelection().toString().trim()
    });

    qrSidebar.style.right = '-350px';
    setTimeout(() => {
      if (qrSidebar && qrSidebar.parentNode) {
        qrSidebar.remove();
        qrSidebar = null;
      }
      // 重置状态
      isButtonShowing = false;
      sidebarJustShown = false;
      console.log('Sidebar hidden and cleaned up');
    }, 300);
  }
}

// HTML转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 生成二维码 - 按用户要求的优先级逻辑
async function generateQRCode(text) {
  console.log('Generating QR code for text:', JSON.stringify(text));
  console.log('Text character codes:', Array.from(text).map(char => `${char}(${char.charCodeAt(0)})`).join(', '));

  // 使用Promise包装chrome.storage.local.get以确保正确的异步处理
  const getSettings = () => {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'useCustomApi',
        'customApiUrl',
        'customApiHeaders',
        'customApiTimeout'
      ], resolve);
    });
  };

  (async () => {
    try {
      const result = await getSettings();
      console.log('QR generation settings:', result);

      // 检查自定义API是否已配置且有效
      const isCustomApiConfigured = result.useCustomApi &&
          result.customApiUrl &&
          result.customApiUrl.includes('{TEXT}') &&
          (result.customApiUrl.startsWith('http://') || result.customApiUrl.startsWith('https://'));

      if (result.useCustomApi && !isCustomApiConfigured) {
        console.log('⚠️ Custom API is enabled but not properly configured:', {
          hasUrl: !!result.customApiUrl,
          hasTextPlaceholder: result.customApiUrl?.includes('{TEXT}'),
          hasValidProtocol: result.customApiUrl?.startsWith('http://') || result.customApiUrl?.startsWith('https://')
        });
        showToast('自定义API配置不完整，请检查设置', 'warning');
      }

      // 根据自定义API开关状态确定优先级
      if (result.useCustomApi && isCustomApiConfigured) {
        // 自定义API开关开启且配置完整：自定义API -> 前端生成 -> 内置API
        console.log('✅ Custom API enabled: trying custom API -> offline -> third-party');

        // 优先级1: 自定义API
        try {
          const success = await tryCustomAPI(text, result);
          if (success) {
            console.log('✅ Custom API generation completed successfully');
            return;
          }
          console.log('❌ Custom API failed but did not throw error, falling back to offline generation');
        } catch (error) {
          console.error('❌ Custom API failed with error:', error);
          showToast('自定义API失败，使用备用方案', 'warning');
        }

        // 优先级2: 本地qrcode.js库
        console.log('📱 Falling back to local QRCode.js library');
        try {
          const success = await tryOfflineGeneration(text);
          if (success) {
            console.log('✅ Offline generation completed successfully');
            return;
          }
          console.log('❌ Offline generation failed but did not throw error, continuing to third-party APIs');
        } catch (error) {
          console.error('❌ Offline generation failed with error:', error);
        }

        // 优先级3: 三方在线API
        console.log('🌐 Falling back to third-party APIs');
        tryThirdPartyAPIs(text);

      } else {
        // 自定义API开关关闭或未配置：前端生成 -> 内置API
        console.log('ℹ️ Custom API disabled: trying offline -> third-party');

        // 优先级1: 本地qrcode.js库
        console.log('📱 Trying local QRCode.js library');
        try {
          const success = await tryOfflineGeneration(text);
          if (success) {
            console.log('✅ Offline generation completed successfully');
            return;
          }
          console.log('❌ Offline generation failed but did not throw error, continuing to third-party APIs');
        } catch (error) {
          console.error('❌ Offline generation failed with error:', error);
        }

        // 优先级2: 三方在线API
        console.log('🌐 Falling back to third-party APIs');
        tryThirdPartyAPIs(text);
      }

    } catch (error) {
      console.error('❌ Error getting settings, falling back to offline generation:', error);
      try {
        await tryOfflineGeneration(text);
      } catch (fallbackError) {
        console.error('❌ Fallback offline generation also failed:', fallbackError);
        showToast('二维码生成失败', 'error');
      }
    }
  })();
}

// 尝试使用自定义API生成二维码
async function tryCustomAPI(text, settings) {
  console.log('🔧 Requesting custom API generation from background script');

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'generateCustomAPI',
      text: text,
      apiConfig: {
        url: settings.customApiUrl,
        headers: settings.customApiHeaders,
        timeout: settings.customApiTimeout
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Background script communication error:', chrome.runtime.lastError);
        reject(new Error('Background script communication failed'));
        return;
      }

      if (response && response.success) {
        console.log('✅ Custom API generation completed successfully via background');
        showSidebar(text, response.qrDataURL);

        // 保存到存储
        chrome.storage.local.set({
          lastText: text,
          lastQRCode: response.qrDataURL
        });

        resolve(true);
      } else {
        console.error('❌ Custom API failed via background:', response?.error || 'Unknown error');
        reject(new Error(response?.error || 'Custom API failed'));
      }
    });
  });
}

// 尝试使用本地qrcode.js库生成
async function tryOfflineGeneration(text) {
  console.log('📱 Starting offline QR generation for text:', JSON.stringify(text));
  console.log('📱 Text character codes:', Array.from(text).map(char => `${char}(${char.charCodeAt(0)})`).join(', '));

  return new Promise((resolve, reject) => {
    try {
      const qrCodeDiv = document.createElement('div');
      qrCodeDiv.style.display = 'none';
      document.body.appendChild(qrCodeDiv);

      console.log('📱 Creating QRCode with text:', JSON.stringify(text));

      const qr = new QRCode(qrCodeDiv, {
        text: text,
        width: 256,
        height: 256,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });

      setTimeout(() => {
        try {
          const qrImage = qrCodeDiv.querySelector('img');
          if (qrImage && qrImage.src) {
            console.log('📱 QR image generated successfully');

            // 验证生成的二维码中的文本
            console.log('📱 QR image src length:', qrImage.src.length);

            showSidebar(text, qrImage.src);

            // 保存到存储
            chrome.storage.local.set({
              lastText: text,
              lastQRCode: qrImage.src
            });

            console.log('✅ Offline generation successful for text:', JSON.stringify(text));
            document.body.removeChild(qrCodeDiv);
            resolve(true);
          } else {
            console.error('❌ Failed to generate QR image element');
            document.body.removeChild(qrCodeDiv);
            reject(new Error('Failed to generate QR image'));
          }
        } catch (error) {
          console.error('❌ Error in offline generation:', error);
          document.body.removeChild(qrCodeDiv);
          reject(error);
        }
      }, 500);

    } catch (error) {
      reject(error);
    }
  });
}

// 使用三方API（通过background script）
function tryThirdPartyAPIs(text) {
  chrome.runtime.sendMessage({
    action: 'generateQR',
    text: text
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('All QR generation methods failed:', chrome.runtime.lastError);
      showToast('二维码生成失败，请检查网络连接', 'error');
    } else {
      console.log('✅ Third-party API generation initiated');
    }
  });
}

// 监听来自background的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Received message:', request); // 调试日志
  if (request.action === 'showQRSidebar') {
    showSidebar(request.text, request.qrDataURL);
    sendResponse({success: true});
  } else if (request.action === 'updateSettings') {
    // 更新设置（只更新传递的设置，保留其他设置）
    console.log('Received settings update:', request.settings);

    // 合并设置而不是完全替换
    extensionSettings = {
      ...extensionSettings,
      ...request.settings
    };

    console.log('Settings after update:', extensionSettings);

    // 如果禁用了按钮显示，立即隐藏当前显示的按钮
    if (request.settings.hasOwnProperty('showSelectionButton') && !extensionSettings.showSelectionButton) {
      hideQRButton();
    }

    sendResponse({success: true});
  } else if (request.action === 'generateOfflineQR') {
    // 处理右键菜单的二维码生成请求（使用新的优先级逻辑）
    console.log('Content - Generating QR for right-click:', request.text);
    try {
      generateQRCode(request.text); // 使用统一的生成逻辑
      sendResponse({success: true});
    } catch (error) {
      console.error('QR generation failed:', error);
      sendResponse({success: false, error: error.message});
    }
  }
  return true;
});

// 全局函数供HTML使用（保留用于其他可能的调用）
window.downloadQR = function(dataURL) {
  const link = document.createElement('a');
  link.download = 'qrcode.png';
  link.href = dataURL;
  link.click();
  showToast('二维码已保存');
};

window.copyText = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('文字已复制');
  }).catch(err => {
    console.error('复制失败:', err);
    showToast('复制失败');
  });
};

// 移除不再需要的全局函数
// window.closeSidebar 已通过事件监听器替代

window.showToast = function(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;

  // 获取主题颜色
  const themeColors = getThemeColors();

  let backgroundColor;
  switch (type) {
    case 'success':
      backgroundColor = themeColors.toastBg.success;
      break;
    case 'error':
      backgroundColor = themeColors.toastBg.error;
      break;
    case 'warning':
      backgroundColor = themeColors.toastBg.warning;
      break;
    default:
      backgroundColor = themeColors.toastBg.info;
  }

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${backgroundColor};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 10002;
    animation: slideIn 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,${themeColors.isDark ? '0.4' : '0.3'});
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
};