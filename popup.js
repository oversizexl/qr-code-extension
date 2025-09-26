// 全局变量
let originalSettings = {}; // 存储页面加载时的原始设置
let hasUnsavedChanges = false;

document.addEventListener('DOMContentLoaded', function() {
  // 初始化设置
  initializeSettings();

  // 初始化标签切换
  initializeTabs();

  // 检查是否有存储的文本和二维码
  chrome.storage.local.get(['lastText', 'lastQRCode'], function(result) {
    if (result.lastText && result.lastQRCode) {
      showQRCode(result.lastText, result.lastQRCode);
    }
  });
});

// 页面卸载时检查是否有未保存的更改
window.addEventListener('beforeunload', function() {
  if (hasUnsavedChanges) {
    // 虽然popup关闭时beforeunload可能不会触发，
    // 但我们可以在这里做一些清理工作
    console.log('Popup closing with unsaved changes');
  }
});

// popup特有的处理：当窗口失去焦点时回滚未保存的更改
window.addEventListener('blur', function() {
  // 延迟执行，确保不是因为点击保存按钮等操作导致的失焦
  setTimeout(() => {
    if (hasUnsavedChanges && document.hidden) {
      console.log('Popup lost focus with unsaved changes - reverting');
      revertUnsavedChanges();
    }
  }, 100);
});

// 初始化标签切换功能
function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  let currentTabIndex = 0;

  // 获取Tab索引
  const getTabIndex = (tabElement) => {
    return Array.from(tabs).indexOf(tabElement);
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      const targetIndex = index;

      // 如果点击的是当前Tab，不执行切换
      if (targetIndex === currentTabIndex) return;

      // 确定滑动方向
      const isMovingRight = targetIndex > currentTabIndex;
      const currentContent = tabContents[currentTabIndex];
      const targetContent = document.getElementById(targetTab + '-tab');

      // 设置目标内容的初始位置
      if (isMovingRight) {
        // 向右滑动：新内容从右侧进入
        targetContent.classList.add('slide-in-right');
      } else {
        // 向左滑动：新内容从左侧进入
        targetContent.classList.add('slide-in-left');
      }

      // 立即显示目标内容以开始过渡
      requestAnimationFrame(() => {
        targetContent.classList.add('active');

        // 开始过渡动画
        requestAnimationFrame(() => {
          if (isMovingRight) {
            currentContent.classList.add('slide-out-left');
            targetContent.classList.remove('slide-in-right');
          } else {
            currentContent.classList.add('slide-out-right');
            targetContent.classList.remove('slide-in-left');
          }
        });
      });

      // 更新Tab状态
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // 更新动态下划线
      const tabsContainer = document.querySelector('.tabs');
      if (targetIndex === 1) {
        tabsContainer.classList.add('settings-active');
      } else {
        tabsContainer.classList.remove('settings-active');
      }

      // 清理过渡类和更新当前索引
      setTimeout(() => {
        currentContent.classList.remove('active', 'slide-out-left', 'slide-out-right');
        targetContent.classList.remove('slide-in-right', 'slide-in-left');
        currentTabIndex = targetIndex;
      }, 300); // 与CSS过渡时间匹配
    });
  });

  // 添加触摸滑动支持（可选）
  let startX = 0;
  let startY = 0;
  let isScrolling = false;

  const tabContainer = document.querySelector('.tab-container');

  tabContainer.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isScrolling = undefined;
  });

  tabContainer.addEventListener('touchmove', (e) => {
    if (isScrolling || !startX || !startY) return;

    const diffX = startX - e.touches[0].clientX;
    const diffY = startY - e.touches[0].clientY;

    if (isScrolling === undefined) {
      isScrolling = Math.abs(diffY) > Math.abs(diffX);
    }

    if (!isScrolling && Math.abs(diffX) > 50) {
      e.preventDefault();

      if (diffX > 0 && currentTabIndex < tabs.length - 1) {
        // 向左滑动，切换到下一个Tab
        tabs[currentTabIndex + 1].click();
      } else if (diffX < 0 && currentTabIndex > 0) {
        // 向右滑动，切换到上一个Tab
        tabs[currentTabIndex - 1].click();
      }

      startX = 0;
      startY = 0;
    }
  });
}

// 初始化设置面板
function initializeSettings() {
  // 加载保存的设置
  loadSettings();

  // 绑定设置事件
  const showButtonToggle = document.getElementById('show-button-toggle');
  const customApiToggle = document.getElementById('custom-api-toggle');
  const customApiConfig = document.getElementById('custom-api-config');
  const saveSettingsBtn = document.getElementById('save-settings');
  const testApiBtn = document.getElementById('test-custom-api');

  // 绿色按钮开关
  showButtonToggle.addEventListener('change', function() {
    updateButtonStatus(this.checked);
    // 立即保存按钮状态
    chrome.storage.local.set({ showSelectionButton: this.checked }, function() {
      console.log('Button toggle state saved:', this.checked);
    });
    // 通知content script更新设置
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings',
          settings: { showSelectionButton: showButtonToggle.checked }
        });
      }
    });
  });

  // 自定义API开关
  customApiToggle.addEventListener('change', function() {
    customApiConfig.style.display = this.checked ? 'block' : 'none';
    updateApiStatus(this.checked);
    // 显示或隐藏保存按钮
    updateSaveButtonVisibility();

    // 立即保存API开关状态
    chrome.storage.local.set({ useCustomApi: this.checked }, function() {
      console.log('Custom API toggle state saved:', customApiToggle.checked);
      // 更新原始设置
      originalSettings.useCustomApi = customApiToggle.checked;
    });

    // 通知content script更新设置（只更新useCustomApi，不影响按钮显示）
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings',
          settings: {
            useCustomApi: customApiToggle.checked,
            // 确保不影响按钮显示设置
            showSelectionButton: originalSettings.showSelectionButton
          }
        });
      }
    });

    // 如果关闭了自定义API，清除未保存更改标记
    if (!this.checked) {
      hasUnsavedChanges = false;
    } else {
      // 标记设置已更改，需要保存其他配置
      markSettingsChanged();
    }
  });

  // 监听输入框变化
  document.getElementById('custom-api-url').addEventListener('input', markSettingsChanged);
  document.getElementById('custom-api-headers').addEventListener('input', markSettingsChanged);
  document.getElementById('custom-api-timeout').addEventListener('input', markSettingsChanged);

  // 保存设置
  saveSettingsBtn.addEventListener('click', saveSettings);

  // 测试API
  testApiBtn.addEventListener('click', testCustomApi);
}

// 加载设置
function loadSettings() {
  chrome.storage.local.get([
    'showSelectionButton',
    'useCustomApi',
    'customApiUrl',
    'customApiHeaders',
    'customApiTimeout'
  ], function(result) {
    // 保存原始设置
    originalSettings = {
      showSelectionButton: result.showSelectionButton !== false, // 默认为true
      useCustomApi: result.useCustomApi || false,
      customApiUrl: result.customApiUrl || '',
      customApiHeaders: result.customApiHeaders || '',
      customApiTimeout: result.customApiTimeout || 5000
    };

    // 设置按钮开关状态
    document.getElementById('show-button-toggle').checked = originalSettings.showSelectionButton;
    updateButtonStatus(originalSettings.showSelectionButton);

    // 设置自定义API开关状态
    document.getElementById('custom-api-toggle').checked = originalSettings.useCustomApi;
    document.getElementById('custom-api-config').style.display = originalSettings.useCustomApi ? 'block' : 'none';
    updateApiStatus(originalSettings.useCustomApi);
    updateSaveButtonVisibility(); // 更新保存按钮显示状态

    // 设置自定义API参数
    document.getElementById('custom-api-url').value = originalSettings.customApiUrl;
    document.getElementById('custom-api-headers').value = originalSettings.customApiHeaders;
    document.getElementById('custom-api-timeout').value = originalSettings.customApiTimeout;

    // 重置更改标记
    hasUnsavedChanges = false;
  });
}

// 标记设置已更改
function markSettingsChanged() {
  hasUnsavedChanges = true;
}

// 回滚所有未保存的更改
function revertUnsavedChanges() {
  if (!hasUnsavedChanges || !originalSettings) return;

  // 恢复所有设置到原始状态
  document.getElementById('show-button-toggle').checked = originalSettings.showSelectionButton;
  document.getElementById('custom-api-toggle').checked = originalSettings.useCustomApi;
  document.getElementById('custom-api-url').value = originalSettings.customApiUrl;
  document.getElementById('custom-api-headers').value = originalSettings.customApiHeaders;
  document.getElementById('custom-api-timeout').value = originalSettings.customApiTimeout;

  // 更新UI状态
  const customApiConfig = document.getElementById('custom-api-config');
  customApiConfig.style.display = originalSettings.useCustomApi ? 'block' : 'none';
  updateButtonStatus(originalSettings.showSelectionButton);
  updateApiStatus(originalSettings.useCustomApi);
  updateSaveButtonVisibility();

  // 重置更改标记
  hasUnsavedChanges = false;
  console.log('Reverted unsaved changes');
}

// 保存设置
function saveSettings() {
  const saveBtn = document.getElementById('save-settings');
  const originalBtnText = saveBtn.textContent;

  // 防止重复点击
  if (saveBtn.disabled) return;

  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  const showButton = document.getElementById('show-button-toggle').checked;
  const useCustomApi = document.getElementById('custom-api-toggle').checked;
  const customApiUrl = document.getElementById('custom-api-url').value.trim();
  const customApiHeaders = document.getElementById('custom-api-headers').value.trim();
  const customApiTimeout = parseInt(document.getElementById('custom-api-timeout').value);

  // 恢复按钮状态的辅助函数
  function restoreButton() {
    saveBtn.disabled = false;
    saveBtn.textContent = originalBtnText;
  }

  // 验证自定义API设置
  if (useCustomApi) {
    // 验证URL是否为空
    if (!customApiUrl) {
      showToast('请输入API地址', 'error');
      restoreButton();
      return;
    }

    // 验证URL格式
    if (!customApiUrl.startsWith('http://') && !customApiUrl.startsWith('https://')) {
      showToast('API地址必须以 http:// 或 https:// 开头', 'error');
      restoreButton();
      return;
    }

    // 验证URL是否包含{TEXT}占位符
    if (!customApiUrl.includes('{TEXT}')) {
      showToast('API地址必须包含 {TEXT} 占位符用于传递二维码内容', 'error');
      restoreButton();
      return;
    }

    // 验证请求头格式
    if (customApiHeaders) {
      try {
        const headers = JSON.parse(customApiHeaders);
        // 确保解析结果是对象
        if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
          throw new Error('请求头必须是JSON对象格式');
        }
      } catch (e) {
        showToast('请求头格式错误，请使用有效的JSON对象格式，如：{"Authorization": "Bearer token"}', 'error');
        restoreButton();
        return;
      }
    }

    // 验证超时时间
    if (customApiTimeout < 1000 || customApiTimeout > 30000) {
      showToast('超时时间必须在1000-30000毫秒之间', 'error');
      restoreButton();
      return;
    }
  }

  const settings = {
    showSelectionButton: showButton,
    useCustomApi: useCustomApi,
    customApiUrl: customApiUrl,
    customApiHeaders: customApiHeaders,
    customApiTimeout: customApiTimeout
  };

  chrome.storage.local.set(settings, function() {
    restoreButton();

    if (chrome.runtime.lastError) {
      showToast('设置保存失败', 'error');
      // 保持用户当前输入状态，不回滚
    } else {
      showToast('设置已保存', 'success');

      // 更新原始设置为当前成功保存的设置
      originalSettings = { ...settings };
      hasUnsavedChanges = false;

      // 通知content script更新设置
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            settings: settings
          });
        }
      });
    }
  });

}

// 测试自定义API
function testCustomApi() {
  const customApiUrl = document.getElementById('custom-api-url').value.trim();
  const customApiHeaders = document.getElementById('custom-api-headers').value.trim();
  const customApiTimeout = parseInt(document.getElementById('custom-api-timeout').value);

  if (!customApiUrl) {
    showToast('请先输入API地址', 'error');
    return;
  }

  let headers = {};
  if (customApiHeaders) {
    try {
      headers = JSON.parse(customApiHeaders);
    } catch (e) {
      showToast('请求头格式错误', 'error');
      return;
    }
  }

  const testBtn = document.getElementById('test-custom-api');
  const originalText = testBtn.textContent;
  testBtn.textContent = '测试中...';
  testBtn.disabled = true;

  // 发送测试请求到background script
  chrome.runtime.sendMessage({
    action: 'testCustomApi',
    apiConfig: {
      url: customApiUrl,
      headers: headers,
      timeout: customApiTimeout
    },
    testText: 'API测试文本'
  }, function(response) {
    testBtn.textContent = originalText;
    testBtn.disabled = false;

    if (response && response.success) {
      showToast('API测试成功！', 'success');
    } else {
      showToast(`API测试失败: ${response?.error || '未知错误'}`, 'error');
    }
  });
}

// 更新保存按钮显示状态
function updateSaveButtonVisibility() {
  const customApiToggle = document.getElementById('custom-api-toggle');
  const saveBtn = document.getElementById('save-settings');

  if (customApiToggle && saveBtn) {
    if (customApiToggle.checked) {
      saveBtn.classList.add('show');
    } else {
      saveBtn.classList.remove('show');
    }
  }
}

// 更新按钮状态指示器
function updateButtonStatus(enabled) {
  const indicator = document.getElementById('button-status');
  indicator.className = `status-indicator ${enabled ? 'enabled' : 'disabled'}`;
}

// 更新API状态指示器
function updateApiStatus(enabled) {
  const indicator = document.getElementById('api-status');
  indicator.className = `status-indicator ${enabled ? 'enabled' : 'disabled'}`;
}

// 显示二维码
function showQRCode(text, qrDataURL) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="text-info">
      <strong>选中的文字：</strong><br>
      ${text}
    </div>

    <div class="qr-container">
      <div id="qrcode">
        <img src="${qrDataURL}" alt="QR Code" style="max-width: 200px;">
      </div>
    </div>

    <div class="actions">
      <button class="btn-copy" id="copy-btn">
        复制文字
      </button>
      <button class="btn-download" id="download-btn">
        保存二维码
      </button>
      <button class="btn-clear" id="clear-btn">
        清空记录
      </button>
    </div>
  `;

  // 添加事件监听器
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const clearBtn = document.getElementById('clear-btn');

  if (copyBtn) {
    copyBtn.addEventListener('click', () => copyToClipboard(text));
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => downloadQRCode(qrDataURL));
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearHistory());
  }
}

// 复制文字到剪贴板
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() {
    showToast('文字已复制到剪贴板', 'success');
  });
}

// 下载二维码
function downloadQRCode(dataURL) {
  const link = document.createElement('a');
  link.download = 'qrcode.png';
  link.href = dataURL;
  link.click();
  showToast('二维码已保存', 'success');
}

// 清空历史记录
function clearHistory() {
  chrome.storage.local.remove(['lastText', 'lastQRCode'], function() {
    showToast('记录已清空', 'success');

    // 重置页面显示
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="empty-state">
        <div class="icon">📱</div>
        <p>在网页中选择文字，然后点击绿色按钮生成二维码</p>
      </div>
    `;
  });
}

// 显示提示消息
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;

  let backgroundColor;
  switch (type) {
    case 'success':
      backgroundColor = '#28a745';
      break;
    case 'error':
      backgroundColor = '#dc3545';
      break;
    default:
      backgroundColor = '#333';
  }

  toast.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: ${backgroundColor};
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

// 监听来自background的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'qrGenerated') {
    showQRCode(request.text, request.qrDataURL);
  } else if (request.action === 'showQRSidebar') {
    // 如果popup打开时收到显示侧边栏的消息，也在popup中显示
    showQRCode(request.text, request.qrDataURL);
  }
});