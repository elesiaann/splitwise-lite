/* ═══════════════════════════════════════════════════════════
   Splitwise Lite — app.js
   Track shared expenses between friends.
   All data stored in localStorage — nothing leaves the browser.
   ═══════════════════════════════════════════════════════════ */

// ── Storage ───────────────────────────────────────────────
const LS_GROUPS   = 'swl_groups';
const LS_EXPENSES = 'swl_expenses';
const LS_SETTLES  = 'swl_settlements';

let groups      = JSON.parse(localStorage.getItem(LS_GROUPS)   || '[]');
let expenses    = JSON.parse(localStorage.getItem(LS_EXPENSES) || '[]');
let settlements = JSON.parse(localStorage.getItem(LS_SETTLES)  || '[]');

function save() {
  localStorage.setItem(LS_GROUPS,   JSON.stringify(groups));
  localStorage.setItem(LS_EXPENSES, JSON.stringify(expenses));
  localStorage.setItem(LS_SETTLES,  JSON.stringify(settlements));
}

// ── Helpers ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const fmtDate = s => new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const today = () => new Date().toISOString().slice(0,10);

const CATEGORY_ICONS = {
  general:'📦', food:'🍕', transport:'🚗', housing:'🏠',
  entertainment:'🎬', shopping:'🛍', utilities:'💡', travel:'✈️', other:'💼'
};

// Member avatar colours
const AVATAR_COLORS = [
  '#1ec8a0','#5b9cf6','#a78bfa','#f5a623','#e05c5c',
  '#34d399','#60a5fa','#f472b6','#fb923c','#a3e635'
];
function memberColor(idx) { return AVATAR_COLORS[idx % AVATAR_COLORS.length]; }
function memberInitial(name) { return (name||'?')[0].toUpperCase(); }

// ── Current view state ────────────────────────────────────
let currentGroupId = null;
let currentTab     = 'expenses';

// ── Rendering entry points ─────────────────────────────────
function render() {
  if (currentGroupId) renderGroupView();
  else                renderHome();
}

// ══════════════════════════════════════════════════════════
// HOME VIEW
// ══════════════════════════════════════════════════════════
function renderHome() {
  $('backBtn').classList.add('hidden');
  $('logoArea').classList.remove('hidden');
  $('headerActions').innerHTML = '';

  const root = $('appRoot');
  if (groups.length === 0) {
    root.innerHTML = `
      <div class="empty-groups">
        <div class="empty-icon">💸</div>
        <p>No groups yet. Create one to start splitting expenses.</p>
        <button class="btn-primary" id="emptyCreate">+ New Group</button>
      </div>`;
    $('emptyCreate').addEventListener('click', openCreateGroup);
    return;
  }

  root.innerHTML = `
    <div class="groups-home">
      <div class="home-header">
        <h1>Your Groups</h1>
        <button class="btn-primary" id="homeCreate">+ New Group</button>
      </div>
      <div class="group-grid" id="groupGrid"></div>
    </div>`;

  $('homeCreate').addEventListener('click', openCreateGroup);

  const grid = $('groupGrid');
  groups.forEach(g => {
    const bal = groupBalance(g.id, null);
    const balClass = bal > 0.005 ? 'positive' : bal < -0.005 ? 'negative' : 'settled';
    const balLabel = bal > 0.005 ? 'you are owed' : bal < -0.005 ? 'you owe' : 'all settled';
    const expCount  = expenses.filter(e => e.groupId === g.id).length;

    const card = document.createElement('div');
    card.className = 'group-card';
    card.style.setProperty('--card-color', memberColor(groups.indexOf(g)));
    card.style.cssText += `--before-bg:${memberColor(groups.indexOf(g))}`;
    card.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${memberColor(groups.indexOf(g))};border-radius:10px 10px 0 0"></div>
      <div class="gc-name">${esc(g.name)}</div>
      <div class="gc-meta">${g.members.length} members · ${expCount} expense${expCount!==1?'s':''}</div>
      <div class="gc-balance ${balClass}">${fmt(Math.abs(bal))}</div>
      <div class="gc-balance-label">${balLabel}</div>`;
    card.addEventListener('click', () => openGroup(g.id));
    grid.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════════
// GROUP VIEW
// ══════════════════════════════════════════════════════════
function openGroup(gid) {
  currentGroupId = gid;
  currentTab     = 'expenses';
  renderGroupView();
}

function renderGroupView() {
  const g = groups.find(x => x.id === currentGroupId);
  if (!g) { currentGroupId = null; render(); return; }

  $('backBtn').classList.remove('hidden');
  $('logoArea').classList.add('hidden');

  $('headerActions').innerHTML = `
    <button class="btn-secondary" id="hdrSettle">Settle Up</button>
    <button class="btn-primary"   id="hdrAddExp">+ Add Expense</button>`;
  $('hdrAddExp').addEventListener('click', openAddExpense);
  $('hdrSettle').addEventListener('click', openSettle);

  const root = $('appRoot');
  root.innerHTML = `
    <div class="group-title-bar">
      <h2>${esc(g.name)}</h2>
      <div class="tabs">
        <button class="tab-btn ${currentTab==='expenses'?'active':''}" data-t="expenses">Expenses</button>
        <button class="tab-btn ${currentTab==='balances'?'active':''}" data-t="balances">Balances</button>
        <button class="tab-btn ${currentTab==='members' ?'active':''}" data-t="members">Members</button>
      </div>
    </div>
    <div id="tab-expenses" class="tab-content ${currentTab==='expenses'?'active':''}"></div>
    <div id="tab-balances" class="tab-content ${currentTab==='balances'?'active':''}"></div>
    <div id="tab-members"  class="tab-content ${currentTab==='members' ?'active':''}"></div>`;

  root.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.t;
      root.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b===btn));
      root.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id===`tab-${currentTab}`));
      renderCurrentTab(g);
    });
  });

  renderCurrentTab(g);
}

function renderCurrentTab(g) {
  if (currentTab === 'expenses') renderExpenses(g);
  if (currentTab === 'balances') renderBalances(g);
  if (currentTab === 'members')  renderMembers(g);
}

// ── Expenses tab ──────────────────────────────────────────
function renderExpenses(g) {
  const el = $('tab-expenses');
  const gExp = expenses.filter(e => e.groupId === g.id).sort((a,b) => b.createdAt - a.createdAt);
  const gSet = settlements.filter(s => s.groupId === g.id).sort((a,b) => b.date.localeCompare(a.date));

  el.innerHTML = `
    <div class="expense-toolbar">
      <span class="muted" style="font-size:.82rem">${gExp.length} expense${gExp.length!==1?'s':''} · ${gSet.length} settlement${gSet.length!==1?'s':''}</span>
    </div>
    <div class="expense-list" id="expenseList"></div>`;

  const list = $('expenseList');

  if (gExp.length === 0 && gSet.length === 0) {
    list.innerHTML = `<div class="empty-list"><div class="empty-icon">🧾</div><p>No expenses yet. Add one above.</p></div>`;
    return;
  }

  // Merge and sort by date desc
  const items = [
    ...gExp.map(e => ({ ...e, _type: 'expense' })),
    ...gSet.map(s => ({ ...s, _type: 'settle' }))
  ].sort((a,b) => {
    const da = a._type==='expense' ? a.createdAt : new Date(a.date).getTime();
    const db = b._type==='expense' ? b.createdAt : new Date(b.date).getTime();
    return db - da;
  });

  items.forEach(item => {
    if (item._type === 'expense') {
      const payer = g.members.find(m => m.id === item.paidBy);
      const payerIdx = g.members.indexOf(payer);
      list.insertAdjacentHTML('beforeend', `
        <div class="expense-card" data-eid="${item.id}">
          <div class="exp-icon">${CATEGORY_ICONS[item.category]||'📦'}</div>
          <div class="exp-body">
            <div class="exp-desc">${esc(item.description)}</div>
            <div class="exp-meta">
              Paid by <strong>${esc(payer?.name||'?')}</strong> · ${fmtDate(item.date)}
            </div>
          </div>
          <div class="exp-right">
            <div class="exp-amount">${fmt(item.amount)}</div>
            <button class="exp-delete" title="Delete expense" data-eid="${item.id}">🗑</button>
          </div>
        </div>`);
    } else {
      const from = g.members.find(m => m.id === item.from);
      const to   = g.members.find(m => m.id === item.to);
      list.insertAdjacentHTML('beforeend', `
        <div class="settlement-card" data-sid="${item.id}">
          <span class="settle-icon">✅</span>
          <span><strong>${esc(from?.name||'?')}</strong> paid <strong>${esc(to?.name||'?')}</strong></span>
          <span class="muted">· ${fmtDate(item.date)}</span>
          <span class="settle-amount">${fmt(item.amount)}</span>
          <button class="settle-delete" title="Delete settlement" data-sid="${item.id}">🗑</button>
        </div>`);
    }
  });

  // Delete expense
  list.querySelectorAll('.exp-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmAction('Delete Expense', 'Delete this expense? This cannot be undone.', () => {
        expenses = expenses.filter(x => x.id !== btn.dataset.eid);
        save(); renderCurrentTab(g);
      });
    });
  });

  // Delete settlement
  list.querySelectorAll('.settle-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmAction('Delete Settlement', 'Remove this settlement record?', () => {
        settlements = settlements.filter(x => x.id !== btn.dataset.sid);
        save(); renderCurrentTab(g);
      });
    });
  });
}

// ── Balances tab ──────────────────────────────────────────
function renderBalances(g) {
  const el = $('tab-balances');
  // Per-member net balance (positive = owed money, negative = owes money)
  const netBalances = computeNetBalances(g.id, g.members);
  // Simplified debts
  const debts = simplifyDebts(netBalances, g.members);

  let memberRows = g.members.map((m, i) => {
    const bal = netBalances[m.id] || 0;
    const cls = bal > 0.005 ? 'pos' : bal < -0.005 ? 'neg' : 'zero';
    const label = bal > 0.005 ? 'gets back' : bal < -0.005 ? 'owes' : 'settled up';
    return `
      <div class="mb-card">
        <div class="mb-avatar" style="background:${memberColor(i)};color:#0d1117">${memberInitial(m.name)}</div>
        <div class="mb-name">${esc(m.name)}</div>
        <div>
          <div class="mb-amount ${cls}">${fmt(Math.abs(bal))}</div>
          <div class="mb-label">${label}</div>
        </div>
      </div>`;
  }).join('');

  let debtRows = '';
  if (debts.length === 0) {
    debtRows = `<div class="all-settled"><div class="big-icon">🎉</div><p>Everyone is settled up!</p></div>`;
  } else {
    debtRows = debts.map(d => {
      const from = g.members.find(m => m.id === d.from);
      const to   = g.members.find(m => m.id === d.to);
      return `
        <div class="debt-card">
          <span class="debt-from">${esc(from?.name||'?')}</span>
          <span class="debt-arrow">→ owes →</span>
          <span class="debt-to">${esc(to?.name||'?')}</span>
          <span class="debt-amount">${fmt(d.amount)}</span>
        </div>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="balance-section">
      <h3>Member Balances</h3>
      <div class="member-balance-list">${memberRows}</div>
    </div>
    <div class="balance-section">
      <h3>Who Owes Whom</h3>
      <div class="debt-list">${debtRows}</div>
    </div>`;
}

// ── Members tab ───────────────────────────────────────────
function renderMembers(g) {
  const el = $('tab-members');
  el.innerHTML = `<div class="member-list-tab" id="memberListTab"></div>`;
  const list = $('memberListTab');

  g.members.forEach((m, i) => {
    const expCount = expenses.filter(e => e.groupId === g.id && e.paidBy === m.id).length;
    const paid = expenses.filter(e => e.groupId === g.id && e.paidBy === m.id)
                         .reduce((s, e) => s + e.amount, 0);
    list.insertAdjacentHTML('beforeend', `
      <div class="member-card-tab">
        <div class="mb-avatar" style="background:${memberColor(i)};color:#0d1117">${memberInitial(m.name)}</div>
        <div class="mc-name">${esc(m.name)}</div>
        <div class="mc-meta">Paid ${expCount} expense${expCount!==1?'s':''} · ${fmt(paid)} total</div>
      </div>`);
  });
}

// ══════════════════════════════════════════════════════════
// BALANCE COMPUTATION
// ══════════════════════════════════════════════════════════
function computeNetBalances(gid, members) {
  const net = {};
  members.forEach(m => { net[m.id] = 0; });

  // Expenses
  expenses.filter(e => e.groupId === gid).forEach(e => {
    net[e.paidBy] = (net[e.paidBy] || 0) + e.amount;
    Object.entries(e.splits).forEach(([mid, amt]) => {
      net[mid] = (net[mid] || 0) - amt;
    });
  });

  // Settlements
  settlements.filter(s => s.groupId === gid).forEach(s => {
    net[s.from] = (net[s.from] || 0) + s.amount; // payer reduces their debt
    net[s.to]   = (net[s.to]   || 0) - s.amount; // receiver reduces credit
  });

  return net;
}

// Returns total balance for a specific member in a group (or null = "me" which isn't implemented)
function groupBalance(gid, memberId) {
  const g = groups.find(x => x.id === gid);
  if (!g || !g.members.length) return 0;
  const net = computeNetBalances(gid, g.members);
  if (memberId) return net[memberId] || 0;
  // No "me" concept — return the sum of positive balances (money to be received)
  return Object.values(net).reduce((s, v) => v > 0 ? s + v : s, 0);
}

// Greedy min-cash-flow to simplify debts
function simplifyDebts(netBalances, members) {
  // Work with cents to avoid float issues
  const bal = {};
  members.forEach(m => { bal[m.id] = Math.round((netBalances[m.id] || 0) * 100); });

  const debts = [];
  for (let iter = 0; iter < 1000; iter++) {
    const creditors = Object.entries(bal).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
    const debtors   = Object.entries(bal).filter(([,v]) => v < 0).sort((a,b) => a[1]-b[1]);
    if (!creditors.length || !debtors.length) break;

    const [cid, camt] = creditors[0];
    const [did, damt] = debtors[0];
    const transfer = Math.min(camt, -damt);

    debts.push({ from: did, to: cid, amount: +(transfer / 100).toFixed(2) });
    bal[cid] -= transfer;
    bal[did] += transfer;
  }
  return debts;
}

// ══════════════════════════════════════════════════════════
// CREATE GROUP MODAL
// ══════════════════════════════════════════════════════════
let cgMembers = []; // temp list while modal is open

function openCreateGroup() {
  cgMembers = [];
  $('cgName').value       = '';
  $('cgMemberName').value = '';
  $('cgError').classList.add('hidden');
  $('cgMemberList').innerHTML = '';
  openModal('modalCreateGroup');
  $('cgName').focus();
}

$('cgAddMember').addEventListener('click', cgAddMember);
$('cgMemberName').addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); cgAddMember(); } });

function cgAddMember() {
  const name = $('cgMemberName').value.trim();
  if (!name) return;
  if (cgMembers.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    showFieldError('cgError', 'Member already added.'); return;
  }
  $('cgError').classList.add('hidden');
  cgMembers.push({ id: uid(), name });
  $('cgMemberName').value = '';
  renderCgChips();
  $('cgMemberName').focus();
}

function renderCgChips() {
  const el = $('cgMemberList');
  el.innerHTML = cgMembers.map((m, i) => `
    <div class="member-chip">
      <div class="chip-avatar" style="background:${memberColor(i)};color:#0d1117">${memberInitial(m.name)}</div>
      ${esc(m.name)}
      <button class="chip-remove" data-mid="${m.id}">✕</button>
    </div>`).join('');
  el.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      cgMembers = cgMembers.filter(m => m.id !== btn.dataset.mid);
      renderCgChips();
    });
  });
}

$('cgSubmit').addEventListener('click', () => {
  const name = $('cgName').value.trim();
  if (!name) { showFieldError('cgError','Enter a group name.'); return; }
  if (cgMembers.length < 2) { showFieldError('cgError','Add at least 2 members.'); return; }

  groups.push({ id: uid(), name, members: cgMembers, createdAt: Date.now() });
  save();
  closeModal('modalCreateGroup');
  render();
});

// ══════════════════════════════════════════════════════════
// ADD EXPENSE MODAL
// ══════════════════════════════════════════════════════════
let aeSplitType = 'equal';

function openAddExpense() {
  const g = groups.find(x => x.id === currentGroupId);
  if (!g) return;

  aeSplitType = 'equal';
  $('aeDesc').value = '';
  $('aeAmount').value = '';
  $('aeDate').value = today();
  $('aeCategory').value = 'general';
  $('aeError').classList.add('hidden');
  $('aeRemaining').classList.add('hidden');

  // Paid by
  const paidBy = $('aePaidBy');
  paidBy.innerHTML = g.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');

  // Split type buttons
  document.querySelectorAll('.split-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.split === 'equal');
  });

  renderAeSplitArea(g, 'equal');
  openModal('modalAddExpense');
  $('aeDesc').focus();
}

document.querySelectorAll('.split-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    aeSplitType = btn.dataset.split;
    document.querySelectorAll('.split-type-btn').forEach(b => b.classList.toggle('active', b===btn));
    const g = groups.find(x => x.id === currentGroupId);
    if (g) renderAeSplitArea(g, aeSplitType);
  });
});

$('aeAmount').addEventListener('input', () => {
  const g = groups.find(x => x.id === currentGroupId);
  if (g && aeSplitType === 'equal') renderAeSplitArea(g, 'equal');
  if (g && aeSplitType !== 'equal') updateAeRemaining();
});

function renderAeSplitArea(g, splitType) {
  const area = $('aeSplitArea');
  const amt  = parseFloat($('aeAmount').value) || 0;
  const equalShare = g.members.length > 0 ? (amt / g.members.length) : 0;

  area.innerHTML = g.members.map((m, i) => {
    let input = '';
    if (splitType === 'equal') {
      input = `<div class="split-member-share">${fmt(equalShare)}</div>`;
    } else if (splitType === 'exact') {
      input = `<input class="split-member-input" type="number" min="0" step="0.01" placeholder="0.00" data-mid="${m.id}" />`;
    } else {
      input = `<input class="split-member-input" type="number" min="0" max="100" step="1" placeholder="0%" data-mid="${m.id}" />`;
    }
    return `
      <div class="split-member-row">
        <input type="checkbox" class="split-member-check" data-mid="${m.id}" checked />
        <div class="split-member-avatar" style="background:${memberColor(i)};color:#0d1117">${memberInitial(m.name)}</div>
        <span class="split-member-name">${esc(m.name)}</span>
        ${input}
      </div>`;
  }).join('');

  // Checkbox toggles disable inputs
  area.querySelectorAll('.split-member-check').forEach(chk => {
    chk.addEventListener('change', () => {
      const row = chk.closest('.split-member-row');
      const inp = row.querySelector('.split-member-input');
      if (inp) inp.disabled = !chk.checked;
      if (splitType === 'equal') {
        const g2 = groups.find(x => x.id === currentGroupId);
        const checked = area.querySelectorAll('.split-member-check:checked').length;
        const amt2 = parseFloat($('aeAmount').value) || 0;
        const share = checked > 0 ? amt2 / checked : 0;
        area.querySelectorAll('.split-member-share').forEach(el => el.textContent = fmt(share));
      }
      updateAeRemaining();
    });
  });

  area.querySelectorAll('.split-member-input').forEach(inp => {
    inp.addEventListener('input', updateAeRemaining);
  });

  $('aeRemaining').classList.add('hidden');
  updateAeRemaining();
}

function updateAeRemaining() {
  const rem = $('aeRemaining');
  if (aeSplitType === 'equal') { rem.classList.add('hidden'); return; }

  const area = $('aeSplitArea');
  const amt  = parseFloat($('aeAmount').value) || 0;
  const inputs = [...area.querySelectorAll('.split-member-input:not(:disabled)')];
  const entered = inputs.reduce((s, i) => s + (parseFloat(i.value)||0), 0);

  rem.classList.remove('hidden', 'ok');
  if (aeSplitType === 'exact') {
    const diff = amt - entered;
    if (Math.abs(diff) < 0.005) {
      rem.textContent = '✓ Amounts add up correctly';
      rem.classList.add('ok');
    } else if (diff > 0) {
      rem.textContent = `${fmt(diff)} left to assign`;
    } else {
      rem.textContent = `${fmt(-diff)} over the total`;
    }
  } else {
    const diff = 100 - entered;
    if (Math.abs(diff) < 0.05) {
      rem.textContent = '✓ Percentages add up to 100%';
      rem.classList.add('ok');
    } else if (diff > 0) {
      rem.textContent = `${diff.toFixed(1)}% left to assign`;
    } else {
      rem.textContent = `${(-diff).toFixed(1)}% over 100%`;
    }
  }
}

$('aeSubmit').addEventListener('click', () => {
  const g    = groups.find(x => x.id === currentGroupId);
  const desc = $('aeDesc').value.trim();
  const amt  = parseFloat($('aeAmount').value);
  const paid = $('aePaidBy').value;
  const cat  = $('aeCategory').value;
  const date = $('aeDate').value || today();

  if (!desc) { showFieldError('aeError','Enter a description.'); return; }
  if (!amt || amt <= 0) { showFieldError('aeError','Enter a valid amount.'); return; }

  const area = $('aeSplitArea');
  const splits = {};

  if (aeSplitType === 'equal') {
    const checked = [...area.querySelectorAll('.split-member-check:checked')];
    if (checked.length === 0) { showFieldError('aeError','Select at least one member.'); return; }
    const share = +(amt / checked.length).toFixed(2);
    // Distribute rounding remainder to first member
    const total = share * checked.length;
    const rem   = +(amt - total).toFixed(2);
    checked.forEach((chk, i) => {
      splits[chk.dataset.mid] = i === 0 ? +(share + rem).toFixed(2) : share;
    });
  } else if (aeSplitType === 'exact') {
    const inputs = [...area.querySelectorAll('.split-member-input')];
    let total = 0;
    for (const inp of inputs) {
      if (!inp.disabled) {
        const v = parseFloat(inp.value) || 0;
        splits[inp.dataset.mid] = +v.toFixed(2);
        total += v;
      }
    }
    if (Math.abs(total - amt) > 0.01) {
      showFieldError('aeError', `Amounts must add up to ${fmt(amt)}.`); return;
    }
  } else { // percent
    const inputs = [...area.querySelectorAll('.split-member-input')];
    let totalPct = 0;
    for (const inp of inputs) {
      if (!inp.disabled) totalPct += parseFloat(inp.value) || 0;
    }
    if (Math.abs(totalPct - 100) > 0.1) {
      showFieldError('aeError', 'Percentages must add up to 100%.'); return;
    }
    inputs.forEach(inp => {
      if (!inp.disabled) {
        const pct = parseFloat(inp.value) || 0;
        splits[inp.dataset.mid] = +((pct / 100) * amt).toFixed(2);
      }
    });
  }

  expenses.push({ id: uid(), groupId: currentGroupId, description: desc, amount: +amt.toFixed(2),
    paidBy: paid, splits, category: cat, date, createdAt: Date.now() });
  save();
  closeModal('modalAddExpense');
  renderCurrentTab(g);
});

// ══════════════════════════════════════════════════════════
// SETTLE UP MODAL
// ══════════════════════════════════════════════════════════
function openSettle() {
  const g = groups.find(x => x.id === currentGroupId);
  if (!g) return;

  $('suAmount').value = '';
  $('suDate').value   = today();
  $('suError').classList.add('hidden');

  const opts = g.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  $('suFrom').innerHTML = opts;
  $('suTo').innerHTML   = opts;
  if (g.members.length >= 2) $('suTo').selectedIndex = 1;

  // Pre-fill with the largest debt if any
  const net   = computeNetBalances(g.id, g.members);
  const debts = simplifyDebts(net, g.members);
  if (debts.length) {
    $('suFrom').value   = debts[0].from;
    $('suTo').value     = debts[0].to;
    $('suAmount').value = debts[0].amount.toFixed(2);
  }

  openModal('modalSettle');
}

$('suSubmit').addEventListener('click', () => {
  const g    = groups.find(x => x.id === currentGroupId);
  const from = $('suFrom').value;
  const to   = $('suTo').value;
  const amt  = parseFloat($('suAmount').value);
  const date = $('suDate').value || today();

  if (from === to) { showFieldError('suError','From and To cannot be the same person.'); return; }
  if (!amt || amt <= 0) { showFieldError('suError','Enter a valid amount.'); return; }

  settlements.push({ id: uid(), groupId: currentGroupId, from, to, amount: +amt.toFixed(2), date });
  save();
  closeModal('modalSettle');
  renderCurrentTab(g);
});

// ══════════════════════════════════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════════════════════════════════
let confirmCallback = null;
function confirmAction(title, msg, cb) {
  $('confirmTitle').textContent = title;
  $('confirmMsg').textContent   = msg;
  confirmCallback = cb;
  openModal('modalConfirm');
}
$('confirmOk').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
  closeModal('modalConfirm');
});

// ══════════════════════════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════════════════════════
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

function showFieldError(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

// Close buttons
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', e => { if (e.target === bd) closeModal(bd.id); });
});

// Back button
$('backBtn').addEventListener('click', () => {
  currentGroupId = null;
  render();
});

// ── Sample data ───────────────────────────────────────────
function loadSampleData() {
  const alice = { id: uid(), name: 'Alice' };
  const bob   = { id: uid(), name: 'Bob' };
  const carol = { id: uid(), name: 'Carol' };
  const gid   = uid();

  groups.push({ id: gid, name: 'Vegas Trip 🎰', members: [alice, bob, carol], createdAt: Date.now() });

  const addExp = (desc, amount, paidBy, splits, cat, daysAgo) => {
    const date = new Date(); date.setDate(date.getDate() - daysAgo);
    expenses.push({ id: uid(), groupId: gid, description: desc, amount, paidBy: paidBy.id, splits, category: cat,
      date: date.toISOString().slice(0,10), createdAt: date.getTime() });
  };

  addExp('Hotel (3 nights)', 450, alice,
    { [alice.id]:150, [bob.id]:150, [carol.id]:150 }, 'housing', 5);
  addExp('Flight tickets', 600, bob,
    { [alice.id]:200, [bob.id]:200, [carol.id]:200 }, 'travel', 6);
  addExp('Dinner at Nobu', 180, carol,
    { [alice.id]:60, [bob.id]:60, [carol.id]:60 }, 'food', 4);
  addExp('Uber rides', 60, alice,
    { [alice.id]:20, [bob.id]:20, [carol.id]:20 }, 'transport', 4);
  addExp('Show tickets', 240, bob,
    { [alice.id]:80, [bob.id]:80, [carol.id]:80 }, 'entertainment', 3);
  addExp('Groceries & snacks', 90, carol,
    { [alice.id]:30, [bob.id]:30, [carol.id]:30 }, 'food', 3);

  save();
}

// ── Boot ──────────────────────────────────────────────────
if (groups.length === 0) loadSampleData();
render();
