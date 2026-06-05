// --- Auth state ---
state.currentUser = null;

// --- Authentication UI & Handlers ---

// Auth required: clear session and show login modal
function handleAuthRequired() {
  state.currentUser = null;
  localStorage.removeItem('token');
  
  // Clear lists and editor
  closeWorkspace();
  state.memos = [];
  state.folders = [];
  state.tags = [];
  saveCache();
  renderList();
  renderFolders();
  if (typeof renderTags === 'function') renderTags();
  
  // Update sidebar profile to Guest
  updateSidebarProfile(null);
  
  // Show fullscreen blurred login modal
  el.loginModal.style.display = 'flex';
}

// Update sidebar profile with current user info
function updateSidebarProfile(user) {
  if (user) {
    el.userDisplayName.textContent = user.display_name;
    el.userUsername.textContent = `@${user.username}`;
  } else {
    el.userDisplayName.textContent = 'ゲスト';
    el.userUsername.textContent = '@anonymous';
  }
}

// Sign In
async function loginUser(username, password) {
  if (!username || !password) {
    showToast("ユーザー名とパスワードを入力してください", 'shield-alert');
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ username, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      state.currentUser = data.user;
      updateSidebarProfile(data.user);
      
      el.loginModal.style.display = 'none';
      showToast(`${data.user.display_name}さん、サインインしました！`, 'check');
      
      // Load app data
      await checkStatus();
    } else {
      const err = await res.json();
      showToast(err.detail || "ユーザー名またはパスワードが正しくありません", 'shield-alert');
    }
  } catch (e) {
    showToast("サインインに失敗しました。サーバー接続を確認してください", 'shield-alert');
  }
}

// Guest Sign In
async function guestLogin() {
  try {
    const res = await fetch(`${API_URL}/auth/guest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      state.currentUser = data.user;
      updateSidebarProfile(data.user);
      
      el.loginModal.style.display = 'none';
      showToast(`ゲストとしてサインインしました！`, 'check');
      
      // Load app data
      await checkStatus();
    } else {
      const err = await res.json();
      showToast(err.detail || "ゲストサインインに失敗しました", 'shield-alert');
    }
  } catch (e) {
    showToast("サインインに失敗しました。サーバー接続を確認してください", 'shield-alert');
  }
}

// Sign Up
async function registerUser(username, displayName, password) {
  if (!username || !displayName || !password) {
    showToast("すべての項目を入力してください", 'shield-alert');
    return;
  }
  
  if (username.length < 3) {
    showToast("ユーザー名は3文字以上必要です", 'shield-alert');
    return;
  }
  
  if (password.length < 4) {
    showToast("パスワードは4文字以上必要です", 'shield-alert');
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ username, display_name: displayName, password })
    });
    
    if (res.ok) {
      showToast("アカウントを作成しました！サインインしてください。", 'check');
      // Switch back to login form
      switchToLoginForm();
      // Pre-fill username
      el.loginUsername.value = username;
      el.loginPassword.value = '';
    } else {
      const err = await res.json();
      showToast(err.detail || "アカウント作成に失敗しました", 'shield-alert');
    }
  } catch (e) {
    showToast("サーバーとの通信に失敗しました", 'shield-alert');
  }
}

// Log Out
function logoutUser() {
  if (confirm("ログアウトしますか？")) {
    handleAuthRequired();
    showToast("ログアウトしました", 'log-out');
  }
}

// Switch between forms
function switchToRegisterForm() {
  el.loginFormContainer.style.display = 'none';
  el.registerFormContainer.style.display = 'block';
  el.loginModalTitle.textContent = "nao-memo アカウント作成";
  el.loginModalSubtitle = "必要事項を入力して登録を完了してください";
}

function switchToLoginForm() {
  el.registerFormContainer.style.display = 'none';
  el.loginFormContainer.style.display = 'block';
  el.loginModalTitle.textContent = "nao-memo にサインイン";
  el.loginModalSubtitle = "メモを同期・共有して管理しましょう";
}

// Initialize Authentication on load
async function initAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    handleAuthRequired();
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const user = await res.json();
      state.currentUser = user;
      updateSidebarProfile(user);
      el.loginModal.style.display = 'none';
      
      // Load initial app data
      await checkStatus();
    } else {
      // Token expired or invalid
      handleAuthRequired();
    }
  } catch (e) {
    // Connection error: load from cache but prompt login if no local profile
    console.error("ユーザー情報の検証失敗", e);
    // Since offline, we can let them use cache but set status
    state.isOnline = false;
    updateStatusUI('offline');
    loadCache();
    renderList();
    renderFolders();
    if (typeof renderTags === 'function') renderTags();
  }
}


// --- Memo Sharing Config & APIs ---

async function openShareModal() {
  if (!state.activeMemoId) return;
  
  el.shareTypeSelect.value = 'user';
  el.shareTargetInput.value = '';
  el.shareTargetInput.placeholder = 'ユーザー名を入力...';
  el.sharePermissionSelect.value = 'read';
  el.shareList.innerHTML = '<div style="text-align:center; font-size:0.8rem; color:var(--text-muted); padding:1rem;">読み込み中...</div>';
  el.shareModal.classList.add('active');
  
  await fetchShareList();
}

async function fetchShareList() {
  try {
    const res = await fetch(`${API_URL}/memos/${state.activeMemoId}/shares`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const shares = await res.json();
      renderShareList(shares);
    } else {
      el.shareList.innerHTML = '<div style="text-align:center; font-size:0.8rem; color:var(--danger); padding:1rem;">共有情報の取得に失敗しました</div>';
    }
  } catch (e) {
    el.shareList.innerHTML = '<div style="text-align:center; font-size:0.8rem; color:var(--danger); padding:1rem;">接続エラーが発生しました</div>';
  }
}

function renderShareList(shares) {
  el.shareList.innerHTML = '';
  
  if (shares.length === 0) {
    el.shareList.innerHTML = '<div style="text-align:center; font-size:0.8rem; color:var(--text-muted); padding:1rem;">共有しているユーザー・ロールはいません</div>';
    return;
  }
  
  shares.forEach(share => {
    const row = document.createElement('div');
    row.className = 'share-user-row';
    
    const permText = share.permission === 'write' ? '✏️ 編集可能' : '👀 閲覧のみ';
    const permClass = share.permission === 'write' ? 'write' : 'read';
    
    let infoHtml = '';
    let removeBtnHtml = '';
    
    if (share.type === 'user') {
      infoHtml = `
        <div class="share-user-info">
          <span class="share-user-display">👤 ${escape(share.display_name)}</span>
          <span class="share-user-name">@${escape(share.username)}</span>
        </div>
      `;
      removeBtnHtml = `
        <button class="btn-remove-share" title="共有を解除" onclick="removeShare('user', ${share.user_id})">
          <i data-lucide="x" style="width:14px; height:14px;"></i>
        </button>
      `;
    } else if (share.type === 'role') {
      infoHtml = `
        <div class="share-user-info">
          <span class="share-user-display" style="color: var(--accent);">👥 ${escape(share.role_name)}</span>
          <span class="share-user-name">（ロール）</span>
        </div>
      `;
      removeBtnHtml = `
        <button class="btn-remove-share" title="共有を解除" onclick="removeShare('role', ${share.role_id})">
          <i data-lucide="x" style="width:14px; height:14px;"></i>
        </button>
      `;
    }
    
    row.innerHTML = `
      ${infoHtml}
      <div class="share-user-actions">
        <span class="share-permission-badge ${permClass}">${permText}</span>
        ${removeBtnHtml}
      </div>
    `;
    el.shareList.appendChild(row);
  });
  lucide.createIcons();
}

async function addShare() {
  const type = el.shareTypeSelect.value;
  const target = el.shareTargetInput.value.trim();
  const permission = el.sharePermissionSelect.value;
  
  if (!target) {
    showToast(type === 'user' ? "共有先のユーザー名を入力してください" : "共有先のロール名を入力してください", 'shield-alert');
    return;
  }
  
  const reqBody = { permission };
  if (type === 'user') {
    reqBody.username = target;
  } else {
    reqBody.role_name = target;
  }
  
  try {
    const res = await fetch(`${API_URL}/memos/${state.activeMemoId}/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(reqBody)
    });
    
    if (res.ok) {
      showToast(`${target} とメモを共有しました！`, 'check');
      el.shareTargetInput.value = '';
      await fetchShareList();
    } else {
      const err = await res.json();
      showToast(err.detail || "共有の追加に失敗しました", 'shield-alert');
    }
  } catch (e) {
    showToast("サーバーとの通信に失敗しました", 'shield-alert');
  }
}

async function removeShare(type, targetId) {
  const confirmMsg = type === 'user' ? "このユーザーとの共有を解除しますか？" : "このロールとの共有を解除しますか？";
  if (!confirm(confirmMsg)) return;
  
  try {
    const endpoint = `${API_URL}/memos/${state.activeMemoId}/shares/${type}/${targetId}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    if (res.ok) {
      showToast("共有を解除しました", 'check');
      await fetchShareList();
    } else {
      showToast("共有解除に失敗しました", 'shield-alert');
    }
  } catch (e) {
    showToast("サーバーとの通信に失敗しました", 'shield-alert');
  }
}

// Bind auth and sharing events
document.addEventListener('DOMContentLoaded', () => {
  // Auth navigation
  el.toRegisterLink.addEventListener('click', (e) => { e.preventDefault(); switchToRegisterForm(); });
  el.toLoginLink.addEventListener('click', (e) => { e.preventDefault(); switchToLoginForm(); });
  
  // Submit handlers
  el.loginSubmitBtn.addEventListener('click', () => {
    loginUser(el.loginUsername.value.trim(), el.loginPassword.value);
  });
  el.guestLoginBtn.addEventListener('click', () => {
    guestLogin();
  });
  el.loginUsername.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.loginPassword.focus();
  });
  el.loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginUser(el.loginUsername.value.trim(), el.loginPassword.value);
  });
  
  el.registerSubmitBtn.addEventListener('click', () => {
    registerUser(
      el.registerUsername.value.trim(),
      el.registerDisplayName.value.trim(),
      el.registerPassword.value
    );
  });
  
  el.logoutBtn.addEventListener('click', logoutUser);
  
  // Share handlers
  if (el.shareBtn) {
    el.shareBtn.addEventListener('click', openShareModal);
  }
  el.closeShareBtn.addEventListener('click', () => el.shareModal.classList.remove('active'));
  el.addShareBtn.addEventListener('click', addShare);
  el.shareTargetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addShare();
  });
  el.shareTypeSelect.addEventListener('change', () => {
    if (el.shareTypeSelect.value === 'user') {
      el.shareTargetInput.placeholder = 'ユーザー名を入力...';
    } else {
      el.shareTargetInput.placeholder = 'ロール名を入力...';
    }
    el.shareTargetInput.value = '';
  });
});
