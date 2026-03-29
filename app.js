const CATEGORY_ORDER = ["한식", "중식", "일식", "양식", "동남아", "카페", "패스트·간편식", "기타"];
const THEME_CONFIG = {
  breakfast: {
    canvasBg: "#edf3f8",
    categoryBases: {
      "한식": [162, 184, 96],
      "중식": [206, 144, 88],
      "일식": [122, 175, 164],
      "양식": [132, 164, 201],
      "동남아": [218, 184, 104],
      "카페": [184, 156, 136],
      "패스트·간편식": [208, 122, 96],
      "기타": [149, 157, 167]
    }
  },
  lunch: {
    canvasBg: "#f8edeb",
    categoryBases: {
      "한식": [151, 176, 122],
      "중식": [204, 140, 108],
      "일식": [126, 164, 158],
      "양식": [140, 160, 190],
      "동남아": [214, 180, 118],
      "카페": [170, 148, 132],
      "패스트·간편식": [208, 122, 104],
      "기타": [158, 161, 168]
    }
  },
  dinner: {
    canvasBg: "#314760",
    categoryBases: {
      "한식": [120, 148, 86],
      "중식": [182, 122, 78],
      "일식": [96, 149, 139],
      "양식": [104, 140, 182],
      "동남아": [188, 152, 78],
      "카페": [138, 116, 106],
      "패스트·간편식": [171, 96, 75],
      "기타": [116, 130, 149]
    }
  }
};
const DEFAULT_CATEGORIES = [
  "한식",
  "중식",
  "일식",
  "양식",
  "베트남·아시아",
  "카페",
  "베이커리",
  "분식",
  "패스트푸드",
  "건강식",
  "기타"
];
const API_BASE_URL = resolveApiBaseUrl();
const state = {
  mealMode: getInitialMealMode(),
  query: "",
  randomPickScope: "all",
  activeId: null,
  hoveredId: null,
  visibleRestaurants: [],
  layout: { categories: [], restaurants: [] },
  pointer: { x: 0, y: 0 },
  press: null,
  drag: null,
  randomPick: null
};

const themeState = {
  progress: 1,
  fromTheme: "lunch",
  toTheme: "lunch",
  startTime: 0,
  duration: 900,
  frameId: null
};

const detailMotionState = {
  token: 0,
  lastId: null,
  timeoutId: null
};

const elements = {
  wrapper: document.querySelector("#wrapper"),
  header: document.querySelector("#header"),
  mainLayout: document.querySelector(".main-layout"),
  canvasPanel: document.querySelector(".canvas-panel"),
  mealToggle: document.querySelector("#mealToggle"),
  randomPickBtn: document.querySelector("#randomPickBtn"),
  randomPickScope: document.querySelector("#randomPickScope"),
  searchInput: document.querySelector("#searchInput"),
  statTotal: document.querySelector("#statTotal"),
  statCategories: document.querySelector("#statCategories"),
  statCustom: document.querySelector("#statCustom"),
  statusText: document.querySelector("#statusText"),
  canvas: document.querySelector("#canvas"),
  detailCard: document.querySelector("#detailCard"),
  categoryList: document.querySelector("#categoryList"),
  editForm: document.querySelector("#editForm"),
  editName: document.querySelector("#editName"),
  editCategory: document.querySelector("#editCategory"),
  editMenuCategory: document.querySelector("#editMenuCategory"),
  editSignatureMenu: document.querySelector("#editSignatureMenu"),
  editTags: document.querySelector("#editTags"),
  editBreakfast: document.querySelector("#editBreakfast"),
  editLunch: document.querySelector("#editLunch"),
  editDinner: document.querySelector("#editDinner"),
  resetEditBtn: document.querySelector("#resetEditBtn"),
  addForm: document.querySelector("#addForm"),
  addName: document.querySelector("#addName"),
  addCategory: document.querySelector("#addCategory"),
  addMenuCategory: document.querySelector("#addMenuCategory"),
  addSignatureMenu: document.querySelector("#addSignatureMenu"),
  addTags: document.querySelector("#addTags"),
  addBreakfast: document.querySelector("#addBreakfast"),
  addLunch: document.querySelector("#addLunch"),
  addDinner: document.querySelector("#addDinner"),
  sidebarTrash: document.querySelector("#sidebarTrash"),
  tooltip: document.querySelector("#tooltip")
};

const ctx = elements.canvas.getContext("2d");
let dpr = window.devicePixelRatio || 1;
let restaurants = [];

initialize().catch((error) => {
  console.error(error);
  alert("서버 데이터를 불러오지 못했습니다. Node 서버와 MySQL 상태를 확인해 주세요.");
});

async function initialize() {
  syncTheme();
  bindEvents();
  syncMealToggle();
  await refreshRestaurants();
}

function getInitialMealMode() {
  const hour = new Date().getHours();
  if (hour < 9) return "breakfast";
  if (hour < 13) return "lunch";
  return "dinner";
}

function bindEvents() {
  elements.mealToggle.querySelectorAll("[data-meal]").forEach((button) => {
    button.addEventListener("click", () => {
      stopRandomPick();
      state.mealMode = button.dataset.meal;
      syncMealToggle();
      syncTheme(true);
      state.activeId = isVisibleActive() ? state.activeId : null;
      render();
    });
  });

  elements.randomPickBtn.addEventListener("click", startRandomPick);
  elements.randomPickScope.addEventListener("change", () => {
    stopRandomPick();
    state.randomPickScope = elements.randomPickScope.value;
    updateRandomPickButton();
  });

  elements.searchInput.addEventListener("input", () => {
    stopRandomPick();
    state.query = elements.searchInput.value.trim().toLowerCase();
    state.activeId = isVisibleActive() ? state.activeId : null;
    render();
  });

  elements.editForm.addEventListener("submit", handleEditSubmit);
  elements.resetEditBtn.addEventListener("click", () => populateEditForm(getActiveRestaurant()));
  elements.addForm.addEventListener("submit", handleAddSubmit);

  elements.canvas.addEventListener("mousemove", handleCanvasMove);
  elements.canvas.addEventListener("mousedown", handleCanvasDown);
  window.addEventListener("mouseup", handleCanvasUp);
  window.addEventListener("mousemove", handleWindowMove);
  elements.canvas.addEventListener("mouseleave", handleCanvasLeave);
  window.addEventListener("resize", () => {
    stopRandomPick();
    render();
  });
}

async function refreshRestaurants(nextActiveId = state.activeId) {
  const data = await requestJson("/api/restaurants");
  restaurants = data.map(hydrateRestaurant);
  fillCategoryEditors();
  state.activeId = nextActiveId && restaurants.some((item) => item.id === nextActiveId) ? nextActiveId : null;
  render();
}

function hydrateRestaurant(restaurant) {
  const aliases = Array.isArray(restaurant.aliases) ? restaurant.aliases : [];
  const tags = Array.isArray(restaurant.tags) ? restaurant.tags : [];
  const hydrated = {
    ...restaurant,
    aliases,
    tags
  };

  return {
    ...hydrated,
    corrected: aliases.some((alias) => alias !== hydrated.name),
    cuisineGroup: hydrated.cuisineGroup || toCuisineGroup(hydrated),
    sizeValue: computeWeight(hydrated)
  };
}

async function requestJson(url, options = {}) {
  const requestUrl = /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;
  const response = await fetch(requestUrl, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }

  return payload;
}

function resolveApiBaseUrl() {
  if (window.location.protocol === "file:") {
    return "http://127.0.0.1:3000";
  }

  if (window.location.port === "3000") {
    return window.location.origin;
  }

  const hostname = window.location.hostname || "127.0.0.1";
  return `${window.location.protocol}//${hostname}:3000`;
}

function computeWeight(restaurant) {
  let score = 1;
  if (restaurant.breakfast) score += 0.2;
  if (restaurant.lunch && restaurant.dinner) score += 0.35;
  if (restaurant.isCustom) score += 0.1;
  return score;
}

function toCuisineGroup(restaurant) {
  const category = restaurant.category;
  if (category === "한식") return "한식";
  if (category === "중식") return "중식";
  if (category === "일식") return "일식";
  if (category === "양식") return "양식";
  if (category === "베트남·아시아") return "동남아";
  if (category === "카페" || category === "베이커리") return "카페";
  if (category === "분식" || category === "패스트푸드" || category === "건강식") return "패스트·간편식";
  return "기타";
}

function fillCategoryEditors() {
  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...restaurants.map((item) => item.category)
  ])).filter(Boolean).sort((a, b) => a.localeCompare(b, "ko"));

  [elements.editCategory, elements.addCategory].forEach((select) => {
    select.replaceChildren(...categories.map((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      return option;
    }));
  });
}

function getVisibleRestaurants() {
  return restaurants.filter((restaurant) => {
    if (state.mealMode === "breakfast" && !restaurant.breakfast) return false;
    if (state.mealMode === "lunch" && !restaurant.lunch) return false;
    if (state.mealMode === "dinner" && !restaurant.dinner) return false;

    if (!state.query) return true;

    const haystack = [
      restaurant.name,
      restaurant.category,
      restaurant.menuCategory,
      restaurant.signatureMenu,
      ...(restaurant.tags || [])
    ].join(" ").toLowerCase();

    return haystack.includes(state.query);
  });
}

function render() {
  state.visibleRestaurants = getVisibleRestaurants();

  if (!state.visibleRestaurants.some((item) => item.id === state.activeId)) {
    state.activeId = null;
  }

  if (state.randomPick && !state.visibleRestaurants.some((item) => item.id === state.randomPick.currentId)) {
    stopRandomPick();
  }

  updateStats(state.visibleRestaurants);
  syncRandomPickScopeOptions(state.visibleRestaurants);
  updateRandomPickButton();
  renderCategoryList(state.visibleRestaurants);
  renderDetail(getActiveRestaurant(), { animate: false });
  layoutCanvas(state.visibleRestaurants);
  draw();
}

function updateRandomPickButton() {
  if (!elements.randomPickBtn) return;

  const isActive = !!state.randomPick?.active;
  const candidates = getRandomPickCandidates();
  elements.randomPickBtn.disabled = isActive || !candidates.length;
  elements.randomPickBtn.textContent = isActive ? "고르는 중..." : "랜덤 선택";
}

function syncRandomPickScopeOptions(items) {
  if (!elements.randomPickScope) return;

  const groups = Object.keys(groupByCuisine(items)).sort((a, b) => {
    const orderA = CATEGORY_ORDER.indexOf(a);
    const orderB = CATEGORY_ORDER.indexOf(b);
    if (orderA !== -1 && orderB !== -1) return orderA - orderB;
    if (orderA !== -1) return -1;
    if (orderB !== -1) return 1;
    return a.localeCompare(b, "ko");
  });

  const nextOptions = [
    { value: "all", label: "전체" },
    ...groups.map((group) => ({ value: group, label: group }))
  ];

  elements.randomPickScope.replaceChildren(...nextOptions.map((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    return option;
  }));

  if (!nextOptions.some((option) => option.value === state.randomPickScope)) {
    state.randomPickScope = "all";
  }

  elements.randomPickScope.value = state.randomPickScope;
}

function getRandomPickCandidates() {
  if (state.randomPickScope === "all") {
    return state.visibleRestaurants;
  }

  return state.visibleRestaurants.filter((item) => item.cuisineGroup === state.randomPickScope);
}

function startRandomPick() {
  const candidates = getRandomPickCandidates();
  if (state.randomPick?.active || !candidates.length) return;

  const sequence = buildRandomPickSequence(candidates);
  if (!sequence.length) return;

  const firstRect = getLayoutRestaurantRect(sequence[0]);
  const firstCenter = firstRect ? getRectCenter(firstRect) : { x: elements.canvas.width / dpr / 2, y: elements.canvas.height / dpr / 2 };

  state.hoveredId = null;
  hideTooltip();
  state.randomPick = {
    active: true,
    sequence,
    stepIndex: 0,
    currentId: sequence[0],
    winnerId: sequence[sequence.length - 1],
    markerX: firstCenter.x,
    markerY: firstCenter.y,
    fromX: firstCenter.x,
    fromY: firstCenter.y,
    toX: firstCenter.x,
    toY: firstCenter.y,
    stepStartTime: performance.now(),
    stepDuration: getRandomPickStepDuration(0, sequence.length),
    frameId: null
  };

  updateRandomPickButton();
  draw();
  state.randomPick.frameId = requestAnimationFrame(stepRandomPick);
}

function buildRandomPickSequence(items) {
  const ids = items.map((item) => item.id);
  if (!ids.length) return [];

  const totalSteps = clamp(Math.round(Math.sqrt(ids.length) * 3.5), 16, 28);
  const pool = shuffle(ids.slice());
  const sequence = [];

  while (sequence.length < totalSteps - 1) {
    if (!pool.length) {
      pool.push(...shuffle(ids.slice()));
    }

    const nextId = pool.shift();
    if (sequence[sequence.length - 1] === nextId && ids.length > 1) continue;
    sequence.push(nextId);
  }

  let winnerId = ids[Math.floor(Math.random() * ids.length)];
  if (ids.length > 1 && sequence[sequence.length - 1] === winnerId) {
    winnerId = ids.find((id) => id !== winnerId) || winnerId;
  }
  sequence.push(winnerId);

  return sequence;
}

function stepRandomPick(now) {
  const randomPick = state.randomPick;
  if (!randomPick?.active) return;

  const progress = clamp((now - randomPick.stepStartTime) / randomPick.stepDuration, 0, 1);
  const eased = easeOutCubic(progress);
  randomPick.markerX = lerp(randomPick.fromX, randomPick.toX, eased);
  randomPick.markerY = lerp(randomPick.fromY, randomPick.toY, eased);

  if (progress >= 1) {
    const nextIndex = randomPick.stepIndex + 1;
    if (nextIndex >= randomPick.sequence.length) {
      finishRandomPick(randomPick.winnerId);
      return;
    }

    const nextId = randomPick.sequence[nextIndex];
    const targetRect = getLayoutRestaurantRect(nextId);
    const targetCenter = targetRect ? getRectCenter(targetRect) : { x: randomPick.markerX, y: randomPick.markerY };

    randomPick.stepIndex = nextIndex;
    randomPick.currentId = nextId;
    randomPick.fromX = randomPick.markerX;
    randomPick.fromY = randomPick.markerY;
    randomPick.toX = targetCenter.x;
    randomPick.toY = targetCenter.y;
    randomPick.stepStartTime = now;
    randomPick.stepDuration = getRandomPickStepDuration(nextIndex, randomPick.sequence.length);
  }

  draw();
  randomPick.frameId = requestAnimationFrame(stepRandomPick);
}

function finishRandomPick(winnerId) {
  const winner = restaurants.find((item) => item.id === winnerId) || null;
  stopRandomPick(false);

  if (!winner) {
    draw();
    return;
  }

  state.activeId = winnerId;
  renderDetail(winner, { animate: true, variant: "winner" });
  draw();
}

function stopRandomPick(redraw = true) {
  if (state.randomPick?.frameId) {
    cancelAnimationFrame(state.randomPick.frameId);
  }

  state.randomPick = null;
  updateRandomPickButton();

  if (redraw) {
    draw();
  }
}

function getRandomPickStepDuration(index, total) {
  const t = total <= 1 ? 1 : index / (total - 1);
  return lerp(135, 500, Math.pow(t, 1.65));
}

function updateStats(items) {
  const grouped = groupByCuisine(items);
  elements.statTotal.textContent = items.length.toLocaleString("ko-KR");
  elements.statCategories.textContent = Object.keys(grouped).length.toLocaleString("ko-KR");
  elements.statCustom.textContent = restaurants.filter((item) => item.isCustom).length.toLocaleString("ko-KR");

  const mealLabels = { breakfast: "아침 히트맵", lunch: "점심 히트맵", dinner: "저녁 히트맵" };
  const mealLabel = mealLabels[state.mealMode] || "식사 히트맵";
  const queryText = state.query ? ` · 검색 "${state.query}"` : "";
  elements.statusText.textContent = `${mealLabel} · ${items.length}개 식당${queryText} · 카테고리로 드래그 이동 가능`;
}

function renderCategoryList(items) {
  const counts = Object.entries(groupByCuisine(items))
    .map(([name, values]) => ({
      name,
      count: values.length
    }))
    .sort((a, b) => {
      const orderA = CATEGORY_ORDER.indexOf(a.name);
      const orderB = CATEGORY_ORDER.indexOf(b.name);
      if (orderA !== -1 && orderB !== -1) return orderA - orderB;
      if (orderA !== -1) return -1;
      if (orderB !== -1) return 1;
      return b.count - a.count;
    });

  if (!counts.length) {
    elements.categoryList.innerHTML = '<div class="breakdown-item"><span>표시 가능한 카테고리 없음</span><strong>0</strong></div>';
    return;
  }

  elements.categoryList.replaceChildren(...counts.map((entry) => {
    const node = document.createElement("div");
    node.className = "breakdown-item";
    node.innerHTML = `<span>${entry.name}</span><strong>${entry.count}개</strong>`;
    return node;
  }));
}

function renderDetail(item, options = {}) {
  const { animate = false, variant = "soft" } = options;
  populateEditForm(item);
  const nextId = item?.id || null;

  if (animate && nextId !== detailMotionState.lastId) {
    animateDetailChange(item, variant);
    return;
  }

  commitDetailContent(item);
}

function animateDetailChange(item, variant) {
  const card = elements.detailCard;
  const token = ++detailMotionState.token;
  const isWinner = variant === "winner";
  const exitClass = isWinner ? "detail-exit-strong" : "detail-exit-soft";
  const enterClass = isWinner ? "detail-enter-strong" : "detail-enter-soft";
  const motionClass = isWinner ? "detail-animating-strong" : "detail-animating-soft";
  const exitDelay = isWinner ? 130 : 90;
  const enterDuration = isWinner ? 420 : 260;

  if (detailMotionState.timeoutId) {
    clearTimeout(detailMotionState.timeoutId);
    detailMotionState.timeoutId = null;
  }

  card.classList.remove(
    "detail-enter-soft",
    "detail-enter-strong",
    "detail-exit-soft",
    "detail-exit-strong",
    "detail-animating-soft",
    "detail-animating-strong"
  );
  void card.offsetWidth;
  card.classList.add(exitClass, motionClass);

  detailMotionState.timeoutId = setTimeout(() => {
    if (token !== detailMotionState.token) return;

    commitDetailContent(item);
    card.classList.remove(exitClass);
    card.classList.add(enterClass);

    detailMotionState.timeoutId = setTimeout(() => {
      if (token !== detailMotionState.token) return;
      card.classList.remove(enterClass, motionClass);
      detailMotionState.timeoutId = null;
    }, enterDuration);
  }, exitDelay);
}

function commitDetailContent(item) {
  const card = elements.detailCard;
  detailMotionState.lastId = item?.id || null;

  if (!item) {
    card.className = "detail-card empty";
    card.innerHTML = "<h3>식당을 선택해 주세요</h3><p>위 treemap에서 식당을 클릭하면 상세 정보와 편집 폼이 연결됩니다.</p>";
    return;
  }

  card.className = "detail-card";
  card.innerHTML = `
    <div class="detail-stack">
      <div class="detail-kicker">${item.cuisineGroup}</div>
      <div class="detail-title">${item.name}</div>
      <p>${item.signatureMenu}</p>
      <div class="detail-grid">
        <div class="detail-chip"><span>카테고리</span><strong>${item.category}</strong></div>
        <div class="detail-chip"><span>메뉴군</span><strong>${item.menuCategory}</strong></div>
        <div class="detail-chip"><span>이용 가능</span><strong>${availabilityText(item)}</strong></div>
      </div>
      <div class="detail-chip"><span>태그</span><strong>${(item.tags || []).join(" · ") || "없음"}</strong></div>
      <div class="detail-links">
        <a class="detail-link" target="_blank" rel="noreferrer" href="https://map.naver.com/p/search/${encodeURIComponent(item.name)}">네이버 검색</a>
        <a class="detail-link" target="_blank" rel="noreferrer" href="https://map.kakao.com/link/search/${encodeURIComponent(item.name)}">카카오맵 검색</a>
        <a class="detail-link" target="_blank" rel="noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(`${item.name} 강동역`)}">구글 검색</a>
      </div>
    </div>
  `;

  focusDetailPanel();
}

function populateEditForm(item) {
  if (!item) {
    elements.editName.value = "";
    elements.editCategory.value = elements.editCategory.options[0]?.value || "";
    elements.editMenuCategory.value = "";
    elements.editSignatureMenu.value = "";
    elements.editTags.value = "";
    elements.editBreakfast.checked = false;
    elements.editLunch.checked = false;
    elements.editDinner.checked = false;
    return;
  }

  ensureCategoryOption(item.category);
  elements.editName.value = item.name;
  elements.editCategory.value = item.category;
  elements.editMenuCategory.value = item.menuCategory;
  elements.editSignatureMenu.value = item.signatureMenu;
  elements.editTags.value = (item.tags || []).join(", ");
  elements.editBreakfast.checked = !!item.breakfast;
  elements.editLunch.checked = !!item.lunch;
  elements.editDinner.checked = !!item.dinner;
}

async function handleEditSubmit(event) {
  event.preventDefault();
  const active = getActiveRestaurant();
  if (!active) return;

  try {
    const payload = {
      name: active.name,
      category: elements.editCategory.value,
      menuCategory: elements.editMenuCategory.value.trim() || "기타",
      signatureMenu: elements.editSignatureMenu.value.trim() || "현장 메뉴 확인",
      tags: parseTags(elements.editTags.value),
      breakfast: elements.editBreakfast.checked,
      lunch: elements.editLunch.checked,
      dinner: elements.editDinner.checked
    };
    await requestJson(`/api/restaurants/${encodeURIComponent(active.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await refreshRestaurants(active.id);
  } catch (error) {
    console.error(error);
    alert("식당 수정 저장에 실패했습니다.");
  }
}

async function handleAddSubmit(event) {
  event.preventDefault();
  const name = elements.addName.value.trim();
  if (!name) return;

  try {
    const payload = {
      name,
      category: elements.addCategory.value,
      menuCategory: elements.addMenuCategory.value.trim() || "기타",
      signatureMenu: elements.addSignatureMenu.value.trim() || "현장 메뉴 확인",
      tags: parseTags(elements.addTags.value),
      breakfast: elements.addBreakfast.checked,
      lunch: elements.addLunch.checked,
      dinner: elements.addDinner.checked
    };
    const created = await requestJson("/api/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    elements.addForm.reset();
    elements.addBreakfast.checked = false;
    elements.addLunch.checked = true;
    await refreshRestaurants(created.id);
  } catch (error) {
    console.error(error);
    alert("식당 추가 저장에 실패했습니다.");
  }
}

async function deleteRestaurant(restaurant) {
  stopRandomPick(false);
  await requestJson(`/api/restaurants/${encodeURIComponent(restaurant.id)}`, {
    method: "DELETE"
  });
  await refreshRestaurants(null);
}

async function moveRestaurantToCategory(restaurant, targetCuisineGroup) {
  const category = cuisineGroupToEditableCategory(targetCuisineGroup, restaurant.category);
  const payload = {
    name: restaurant.name,
    category,
    menuCategory: restaurant.menuCategory,
    signatureMenu: restaurant.signatureMenu,
    tags: restaurant.tags || [],
    breakfast: restaurant.breakfast,
    lunch: restaurant.lunch,
    dinner: restaurant.dinner
  };
  await requestJson(`/api/restaurants/${encodeURIComponent(restaurant.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  await refreshRestaurants(restaurant.id);
}

function getActiveRestaurant() {
  return restaurants.find((item) => item.id === state.activeId) || null;
}

function isVisibleActive() {
  return state.visibleRestaurants.some((item) => item.id === state.activeId);
}

function layoutCanvas(items) {
  const width = Math.max(320, elements.canvasPanel.clientWidth);
  const layoutHeight = elements.canvasPanel.clientHeight || Math.max(320, elements.mainLayout.clientHeight);
  const height = Math.max(320, layoutHeight);

  dpr = window.devicePixelRatio || 1;
  elements.canvas.width = width * dpr;
  elements.canvas.height = height * dpr;
  elements.canvas.style.width = `${width}px`;
  elements.canvas.style.height = `${height}px`;

  const categories = Object.entries(groupByCuisine(items))
    .map(([name, members]) => ({
      name,
      members: members
        .slice()
        .sort((a, b) => (b.sizeValue - a.sizeValue) || a.name.localeCompare(b.name, "ko")),
      value: members.reduce((sum, item) => sum + item.sizeValue, 0)
    }))
    .sort((a, b) => {
      const orderA = CATEGORY_ORDER.indexOf(a.name);
      const orderB = CATEGORY_ORDER.indexOf(b.name);
      if (orderA !== -1 && orderB !== -1) return orderA - orderB;
      if (orderA !== -1) return -1;
      if (orderB !== -1) return 1;
      return b.value - a.value;
    });

  const categoryRects = squarify(categories, 0, 0, width, height).map((category) => {
    const headerHeight = category.rh > 96 ? 26 : category.rh > 68 ? 20 : 0;
    const innerY = category.ry + headerHeight;
    const innerH = Math.max(0, category.rh - headerHeight);
    const restaurantRects = innerH > 8
      ? squarify(
          category.members.map((item) => ({ ...item, value: item.sizeValue })),
          category.rx,
          innerY,
          category.rw,
          innerH
        ).map((rect) => ({
          id: rect.id,
          x: rect.rx,
          y: rect.ry,
          w: rect.rw,
          h: rect.rh,
          categoryName: category.name,
          data: rect
        }))
      : [];

    return {
      name: category.name,
      x: category.rx,
      y: category.ry,
      w: category.rw,
      h: category.rh,
      headerHeight,
      restaurants: restaurantRects
    };
  });

  state.layout = {
    categories: categoryRects,
    restaurants: categoryRects.flatMap((category) => category.restaurants)
  };
}

function draw() {
  const width = elements.canvas.width / dpr;
  const height = elements.canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getThemeConfig().canvasBg;
  ctx.fillRect(0, 0, width, height);

  if (!state.layout.categories.length) {
    drawEmptyState();
    return;
  }

  state.layout.categories.forEach(drawCategoryRect);

  if (state.drag?.active) {
    drawDraggedGhost();
  }
}

function drawCategoryRect(category) {
  const base = getCategoryBase(category.name);
  ctx.fillStyle = toRgba(shiftColor(base, -24), 1);
  ctx.fillRect(category.x, category.y, category.w, category.h);
  drawTreemapSeparators(category, getThemeConfig().canvasBg, 1);

  if (category.headerHeight > 0) {
    ctx.fillStyle = toRgba(shiftColor(base, -10), 1);
    ctx.fillRect(category.x, category.y, category.w, category.headerHeight);
    drawHorizontalSeparator(
      category.x,
      category.y + category.headerHeight,
      category.w,
      getThemeConfig().canvasBg,
      1
    );

    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `${category.headerHeight > 22 ? 700 : 600} ${category.headerHeight > 22 ? 17 : 13}px "Noto Sans KR", system-ui, sans-serif`;
    drawEllipsisText(`${category.name} · ${category.restaurants.length}곳`, category.x + 6, category.y + 4, Math.max(10, category.w - 12));
  }

  category.restaurants.forEach((restaurant) => drawRestaurantRect(restaurant, base));

  if (state.drag?.active && state.drag.targetCategory === category.name) {
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 3;
    ctx.strokeRect(category.x + 1.5, category.y + 1.5, category.w - 3, category.h - 3);
  }
}

function drawRestaurantRect(rect, base) {
  const isHovered = rect.id === state.hoveredId;
  const isActive = rect.id === state.activeId;
  const isDragged = state.drag?.active && state.drag.item.id === rect.id;
  const isRandom = state.randomPick?.active && state.randomPick.currentId === rect.id;
  const variation = mapHashToRange(hashString(rect.data.name), -12, 14);
  const pulse = isRandom ? 0.5 + 0.5 * Math.sin(performance.now() / 145) : 0;
  const fillBase = isRandom ? shiftColor(base, 30 + Math.round(pulse * 12)) : shiftColor(base, variation);

  ctx.fillStyle = toRgba(fillBase, isDragged ? 0.24 : 1);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  if (isRandom) {
    ctx.fillStyle = `rgba(255, 242, 212, ${0.18 + pulse * 0.12})`;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  ctx.strokeStyle = getThemeConfig().canvasBg;
  ctx.lineWidth = 1;
  drawTreemapSeparators(rect, getThemeConfig().canvasBg, 1);

  if (isHovered || isActive || isRandom) {
    ctx.strokeStyle = isActive
      ? "rgba(255,255,255,0.98)"
      : isRandom
        ? "rgba(255,245,218,0.98)"
        : "rgba(255,255,255,0.72)";
    ctx.lineWidth = isRandom ? 3 : isActive ? 2 : 1.5;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  }

  if (rect.w < 40 || rect.h < 16) return;

  const fontSize = clamp(Math.round(Math.min(rect.h * 0.34, rect.w / 7.5)), 10, 19);
  const labelY = rect.y + Math.max(3, (rect.h - fontSize) / 2 - 1);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.textBaseline = "top";
  ctx.font = `600 ${fontSize}px "Noto Sans KR", system-ui, sans-serif`;
  drawEllipsisText(rect.data.name, rect.x + 5, labelY, rect.w - 10);
}

function drawDraggedGhost() {
  const { x, y, item } = state.drag;
  const base = getCategoryBase(item.cuisineGroup);
  const width = clamp(Math.round(item.name.length * 10.5 + 30), 110, 260);
  const height = 34;
  const left = x + 14;
  const top = y + 14;

  ctx.fillStyle = toRgba(shiftColor(base, 8), 0.92);
  ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left, top, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.textBaseline = "middle";
  ctx.font = `600 14px "Noto Sans KR", system-ui, sans-serif`;
  drawEllipsisText(item.name, left + 8, top + 10, width - 16);
}

function drawTreemapSeparators(rect, color, lineWidth) {
  const canvasWidth = elements.canvas.width / dpr;
  const canvasHeight = elements.canvas.height / dpr;
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  if (right < canvasWidth - 0.5) {
    ctx.beginPath();
    ctx.moveTo(right, rect.y);
    ctx.lineTo(right, bottom);
    ctx.stroke();
  }

  if (bottom < canvasHeight - 0.5) {
    ctx.beginPath();
    ctx.moveTo(rect.x, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHorizontalSeparator(x, y, width, color, lineWidth) {
  const canvasHeight = elements.canvas.height / dpr;
  if (y >= canvasHeight - 0.5) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  ctx.restore();
}

function drawEmptyState() {
  const isLightTheme = state.mealMode !== "dinner";
  ctx.fillStyle = isLightTheme ? "rgba(34,34,42,0.88)" : "rgba(255,255,255,0.88)";
  ctx.font = '700 28px "Noto Sans KR", system-ui, sans-serif';
  ctx.textBaseline = "top";
  ctx.fillText("조건에 맞는 식당이 없습니다.", 24, 28);
  ctx.fillStyle = isLightTheme ? "rgba(34,34,42,0.56)" : "rgba(255,255,255,0.56)";
  ctx.font = '400 14px "Noto Sans KR", system-ui, sans-serif';
  ctx.fillText("검색어를 줄이거나 점심 / 저녁 토글을 바꿔보세요.", 24, 64);
}

function handleCanvasMove(event) {
  if (state.randomPick?.active) {
    elements.canvas.style.cursor = "default";
    hideTooltip();
    return;
  }

  const point = getCanvasPoint(event);
  state.pointer = point;

  if (state.press && !state.drag?.active) {
    const distance = Math.hypot(point.x - state.press.startX, point.y - state.press.startY);
    if (distance >= 6) {
      state.drag = {
        active: true,
        item: state.press.item,
        x: point.x,
        y: point.y,
        targetCategory: null,
        targetDelete: false
      };
      syncTrashState(true, false);
      hideTooltip();
    }
  }

  if (state.drag?.active) {
    updateDragState(event);
    return;
  }

  const hit = hitRestaurant(point.x, point.y);
  const hoveredId = hit?.id || null;
  if (hoveredId !== state.hoveredId) {
    state.hoveredId = hoveredId;
    draw();
  }

  if (hit) {
    elements.canvas.style.cursor = "pointer";
    showTooltip(hit.data, event.clientX, event.clientY);
  } else {
    elements.canvas.style.cursor = "default";
    hideTooltip();
  }
}

function handleCanvasDown(event) {
  if (state.randomPick?.active) return;

  const point = getCanvasPoint(event);
  const hit = hitRestaurant(point.x, point.y);
  if (!hit) return;

  state.press = {
    item: hit.data,
    startX: point.x,
    startY: point.y
  };
}

function handleWindowMove(event) {
  if (!state.drag?.active) return;
  updateDragState(event);
}

function updateDragState(event) {
  const canvasRect = elements.canvas.getBoundingClientRect();
  const rawX = event.clientX - canvasRect.left;
  const rawY = event.clientY - canvasRect.top;
  const insideCanvas = rawX >= 0 && rawX <= canvasRect.width && rawY >= 0 && rawY <= canvasRect.height;
  const overTrash = isPointInElement(event.clientX, event.clientY, elements.sidebarTrash);

  state.drag.x = clamp(rawX, 0, canvasRect.width);
  state.drag.y = clamp(rawY, 0, canvasRect.height);
  state.drag.targetDelete = overTrash;

  const target = insideCanvas && !overTrash ? hitCategory(rawX, rawY) : null;
  state.drag.targetCategory = target && target.name !== state.drag.item.cuisineGroup ? target.name : null;
  state.hoveredId = null;
  elements.canvas.style.cursor = overTrash ? "no-drop" : "grabbing";
  syncTrashState(true, overTrash);
  hideTooltip();
  draw();
}

async function handleCanvasUp(event) {
  if (state.randomPick?.active) return;
  if (!state.press && !state.drag) return;

  const point = getCanvasPoint(event);

  if (state.drag?.active) {
    const target = state.drag.targetCategory;
    const targetDelete = state.drag.targetDelete;
    const draggedItem = state.drag.item;
    state.drag = null;
    state.press = null;
    syncTrashState(false, false);

    if (targetDelete) {
      if (window.confirm(`"${draggedItem.name}" 식당을 삭제하시겠습니까?`)) {
        await deleteRestaurant(draggedItem);
        return;
      }
      draw();
      return;
    }

    if (target && draggedItem.cuisineGroup !== target) {
      await moveRestaurantToCategory(draggedItem, target);
      return;
    }

    draw();
    return;
  }

  const hit = hitRestaurant(point.x, point.y);
  if (hit && state.press && hit.id === state.press.item.id) {
    state.activeId = hit.id;
    renderDetail(hit.data, { animate: true, variant: "soft" });
    draw();
  }

  state.press = null;
}

function handleCanvasLeave() {
  if (state.randomPick?.active) return;
  if (state.drag?.active) return;
  state.hoveredId = null;
  elements.canvas.style.cursor = "default";
  hideTooltip();
  draw();
}

function getCanvasPoint(event) {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height)
  };
}

function hitRestaurant(x, y) {
  for (let index = state.layout.restaurants.length - 1; index >= 0; index -= 1) {
    const rect = state.layout.restaurants[index];
    if (pointInRect(x, y, rect)) return rect;
  }
  return null;
}

function hitCategory(x, y) {
  for (let index = state.layout.categories.length - 1; index >= 0; index -= 1) {
    const rect = state.layout.categories[index];
    if (pointInRect(x, y, rect)) return rect;
  }
  return null;
}

function getLayoutRestaurantRect(id) {
  return state.layout.restaurants.find((rect) => rect.id === id) || null;
}

function getRectCenter(rect) {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2
  };
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function isPointInElement(clientX, clientY, element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function syncTrashState(visible, hot) {
  if (!elements.sidebarTrash) return;
  elements.sidebarTrash.classList.toggle("visible", visible);
  elements.sidebarTrash.classList.toggle("hot", visible && hot);
}

function showTooltip(item, clientX, clientY) {
  elements.tooltip.querySelector(".tt-title").textContent = item.name;
  elements.tooltip.querySelector(".tt-stats").innerHTML = `
    <div>${item.category} · ${item.menuCategory}</div>
    <div>${item.signatureMenu}</div>
    <div>${availabilityText(item)}</div>
  `;

  positionTooltip(clientX, clientY);
  elements.tooltip.classList.add("visible");
}

function positionTooltip(clientX, clientY) {
  const tooltip = elements.tooltip;
  const offset = 16;
  let left = clientX + offset;
  let top = clientY + offset;

  if (left + tooltip.offsetWidth > window.innerWidth - 12) {
    left = clientX - tooltip.offsetWidth - offset;
  }

  if (top + tooltip.offsetHeight > window.innerHeight - 12) {
    top = clientY - tooltip.offsetHeight - offset;
  }

  tooltip.style.left = `${Math.max(12, left)}px`;
  tooltip.style.top = `${Math.max(12, top)}px`;
}

function hideTooltip() {
  elements.tooltip.classList.remove("visible");
}

function focusDetailPanel() {
  const panel = document.querySelector(".sidebar-header");
  const sidebar = document.querySelector(".sidebar-panels");
  if (!panel || !sidebar) return;
  requestAnimationFrame(() => {
    sidebar.scrollTo({
      top: Math.max(0, panel.offsetTop - 16),
      behavior: "smooth"
    });
  });
}

function syncTheme(animate = false) {
  const visualTheme = state.mealMode;
  document.body.dataset.theme = visualTheme;

  if (!animate) {
    themeState.fromTheme = visualTheme;
    themeState.toTheme = visualTheme;
    themeState.progress = 1;
    if (themeState.frameId) cancelAnimationFrame(themeState.frameId);
    themeState.frameId = null;
    return;
  }

  const currentTheme = themeState.progress >= 1 ? themeState.toTheme : themeState.fromTheme;
  themeState.fromTheme = currentTheme;
  themeState.toTheme = visualTheme;
  themeState.progress = 0;
  themeState.startTime = performance.now();

  if (themeState.frameId) cancelAnimationFrame(themeState.frameId);
  themeState.frameId = requestAnimationFrame(stepThemeAnimation);
}

function stepThemeAnimation(now) {
  const elapsed = now - themeState.startTime;
  const progress = clamp(elapsed / themeState.duration, 0, 1);
  themeState.progress = easeInOutCubic(progress);
  draw();

  if (progress < 1) {
    themeState.frameId = requestAnimationFrame(stepThemeAnimation);
  } else {
    themeState.fromTheme = themeState.toTheme;
    themeState.progress = 1;
    themeState.frameId = null;
    draw();
  }
}

function getThemeConfig() {
  const fromTheme = THEME_CONFIG[themeState.fromTheme] || THEME_CONFIG.lunch;
  const toTheme = THEME_CONFIG[themeState.toTheme] || THEME_CONFIG.lunch;
  const mix = themeState.progress;
  const categories = {};

  Object.keys(toTheme.categoryBases).forEach((key) => {
    const fromBase = fromTheme.categoryBases[key] || fromTheme.categoryBases["기타"];
    const toBase = toTheme.categoryBases[key] || toTheme.categoryBases["기타"];
    categories[key] = mixRgb(fromBase, toBase, mix);
  });

  return {
    canvasBg: mixHex(fromTheme.canvasBg, toTheme.canvasBg, mix),
    categoryBases: categories
  };
}

function getCategoryBase(categoryName) {
  const theme = getThemeConfig();
  return theme.categoryBases[categoryName] || theme.categoryBases["기타"];
}

function syncMealToggle() {
  elements.mealToggle.querySelectorAll("[data-meal]").forEach((button) => {
    button.classList.toggle("active", button.dataset.meal === state.mealMode);
  });
}

function groupByCuisine(items) {
  return items.reduce((accumulator, item) => {
    if (!accumulator[item.cuisineGroup]) accumulator[item.cuisineGroup] = [];
    accumulator[item.cuisineGroup].push(item);
    return accumulator;
  }, {});
}

function cuisineGroupToEditableCategory(group, fallback) {
  const map = {
    "한식": "한식",
    "중식": "중식",
    "일식": "일식",
    "양식": "양식",
    "동남아": "베트남·아시아",
    "카페": "카페",
    "패스트·간편식": "분식",
    "기타": fallback || "기타"
  };

  return map[group] || fallback || "기타";
}

function ensureCategoryOption(category) {
  [elements.editCategory, elements.addCategory].forEach((select) => {
    if (![...select.options].some((option) => option.value === category)) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      select.append(option);
    }
  });
}

function parseTags(input) {
  return input.split(",").map((item) => item.trim()).filter(Boolean);
}

function availabilityText(item) {
  const slots = [];
  if (item.breakfast) slots.push("아침");
  if (item.lunch) slots.push("점심");
  if (item.dinner) slots.push("저녁");
  if (slots.length) return slots.join(" / ");
  return "미지정";
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mapHashToRange(hash, min, max) {
  const ratio = (hash % 1000) / 999;
  return Math.round(min + (max - min) * ratio);
}

function shiftColor(rgb, delta) {
  return rgb.map((channel) => clamp(channel + delta, 0, 255));
}

function toRgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function mixRgb(from, to, t) {
  return from.map((channel, index) => Math.round(lerp(channel, to[index], t)));
}

function mixHex(fromHex, toHex, t) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const mixed = mixRgb(from, to, t);
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16)
  ];
}

function drawEllipsisText(text, x, y, maxWidth) {
  ctx.fillText(fitText(text, maxWidth), x, y);
}

function fitText(text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let low = 0;
  let high = text.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid)}${ellipsis}`;
    if (ctx.measureText(candidate).width <= maxWidth) low = mid;
    else high = mid - 1;
  }

  return `${text.slice(0, low)}${ellipsis}`;
}

function shuffle(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
}

function squarify(items, x, y, w, h) {
  if (!items.length || w <= 0 || h <= 0) return [];
  if (items.length === 1) return [{ ...items[0], rx: x, ry: y, rw: w, rh: h }];

  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  const results = [];
  let remaining = items.slice();
  let cursorX = x;
  let cursorY = y;
  let remainingW = w;
  let remainingH = h;

  while (remaining.length) {
    const remainingTotal = remaining.reduce((sum, item) => sum + item.value, 0);
    const vertical = remainingW >= remainingH;
    const side = vertical ? remainingH : remainingW;
    const extent = vertical ? remainingW : remainingH;

    let row = [remaining[0]];
    let rowSum = remaining[0].value;

    for (let index = 1; index < remaining.length; index += 1) {
      const candidate = [...row, remaining[index]];
      const candidateSum = rowSum + remaining[index].value;
      if (
        worstAspect(candidate, candidateSum, side, remainingTotal, extent) <=
        worstAspect(row, rowSum, side, remainingTotal, extent)
      ) {
        row = candidate;
        rowSum = candidateSum;
      } else {
        break;
      }
    }

    const rowFraction = rowSum / remainingTotal;
    const rowThickness = vertical ? remainingW * rowFraction : remainingH * rowFraction;
    let offset = 0;

    row.forEach((item) => {
      const itemFraction = item.value / rowSum;
      const itemLength = side * itemFraction;
      if (vertical) {
        results.push({ ...item, rx: cursorX, ry: cursorY + offset, rw: rowThickness, rh: itemLength });
      } else {
        results.push({ ...item, rx: cursorX + offset, ry: cursorY, rw: itemLength, rh: rowThickness });
      }
      offset += itemLength;
    });

    if (vertical) {
      cursorX += rowThickness;
      remainingW -= rowThickness;
    } else {
      cursorY += rowThickness;
      remainingH -= rowThickness;
    }

    remaining = remaining.slice(row.length);
  }

  return results;
}

function worstAspect(row, rowSum, side, totalArea, availableExtent) {
  const rowExtent = availableExtent * (rowSum / totalArea);
  if (rowExtent <= 0) return Number.POSITIVE_INFINITY;

  let worst = 0;
  row.forEach((item) => {
    const itemLength = side * (item.value / rowSum);
    if (itemLength <= 0) return;
    const aspect = Math.max(rowExtent / itemLength, itemLength / rowExtent);
    if (aspect > worst) worst = aspect;
  });

  return worst;
}
