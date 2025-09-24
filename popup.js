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

// 初始化标签切换功能
function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      // 移除所有活动状态
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // 添加活动状态
      tab.classList.add('active');
      document.getElementById(targetTab + '-tab').classList.add('active');
    });
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
      console.log('Custom API toggle state saved:', this.checked);
    });
  });

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
    // 设置按钮开关状态
    const showButton = result.showSelectionButton !== false; // 默认为true
    document.getElementById('show-button-toggle').checked = showButton;
    updateButtonStatus(showButton);

    // 设置自定义API开关状态
    const useCustomApi = result.useCustomApi || false;
    document.getElementById('custom-api-toggle').checked = useCustomApi;
    document.getElementById('custom-api-config').style.display = useCustomApi ? 'block' : 'none';
    updateApiStatus(useCustomApi);
    updateSaveButtonVisibility(); // 更新保存按钮显示状态

    // 设置自定义API参数
    if (result.customApiUrl) {
      document.getElementById('custom-api-url').value = result.customApiUrl;
    }
    if (result.customApiHeaders) {
      document.getElementById('custom-api-headers').value = result.customApiHeaders;
    }
    if (result.customApiTimeout) {
      document.getElementById('custom-api-timeout').value = result.customApiTimeout;
    }
  });
}

// 保存设置
function saveSettings() {
  const showButton = document.getElementById('show-button-toggle').checked;
  const useCustomApi = document.getElementById('custom-api-toggle').checked;
  const customApiUrl = document.getElementById('custom-api-url').value.trim();
  const customApiHeaders = document.getElementById('custom-api-headers').value.trim();
  const customApiTimeout = parseInt(document.getElementById('custom-api-timeout').value);

  // 验证自定义API设置
  if (useCustomApi && !customApiUrl) {
    showToast('请输入API地址', 'error');
    return;
  }

  if (useCustomApi && customApiHeaders) {
    try {
      JSON.parse(customApiHeaders);
    } catch (e) {
      showToast('请求头格式错误，请使用有效的JSON格式', 'error');
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
    if (chrome.runtime.lastError) {
      showToast('设置保存失败', 'error');
    } else {
      showToast('设置已保存', 'success');

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
  }
});