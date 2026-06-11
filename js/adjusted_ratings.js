// --- 偏差補正平均用 UI/UX & API 連携ロジック ---

let activePaneIdForAdjusted = 'left';

async function openAdjustedRatingModal(paneId) {
  activePaneIdForAdjusted = paneId;
  
  // ユーザー・ロール情報のロードを確実に行う
  if (typeof ensureUsersAndRolesLoaded === 'function') {
    await ensureUsersAndRolesLoaded();
  }

  const paneState = state.panes[paneId];
  const activeMemo = state.memos.find(m => m.id === paneState.activeMemoId);
  
  if (activeMemo && activeMemo.adjusted_rating_params) {
    try {
      const savedParams = JSON.parse(activeMemo.adjusted_rating_params);
      state.adjustedRatingFilterDraft = {
        included_role_ids: savedParams.included_role_ids || [],
        excluded_role_ids: savedParams.excluded_role_ids || [],
        included_user_ids: savedParams.included_user_ids || [],
        excluded_user_ids: savedParams.excluded_user_ids || []
      };
    } catch (e) {
      console.error("Failed to parse adjusted rating params", e);
      resetAdjustedFilterDraft();
    }
  } else {
    resetAdjustedFilterDraft();
  }

  // セレクトボックスの選択肢を再構築
  populateAdjustedSelectors();

  // チップを再描画
  renderAdjFilters();

  if (el.adjustedRatingModal) {
    el.adjustedRatingModal.classList.add('active');
  }
}

function closeAdjustedRatingModal() {
  if (el.adjustedRatingModal) {
    el.adjustedRatingModal.classList.remove('active');
  }
}

function resetAdjustedFilterDraft() {
  state.adjustedRatingFilterDraft = {
    included_role_ids: [],
    excluded_role_ids: [],
    included_user_ids: [],
    excluded_user_ids: []
  };
}

// セレクトボックスのオプション構築
function populateAdjustedSelectors() {
  const roleSelect = el.adjRoleSelect;
  const userSelect = el.adjUserSelect;
  if (!roleSelect || !userSelect) return;

  roleSelect.innerHTML = '<option value="">-- ロールを選択 --</option>';
  userSelect.innerHTML = '<option value="">-- ユーザーを選択 --</option>';

  if (state.cachedRoles) {
    state.cachedRoles.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      roleSelect.appendChild(opt);
    });
  }

  if (state.cachedUsers) {
    state.cachedUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.display_name} (@${u.username})`;
      userSelect.appendChild(opt);
    });
  }
}

// フィルター条件の追加
window.addAdjFilter = (type, mode) => {
  const select = type === 'role' ? el.adjRoleSelect : el.adjUserSelect;
  if (!select) return;
  
  const val = select.value;
  if (!val) {
    showToast("対象を選択してください", "shield-alert");
    return;
  }
  
  const id = parseInt(val, 10);
  const draft = state.adjustedRatingFilterDraft;
  
  if (type === 'role') {
    if (mode === 'include') {
      if (!draft.included_role_ids.includes(id)) {
        draft.included_role_ids.push(id);
        draft.excluded_role_ids = draft.excluded_role_ids.filter(x => x !== id);
      }
    } else {
      if (!draft.excluded_role_ids.includes(id)) {
        draft.excluded_role_ids.push(id);
        draft.included_role_ids = draft.included_role_ids.filter(x => x !== id);
      }
    }
  } else {
    if (mode === 'include') {
      if (!draft.included_user_ids.includes(id)) {
        draft.included_user_ids.push(id);
        draft.excluded_user_ids = draft.excluded_user_ids.filter(x => x !== id);
      }
    } else {
      if (!draft.excluded_user_ids.includes(id)) {
        draft.excluded_user_ids.push(id);
        draft.included_user_ids = draft.included_user_ids.filter(x => x !== id);
      }
    }
  }
  
  select.value = ""; // 選択解除
  renderAdjFilters();
};

// フィルター条件の削除
window.removeAdjFilter = (type, mode, id) => {
  const draft = state.adjustedRatingFilterDraft;
  if (type === 'role') {
    if (mode === 'include') {
      draft.included_role_ids = draft.included_role_ids.filter(x => x !== id);
    } else {
      draft.excluded_role_ids = draft.excluded_role_ids.filter(x => x !== id);
    }
  } else {
    if (mode === 'include') {
      draft.included_user_ids = draft.included_user_ids.filter(x => x !== id);
    } else {
      draft.excluded_user_ids = draft.excluded_user_ids.filter(x => x !== id);
    }
  }
  renderAdjFilters();
};

// チップ描画処理
function renderAdjFilters() {
  const rolesList = el.adjSelectedRolesList;
  const usersList = el.adjSelectedUsersList;
  if (!rolesList || !usersList) return;

  rolesList.innerHTML = '';
  usersList.innerHTML = '';

  const draft = state.adjustedRatingFilterDraft;

  // 1. ロール
  draft.included_role_ids.forEach(id => {
    const roleObj = state.cachedRoles.find(r => r.id === id);
    if (!roleObj) return;
    rolesList.appendChild(createAdjFilterChip('role', 'include', id, `含む: ${roleObj.name}`));
  });
  draft.excluded_role_ids.forEach(id => {
    const roleObj = state.cachedRoles.find(r => r.id === id);
    if (!roleObj) return;
    rolesList.appendChild(createAdjFilterChip('role', 'exclude', id, `除く: ${roleObj.name}`));
  });
  if (rolesList.children.length === 0) {
    rolesList.innerHTML = '<span style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">指定なし (全員対象)</span>';
  }

  // 2. ユーザー
  draft.included_user_ids.forEach(id => {
    const userObj = state.cachedUsers.find(u => u.id === id);
    if (!userObj) return;
    usersList.appendChild(createAdjFilterChip('user', 'include', id, `含む: ${userObj.display_name}`));
  });
  draft.excluded_user_ids.forEach(id => {
    const userObj = state.cachedUsers.find(u => u.id === id);
    if (!userObj) return;
    usersList.appendChild(createAdjFilterChip('user', 'exclude', id, `除く: ${userObj.display_name}`));
  });
  if (usersList.children.length === 0) {
    usersList.innerHTML = '<span style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">指定なし</span>';
  }
}

// フィルターチップ生成
function createAdjFilterChip(type, mode, id, label) {
  const chip = document.createElement('div');
  chip.className = `filter-chip ${mode}`;
  chip.innerHTML = `
    <span>${escape(label)}</span>
    <button type="button" class="remove-btn" onclick="removeAdjFilter('${type}', '${mode}', ${id})">&times;</button>
  `;
  return chip;
}

// 計算実行API連携
async function runAdjustedRatingCalculation() {
  const paneId = activePaneIdForAdjusted;
  const paneState = state.panes[paneId];
  const memoId = paneState.activeMemoId;
  if (!memoId) return;

  const draft = state.adjustedRatingFilterDraft;

  // フィルターが空の場合は、デフォルトで全ユーザーを含めて処理
  if (draft.included_role_ids.length === 0 && draft.included_user_ids.length === 0) {
    if (state.cachedUsers) {
      draft.included_user_ids = state.cachedUsers.map(u => u.id);
    }
  }

  showToast("偏差補正評価を計算中...", "refresh-cw");

  try {
    const token = state.token;
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/memos/${memoId}/calculate-adjusted-rating`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(draft)
    });

    if (res.ok) {
      const result = await res.json();
      
      // メモキャッシュを更新
      state.memos = state.memos.map(m => {
        if (m.id === memoId) {
          return {
            ...m,
            adjusted_rating: result.adjusted_rating,
            adjusted_rating_calculated_at: result.calculated_at,
            adjusted_rating_params: JSON.stringify(draft)
          };
        }
        return m;
      });
      saveCache();

      // UIの更新
      const activeMemo = state.memos.find(m => m.id === memoId);
      updateAdjustedRatingDisplay(paneId, activeMemo);
      
      // スプリットされたもう片方のペインも連動更新
      const otherPaneId = paneId === 'left' ? 'right' : 'left';
      if (state.panes[otherPaneId].activeMemoId === memoId) {
        updateAdjustedRatingDisplay(otherPaneId, activeMemo);
      }

      showToast(`補正平均: ${result.adjusted_rating}点 で保存しました！`, "check");
      closeAdjustedRatingModal();
    } else {
      const err = await res.json();
      showToast(err.detail || "偏差補正の計算に失敗しました", "shield-alert");
    }
  } catch (e) {
    console.error("Calculate adjusted rating error:", e);
    showToast("通信エラーが発生しました", "shield-alert");
  }
}

// 偏差補正平均の表示制御
function updateAdjustedRatingDisplay(paneId, memo) {
  const adjustedVal = document.getElementById(`${paneId}-adjustedRatingValue`);
  const adjustedContainer = document.getElementById(`${paneId}-adjustedRatingContainer`);
  if (!adjustedVal || !adjustedContainer) return;

  if (memo && memo.adjusted_rating !== undefined && memo.adjusted_rating !== null) {
    adjustedContainer.style.display = 'flex';
    
    let dateStr = "";
    if (memo.adjusted_rating_calculated_at) {
      try {
        const d = new Date(memo.adjusted_rating_calculated_at);
        dateStr = ` (${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} 確定)`;
      } catch (e) {
        console.error(e);
      }
    }
    
    adjustedVal.textContent = `${memo.adjusted_rating}点${dateStr}`;
  } else {
    // 編集権限がある場合は「未計算（計算ボタンあり）」で表示
    if (memo && memo.permission !== 'read') {
      adjustedContainer.style.display = 'flex';
      adjustedVal.textContent = '未計算';
    } else {
      // 閲覧権限のみで未計算の場合は非表示
      adjustedContainer.style.display = 'none';
    }
  }
}

// グローバルへのエクスポート
window.openAdjustedRatingModal = openAdjustedRatingModal;
window.closeAdjustedRatingModal = closeAdjustedRatingModal;
window.runAdjustedRatingCalculation = runAdjustedRatingCalculation;
window.updateAdjustedRatingDisplay = updateAdjustedRatingDisplay;
