async function fetchCurrentUser() {
  if (state.currentUser) {
    state.currentUserId = state.currentUser.id;
    return;
  }
  try {
    const res = await fetch(`${API_URL}/users/me`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
    if (res.ok) {
      const u = await res.json();
      state.currentUserId = u.id;
    }
  } catch (e) {
    console.error('Fetch current user error:', e);
  }
}

async function loadRatingsForMemo(memoId, paneId = state.activePaneId) {
  const pel = getPaneEl(paneId);
  if (!state.isOnline || typeof memoId === 'string' || !memoId) {
    if (pel.ratingPanel) pel.ratingPanel.style.display = 'none';
    return;
  }
  try {
    // 1. 軸一覧のロード
    const axesRes = await fetch(`${API_URL}/memos/${memoId}/axes`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
    if (axesRes.ok) {
      state.currentAxes = await axesRes.json();
    }
    // 2. 評価データのロード
    const ratingsRes = await fetch(`${API_URL}/memos/${memoId}/ratings`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
    if (ratingsRes.ok) {
      state.currentRatings = await ratingsRes.json();
    }
    // 3. サマリーのロード
    const summaryRes = await fetch(`${API_URL}/memos/${memoId}/ratings/summary`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
    if (summaryRes.ok) {
      state.currentSummary = await summaryRes.json();
    }
    renderRatingPanel(paneId);
  } catch (e) {
    console.error('Load ratings error:', e);
    if (pel.ratingPanel) pel.ratingPanel.style.display = 'none';
  }
}

function renderRatingPanel(paneId = state.activePaneId) {
  const pel = getPaneEl(paneId);
  if (!pel.ratingPanel) return;
  pel.ratingPanel.style.display = 'block'; // パネルを明示的に表示
  const container = pel.ratingAxesList;
  if (!container) return;
  container.innerHTML = '';

  if (state.currentAxes.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:0.75rem; color:var(--text-muted); font-size:0.8rem;">
      評価軸がありません。<button onclick="openAxisModal()" style="background:transparent; border:none; color:var(--accent); cursor:pointer; font-weight:600; font-family:inherit; font-size:0.8rem;">+ 追加</button>
    </div>`;
    if (pel.ratingSummaryRow) pel.ratingSummaryRow.style.display = 'none';
    return;
  }

  const paneState = state.panes[paneId];
  const activeMemo = state.memos.find(m => m.id === paneState.activeMemoId);
  const isReadOnly = activeMemo && activeMemo.permission === 'read';

  state.currentAxes.forEach(axis => {
    const card = document.createElement('div');
    card.className = 'rating-axis-card';

    // 現在のユーザーの評価を見つける
    const axisData = state.currentRatings.find(r => r.axis && r.axis.id === axis.id);
    const myRating = axisData ? axisData.ratings.find(r => r.user_id === state.currentUserId) : null;

    const methodLabels = { star: '⭐ 星', tier: '🏆 ティア', numeric: '📊 数値' };

    card.innerHTML = `
      <div class="rating-axis-header">
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span class="rating-axis-name">${escape(axis.name)}</span>
          <span class="rating-axis-method-badge ${axis.method}">${methodLabels[axis.method] || axis.method}</span>
        </div>
        <button class="axis-delete-btn" onclick="deleteAxis(${axis.id}, '${paneId}')" title="この評価軸を削除" style="${isReadOnly ? 'display:none;' : ''}">
          <i data-lucide="x" style="width:12px; height:12px;"></i>
        </button>
      </div>
      <div id="ratingInput_${paneId}_${axis.id}"></div>
    `;
    container.appendChild(card);

    // 入力UIの描画
    const inputContainer = card.querySelector(`#ratingInput_${paneId}_${axis.id}`);
    if (axis.method === 'star') {
      renderStarInput(inputContainer, axis.id, myRating, paneId);
    } else if (axis.method === 'tier') {
      renderTierInput(inputContainer, axis.id, myRating, paneId);
    } else if (axis.method === 'numeric') {
      renderNumericInput(inputContainer, axis.id, myRating, paneId);
    }
  });

  lucide.createIcons();
  renderRatingSummary(paneId);
}

// 星評価UIの描画
function renderStarInput(container, axisId, myRating, paneId) {
  const currentScore = myRating ? parseFloat(myRating.raw_value) : 0;
  const div = document.createElement('div');
  div.className = 'star-rating';
  
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.className = `star-btn ${i <= currentScore ? 'active' : ''}`;
    btn.textContent = i <= currentScore ? '★' : '☆';
    btn.addEventListener('click', () => submitRating(axisId, String(i), paneId));
    div.appendChild(btn);
  }
  
  if (currentScore > 0) {
    const label = document.createElement('span');
    label.className = 'star-score-label';
    label.textContent = `${currentScore} / 5`;
    div.appendChild(label);
  }
  
  container.appendChild(div);
}

// ティア評価UIの描画
function renderTierInput(container, axisId, myRating, paneId) {
  const currentTier = myRating ? myRating.raw_value : '';
  const div = document.createElement('div');
  div.className = 'tier-rating';
  
  ['S', 'A', 'B', 'C', 'D'].forEach(tier => {
    const btn = document.createElement('button');
    btn.className = `tier-btn ${currentTier.toUpperCase() === tier ? 'active-' + tier : ''}`;
    btn.textContent = tier;
    btn.addEventListener('click', () => submitRating(axisId, tier, paneId));
    div.appendChild(btn);
  });
  
  container.appendChild(div);
}

// 数値評価UIの描画
function renderNumericInput(container, axisId, myRating, paneId) {
  const currentVal = myRating ? parseFloat(myRating.raw_value) : 50;
  const div = document.createElement('div');
  div.className = 'numeric-rating';
  
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'numeric-slider';
  slider.min = '0';
  slider.max = '100';
  slider.value = myRating ? currentVal : 50;
  
  const numInput = document.createElement('input');
  numInput.type = 'number';
  numInput.className = 'numeric-input';
  numInput.min = '0';
  numInput.max = '100';
  numInput.value = myRating ? currentVal : 50;
  
  let debounceTimer = null;
  const debouncedSubmit = (val) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => submitRating(axisId, String(val), paneId), 500);
  };

  slider.addEventListener('input', () => {
    numInput.value = slider.value;
    debouncedSubmit(slider.value);
  });
  
  numInput.addEventListener('input', () => {
    const v = Math.max(0, Math.min(100, parseInt(numInput.value) || 0));
    slider.value = v;
    debouncedSubmit(v);
  });
  
  div.appendChild(slider);
  div.appendChild(numInput);
  container.appendChild(div);
}

// 評価を送信（upsert）
async function submitRating(axisId, rawValue, paneId = state.activePaneId) {
  if (!state.isOnline) {
    showToast('オフライン時は評価を送信できません', 'shield-alert');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/axes/${axisId}/rate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ raw_value: rawValue })
    });
    if (res.ok) {
      showToast('評価を保存しました', 'star');
      const paneState = state.panes[paneId];
      if (paneState && paneState.activeMemoId) await loadRatingsForMemo(paneState.activeMemoId, paneId);
    }
  } catch (e) {
    console.error('Rating submit error:', e);
    showToast('評価の送信に失敗しました', 'shield-alert');
  }
}

// 評価軸の削除
async function deleteAxis(axisId, paneId = state.activePaneId) {
  if (!confirm('この評価軸を削除しますか？関連するすべての評価データも削除されます。')) return;
  try {
    const res = await fetch(`${API_URL}/axes/${axisId}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok || res.status === 204) {
      showToast('評価軸を削除しました', 'trash-2');
      const paneState = state.panes[paneId];
      if (paneState && paneState.activeMemoId) await loadRatingsForMemo(paneState.activeMemoId, paneId);
    }
  } catch (e) {
    showToast('削除に失敗しました', 'shield-alert');
  }
}

// 評価軸追加モーダルの表示
function openAxisModal() {
  el.axisNameInput.value = '';
  el.axisMethodSelect.value = 'star';
  el.axisModal.classList.add('active');
  setTimeout(() => el.axisNameInput.focus(), 80);
}

// 評価軸の保存
async function saveAxis() {
  const name = el.axisNameInput.value.trim();
  const method = el.axisMethodSelect.value;
  if (!name) {
    showToast('軸名を入力してください', 'shield-alert');
    return;
  }
  const paneId = state.activePaneId;
  const paneState = state.panes[paneId];
  const activeMemoId = paneState.activeMemoId;
  if (!activeMemoId || typeof activeMemoId === 'string') {
    showToast('メモを先に同期してください', 'shield-alert');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/memos/${activeMemoId}/axes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ name, method })
    });
    if (res.ok) {
      el.axisModal.classList.remove('active');
      showToast(`評価軸「${name}」を追加しました`, 'bar-chart-3');
      await loadRatingsForMemo(activeMemoId, paneId);
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.detail || '作成失敗'}`, 'shield-alert');
    }
  } catch (e) {
    showToast('通信エラー', 'shield-alert');
  }
}

// 集計バッジのレンダリング
function renderRatingSummary() {
  const row = el.ratingSummaryRow;
  if (state.currentSummary.length === 0) {
    row.style.display = 'none';
    return;
  }
  row.style.display = 'flex';
  row.innerHTML = '';

  state.currentSummary.forEach(s => {
    const badge = document.createElement('div');
    badge.className = 'rating-summary-badge';

    let displayValue = '—';
    if (s.average_score !== null && s.average_score !== undefined) {
      if (s.method === 'star') {
        displayValue = `★${s.average_score.toFixed(1)}`;
      } else if (s.method === 'tier') {
        if (s.tier_distribution) {
          const maxTier = Object.entries(s.tier_distribution).sort((a, b) => b[1] - a[1])[0];
          displayValue = maxTier ? maxTier[0] : '—';
        } else {
          displayValue = `${s.average_score.toFixed(1)}`;
        }
      } else {
        displayValue = `${s.average_score.toFixed(1)}`;
      }
    }

    badge.innerHTML = `<span style="font-weight:700;">${escape(s.axis_name)}:</span> ${displayValue} <span style="color:var(--text-muted);">(${s.count}人)</span>`;
    row.appendChild(badge);
  });
}

// トグルグリッドの表示
async function openToggleGrid() {
  const paneId = state.activePaneId;
  const activeMemoId = state.panes[paneId].activeMemoId;
  if (!activeMemoId || typeof activeMemoId === 'string') {
    showToast('メモを先に同期してください', 'shield-alert');
    return;
  }
  el.toggleGridModal.classList.add('active');
  lucide.createIcons();
  await renderToggleGrid();
}

// トグルグリッドのレンダリング
async function renderToggleGrid() {
  try {
    const paneId = state.activePaneId;
    const activeMemoId = state.panes[paneId].activeMemoId;
    if (!activeMemoId || typeof activeMemoId === 'string') return;
    const res = await fetch(`${API_URL}/memos/${activeMemoId}/visibility`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
    if (!res.ok) return;
    const data = await res.json();

    const axes = state.currentAxes;
    const grid = data.grid || [];

    // ヘッダー行
    let headHtml = '<tr><th>ユーザー</th>';
    axes.forEach(ax => {
      headHtml += `<th>${escape(ax.name)}<br><button class="toggle-bulk-btn" style="margin-top:0.2rem; font-size:0.6rem; padding:0.1rem 0.3rem;" onclick="bulkToggle('axis_on', null, ${ax.id})">ON</button> <button class="toggle-bulk-btn" style="font-size:0.6rem; padding:0.1rem 0.3rem;" onclick="bulkToggle('axis_off', null, ${ax.id})">OFF</button></th>`;
    });
    headHtml += '</tr>';
    el.toggleGridHead.innerHTML = headHtml;

    // ボディ行
    let bodyHtml = '';
    grid.forEach(row => {
      bodyHtml += `<tr><td style="text-align:left; font-weight:600;">
        ${escape(row.display_name || row.username)}
        <div style="display:flex; gap:0.2rem; margin-top:0.2rem;">
          <button class="toggle-bulk-btn" style="font-size:0.6rem; padding:0.1rem 0.3rem;" onclick="bulkToggle('user_on', ${row.user_id})">全ON</button>
          <button class="toggle-bulk-btn" style="font-size:0.6rem; padding:0.1rem 0.3rem;" onclick="bulkToggle('user_off', ${row.user_id})">全OFF</button>
        </div>
      </td>`;
      axes.forEach(ax => {
        const isVisible = row.axes[String(ax.id)] !== 0;
        bodyHtml += `<td>
          <label class="toggle-switch">
            <input type="checkbox" ${isVisible ? 'checked' : ''} onchange="singleToggle(${row.user_id}, ${ax.id}, this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </td>`;
      });
      bodyHtml += '</tr>';
    });
    el.toggleGridBody.innerHTML = bodyHtml;
  } catch (e) {
    console.error('Toggle grid error:', e);
  }
}

// 個別トグル
async function singleToggle(targetUserId, axisId, visible) {
  try {
    await fetch(`${API_URL}/visibility/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ target_user_id: targetUserId, axis_id: axisId, visible })
    });
    const paneId = state.activePaneId;
    const activeMemoId = state.panes[paneId].activeMemoId;
    if (activeMemoId && typeof activeMemoId !== 'string') {
      const summaryRes = await fetch(`${API_URL}/memos/${activeMemoId}/ratings/summary`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (summaryRes.ok) {
        state.currentSummary = await summaryRes.json();
        renderRatingSummary();
      }
    }
  } catch (e) { console.error('Toggle error:', e); }
}

// 一括トグル
async function bulkToggle(mode, targetUserId = null, axisId = null) {
  try {
    const body = { mode };
    if (targetUserId !== null) body.target_user_id = targetUserId;
    if (axisId !== null) body.axis_id = axisId;
    await fetch(`${API_URL}/visibility/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify(body)
    });
    await renderToggleGrid();
    const paneId = state.activePaneId;
    const activeMemoId = state.panes[paneId].activeMemoId;
    if (activeMemoId && typeof activeMemoId !== 'string') {
      const summaryRes = await fetch(`${API_URL}/memos/${activeMemoId}/ratings/summary`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (summaryRes.ok) {
        state.currentSummary = await summaryRes.json();
        renderRatingSummary();
      }
    }
  } catch (e) { console.error('Bulk toggle error:', e); }
}

// グローバルバインド（HTMLイベントハンドラ連携用）
window.deleteAxis = deleteAxis;
window.openAxisModal = openAxisModal;
window.singleToggle = singleToggle;
window.bulkToggle = bulkToggle;