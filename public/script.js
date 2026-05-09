const subscriptions = [
  {
    id: 1,
    name: "Apple Music",
    category: "Other",
    description: "Music streaming subscription",
    price: 10,
    billingCycle: "Monthly",
    currency: "USD ($)",
    monthlyEquivalent: 10.0,
    nextRenewal: null,
    nextRenewalRaw: "",
    status: "active",
    logo: "A",
    logoClass: "apple",
    logoUrl: "",
    logoFileName: "",
    website: ""
  },
  {
    id: 2,
    name: "Spotify Premium",
    category: "Music",
    description: "Music streaming service",
    price: 10.99,
    billingCycle: "Monthly",
    currency: "USD ($)",
    monthlyEquivalent: 10.99,
    nextRenewal: "Nov 30, 2025",
    nextRenewalRaw: "2025-11-30",
    status: "active",
    logo: "S",
    logoClass: "spotify",
    logoUrl: "",
    logoFileName: "",
    website: "https://spotify.com"
  },
  {
    id: 3,
    name: "Netflix",
    category: "Entertainment",
    description: "Streaming service for movies and TV shows",
    price: 15.99,
    billingCycle: "Monthly",
    currency: "USD ($)",
    monthlyEquivalent: 15.99,
    nextRenewal: "Dec 14, 2025",
    nextRenewalRaw: "2025-12-14",
    status: "active",
    logo: "N",
    logoClass: "netflix",
    logoUrl: "",
    logoFileName: "",
    website: "https://netflix.com"
  },
  {
    id: 4,
    name: "Adobe Creative Cloud",
    category: "Software",
    description: "Design and creative software suite",
    price: 54.99,
    billingCycle: "Monthly",
    currency: "USD ($)",
    monthlyEquivalent: 54.99,
    nextRenewal: "Nov 27, 2025",
    nextRenewalRaw: "2025-11-27",
    status: "active",
    logo: "A",
    logoClass: "adobe",
    logoUrl: "",
    logoFileName: "",
    website: "https://adobe.com"
  },
  {
    id: 5,
    name: "GitHub Pro",
    category: "Productivity",
    description: "Code hosting and collaboration",
    price: 4,
    billingCycle: "Monthly",
    currency: "USD ($)",
    monthlyEquivalent: 4.0,
    nextRenewal: "Dec 9, 2025",
    nextRenewalRaw: "2025-12-09",
    status: "active",
    logo: "G",
    logoClass: "github",
    logoUrl: "",
    logoFileName: "",
    website: "https://github.com"
  }
];

// Load subscriptions from localStorage or use defaults
const loadSubscriptions = () => {
  const stored = localStorage.getItem('subscriptions');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        subscriptions.splice(0, subscriptions.length, ...parsed);
        nextSubscriptionId = Math.max(...parsed.map(s => s.id)) + 1;
      }
    } catch (e) {
      console.error('Failed to load subscriptions from localStorage:', e);
    }
  }
};

// Save subscriptions to localStorage
const saveSubscriptions = () => {
  try {
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
  } catch (e) {
    console.error('Failed to save subscriptions to localStorage:', e);
  }
};

const loadInboxState = () => {
  const stored = localStorage.getItem("inboxState");
  if (!stored) {
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    inboxState = {
      linked: Boolean(parsed.linked),
      email: typeof parsed.email === "string" ? parsed.email : ""
    };
  } catch (error) {
    console.error("Failed to load inbox state:", error);
  }
};

const saveInboxState = () => {
  try {
    localStorage.setItem("inboxState", JSON.stringify(inboxState));
  } catch (error) {
    console.error("Failed to save inbox state:", error);
  }
};

const categoryColors = {
  Software: "#8b5cf6",
  Entertainment: "#ec4899",
  Music: "#ff7a18",
  Other: "#3b82f6",
  Productivity: "#10b981",
  Utilities: "#0ea5e9",
  Fitness: "#22c55e",
  Education: "#f59e0b",
  "Cloud Storage": "#6366f1",
  Gaming: "#ef4444",
  News: "#64748b"
};

let activeFilter = "All Subscriptions";
let chartView = "monthly";
let editingSubscriptionId = null;
let nextSubscriptionId = subscriptions.length + 1;
let openEditModal = () => {};
let refreshPlanState = () => {};
let activeMenuId = null;
let chartAnimationState = {
  displayMax: null,
  valuesByKey: {}
};
const INBOX_API_BASE = window.location.host.includes("localhost") ? "http://localhost:8787" : "https://sub-track.ca";
const DEFAULT_FREE_SUBSCRIPTION_LIMIT = 5;
const DEFAULT_PREMIUM_PRICING = {
  monthly: 10.99,
  yearly: 109.99,
  lifetime: 100
};
const DEVELOPER_EMAIL = "zhaner4994@gmail.com";
const AI_USAGE_LIMITS = {
  free: 0,
  premium: 10,
  lifetime: Number.POSITIVE_INFINITY
};
const defaultSubscriptionsTemplate = JSON.parse(JSON.stringify(subscriptions));
let accountSession = {
  authenticated: false,
  user: null
};
let freeSubscriptionLimit = DEFAULT_FREE_SUBSCRIPTION_LIMIT;
let premiumPricing = { ...DEFAULT_PREMIUM_PRICING };
let inboxState = {
  linked: false,
  email: ""
};
let detectedCandidates = [];
let pendingCandidate = null;
let authMode = "login";
let aiTypingTimer = null;
let aiTypingRunId = 0;

function getPlanType() {
  if (!accountSession.authenticated) {
    return "free";
  }
  const planType = accountSession.user?.planType;
  if (planType === "lifetime" || planType === "premium") {
    return planType;
  }
  return "free";
}

function isDeveloperEmail(email) {
  return String(email || "").trim().toLowerCase() === DEVELOPER_EMAIL;
}

function isDeveloperAccount() {
  return accountSession.authenticated && isDeveloperEmail(accountSession.user?.email);
}

function getAiUsageStorageKey() {
  const email = accountSession.user?.email || "guest";
  return `aiBudgetUsage:${email.toLowerCase()}`;
}

function getTodayUsageKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readAiUsageSnapshot() {
  try {
    const raw = localStorage.getItem(getAiUsageStorageKey());
    if (!raw) {
      return { date: getTodayUsageKey(), count: 0 };
    }

    const parsedJson = JSON.parse(raw);
    if (
      parsedJson &&
      typeof parsedJson === "object" &&
      typeof parsedJson.date === "string" &&
      Number.isFinite(parsedJson.count) &&
      parsedJson.count >= 0
    ) {
      return { date: parsedJson.date, count: Number(parsedJson.count) };
    }

    const parsedLegacy = Number(raw);
    if (Number.isFinite(parsedLegacy) && parsedLegacy >= 0) {
      return { date: getTodayUsageKey(), count: parsedLegacy };
    }
  } catch {
    // Fallback below.
  }

  return { date: getTodayUsageKey(), count: 0 };
}

function writeAiUsageSnapshot(value) {
  try {
    const safeValue = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    localStorage.setItem(
      getAiUsageStorageKey(),
      JSON.stringify({
        date: getTodayUsageKey(),
        count: safeValue
      })
    );
  } catch {
    // Ignore storage write failures.
  }
}

function getAiUsageDetails() {
  const planType = getPlanType();
  const limit = AI_USAGE_LIMITS[planType] ?? 0;
  const unlimited = !Number.isFinite(limit);

  if (unlimited) {
    return {
      planType,
      limit,
      used: 0,
      remaining: Number.POSITIVE_INFINITY,
      unlimited: true
    };
  }

  const today = getTodayUsageKey();
  const snapshot = readAiUsageSnapshot();
  const used = snapshot.date === today ? snapshot.count : 0;

  if (snapshot.date !== today && snapshot.count !== 0) {
    writeAiUsageSnapshot(0);
  }

  return {
    planType,
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    unlimited: false
  };
}

function consumeAiUsage() {
  const details = getAiUsageDetails();
  if (details.unlimited || details.limit <= 0) {
    return details;
  }
  writeAiUsageSnapshot(details.used + 1);
  return getAiUsageDetails();
}

function generateAiBudgetInsight(question) {
  const monthlyTotal = subscriptions.reduce((sum, item) => sum + item.monthlyEquivalent, 0);
  const sorted = [...subscriptions].sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
  const topThree = sorted.slice(0, 3);
  const topLine = topThree.length
    ? topThree.map((item) => `${item.name} (${formatCurrency(item.monthlyEquivalent)}/mo)`).join(", ")
    : "No subscriptions found yet.";

  const categoryTotals = subscriptions.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.monthlyEquivalent;
    return acc;
  }, {});
  const worstCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const worstCategory = worstCategoryEntry
    ? `${worstCategoryEntry[0]} (${formatCurrency(worstCategoryEntry[1])}/mo)`
    : "No category data yet.";

  const possibleCut = topThree.length ? topThree[0].monthlyEquivalent : 0;
  const projected = Math.max(monthlyTotal - possibleCut, 0);

  return [
    `Question: ${question || "General optimization"}`,
    `Current monthly spend: ${formatCurrency(monthlyTotal)}`,
    `Highest-cost subscriptions: ${topLine}`,
    `Highest-cost category: ${worstCategory}`,
    topThree.length
      ? `Fastest cut option: Pause or downgrade ${topThree[0].name} to move monthly spend toward ${formatCurrency(projected)}.`
      : "Add subscriptions to receive budget suggestions."
  ].join("\n");
}

function renderAiTyping(outputElement, text) {
  if (!outputElement) {
    return;
  }

  aiTypingRunId += 1;
  const runId = aiTypingRunId;

  if (aiTypingTimer) {
    clearTimeout(aiTypingTimer);
    aiTypingTimer = null;
  }

  outputElement.textContent = "";
  const lines = String(text).split("\n");
  let lineIndex = 0;
  let charIndex = 0;
  let rendered = "";

  const scheduleNext = (delay) => {
    aiTypingTimer = setTimeout(typeNext, delay);
  };

  const typeNext = () => {
    if (runId !== aiTypingRunId) {
      aiTypingTimer = null;
      return;
    }

    if (lineIndex >= lines.length) {
      aiTypingTimer = null;
      return;
    }

    const line = lines[lineIndex];
    if (charIndex < line.length) {
      const currentChar = line[charIndex];
      rendered += currentChar;
      outputElement.textContent = rendered;
      charIndex += 1;

      let delay = 44 + Math.floor(Math.random() * 46);
      if (currentChar === " ") delay += 22;
      if (/[,:;]/.test(currentChar)) delay += 140;
      if (/[.!?]/.test(currentChar)) delay += 220;
      scheduleNext(delay);
      return;
    }

    if (lineIndex < lines.length - 1) {
      rendered += "\n";
      outputElement.textContent = rendered;
      lineIndex += 1;
      charIndex = 0;
      scheduleNext(320);
      return;
    }

    aiTypingTimer = null;
  };

  scheduleNext(220);
}

async function inboxApiRequest(path, options = {}) {
  const response = await fetch(`${INBOX_API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || data.error || "Inbox request failed.";
    throw new Error(message);
  }

  return data;
}

async function syncAccountSessionFromServer() {
  try {
    const response = await inboxApiRequest("/api/auth/session");
    if (Number.isFinite(response.freeLimit) && response.freeLimit > 0) {
      freeSubscriptionLimit = Number(response.freeLimit);
    }
    if (
      response.pricing &&
      Number.isFinite(response.pricing.monthly) &&
      Number.isFinite(response.pricing.yearly) &&
      Number.isFinite(response.pricing.lifetime)
    ) {
      premiumPricing = {
        monthly: Number(response.pricing.monthly),
        yearly: Number(response.pricing.yearly),
        lifetime: Number(response.pricing.lifetime)
      };
    }

    const normalizedUser = response.user
      ? {
          ...response.user,
          planType:
            response.user.planType === "lifetime"
              ? "lifetime"
              : response.user.planType === "premium"
                ? "premium"
                : "free",
          premiumBillingCycle:
            response.user.planType === "premium"
              ? response.user.premiumBillingCycle === "yearly"
                ? "yearly"
                : "monthly"
              : null
        }
      : null;

    accountSession = {
      authenticated: Boolean(response.authenticated),
      user: normalizedUser
    };
  } catch {
    accountSession = {
      authenticated: false,
      user: null
    };
    freeSubscriptionLimit = DEFAULT_FREE_SUBSCRIPTION_LIMIT;
    premiumPricing = { ...DEFAULT_PREMIUM_PRICING };
  }
}

function isPremiumActive() {
  return (
    accountSession.authenticated &&
    (accountSession.user?.planType === "premium" || accountSession.user?.planType === "lifetime")
  );
}

function getCurrentSubscriptionLimit() {
  return isPremiumActive() ? Number.POSITIVE_INFINITY : freeSubscriptionLimit;
}

function canAddMoreSubscriptions() {
  return subscriptions.length < getCurrentSubscriptionLimit();
}

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

function formatCompactCurrency(value) {
  if (value >= 1000) {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
  if (value >= 100) {
    return `$${Math.round(value)}`;
  }
  if (value >= 10) {
    return `$${value.toFixed(1)}`;
  }
  return `$${value.toFixed(2)}`;
}

function getChartValue(item) {
  return chartView === "yearly" ? item.yearlyEquivalent : item.monthlyEquivalent;
}

function getChartData() {
  if (activeFilter !== "All Subscriptions") {
    return getVisibleSubscriptions().map((item) => ({
      subscriptionId: item.id,
      label: item.name,
      subtitle: item.category,
      category: item.category,
      monthlyEquivalent: item.monthlyEquivalent,
      yearlyEquivalent: item.monthlyEquivalent * 12
    }));
  }

  const categoryTotals = subscriptions.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = {
        label: item.category,
        subtitle: "Category total",
        category: item.category,
        monthlyEquivalent: 0,
        yearlyEquivalent: 0
      };
    }

    acc[item.category].monthlyEquivalent += item.monthlyEquivalent;
    acc[item.category].yearlyEquivalent += item.monthlyEquivalent * 12;
    return acc;
  }, {});

  return Object.values(categoryTotals).sort(
    (a, b) => b.monthlyEquivalent - a.monthlyEquivalent
  );
}

function getVisibleSubscriptions() {
  if (activeFilter === "All Subscriptions") {
    return subscriptions;
  }
  return subscriptions.filter((item) => item.category === activeFilter);
}

function getLogoDetails(name, logoUrl) {
  if (logoUrl) {
    return {
      logo: `<img src="${logoUrl}" alt="${name} logo" />`,
      logoClass: "custom-logo"
    };
  }

  return {
    logo: name.trim().charAt(0).toUpperCase() || "?",
    logoClass: "fallback-logo"
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function formatDateForDisplay(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function calculateMonthlyEquivalent(price, billingCycle) {
  if (billingCycle === "Yearly") {
    return price / 12;
  }

  if (billingCycle === "Weekly") {
    return (price * 52) / 12;
  }

  return price;
}

function createSubscriptionPayload(baseInput) {
  const name = String(baseInput.name || "").trim();
  const description = String(baseInput.description || "").trim() || "No description added yet.";
  const parsedPrice = Number(baseInput.price);
  const price = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
  const billingCycle = baseInput.billingCycle || "Monthly";
  const category = baseInput.category || "Other";
  const nextRenewalRaw = baseInput.nextRenewalRaw || "";
  const nextRenewal = formatDateForDisplay(nextRenewalRaw);
  const status = baseInput.status || "active";
  const currency = baseInput.currency || "USD ($)";
  const website = String(baseInput.website || "").trim();
  const logoUrl = baseInput.logoUrl || "";
  const logoFileName = baseInput.logoFileName || "";
  const logoDetails = getLogoDetails(name, logoUrl);
  const monthlyEquivalent = calculateMonthlyEquivalent(price, billingCycle);

  return {
    name,
    category,
    description,
    price,
    billingCycle,
    currency,
    monthlyEquivalent,
    nextRenewal,
    nextRenewalRaw,
    status,
    logo: logoDetails.logo,
    logoClass: logoDetails.logoClass,
    logoUrl,
    logoFileName,
    website
  };
}

function addSubscriptionRecord(subscriptionPayload) {
  subscriptions.unshift({
    id: nextSubscriptionId,
    ...subscriptionPayload
  });
  nextSubscriptionId += 1;
  saveSubscriptions();
}

function detectBillingCycleFromText(text) {
  const lower = text.toLowerCase();
  if (/weekly|\/week|per week|every week/.test(lower)) {
    return "Weekly";
  }
  if (/yearly|annual|annually|\/year|per year/.test(lower)) {
    return "Yearly";
  }
  return "Monthly";
}

function detectCategoryFromText(text) {
  const lower = text.toLowerCase();

  if (/music|spotify|apple music|tidal|soundcloud/.test(lower)) {
    return "Music";
  }
  if (/netflix|hulu|disney|max|prime video|youtube/.test(lower)) {
    return "Entertainment";
  }
  if (/github|notion|slack|figma|canva/.test(lower)) {
    return "Productivity";
  }
  if (/cloud|dropbox|drive|onedrive|icloud/.test(lower)) {
    return "Cloud Storage";
  }
  if (/adobe|software|jetbrains|microsoft 365/.test(lower)) {
    return "Software";
  }
  if (/gym|fitness|peloton|strava/.test(lower)) {
    return "Fitness";
  }
  if (/education|course|udemy|coursera|masterclass/.test(lower)) {
    return "Education";
  }
  if (/news|times|journal|post|economist/.test(lower)) {
    return "News";
  }
  if (/game|gaming|xbox|playstation|steam/.test(lower)) {
    return "Gaming";
  }
  if (/utility|utilities|internet|phone|mobile|water|electric/.test(lower)) {
    return "Utilities";
  }

  return "Other";
}

function parseReceiptCandidates(rawText) {
  const cleaned = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!cleaned.length) {
    return [];
  }

  const merchantHints = [
    { pattern: /spotify/i, name: "Spotify Premium", category: "Music", website: "https://spotify.com" },
    { pattern: /apple music/i, name: "Apple Music", category: "Music", website: "https://music.apple.com" },
    { pattern: /netflix/i, name: "Netflix", category: "Entertainment", website: "https://netflix.com" },
    { pattern: /youtube premium/i, name: "YouTube Premium", category: "Entertainment", website: "https://youtube.com/premium" },
    { pattern: /adobe/i, name: "Adobe Creative Cloud", category: "Software", website: "https://adobe.com" },
    { pattern: /github/i, name: "GitHub Pro", category: "Productivity", website: "https://github.com" },
    { pattern: /notion/i, name: "Notion", category: "Productivity", website: "https://notion.so" },
    { pattern: /dropbox/i, name: "Dropbox", category: "Cloud Storage", website: "https://dropbox.com" },
    { pattern: /disney\+/i, name: "Disney+", category: "Entertainment", website: "https://disneyplus.com" },
    { pattern: /hulu/i, name: "Hulu", category: "Entertainment", website: "https://hulu.com" }
  ];

  const segments = rawText
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const inputSegments =
    segments.length > 1
      ? segments
      : cleaned.filter((line) => /\$\s*\d/.test(line) || merchantHints.some((hint) => hint.pattern.test(line)));

  const keys = new Set();
  const candidates = [];

  inputSegments.forEach((segment, index) => {
    const hint = merchantHints.find((item) => item.pattern.test(segment));
    const amountMatch = segment.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    const amount = amountMatch ? Number(amountMatch[1]) : NaN;

    if (!hint && !Number.isFinite(amount)) {
      return;
    }

    if (!Number.isFinite(amount)) {
      return;
    }

    const inferredNameMatch =
      segment.match(/(?:subscription|receipt|invoice)\s+(?:for|from)\s+([a-z0-9+&.' -]{2,60})/i) ||
      segment.match(/from\s+([a-z0-9+&.' -]{2,60})/i);
    const inferredName = inferredNameMatch ? inferredNameMatch[1].trim() : "";
    const name = hint?.name || inferredName || `Detected Subscription ${index + 1}`;
    const price = Number.isFinite(amount) ? amount : 0;
    const billingCycle = detectBillingCycleFromText(segment);
    const category = hint?.category || detectCategoryFromText(segment);
    const website = hint?.website || "";
    const key = `${name.toLowerCase()}|${price}|${billingCycle}`;

    if (keys.has(key)) {
      return;
    }

    keys.add(key);
    candidates.push({
      id: `candidate-${Date.now()}-${index}`,
      name,
      description: "Detected from inbox receipt scan.",
      price,
      billingCycle,
      category,
      currency: "USD ($)",
      nextRenewalRaw: "",
      status: "active",
      website,
      logoUrl: "",
      logoFileName: "",
      sourceSnippet: segment.slice(0, 180)
    });
  });

  return candidates;
}

function closeActiveMenu() {
  activeMenuId = null;
  document.querySelectorAll(".menu-dropdown").forEach((menu) => {
    menu.classList.remove("open");
  });
}

function deleteSubscription(subscriptionId) {
  const index = subscriptions.findIndex((item) => item.id === subscriptionId);
  if (index === -1) {
    return;
  }

  subscriptions.splice(index, 1);

  if (
    activeFilter !== "All Subscriptions" &&
    !subscriptions.some((item) => item.category === activeFilter)
  ) {
    activeFilter = "All Subscriptions";
  }

  saveSubscriptions();
  renderAll();
}

function renderStats() {
  const activeCountEl = document.getElementById("activeCount");
  const monthlyCostEl = document.getElementById("monthlyCost");
  const yearlyCostEl = document.getElementById("yearlyCost");
  const averageCostEl = document.getElementById("averageCost");

  if (!activeCountEl || !monthlyCostEl || !yearlyCostEl || !averageCostEl) {
    return;
  }

  const visible = getVisibleSubscriptions();
  const monthly = visible.reduce((sum, item) => sum + item.monthlyEquivalent, 0);
  const yearly = monthly * 12;
  const average = visible.length ? monthly / visible.length : 0;

  activeCountEl.textContent = visible.length;
  monthlyCostEl.textContent = formatCurrency(monthly);
  yearlyCostEl.textContent = formatCurrency(yearly);
  averageCostEl.textContent = formatCurrency(average);
}

function renderChart(animate = false) {
  const chart = document.getElementById("chart");
  if (!chart) {
    return;
  }
  chart.innerHTML = "";

  const chartData = getChartData()
    .map((item) => {
      const key = item.subscriptionId ? `sub:${item.subscriptionId}` : `cat:${item.category}`;
      return { ...item, key, targetValue: getChartValue(item) };
    })
    .sort((a, b) => a.targetValue - b.targetValue);

  if (!chartData.length) {
    chartAnimationState = { displayMax: null, valuesByKey: {} };
    return;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  chart.appendChild(tooltip);

  const linePlot = document.createElement("div");
  linePlot.className = "line-plot";
  chart.appendChild(linePlot);

  function positionTooltip(pointerX, pointerY) {
    const chartBounds = chart.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth || 220;
    const tooltipHeight = tooltip.offsetHeight || 88;
    const x = pointerX - chartBounds.left;
    const y = pointerY - chartBounds.top;
    const margin = 12;
    const minLeft = tooltipWidth / 2;
    const maxLeft = Math.max(minLeft, chartBounds.width - tooltipWidth / 2);
    const left = Math.min(Math.max(x, minLeft), maxLeft);

    const topAbove = y - tooltipHeight - margin;
    const topBelow = y + margin;
    const maxTop = Math.max(4, chartBounds.height - tooltipHeight - 4);
    const top = topAbove < 4 ? Math.min(topBelow, maxTop) : topAbove;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(4, top)}px`;
  }

  const axisLeftPadding = 66;
  const pointGroupWidth = 140;
  const pointGap = 18;
  const pointZoneHeight = 208;
  const pointSize = 18;
  const tickCount = 5;
  const globalMax = Math.max(...chartData.map((item) => item.yearlyEquivalent), 1);
  const monthlyMax = Math.max(...chartData.map((item) => item.monthlyEquivalent), 1);
  const displayMaxTarget = chartView === "yearly" ? globalMax : monthlyMax;
  const yMin = 0;
  const usableHeight = pointZoneHeight - pointSize;
  const linePoints = new Array(chartData.length);
  const gridLayer = document.createElement("div");
  gridLayer.className = "grid-layer";
  linePlot.appendChild(gridLayer);
  const gridLabels = [];

  const shouldAnimate =
    animate &&
    chartAnimationState.displayMax !== null &&
    Object.keys(chartAnimationState.valuesByKey).length > 0;
  const startDisplayMax = shouldAnimate ? chartAnimationState.displayMax : displayMaxTarget;

  for (let i = 0; i < tickCount; i += 1) {
    const ratio = i / (tickCount - 1);
    const yFromBottom = ratio * usableHeight + pointSize / 2;

    const gridLine = document.createElement("div");
    gridLine.className = "grid-line";
    gridLine.style.bottom = `${yFromBottom}px`;
    gridLayer.appendChild(gridLine);

    const label = document.createElement("span");
    label.className = "y-label";
    label.style.bottom = `${yFromBottom}px`;
    gridLayer.appendChild(label);
    gridLabels.push({ ratio, element: label });
  }

  chartData.forEach((item) => {
    const pointGroup = document.createElement("div");
    pointGroup.className = "point-group";

    const pointZone = document.createElement("div");
    pointZone.className = "point-zone";

    const point = document.createElement("button");
    point.className = "point";
    point.type = "button";
    point.style.background = categoryColors[item.category] || "#6fb3ff";
    point.setAttribute("aria-label", `Open ${item.label}`);

    point.addEventListener("mouseenter", () => {
      tooltip.innerHTML = `
        <div class="tooltip-title">${item.label}</div>
        <div class="tooltip-line">Category: ${item.category}</div>
        <div class="tooltip-line">Monthly: ${formatCurrency(item.monthlyEquivalent)}</div>
        <div class="tooltip-line">Yearly: ${formatCurrency(item.yearlyEquivalent)}</div>
      `;
      tooltip.classList.add("visible");
    });

    point.addEventListener("mousemove", (event) => {
      positionTooltip(event.clientX, event.clientY);
    });

    point.addEventListener("mouseleave", () => {
      tooltip.classList.remove("visible");
    });

    let touchTimer;
    let touchStartX, touchStartY;
    let isTooltipShown = false;

    point.addEventListener("touchstart", (event) => {
      event.preventDefault();
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      isTooltipShown = false;
      touchTimer = setTimeout(() => {
        tooltip.innerHTML = `
          <div class="tooltip-title">${item.label}</div>
          <div class="tooltip-line">Category: ${item.category}</div>
          <div class="tooltip-line">Monthly: ${formatCurrency(item.monthlyEquivalent)}</div>
          <div class="tooltip-line">Yearly: ${formatCurrency(item.yearlyEquivalent)}</div>
        `;
        tooltip.classList.add("visible");
        positionTooltip(touchStartX, touchStartY);
        isTooltipShown = true;
      }, 300);
    });

    point.addEventListener("touchmove", (event) => {
      const moveX = event.touches[0].clientX;
      const moveY = event.touches[0].clientY;
      const deltaX = Math.abs(moveX - touchStartX);
      const deltaY = Math.abs(moveY - touchStartY);
      if (deltaX > 10 || deltaY > 10) {
        clearTimeout(touchTimer);
        isTooltipShown = false;
        tooltip.classList.remove("visible");
      }
    });

    point.addEventListener("touchend", (event) => {
      clearTimeout(touchTimer);
      tooltip.classList.remove("visible");
      isTooltipShown = false;
      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const deltaX = Math.abs(endX - touchStartX);
      const deltaY = Math.abs(endY - touchStartY);
      if (deltaX < 10 && deltaY < 10 && !isTooltipShown) {
        handleBarAction();
      }
    });

    const handleBarAction = () => {
      if (activeFilter === "All Subscriptions") {
        activeFilter = item.category;
        renderAll();
        return;
      }

      if (item.subscriptionId) {
        openEditModal(item.subscriptionId);
      }
    };

    if (!('ontouchstart' in window)) {
      point.addEventListener("click", handleBarAction);
    }
    point.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleBarAction();
      }
    });

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = item.label;

    const subtitle = document.createElement("span");
    subtitle.className = "bar-subtitle";
    subtitle.textContent = item.subtitle;

    pointZone.appendChild(point);
    pointGroup.appendChild(pointZone);
    pointGroup.appendChild(label);
    pointGroup.appendChild(subtitle);
    linePlot.appendChild(pointGroup);

    item.point = point;
    item.pointGroup = pointGroup;
  });

  const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lineSvg.classList.add("line-svg");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  path.classList.add("line-path");

  const svgHeight = pointZoneHeight;
  const svgWidth = Math.max(
    (chartData.length - 1) * (pointGroupWidth + pointGap) + pointGroupWidth,
    pointGroupWidth
  );
  lineSvg.setAttribute("width", String(svgWidth + 8));
  lineSvg.setAttribute("height", String(svgHeight + 8));
  lineSvg.setAttribute("viewBox", `-4 -4 ${svgWidth + 8} ${svgHeight + 8}`);

  lineSvg.appendChild(path);
  linePlot.appendChild(lineSvg);

  const startValues = {};
  chartData.forEach((item) => {
    startValues[item.key] = shouldAnimate
      ? (chartAnimationState.valuesByKey[item.key] ?? item.targetValue)
      : item.targetValue;
  });

  const animateMs = shouldAnimate ? 560 : 0;
  const animateStart = performance.now();

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function toYFromBottom(value) {
    const ratio = Math.max(0, Math.min(1, value / globalMax));
    return ratio * usableHeight + pointSize / 2;
  }

  function placeChartAtProgress(progress) {
    const eased = easeOutCubic(progress);
    const currentDisplayMax = lerp(startDisplayMax, displayMaxTarget, eased);

    gridLabels.forEach((tick) => {
      const tickValue = yMin + (currentDisplayMax - yMin) * tick.ratio;
      tick.element.textContent = formatCompactCurrency(tickValue);
    });

    chartData.forEach((item, index) => {
      const currentValue = lerp(startValues[item.key], item.targetValue, eased);
      const yFromBottom = toYFromBottom(currentValue);
      const pointBottom = yFromBottom - pointSize / 2;
      item.point.style.bottom = `${pointBottom}px`;
    });

    lineSvg.style.left = `${axisLeftPadding}px`;

    const svgRect = lineSvg.getBoundingClientRect();
    chartData.forEach((item, index) => {
      const dotRect = item.point.getBoundingClientRect();
      const centerX = dotRect.left + dotRect.width / 2 - svgRect.left - 4;
      const centerY = dotRect.top + dotRect.height / 2 - svgRect.top - 4;
      linePoints[index] = `${centerX},${centerY}`;
    });

    path.setAttribute("points", linePoints.join(" "));
  }

  if (!shouldAnimate) {
    placeChartAtProgress(1);
  } else {
    const step = (now) => {
      const elapsed = now - animateStart;
      const progress = Math.min(1, elapsed / animateMs);
      placeChartAtProgress(progress);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  chartAnimationState = {
    displayMax: displayMaxTarget,
    valuesByKey: chartData.reduce((acc, item) => {
      acc[item.key] = item.targetValue;
      return acc;
    }, {})
  };
}

function renderFilters() {
  const filtersContainer = document.getElementById("filters");
  if (!filtersContainer) {
    return;
  }
  filtersContainer.innerHTML = "";

  const categoryCounts = subscriptions.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const filterItems = [
    { label: "All Subscriptions", count: subscriptions.length },
    ...Object.entries(categoryCounts).map(([category, count]) => ({
      label: category,
      count
    }))
  ];

  filterItems.forEach((item) => {
    const chip = document.createElement("button");
    chip.className = `chip ${activeFilter === item.label ? "active" : ""}`;
    chip.innerHTML = `
      <span>${item.label}</span>
      <span class="chip-count">${item.count}</span>
    `;

    chip.addEventListener("click", () => {
      activeFilter = item.label;
      renderAll();
    });

    filtersContainer.appendChild(chip);
  });
}

function renderSubscriptions() {
  const container = document.getElementById("subscriptions");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  const visible = getVisibleSubscriptions();

  visible.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card subscription-card";

    const logoMarkup = item.logoUrl
      ? `<img src="${item.logoUrl}" alt="${item.name} logo" />`
      : item.logo;

    card.innerHTML = `
      <div class="top-row">
        <div class="brand">
          <div class="brand-logo ${item.logoClass}">${logoMarkup}</div>
          <div>
            <h3>${item.name}</h3>
            <span class="tag">${item.category}</span>
          </div>
        </div>
        <div class="menu-wrap">
          <button class="menu-btn" type="button" data-subscription-id="${item.id}" aria-label="Open actions for ${item.name}">⋮</button>
          <div class="menu-dropdown" data-menu-id="${item.id}">
            <button class="menu-item" type="button" data-action="edit" data-subscription-id="${item.id}">
              <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>
              </svg>
              <span>Edit</span>
            </button>
            <button class="menu-item danger" type="button" data-action="delete" data-subscription-id="${item.id}">
              <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M8 6V4h8v2"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
      <p class="desc">${item.description}</p>
      <div class="info-row"><span>Price</span><strong>$${item.price} <small>/ ${item.billingCycle.toLowerCase()}</small></strong></div>
      ${
        chartView === "yearly" && item.billingCycle !== "Monthly"
          ? `<div class="info-row"><span>Monthly equivalent</span><strong>${formatCurrency(item.monthlyEquivalent)}/mo</strong></div>`
          : ""
      }
      ${
        item.nextRenewal
          ? `<div class="info-row"><span>Next renewal</span><strong>${item.nextRenewal}</strong></div>`
          : ""
      }
      <div class="info-row"><span>Status</span><span class="status">${item.status}</span></div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll(".menu-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const subscriptionId = Number(button.dataset.subscriptionId);
      const dropdown = container.querySelector(`[data-menu-id="${subscriptionId}"]`);
      const shouldOpen = activeMenuId !== subscriptionId;

      closeActiveMenu();

      if (shouldOpen && dropdown) {
        dropdown.classList.add("open");
        activeMenuId = subscriptionId;
      }
    });
  });

  container.querySelectorAll(".menu-item").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const subscriptionId = Number(button.dataset.subscriptionId);
      const action = button.dataset.action;

      closeActiveMenu();

      if (action === "edit") {
        openEditModal(subscriptionId);
        return;
      }

      if (action === "delete") {
        deleteSubscription(subscriptionId);
      }
    });
  });

}

function renderDetectedCandidates(container, onAddClick) {
  if (!container) {
    return;
  }
  container.innerHTML = "";

  if (!detectedCandidates.length) {
    const empty = document.createElement("div");
    empty.className = "detected-empty";
    empty.textContent = "No receipt matches yet. Paste receipt text and click Scan Receipts.";
    container.appendChild(empty);
    return;
  }

  detectedCandidates.forEach((candidate) => {
    const card = document.createElement("article");
    card.className = "detected-card";
    card.innerHTML = `
      <div class="detected-head">
        <h3 class="detected-title">${candidate.name}</h3>
        <span class="detected-badge">${candidate.category}</span>
      </div>
      <div class="detected-meta">
        <span><strong>Price:</strong> ${formatCurrency(candidate.price)}</span>
        <span><strong>Cycle:</strong> ${candidate.billingCycle}</span>
      </div>
      <div class="detected-meta">
        <span>${candidate.sourceSnippet}</span>
      </div>
      <div>
        <button class="btn btn-gradient detected-add-btn" type="button" data-candidate-id="${candidate.id}">
          Review and Add
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".detected-add-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = detectedCandidates.find((item) => item.id === button.dataset.candidateId);
      if (candidate) {
        onAddClick(candidate);
      }
    });
  });
}

function initPremiumScrollExperience() {
  const premiumExperience = document.querySelector(".premium-experience");
  if (!premiumExperience) {
    return;
  }

  const scenes = Array.from(premiumExperience.querySelectorAll(".premium-scene"));
  if (!scenes.length) {
    return;
  }
  const sceneMeta = scenes.map((scene) => ({
    scene,
    steps: Array.from(scene.querySelectorAll(".premium-wheel-step"))
  }));

  scenes.forEach((scene, sceneIndex) => {
    const cloud = scene.querySelector(".premium-bubble-cloud");
    if (!cloud || cloud.children.length) {
      return;
    }

    const bubbleCount = Math.max(24, Number(scene.dataset.bubbles) || 72);
    for (let i = 0; i < bubbleCount; i += 1) {
      const bubble = document.createElement("span");
      bubble.className = "premium-bubble";
      const size = 8 + Math.random() * 42;
      const left = Math.random() * 100;
      const base = Math.random() * 26;
      const depth = 0.45 + Math.random() * 0.9;
      const drift = (Math.random() - 0.5) * 18;
      bubble.style.setProperty("--size", `${size}px`);
      bubble.style.setProperty("--left", `${left}%`);
      bubble.style.setProperty("--base", `${base}`);
      bubble.style.setProperty("--depth", String(depth));
      bubble.style.setProperty("--drift", `${drift}px`);
      bubble.style.setProperty("--delay", `${(i % 12) * 0.04 + sceneIndex * 0.06}s`);
      cloud.appendChild(bubble);
    }
  });

  let ticking = false;
  const updateScenes = () => {
    sceneMeta.forEach(({ scene, steps }) => {
      const rect = scene.getBoundingClientRect();
      const total = window.innerHeight + rect.height;
      const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / total));
      scene.style.setProperty("--scroll-progress", progress.toFixed(4));

      if (!steps.length) {
        return;
      }

      const segment = 1 / steps.length;
      steps.forEach((step, index) => {
        const start = segment * index;
        const end = start + segment;
        const localProgress = Math.max(0, Math.min(1, (progress - start) / (end - start)));
        step.style.setProperty("--wheel-progress", localProgress.toFixed(4));
      });
    });
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) {
      return;
    }
    ticking = true;
    requestAnimationFrame(updateScenes);
  };

  updateScenes();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
}

function renderAll() {
  renderStats();
  renderChart();
  renderFilters();
  renderSubscriptions();
  refreshPlanState();
}

document.addEventListener("DOMContentLoaded", () => {
  loadSubscriptions();
  loadInboxState();
  const addBtn = document.getElementById("addBtn");
  const modal = document.getElementById("subscriptionModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelModalBtn = document.getElementById("cancelModalBtn");
  const subscriptionForm = document.getElementById("subscriptionForm");
  const modalTitle = document.getElementById("subscriptionModalTitle");
  const submitSubscriptionBtn = document.getElementById("submitSubscriptionBtn");
  const serviceNameInput = document.getElementById("serviceName");
  const descriptionInput = document.getElementById("description");
  const priceInput = document.getElementById("price");
  const currencyInput = document.getElementById("currency");
  const billingCycleInput = document.getElementById("billingCycle");
  const categoryInput = document.getElementById("category");
  const nextRenewalInput = document.getElementById("nextRenewal");
  const statusInput = document.getElementById("status");
  const logoFileInput = document.getElementById("logoFile");
  const logoFileNote = document.getElementById("logoFileNote");
  const websiteInput = document.getElementById("website");
  const inboxEmailInput = document.getElementById("inboxEmailInput");
  const linkInboxBtn = document.getElementById("linkInboxBtn");
  const inboxStatus = document.getElementById("inboxStatus");
  const receiptInboxText = document.getElementById("receiptInboxText");
  const scanReceiptsBtn = document.getElementById("scanReceiptsBtn");
  const detectedReceipts = document.getElementById("detectedReceipts");
  const toggleInboxPanelBtn = document.getElementById("toggleInboxPanelBtn");
  const inboxPanelBody = document.getElementById("inboxPanelBody");
  const inboxPanel = document.querySelector(".inbox-panel");
  const receiptConfirmModal = document.getElementById("receiptConfirmModal");
  const receiptConfirmPreview = document.getElementById("receiptConfirmPreview");
  const closeReceiptConfirmBtn = document.getElementById("closeReceiptConfirmBtn");
  const cancelReceiptConfirmBtn = document.getElementById("cancelReceiptConfirmBtn");
  const confirmReceiptAddBtn = document.getElementById("confirmReceiptAddBtn");
  const accountStatusPill = document.getElementById("accountStatusPill");
  const accountActionBtn = document.getElementById("accountActionBtn");
  const authModal = document.getElementById("authModal");
  const authModalTitle = document.getElementById("authModalTitle");
  const closeAuthModalBtn = document.getElementById("closeAuthModalBtn");
  const authForm = document.getElementById("authForm");
  const authNameInput = document.getElementById("authName");
  const authEmailInput = document.getElementById("authEmail");
  const authPasswordInput = document.getElementById("authPassword");
  const authStatusText = document.getElementById("authStatusText");
  const authSwitchBtn = document.getElementById("authSwitchBtn");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const planBadge = document.getElementById("planBadge");
  const planSummary = document.getElementById("planSummary");
  const planStatus = document.getElementById("planStatus");
  const upgradeMonthlyBtn = document.getElementById("upgradeMonthlyBtn");
  const upgradeYearlyBtn = document.getElementById("upgradeYearlyBtn");
  const upgradeLifetimeBtn = document.getElementById("upgradeLifetimeBtn");
  const aiBudgetInput = document.getElementById("aiBudgetInput");
  const aiBudgetStatusText = document.getElementById("aiBudgetStatusText");
  const aiBudgetUsageText = document.getElementById("aiBudgetUsageText");
  const runAiBudgetBtn = document.getElementById("runAiBudgetBtn");
  const aiBudgetOutput = document.getElementById("aiBudgetOutput");
  const toggleAiPanelBtn = document.getElementById("toggleAiPanelBtn");
  const aiPanelBody = document.getElementById("aiPanelBody");
  const aiBudgetPanel = document.querySelector(".ai-budget-panel");
  const developerResetBtn = document.getElementById("developerResetBtn");

  function setModalMode(mode) {
    if (!modalTitle || !submitSubscriptionBtn) {
      return;
    }
    const isEdit = mode === "edit";
    modalTitle.textContent = isEdit ? "Edit Subscription" : "Add New Subscription";
    submitSubscriptionBtn.textContent = isEdit ? "Update" : "Add Subscription";
  }

  function resetFormToDefaults() {
    if (
      !subscriptionForm ||
      !billingCycleInput ||
      !categoryInput ||
      !statusInput ||
      !currencyInput ||
      !nextRenewalInput ||
      !logoFileNote
    ) {
      return;
    }
    subscriptionForm.reset();
    billingCycleInput.value = "Monthly";
    categoryInput.value = "Other";
    statusInput.value = "active";
    currencyInput.value = "USD ($)";
    nextRenewalInput.value = "";
    logoFileNote.textContent = "Upload a screenshot or downloaded image.";
    editingSubscriptionId = null;
  }

  function openModal() {
    if (!modal || !serviceNameInput) {
      return;
    }
    setModalMode("add");
    resetFormToDefaults();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    serviceNameInput.focus();
  }

  function closeModal() {
    if (!modal) {
      return;
    }
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function renderAccountState(message = "") {
    if (!accountStatusPill || !accountActionBtn) {
      return;
    }

    if (accountSession.authenticated && accountSession.user) {
      accountStatusPill.textContent = accountSession.user.email;
      accountActionBtn.textContent = "Logout";
      if (developerResetBtn) {
        developerResetBtn.style.display = isDeveloperAccount() ? "inline-flex" : "none";
      }
      if (message && authStatusText) {
        authStatusText.textContent = message;
      }
      return;
    }

    accountStatusPill.textContent = "Guest";
    accountActionBtn.textContent = "Login";
    if (developerResetBtn) {
      developerResetBtn.style.display = "none";
    }
    if (message && authStatusText) {
      authStatusText.textContent = message;
    }
  }

  function renderPremiumFeatureVisibility() {
    const planType = getPlanType();
    const hasPaidPlan = planType === "premium" || planType === "lifetime";

    if (aiBudgetPanel) {
      aiBudgetPanel.style.display = hasPaidPlan ? "" : "none";
    }

    if (inboxPanel) {
      inboxPanel.style.display = "";
    }
  }

  function renderPlanState(message = "") {
    renderPremiumFeatureVisibility();

    if (!planBadge || !planSummary || !planStatus) {
      if (message && /cap reached|upgrade to premium/i.test(message)) {
        window.alert(message);
      }
      return;
    }

    const planType = accountSession.user?.planType || "free";
    const premium = planType === "premium";
    const lifetime = planType === "lifetime";
    const limit = getCurrentSubscriptionLimit();
    const usedCount = subscriptions.length;
    const monthlyPrice = formatCurrency(premiumPricing.monthly);
    const yearlyPrice = formatCurrency(premiumPricing.yearly);
    const lifetimePrice = formatCurrency(premiumPricing.lifetime);

    if (upgradeMonthlyBtn) {
      upgradeMonthlyBtn.textContent = `Buy Premium Monthly · ${monthlyPrice}/mo`;
    }
    if (upgradeYearlyBtn) {
      upgradeYearlyBtn.textContent = `Buy Premium Yearly · ${yearlyPrice}/yr`;
    }
    if (upgradeLifetimeBtn) {
      upgradeLifetimeBtn.textContent = `Buy Lifetime · ${lifetimePrice}`;
    }

    if (lifetime) {
      planBadge.textContent = "Lifetime";
      planSummary.textContent = "Lifetime gives unlimited subscriptions, unlimited AI insight, and lifetime update support.";
      planStatus.textContent = message || `You are tracking ${usedCount} subscriptions with lifetime access.`;
      planStatus.classList.remove("limit-reached");
      if (upgradeMonthlyBtn) {
        upgradeMonthlyBtn.disabled = true;
      }
      if (upgradeYearlyBtn) {
        upgradeYearlyBtn.disabled = true;
      }
      if (upgradeLifetimeBtn) {
        upgradeLifetimeBtn.disabled = true;
      }
      renderAiBudgetToolState();
      return;
    }

    if (premium) {
      const cycleLabel = accountSession.user?.premiumBillingCycle === "yearly" ? "Yearly" : "Monthly";
      planBadge.textContent = "Premium";
      planSummary.textContent = `Premium (${cycleLabel}) gives you unlimited subscription tracking.`;
      planStatus.textContent = message || `You are tracking ${usedCount} subscriptions with no limit.`;
      planStatus.classList.remove("limit-reached");
      if (upgradeMonthlyBtn) {
        upgradeMonthlyBtn.disabled = true;
      }
      if (upgradeYearlyBtn) {
        upgradeYearlyBtn.disabled = true;
      }
      if (upgradeLifetimeBtn) {
        upgradeLifetimeBtn.disabled = false;
      }
      renderAiBudgetToolState();
      return;
    }

    planBadge.textContent = "Free";
    planSummary.textContent = `Free tracks up to ${freeSubscriptionLimit} subscriptions. Premium unlocks unlimited tracking.`;
    const remaining = Math.max(limit - usedCount, 0);
    const defaultStatus =
      remaining === 0
        ? `Free plan limit reached (${freeSubscriptionLimit}/${freeSubscriptionLimit}). Upgrade to add more.`
        : `${remaining} slot${remaining === 1 ? "" : "s"} left on Free (${usedCount}/${freeSubscriptionLimit} used).`;
    planStatus.textContent = message || defaultStatus;
    planStatus.classList.toggle("limit-reached", remaining === 0);
    if (upgradeMonthlyBtn) {
      upgradeMonthlyBtn.disabled = false;
    }
    if (upgradeYearlyBtn) {
      upgradeYearlyBtn.disabled = false;
    }
    if (upgradeLifetimeBtn) {
      upgradeLifetimeBtn.disabled = false;
    }
    renderAiBudgetToolState();
  }

  function renderAiBudgetToolState(statusMessage = "") {
    if (!runAiBudgetBtn || !aiBudgetUsageText || !aiBudgetStatusText) {
      return;
    }

    const usageDetails = getAiUsageDetails();
    const { planType, used, limit, remaining, unlimited } = usageDetails;

    aiBudgetUsageText.textContent = unlimited ? "Usage: Unlimited" : `Usage today: ${used} / ${limit}`;

    if (!accountSession.authenticated) {
      runAiBudgetBtn.disabled = true;
      aiBudgetStatusText.textContent = "Log in and upgrade to Premium to use AI budget insights.";
      return;
    }

    if (planType === "free") {
      runAiBudgetBtn.disabled = true;
      aiBudgetStatusText.textContent = "AI Budget Tool is Premium/Lifetime only.";
      return;
    }

    runAiBudgetBtn.disabled = !unlimited && remaining <= 0;
    const planLabel = planType === "lifetime" ? "Lifetime" : "Premium";
    aiBudgetStatusText.textContent =
      statusMessage || (unlimited
        ? `${planLabel} AI uses: unlimited.`
        : `${planLabel} AI uses remaining today: ${remaining} of ${limit}.`);
  }

  async function upgradeToPremium(billingCycle) {
    if (!accountSession.authenticated) {
      renderPlanState("Log in to upgrade to Premium.");
      openAuthModal("login");
      return;
    }

    try {
      const response = await inboxApiRequest("/api/account/upgrade", {
        method: "POST",
        body: { billingCycle }
      });

      if (
        response.pricing &&
        Number.isFinite(response.pricing.monthly) &&
        Number.isFinite(response.pricing.yearly) &&
        Number.isFinite(response.pricing.lifetime)
      ) {
        premiumPricing = {
          monthly: Number(response.pricing.monthly),
          yearly: Number(response.pricing.yearly),
          lifetime: Number(response.pricing.lifetime)
        };
      }

      if (response.user) {
        accountSession.user = {
          ...response.user,
          planType:
            response.user.planType === "lifetime"
              ? "lifetime"
              : response.user.planType === "premium"
                ? "premium"
                : "free",
          premiumBillingCycle:
            response.user.planType === "premium"
              ? response.user.premiumBillingCycle === "yearly"
                ? "yearly"
                : "monthly"
              : null
        };
      }

      renderAccountState("Premium active.");
      renderPlanState(`Premium ${billingCycle} plan activated.`);
    } catch (error) {
      renderPlanState(error.message || "Unable to upgrade to Premium right now.");
    }
  }

  async function upgradeToLifetime() {
    if (!accountSession.authenticated) {
      renderPlanState("Log in to unlock Lifetime.");
      openAuthModal("login");
      return;
    }

    try {
      const response = await inboxApiRequest("/api/account/lifetime", {
        method: "POST"
      });

      if (
        response.pricing &&
        Number.isFinite(response.pricing.monthly) &&
        Number.isFinite(response.pricing.yearly) &&
        Number.isFinite(response.pricing.lifetime)
      ) {
        premiumPricing = {
          monthly: Number(response.pricing.monthly),
          yearly: Number(response.pricing.yearly),
          lifetime: Number(response.pricing.lifetime)
        };
      }

      if (response.user) {
        accountSession.user = {
          ...response.user,
          planType: "lifetime",
          premiumBillingCycle: null
        };
      }

      renderAccountState("Lifetime active.");
      renderPlanState("Lifetime access activated.");
    } catch (error) {
      renderPlanState(error.message || "Unable to activate Lifetime right now.");
    }
  }

  refreshPlanState = renderPlanState;

  function setAuthMode(mode) {
    if (
      !authForm ||
      !authModalTitle ||
      !authSubmitBtn ||
      !authSwitchBtn ||
      !authStatusText
    ) {
      return;
    }

    authMode = mode;
    const isRegister = mode === "register";

    authForm.classList.toggle("register-mode", isRegister);
    authModalTitle.textContent = isRegister ? "Create Account" : "Login";
    authSubmitBtn.textContent = isRegister ? "Create Account" : "Login";
    authSwitchBtn.textContent = isRegister ? "Back to login" : "Create account instead";
    if (authNameInput) {
      authNameInput.required = isRegister;
      authNameInput.disabled = !isRegister;
      if (!isRegister) {
        authNameInput.value = "";
      }
    }
    authStatusText.textContent = isRegister
      ? "Create an account to unlock session-based features."
      : "Use your account to enable protected session features.";
  }

  function openAuthModal(mode = "login") {
    if (!authModal || !authEmailInput) {
      return;
    }
    setAuthMode(mode);
    authModal.classList.add("open");
    authModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (mode === "register" && authNameInput) {
      authNameInput.focus();
    } else {
      authEmailInput.focus();
    }
  }

  function closeAuthModal() {
    if (!authModal || !authForm) {
      return;
    }
    authModal.classList.remove("open");
    authModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    authForm.reset();
    setAuthMode("login");
  }

  function renderInboxLinkState(message = "") {
    if (!inboxEmailInput || !linkInboxBtn || !inboxStatus || !scanReceiptsBtn) {
      return;
    }

    const isLoggedIn = accountSession.authenticated;
    inboxEmailInput.disabled = !isLoggedIn;
    linkInboxBtn.disabled = !isLoggedIn;
    scanReceiptsBtn.disabled = !isLoggedIn;

    if (!isLoggedIn) {
      linkInboxBtn.textContent = "Login Required";
      inboxStatus.textContent = message || "Log in to link Gmail and use live inbox sync.";
      return;
    }

    inboxEmailInput.value = inboxState.email || "";

    if (inboxState.linked) {
      linkInboxBtn.textContent = "Unlink Gmail";
      inboxStatus.textContent =
        message || `Linked to ${inboxState.email}. Live inbox scan is enabled.`;
      return;
    }

    linkInboxBtn.textContent = "Link Gmail";
    inboxStatus.textContent = message || "Not linked.";
  }

  async function syncInboxStateFromServer(message = "") {
    if (!inboxEmailInput || !linkInboxBtn || !inboxStatus) {
      return false;
    }

    if (!accountSession.authenticated) {
      inboxState = { linked: false, email: "" };
      renderInboxLinkState(message || "Log in to link Gmail and use live inbox sync.");
      return false;
    }

    try {
      const response = await inboxApiRequest("/api/inbox/status");
      inboxState = {
        linked: Boolean(response.linked),
        email: response.email || ""
      };
      saveInboxState();
      renderInboxLinkState(message);
      return inboxState.linked;
    } catch {
      inboxState = { linked: false, email: "" };
      renderInboxLinkState("Inbox API offline. Start the backend server to enable live sync.");
      return false;
    }
  }

  function closeReceiptConfirmModal() {
    if (!receiptConfirmModal) {
      return;
    }
    receiptConfirmModal.classList.remove("open");
    receiptConfirmModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    pendingCandidate = null;
  }

  function openReceiptConfirmModal(candidate) {
    if (!receiptConfirmModal || !receiptConfirmPreview) {
      return;
    }
    pendingCandidate = candidate;
    receiptConfirmPreview.innerHTML = `
      <div class="confirm-line"><span>Name</span><strong>${candidate.name}</strong></div>
      <div class="confirm-line"><span>Category</span><strong>${candidate.category}</strong></div>
      <div class="confirm-line"><span>Price</span><strong>${formatCurrency(candidate.price)}</strong></div>
      <div class="confirm-line"><span>Billing cycle</span><strong>${candidate.billingCycle}</strong></div>
      <div class="confirm-line"><span>Status</span><strong>Active</strong></div>
      <div class="confirm-line"><span>Detected from</span><strong>Inbox receipt scan</strong></div>
    `;
    receiptConfirmModal.classList.add("open");
    receiptConfirmModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  openEditModal = (subscriptionId) => {
    if (
      !modal ||
      !serviceNameInput ||
      !descriptionInput ||
      !priceInput ||
      !currencyInput ||
      !billingCycleInput ||
      !categoryInput ||
      !nextRenewalInput ||
      !statusInput ||
      !logoFileInput ||
      !logoFileNote ||
      !websiteInput
    ) {
      return;
    }

    const subscription = subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) {
      return;
    }

    editingSubscriptionId = subscriptionId;
    setModalMode("edit");
    serviceNameInput.value = subscription.name;
    descriptionInput.value = subscription.description;
    priceInput.value = subscription.price;
    currencyInput.value = subscription.currency || "USD ($)";
    billingCycleInput.value = subscription.billingCycle || "Monthly";
    categoryInput.value = subscription.category;
    nextRenewalInput.value = subscription.nextRenewalRaw || "";
    statusInput.value = subscription.status;
    logoFileInput.value = "";
    logoFileNote.textContent = subscription.logoFileName
      ? `Current image: ${subscription.logoFileName}`
      : "Upload a screenshot or downloaded image.";
    websiteInput.value = subscription.website || "";

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    serviceNameInput.focus();
  };

  if (addBtn) {
    addBtn.addEventListener("click", openModal);
  }
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }
  if (cancelModalBtn) {
    cancelModalBtn.addEventListener("click", closeModal);
  }

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  if (receiptConfirmModal) {
    receiptConfirmModal.addEventListener("click", (event) => {
      if (event.target === receiptConfirmModal) {
        closeReceiptConfirmModal();
      }
    });
  }

  if (authModal) {
    authModal.addEventListener("click", (event) => {
      if (event.target === authModal) {
        closeAuthModal();
      }
    });
  }

  if (closeReceiptConfirmBtn) {
    closeReceiptConfirmBtn.addEventListener("click", closeReceiptConfirmModal);
  }
  if (cancelReceiptConfirmBtn) {
    cancelReceiptConfirmBtn.addEventListener("click", closeReceiptConfirmModal);
  }
  if (closeAuthModalBtn) {
    closeAuthModalBtn.addEventListener("click", closeAuthModal);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (receiptConfirmModal && receiptConfirmModal.classList.contains("open")) {
      closeReceiptConfirmModal();
      return;
    }

    if (authModal && authModal.classList.contains("open")) {
      closeAuthModal();
      return;
    }

    if (modal && modal.classList.contains("open")) {
      closeModal();
    }
  });

  document.addEventListener("click", () => {
    closeActiveMenu();
  });

  if (logoFileInput && logoFileNote) {
    logoFileInput.addEventListener("change", () => {
      const file = logoFileInput.files && logoFileInput.files[0];
      logoFileNote.textContent = file
        ? `Selected image: ${file.name}`
        : editingSubscriptionId !== null
          ? "Keeping current image."
          : "Upload a screenshot or downloaded image.";
    });
  }

  if (accountActionBtn) {
    accountActionBtn.addEventListener("click", async () => {
      if (!accountSession.authenticated) {
        openAuthModal("login");
        return;
      }

      try {
        await inboxApiRequest("/api/auth/logout", { method: "POST" });
      } catch {
        // Keep UI responsive even if logout request fails.
      }

      accountSession = { authenticated: false, user: null };
      inboxState = { linked: false, email: "" };
      saveInboxState();
      renderAccountState("Logged out.");
      renderPlanState("You are on Free plan.");
      renderInboxLinkState("Log in to link Gmail and use live inbox sync.");
      detectedCandidates = [];
      renderDetectedCandidates(detectedReceipts, openReceiptConfirmModal);
      renderAiBudgetToolState();
    });
  }

  if (authSwitchBtn) {
    authSwitchBtn.addEventListener("click", () => {
      setAuthMode(authMode === "login" ? "register" : "login");
    });
  }

  if (authForm && authEmailInput && authPasswordInput) {
    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        email: authEmailInput.value.trim(),
        password: authPasswordInput.value
      };
      if (authMode === "register") {
        payload.name = authNameInput ? authNameInput.value.trim() : "";
      }

      try {
        const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
        const response = await inboxApiRequest(endpoint, {
          method: "POST",
          body: payload
        });

        if (Number.isFinite(response.freeLimit) && response.freeLimit > 0) {
          freeSubscriptionLimit = Number(response.freeLimit);
        }
        if (
          response.pricing &&
          Number.isFinite(response.pricing.monthly) &&
          Number.isFinite(response.pricing.yearly) &&
          Number.isFinite(response.pricing.lifetime)
        ) {
          premiumPricing = {
            monthly: Number(response.pricing.monthly),
            yearly: Number(response.pricing.yearly),
            lifetime: Number(response.pricing.lifetime)
          };
        }

        accountSession = {
          authenticated: Boolean(response.authenticated),
          user: response.user
            ? {
                ...response.user,
                planType:
                  response.user.planType === "lifetime"
                    ? "lifetime"
                    : response.user.planType === "premium"
                      ? "premium"
                      : "free",
                premiumBillingCycle:
                  response.user.planType === "premium"
                    ? response.user.premiumBillingCycle === "yearly"
                      ? "yearly"
                      : "monthly"
                    : null
              }
            : null
        };

        renderAccountState(authMode === "register" ? "Account created and logged in." : "Logged in.");
        renderPlanState();
        renderAiBudgetToolState();
        await syncInboxStateFromServer();
        closeAuthModal();
      } catch (error) {
        if (authStatusText) {
          authStatusText.textContent = error.message || "Authentication failed.";
        }
      }
    });
  }

  if (linkInboxBtn && inboxEmailInput) {
    linkInboxBtn.addEventListener("click", async () => {
      if (!accountSession.authenticated) {
        renderInboxLinkState("Log in first to link Gmail.");
        openAuthModal("login");
        return;
      }

      if (inboxState.linked) {
        try {
          await inboxApiRequest("/api/inbox/unlink", { method: "POST" });
        } catch {
          // Continue with local unlink state even if API call fails.
        }
        inboxState = { linked: false, email: "" };
        saveInboxState();
        renderInboxLinkState("Gmail unlinked.");
        return;
      }

      const email = inboxEmailInput.value.trim();
      if (!email || !inboxEmailInput.checkValidity()) {
        renderInboxLinkState("Enter a valid Google email before linking.");
        return;
      }

      const oauthUrl = `${INBOX_API_BASE}/auth/google/start?origin=${encodeURIComponent(window.location.origin)}`;
      const popup = window.open(oauthUrl, "subtrack-google-oauth", "width=520,height=720");

      if (!popup) {
        renderInboxLinkState("Pop-up was blocked. Allow pop-ups and try linking Gmail again.");
        return;
      }

      renderInboxLinkState("Waiting for Gmail authorization...");

      const poll = setInterval(async () => {
        const linked = await syncInboxStateFromServer();
        if (linked) {
          clearInterval(poll);
          renderInboxLinkState("Gmail linked successfully.");
        }
        if (popup.closed) {
          clearInterval(poll);
          await syncInboxStateFromServer();
        }
      }, 1500);
    });
  }

  if (upgradeMonthlyBtn) {
    upgradeMonthlyBtn.addEventListener("click", () => {
      upgradeToPremium("monthly");
    });
  }

  if (upgradeYearlyBtn) {
    upgradeYearlyBtn.addEventListener("click", () => {
      upgradeToPremium("yearly");
    });
  }

  if (upgradeLifetimeBtn) {
    upgradeLifetimeBtn.addEventListener("click", () => {
      upgradeToLifetime();
    });
  }

  if (scanReceiptsBtn && inboxStatus) {
    scanReceiptsBtn.addEventListener("click", async () => {
      if (!accountSession.authenticated) {
        renderInboxLinkState("Log in first to scan live inbox receipts.");
        openAuthModal("login");
        return;
      }

      if (!inboxState.linked) {
        const linked = await syncInboxStateFromServer();
        if (!linked) {
          renderInboxLinkState("Link Gmail before scanning live receipts.");
          return;
        }
      }

      inboxStatus.textContent = "Scanning inbox receipts...";

      try {
        const response = await inboxApiRequest("/api/inbox/scan-live", {
          method: "POST",
          body: { maxResults: 25 }
        });

        detectedCandidates = Array.isArray(response.candidates) ? response.candidates : [];
        renderDetectedCandidates(detectedReceipts, openReceiptConfirmModal);

        if (!detectedCandidates.length) {
          inboxStatus.textContent = "No subscription receipts found in recent inbox messages.";
          return;
        }

        inboxStatus.textContent = `Detected ${detectedCandidates.length} subscription receipt${detectedCandidates.length === 1 ? "" : "s"} from your inbox. Review and confirm to add.`;
        return;
      }

      catch (error) {
        const rawText = receiptInboxText ? receiptInboxText.value.trim() : "";
        if (rawText) {
          detectedCandidates = parseReceiptCandidates(rawText);
          renderDetectedCandidates(detectedReceipts, openReceiptConfirmModal);
          inboxStatus.textContent = `Live scan unavailable (${error.message}). Using pasted receipt text fallback.`;
        } else {
          detectedCandidates = [];
          renderDetectedCandidates(detectedReceipts, openReceiptConfirmModal);
          inboxStatus.textContent = `Live scan failed: ${error.message}`;
        }
      }
    });
  }

  if (confirmReceiptAddBtn) {
    confirmReceiptAddBtn.addEventListener("click", () => {
      if (!pendingCandidate) {
        return;
      }

      if (!canAddMoreSubscriptions()) {
        closeReceiptConfirmModal();
        renderPlanState(`Free plan cap reached (${freeSubscriptionLimit}). Upgrade to Premium for unlimited tracking.`);
        return;
      }

      const payload = createSubscriptionPayload(pendingCandidate);
      addSubscriptionRecord(payload);

      detectedCandidates = detectedCandidates.filter((item) => item.id !== pendingCandidate.id);
      renderDetectedCandidates(detectedReceipts, openReceiptConfirmModal);
      if (inboxStatus) {
        inboxStatus.textContent = `${payload.name} was added from inbox receipts.`;
      }

      activeFilter = "All Subscriptions";
      renderPlanState();
      renderAll();
      closeReceiptConfirmModal();
    });
  }

  if (subscriptionForm && logoFileInput) {
    subscriptionForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(subscriptionForm);
      const selectedLogoFile = logoFileInput.files && logoFileInput.files[0];
      const existingSubscription = editingSubscriptionId !== null
        ? subscriptions.find((item) => item.id === editingSubscriptionId)
        : null;
      let logoUrl = existingSubscription ? existingSubscription.logoUrl : "";
      let logoFileName = existingSubscription ? existingSubscription.logoFileName : "";

      if (selectedLogoFile) {
        logoUrl = await readFileAsDataUrl(selectedLogoFile);
        logoFileName = selectedLogoFile.name;
      }

      const subscriptionPayload = createSubscriptionPayload({
        name: formData.get("serviceName"),
        description: formData.get("description"),
        price: formData.get("price"),
        billingCycle: formData.get("billingCycle"),
        category: formData.get("category"),
        nextRenewalRaw: formData.get("nextRenewal"),
        status: formData.get("status"),
        currency: formData.get("currency"),
        website: formData.get("website"),
        logoUrl,
        logoFileName
      });

      const isEditing = editingSubscriptionId !== null;

      if (!isEditing && !canAddMoreSubscriptions()) {
        renderPlanState(`Free plan cap reached (${freeSubscriptionLimit}). Upgrade to Premium for unlimited tracking.`);
        return;
      }

      if (isEditing) {
        if (existingSubscription) {
          Object.assign(existingSubscription, subscriptionPayload);
          saveSubscriptions();
        }
      } else {
        addSubscriptionRecord(subscriptionPayload);
      }

      activeFilter = "All Subscriptions";
      resetFormToDefaults();
      closeModal();
      renderPlanState();
      renderAll();
    });
  }

  document.querySelectorAll(".chart-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      chartView = button.dataset.view;

      document.querySelectorAll(".chart-toggle").forEach((toggle) => {
        toggle.classList.toggle("active", toggle === button);
      });

      renderChart(true);
      renderSubscriptions();
    });
  });

  window.addEventListener("message", async (event) => {
    if (event.data?.type !== "subtrack-google-linked") {
      return;
    }
    await syncInboxStateFromServer("Gmail linked successfully.");
  });

  syncAccountSessionFromServer().then(async () => {
    renderAccountState();
    renderPlanState();
    renderAiBudgetToolState();
    renderInboxLinkState("Checking inbox link...");
    await syncInboxStateFromServer();
  });

  if (runAiBudgetBtn && aiBudgetOutput) {
    runAiBudgetBtn.addEventListener("click", () => {
      const usageDetails = getAiUsageDetails();
      const { planType, limit, used, unlimited } = usageDetails;

      if (!accountSession.authenticated || planType === "free") {
        renderAiBudgetToolState("Upgrade to Premium to use AI budget insights.");
        return;
      }

      if (!unlimited && used >= limit) {
        renderAiBudgetToolState("AI usage limit reached. Upgrade for more.");
        return;
      }

      const question = aiBudgetInput ? aiBudgetInput.value.trim() : "";
      const insight = generateAiBudgetInsight(question);
      renderAiTyping(aiBudgetOutput, insight);
      consumeAiUsage();
      renderAiBudgetToolState("AI insight generated.");
    });
  }

  if (developerResetBtn) {
    developerResetBtn.addEventListener("click", () => {
      if (!isDeveloperAccount()) {
        return;
      }

      const confirmed = window.confirm(
        "Developer reset will clear local subscriptions, inbox state, and AI usage counters in this browser. Continue?"
      );
      if (!confirmed) {
        return;
      }

      if (aiTypingTimer) {
        clearTimeout(aiTypingTimer);
        aiTypingTimer = null;
      }

      try {
        localStorage.removeItem("subscriptions");
        localStorage.removeItem("inboxState");
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("aiBudgetUsage:")) {
            localStorage.removeItem(key);
          }
        });
      } catch {
        // Ignore storage cleanup failures.
      }

      const resetSubscriptions = JSON.parse(JSON.stringify(defaultSubscriptionsTemplate));
      subscriptions.splice(0, subscriptions.length, ...resetSubscriptions);
      nextSubscriptionId = Math.max(...subscriptions.map((item) => item.id), 0) + 1;
      activeFilter = "All Subscriptions";
      detectedCandidates = [];
      pendingCandidate = null;
      inboxState = { linked: false, email: "" };
      chartAnimationState = { displayMax: null, valuesByKey: {} };

      if (aiBudgetInput) {
        aiBudgetInput.value = "";
      }
      if (aiBudgetOutput) {
        aiBudgetOutput.textContent = "Developer reset complete.";
      }

      renderDetectedCandidates(detectedReceipts, openReceiptConfirmModal);
      renderInboxLinkState("Developer reset complete. Inbox is now unlinked in local state.");
      renderAiBudgetToolState("Developer reset complete.");
      renderAll();
    });
  }

  renderDetectedCandidates(detectedReceipts, openReceiptConfirmModal);
  initPremiumScrollExperience();

  const isInboxPanelMinimized = localStorage.getItem("inboxPanelMinimized") === "true";
  const isAiPanelMinimized = localStorage.getItem("aiPanelMinimized") === "true";
  function applyInboxPanelMinimized(minimized) {
    if (!toggleInboxPanelBtn || !inboxPanelBody || !inboxPanel) {
      return;
    }

    inboxPanelBody.classList.toggle("collapsed", minimized);
    inboxPanel.classList.toggle("minimized", minimized);
    toggleInboxPanelBtn.textContent = minimized ? "+ Expand" : "− Minimize";
    toggleInboxPanelBtn.setAttribute("aria-expanded", minimized ? "false" : "true");
  }

  function applyAiPanelMinimized(minimized) {
    if (!toggleAiPanelBtn || !aiPanelBody || !aiBudgetPanel) {
      return;
    }

    aiPanelBody.classList.toggle("collapsed", minimized);
    aiBudgetPanel.classList.toggle("minimized", minimized);
    toggleAiPanelBtn.textContent = minimized ? "+ Expand" : "− Minimize";
    toggleAiPanelBtn.setAttribute("aria-expanded", minimized ? "false" : "true");
  }

  applyInboxPanelMinimized(isInboxPanelMinimized);
  applyAiPanelMinimized(isAiPanelMinimized);
  if (toggleInboxPanelBtn) {
    toggleInboxPanelBtn.addEventListener("click", () => {
      const nextMinimized = !inboxPanelBody.classList.contains("collapsed");
      localStorage.setItem("inboxPanelMinimized", String(nextMinimized));
      applyInboxPanelMinimized(nextMinimized);
    });
  }
  if (toggleAiPanelBtn) {
    toggleAiPanelBtn.addEventListener("click", () => {
      const nextMinimized = !aiPanelBody.classList.contains("collapsed");
      localStorage.setItem("aiPanelMinimized", String(nextMinimized));
      applyAiPanelMinimized(nextMinimized);
    });
  }

  renderAll();
});
