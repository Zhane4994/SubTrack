import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";
import { google } from "googleapis";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5500";
const sessionSecret = process.env.SESSION_SECRET || "subtrack-dev-secret";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, "data", "users.json");
const publicDir = path.join(__dirname, "public");
const FREE_SUBSCRIPTION_LIMIT = 5;
const PREMIUM_PRICING = {
  monthly: 10.99,
  yearly: 109.99,
  lifetime: 100
};

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/auth/google/callback`
);

app.use(express.json());
app.use(
  cors({
    origin: [frontendOrigin, "http://localhost:5500", `http://localhost:${port}`],
    credentials: true
  })
);
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  })
);
app.use(express.static(publicDir));

function getTokenStore(req) {
  if (!req.session.inboxSync) {
    req.session.inboxSync = {};
  }
  return req.session.inboxSync;
}

function requireAuth(req, res, next) {
  if (!req.session.account) {
    return res.status(401).json({
      error: "auth_required",
      message: "Please log in to continue."
    });
  }

  return next();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) {
    return false;
  }
  const [salt, hash] = stored.split(":");
  const compareHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(compareHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function ensureUsersFile() {
  const folder = path.dirname(usersFilePath);
  await fs.mkdir(folder, { recursive: true });
  try {
    await fs.access(usersFilePath);
  } catch {
    await fs.writeFile(usersFilePath, "[]", "utf-8");
  }
}

async function readUsers() {
  await ensureUsersFile();
  const raw = await fs.readFile(usersFilePath, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await ensureUsersFile();
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf-8");
}

function withPlanDefaults(user) {
  const planType =
    user.planType === "lifetime"
      ? "lifetime"
      : user.planType === "premium"
        ? "premium"
        : "free";
  const premiumBillingCycle =
    planType === "premium"
      ? user.premiumBillingCycle === "yearly"
        ? "yearly"
        : "monthly"
      : null;

  return {
    ...user,
    planType,
    premiumBillingCycle
  };
}

function getSubscriptionLimit(planType) {
  return planType === "premium" || planType === "lifetime" ? null : FREE_SUBSCRIPTION_LIMIT;
}

function sanitizeUser(user) {
  const normalized = withPlanDefaults(user);
  return {
    id: normalized.id,
    name: normalized.name,
    email: normalized.email,
    planType: normalized.planType,
    premiumBillingCycle: normalized.premiumBillingCycle,
    subscriptionLimit: getSubscriptionLimit(normalized.planType)
  };
}

function getAuthorizedClient(req) {
  const store = getTokenStore(req);
  if (!store.tokens || !store.tokens.access_token) {
    return null;
  }

  oauth2Client.setCredentials(store.tokens);
  return oauth2Client;
}

function getTextFromPayloadPart(part) {
  if (!part) {
    return "";
  }

  if (part.parts && part.parts.length) {
    return part.parts.map((item) => getTextFromPayloadPart(item)).join("\n");
  }

  const encoded = part.body && part.body.data ? part.body.data : "";
  if (!encoded) {
    return "";
  }

  try {
    return Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return "";
  }
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

function parseCandidatesFromMessages(messages) {
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

  const keys = new Set();
  const candidates = [];

  messages.forEach((message, index) => {
    const searchable = `${message.subject}\n${message.snippet}\n${message.body}`.trim();
    const hint = merchantHints.find((item) => item.pattern.test(searchable));
    const amountMatch = searchable.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    const amount = amountMatch ? Number(amountMatch[1]) : NaN;

    if (!hint && !Number.isFinite(amount)) {
      return;
    }
    if (!Number.isFinite(amount)) {
      return;
    }

    const inferredNameMatch =
      searchable.match(/(?:subscription|receipt|invoice)\s+(?:for|from)\s+([a-z0-9+&.' -]{2,60})/i) ||
      searchable.match(/from\s+([a-z0-9+&.' -]{2,60})/i);

    const inferredName = inferredNameMatch ? inferredNameMatch[1].trim() : "";
    const name = hint?.name || inferredName || message.from || `Detected Subscription ${index + 1}`;
    const price = amount;
    const billingCycle = detectBillingCycleFromText(searchable);
    const category = hint?.category || detectCategoryFromText(searchable);
    const website = hint?.website || "";
    const key = `${name.toLowerCase()}|${price}|${billingCycle}`;

    if (keys.has(key)) {
      return;
    }

    keys.add(key);
    candidates.push({
      id: `gmail-${message.id}`,
      name,
      description: "Detected from Gmail receipts.",
      price,
      billingCycle,
      category,
      currency: "USD ($)",
      nextRenewalRaw: "",
      status: "active",
      website,
      logoUrl: "",
      logoFileName: "",
      sourceSnippet: message.snippet
    });
  });

  return candidates;
}

async function getInboxProfile(req) {
  const auth = getAuthorizedClient(req);
  if (!auth) {
    return { linked: false, email: "" };
  }

  const oauth2 = google.oauth2({ version: "v2", auth });
  const profile = await oauth2.userinfo.get();
  const email = profile.data.email || "";
  const store = getTokenStore(req);
  store.email = email;
  return { linked: true, email };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/session", (req, res) => {
  if (!req.session.account) {
    return res.json({
      authenticated: false,
      user: null,
      pricing: PREMIUM_PRICING,
      freeLimit: FREE_SUBSCRIPTION_LIMIT
    });
  }

  req.session.account = sanitizeUser(req.session.account);
  return res.json({
    authenticated: true,
    user: req.session.account,
    pricing: PREMIUM_PRICING,
    freeLimit: FREE_SUBSCRIPTION_LIMIT
  });
});

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "invalid_email", message: "Enter a valid email address." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "invalid_password", message: "Password must be at least 6 characters." });
  }

  const users = await readUsers();
  if (users.some((item) => item.email === email)) {
    return res.status(409).json({ error: "email_exists", message: "An account with this email already exists." });
  }

  const requestedName = String(req.body?.name || "").trim();
  const fallbackName = email.split("@")[0] || "SubTrack User";
  const name = requestedName.length >= 2 ? requestedName : fallbackName;

  const newUser = {
    id: `usr_${crypto.randomUUID()}`,
    name,
    email,
    passwordHash: hashPassword(password),
    planType: "free",
    premiumBillingCycle: null,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  await writeUsers(users);

  req.session.account = sanitizeUser(newUser);
  return res.status(201).json({
    authenticated: true,
    user: req.session.account,
    pricing: PREMIUM_PRICING,
    freeLimit: FREE_SUBSCRIPTION_LIMIT
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: "invalid_credentials", message: "Enter valid login credentials." });
  }

  const users = await readUsers();
  const userIndex = users.findIndex((item) => item.email === email);
  const user = userIndex >= 0 ? users[userIndex] : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "invalid_credentials", message: "Email or password is incorrect." });
  }

  const normalizedUser = withPlanDefaults(user);
  if (
    normalizedUser.planType !== user.planType ||
    normalizedUser.premiumBillingCycle !== user.premiumBillingCycle
  ) {
    users[userIndex] = normalizedUser;
    await writeUsers(users);
  }

  req.session.account = sanitizeUser(normalizedUser);
  return res.json({
    authenticated: true,
    user: req.session.account,
    pricing: PREMIUM_PRICING,
    freeLimit: FREE_SUBSCRIPTION_LIMIT
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.post("/api/account/upgrade", requireAuth, async (req, res) => {
  const billingCycle = req.body?.billingCycle === "yearly" ? "yearly" : req.body?.billingCycle === "monthly" ? "monthly" : null;
  if (!billingCycle) {
    return res.status(400).json({
      error: "invalid_billing_cycle",
      message: "Billing cycle must be monthly or yearly."
    });
  }

  const users = await readUsers();
  const userIndex = users.findIndex((item) => item.id === req.session.account.id);
  if (userIndex === -1) {
    return res.status(404).json({
      error: "user_not_found",
      message: "Account not found."
    });
  }

  users[userIndex] = {
    ...users[userIndex],
    planType: "premium",
    premiumBillingCycle: billingCycle,
    premiumStartedAt: new Date().toISOString()
  };
  await writeUsers(users);

  req.session.account = sanitizeUser(users[userIndex]);
  return res.json({
    ok: true,
    user: req.session.account,
    pricing: PREMIUM_PRICING,
    freeLimit: FREE_SUBSCRIPTION_LIMIT
  });
});

app.post("/api/account/lifetime", requireAuth, async (req, res) => {
  const users = await readUsers();
  const userIndex = users.findIndex((item) => item.id === req.session.account.id);
  if (userIndex === -1) {
    return res.status(404).json({
      error: "user_not_found",
      message: "Account not found."
    });
  }

  users[userIndex] = {
    ...users[userIndex],
    planType: "lifetime",
    premiumBillingCycle: null,
    lifetimeStartedAt: new Date().toISOString()
  };
  await writeUsers(users);

  req.session.account = sanitizeUser(users[userIndex]);
  return res.json({
    ok: true,
    user: req.session.account,
    pricing: PREMIUM_PRICING,
    freeLimit: FREE_SUBSCRIPTION_LIMIT
  });
});

app.get("/auth/google/start", requireAuth, (req, res) => {
  const origin = req.query.origin || frontendOrigin;
  const store = getTokenStore(req);
  store.returnOrigin = origin;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.readonly"
    ]
  });

  res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    if (!req.session.account) {
      return res.status(401).send("Please log in before linking Gmail.");
    }

    const code = req.query.code;
    if (!code) {
      throw new Error("Missing OAuth code.");
    }

    const { tokens } = await oauth2Client.getToken(code);
    const store = getTokenStore(req);
    store.tokens = tokens;

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const profile = await oauth2.userinfo.get();
    store.email = profile.data.email || "";

    const targetOrigin = store.returnOrigin || frontendOrigin;
    const safeOrigin = targetOrigin === "null" ? "*" : targetOrigin;

    res.type("html").send(`<!DOCTYPE html>
<html>
  <body>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: "subtrack-google-linked" }, ${JSON.stringify(safeOrigin)});
      }
      window.close();
    </script>
    You can close this window.
  </body>
</html>`);
  } catch (error) {
    res.status(500).json({
      error: "oauth_failed",
      message: error.message || "Unable to connect Gmail."
    });
  }
});

app.get("/api/inbox/status", requireAuth, async (req, res) => {
  try {
    const profile = await getInboxProfile(req);
    res.json(profile);
  } catch {
    const store = getTokenStore(req);
    store.tokens = null;
    store.email = "";
    res.json({ linked: false, email: "" });
  }
});

app.post("/api/inbox/unlink", requireAuth, (req, res) => {
  const store = getTokenStore(req);
  store.tokens = null;
  store.email = "";
  res.json({ ok: true });
});

app.post("/api/inbox/scan-live", requireAuth, async (req, res) => {
  try {
    const auth = getAuthorizedClient(req);
    if (!auth) {
      return res.status(401).json({ error: "not_linked", message: "Please link Gmail first." });
    }

    const maxResults = Math.min(Math.max(Number(req.body?.maxResults) || 20, 1), 50);
    const gmail = google.gmail({ version: "v1", auth });
    const listResult = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: "subject:(receipt OR invoice OR subscription OR payment) newer_than:365d -category:social"
    });

    const messageRefs = listResult.data.messages || [];
    if (!messageRefs.length) {
      return res.json({ candidates: [] });
    }

    const messageDetails = await Promise.all(
      messageRefs.map(async (messageRef) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: messageRef.id,
          format: "full"
        });

        const payload = detail.data.payload;
        const headers = payload?.headers || [];
        const subject = headers.find((item) => item.name?.toLowerCase() === "subject")?.value || "";
        const from = headers.find((item) => item.name?.toLowerCase() === "from")?.value || "";
        const snippet = detail.data.snippet || "";
        const body = getTextFromPayloadPart(payload);

        return {
          id: messageRef.id,
          subject,
          from,
          snippet,
          body
        };
      })
    );

    const candidates = parseCandidatesFromMessages(messageDetails);
    return res.json({ candidates });
  } catch (error) {
    return res.status(500).json({
      error: "scan_failed",
      message: error.message || "Unable to scan inbox receipts."
    });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/dashboard", (_req, res) => {
  res.sendFile(path.join(publicDir, "dashboard.html"));
});

app.get("/subscriptions", (_req, res) => {
  res.sendFile(path.join(publicDir, "subscriptions.html"));
});

app.listen(port, () => {
  console.log(`SubTrack API + site running on http://localhost:${port}`);
});
