let selectedText = '';
let qrCodeButton = null;
let qrSidebar = null;
let isButtonShowing = false;
let extensionSettings = {
  showSelectionButton: true,
  useCustomApi: false
};

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
document.addEventListener('mouseup', function(event) {
  // 延迟执行以确保选择完成
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    console.log('Selected text:', text); // 调试日志

    if (text.length > 0) {
      selectedText = text;

      // 获取选中文本的位置
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 计算按钮位置：选中文本的右上角附近
      const buttonX = rect.right + 10; // 选中文本右边10px
      const buttonY = rect.top - 10;   // 选中文本上方10px

      showQRButton(buttonX, buttonY, rect);
    } else if (!isButtonShowing) {
      // 只有在按钮不是正在显示状态时才隐藏
      hideQRButton();
      hideSidebar();
    }
  }, 100);
});

// 监听选择变化事件
document.addEventListener('selectionchange', function() {
  // 延迟执行避免与mouseup冲突
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length === 0 && !isButtonShowing) {
      hideQRButton();
      hideSidebar();
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

    // 如果没有选中文字，则隐藏
    if (text.length === 0) {
      hideQRButton();
      hideSidebar();
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
    console.log('Button clicked, generating QR for:', selectedText); // 调试日志
    generateQRCode(selectedText);
  });

  // 增强的悬停效果
  qrCodeButton.addEventListener('mouseenter', function() {
    this.style.background = '#45a049';
    this.style.transform = 'translateY(-2px) scale(1.05)';
    this.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.4)';
  });

  qrCodeButton.addEventListener('mouseleave', function() {
    this.style.background = '#4CAF50';
    this.style.transform = 'translateY(0) scale(1)';
    this.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
  });

  document.body.appendChild(qrCodeButton);
  console.log('QR button shown'); // 调试日志

  // 8秒后自动隐藏按钮
  setTimeout(() => {
    if (qrCodeButton && qrCodeButton.parentNode) {
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
  hideSidebar();

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

  qrSidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: -350px;
    width: 320px;
    height: 100vh;
    background: white;
    box-shadow: -2px 0 10px rgba(0,0,0,0.1);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: right 0.3s ease;
    overflow-y: auto;
    border-left: 1px solid #e0e0e0;
  `;

  document.body.appendChild(qrSidebar);

  // 添加事件监听器
  const closeBtn = qrSidebar.querySelector('#qr-close-btn');
  const copyBtn = qrSidebar.querySelector('#qr-copy-btn');
  const downloadBtn = qrSidebar.querySelector('#qr-download-btn');

  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    hideSidebar();
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

  // 动画显示
  setTimeout(() => {
    qrSidebar.style.right = '0px';
  }, 10);

  hideQRButton();
}

// 隐藏侧边栏
function hideSidebar() {
  if (qrSidebar && qrSidebar.parentNode) {
    qrSidebar.style.right = '-350px';
    setTimeout(() => {
      if (qrSidebar && qrSidebar.parentNode) {
        qrSidebar.remove();
        qrSidebar = null;
      }
    }, 300);
  }
}

// HTML转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 生成二维码
function generateQRCode(text) {
  console.log('Sending message to background:', text); // 调试日志
  chrome.runtime.sendMessage({
    action: 'generateQR',
    text: text
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
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
    // 更新设置
    extensionSettings = request.settings;
    console.log('Settings updated:', extensionSettings);

    // 如果禁用了按钮显示，立即隐藏当前显示的按钮
    if (!extensionSettings.showSelectionButton) {
      hideQRButton();
    }

    sendResponse({success: true});
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

window.showToast = function(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 10002;
    animation: slideIn 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
};