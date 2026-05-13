import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BadgePercent,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════

const STATUS = { pending: "신청 전", active: "계약중", expired: "계약 만료" };

const DISCOUNT_TYPES = {
  none: "할인 없음",
  friend: "지인 할인",
  negotiation: "협상 할인",
  other: "기타 할인",
};

const CLIENTS_STORAGE_KEY = "lumi_bot_manager_clients";
const ACCOUNT_RECORDS_STORAGE_KEY = "lumi_bot_manager_account_records";
const ACCOUNT_DB_NAME = "lumi_desk_accounts";
const ACCOUNT_DB_VERSION = 1;
const ACCOUNT_DB_STORE = "account_records";
const SETTINGS_STORAGE_KEY = "lumi_bot_manager_settings";
const NOTIFICATION_STORAGE_KEY = "lumi_bot_manager_sent_notifications";
const AUTH_STORAGE_KEY = "lumi_bot_manager_auth";
const AUTH_SESSION_KEY = "lumi_bot_manager_session";

const AUTH_ID = "admin";
const AUTH_PASSWORD = "admin123";
const LOCK_MINUTES = 10;
const EXPIRY_NOTIFICATION_DAYS = [3, 2, 1, 0];
const DASHBOARD_TABS = { clients: "clients", accounts: "accounts" };

const ACCOUNT_FORMAT_LABELS = {
  four_part: "이메일 / 토큰 비밀번호 / 이메일 비밀번호 / 토큰",
  three_part: "이메일 / 토큰 비밀번호 / 토큰",
  two_part: "이메일 / 이메일 비밀번호",
  token_only: "토큰만",
  unknown: "직접 확인 필요",
};

const ACCOUNT_STATUS = {
  available: "사용 전",
  assigned: "고객 연결",
};

const ACCOUNT_INFO_FIELD_LABELS = {
  four_part: ["이메일", "토큰 비밀번호", "이메일 비밀번호", "토큰"],
  three_part: ["이메일", "토큰 비밀번호", "토큰"],
  two_part: ["이메일", "이메일 비밀번호"],
  token_only: ["토큰"],
};

const KNOWN_ACCOUNT_INFO_LABELS = new Set(
  Object.values(ACCOUNT_INFO_FIELD_LABELS).flat(),
);

const DEFAULT_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1502363881215889651/atAMoN9dOnAOZDgz2nim-ldtyuSgePim0h8v8nXIi4eBxVA_fRsWJ1obP50ILPQxY5uQ";

const spring = { type: "spring", stiffness: 280, damping: 26, mass: 0.8 };

const initialClients = [
  {
    id: "1",
    buyerId: "discord_user_001",
    botCount: 3,
    purchaseMonths: 1,
    paymentAmount: 45000,
    discountType: "friend",
    discountAmount: 5000,
    note: "재계약 가능성 높음. 5월 27일쯤 미리 연락.",
    promoText:
      "서버 홍보 멘트 예시입니다. 이벤트 진행 중이며 신규 유저 환영 문구와 서버 특징을 포함한 긴 홍보 문구를 여기에 저장할 수 있습니다.",
    startDate: "2026-05-01",
    endDate: "2026-05-30",
    status: "active",
  },
  {
    id: "2",
    buyerId: "client_lov3",
    botCount: 1,
    purchaseMonths: 2,
    paymentAmount: 80000,
    discountType: "negotiation",
    discountAmount: 10000,
    note: "초기 세팅 요청 대기 중. 멘트 수정 후 계약 전환 예정.",
    promoText:
      "계약 전 문의 고객입니다. 홍보봇 세팅 전이라 멘트 수정이 필요합니다.",
    startDate: "",
    endDate: "",
    status: "pending",
  },
  {
    id: "3",
    buyerId: "old_customer_07",
    botCount: 2,
    purchaseMonths: 1,
    paymentAmount: 35000,
    discountType: "none",
    discountAmount: 0,
    note: "지난달 이용 종료. 재유입 시 묶음 개월 제안.",
    promoText: "지난달 이용 고객입니다. 재계약 여부 확인 필요.",
    startDate: "2026-03-20",
    endDate: "2026-04-18",
    status: "expired",
  },
];

// ═══════════════════════════════════════════════════════════════
//  Utility functions
// ═══════════════════════════════════════════════════════════════

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getToday() {
  return formatLocalDate(new Date());
}

function formatCurrency(amount) {
  return `${Number(amount || 0).toLocaleString("ko-KR")}원`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculateEndDate(startDate, purchaseMonths) {
  const start = parseLocalDate(startDate);
  const months = Math.max(1, Number(purchaseMonths || 1));
  if (!start) return "";
  return formatLocalDate(addDays(start, months * 30 - 1));
}

function calculateCycleDueDate(startDate, cycleIndex) {
  const start = parseLocalDate(startDate);
  if (!start) return "";
  return formatLocalDate(addDays(start, cycleIndex * 30 - 1));
}

function daysLeft(endDate) {
  if (!endDate) return null;
  const today = parseLocalDate(getToday());
  const end = parseLocalDate(endDate);
  if (!today || !end) return null;
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function inferPurchaseMonths(client) {
  if (client.purchaseMonths) return Math.max(1, Number(client.purchaseMonths));
  const start = parseLocalDate(client.startDate);
  const end = parseLocalDate(client.endDate);
  if (!start || !end) return 1;
  const totalDays = Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
  return Math.max(1, Math.ceil(totalDays / 30));
}

function normalizeClient(client) {
  const purchaseMonths = inferPurchaseMonths(client);
  const startDate = client.startDate || "";
  const endDate = startDate ? calculateEndDate(startDate, purchaseMonths) : "";
  return {
    id: client.id ?? crypto.randomUUID(),
    buyerId: client.buyerId ?? "",
    botCount: Math.max(1, Number(client.botCount || 1)),
    purchaseMonths,
    paymentAmount: Math.max(0, Number(client.paymentAmount || 0)),
    discountType: client.discountType || "none",
    discountAmount: Math.max(0, Number(client.discountAmount || 0)),
    note: client.note ?? "",
    promoText: client.promoText ?? "",
    startDate,
    endDate,
    status: client.status ?? "pending",
  };
}

function getOriginalAmount(client) {
  return Number(client.paymentAmount || 0) + Number(client.discountAmount || 0);
}

function getMonthlyCharge(client) {
  const months = Math.max(1, Number(client.purchaseMonths || 1));
  return Math.round(Number(client.paymentAmount || 0) / months);
}

function hasDiscount(client) {
  return Number(client.discountAmount || 0) > 0 || client.discountType !== "none";
}

function detectAccountFormatFromValues(values) {
  if (values.length === 1) return "token_only";
  if (values.length === 2) return values[0].includes("@") ? "two_part" : "unknown";
  if (values.length === 3) return "three_part";
  if (values.length === 4) return "four_part";
  return "unknown";
}

function getAccountInfoLabels(values, format = detectAccountFormatFromValues(values)) {
  const configured = ACCOUNT_INFO_FIELD_LABELS[format];
  if (configured?.length === values.length) return configured;
  return values.map((_, index) => `항목 ${index + 1}`);
}

function parseAccountInfoSegments(value) {
  const text = String(value || "").trim();
  if (!text) return [];

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const labeledLines = lines
    .map((line) => {
      const match = line.match(/^([^:\n]+):\s*(.+)$/);
      if (!match) return null;
      return { label: match[1].trim(), value: match[2].trim() };
    })
    .filter(Boolean);

  const isStructuredSingleLine = labeledLines.length === 1
    && (KNOWN_ACCOUNT_INFO_LABELS.has(labeledLines[0].label) || /^항목 \d+$/.test(labeledLines[0].label));

  if ((lines.length > 1 && labeledLines.length === lines.length) || isStructuredSingleLine) {
    return labeledLines.filter((item) => item.value);
  }

  const values = text.split(":").map((segment) => segment.trim()).filter(Boolean);
  const labels = getAccountInfoLabels(values);
  return values.map((segment, index) => ({ label: labels[index], value: segment }));
}

function detectAccountFormat(maskedHint) {
  const segments = parseAccountInfoSegments(maskedHint);
  return detectAccountFormatFromValues(segments.map((segment) => segment.value));
}

function formatAccountInfoForStorage(value) {
  const segments = parseAccountInfoSegments(value);
  if (segments.length === 0) return "";
  return segments.map((segment) => `${segment.label}: ${segment.value}`).join("\n");
}

function formatAccountInfoCompact(value) {
  const segments = parseAccountInfoSegments(value);
  if (segments.length === 0) return "";
  return segments.map((segment) => segment.value).join(":");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("이미지 파일을 읽는 중 오류가 발생했습니다."));
    reader.readAsDataURL(file);
  });
}

function emptyAccountForm() {
  return {
    status: "available",
    clientId: "",
    promoterName: "",
    profileImageUrl: "",
    vaultReference: "",
    maskedHint: "",
    note: "",
  };
}

function normalizeAccountRecord(record) {
  const maskedHint = formatAccountInfoForStorage(record.maskedHint);
  const detectedFormat = detectAccountFormat(maskedHint);
  return {
    id: record.id ?? crypto.randomUUID(),
    status: record.status === "assigned" ? "assigned" : "available",
    clientId: String(record.clientId || "").trim(),
    promoterName: String(record.promoterName || "").trim(),
    profileImageUrl: String(record.profileImageUrl || "").trim(),
    vaultReference: String(record.vaultReference || "").trim(),
    maskedHint,
    note: String(record.note || "").trim(),
    detectedFormat,
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

async function copyText(value) {
  const text = String(value || "").trim();
  if (!text) throw new Error("복사할 내용이 없습니다.");
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document === "undefined") {
    throw new Error("이 환경에서는 복사를 지원하지 않습니다.");
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function openAccountRecordDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("이 브라우저에서는 계정 기록 저장소를 사용할 수 없습니다."));
      return;
    }
    const request = indexedDB.open(ACCOUNT_DB_NAME, ACCOUNT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ACCOUNT_DB_STORE)) {
        db.createObjectStore(ACCOUNT_DB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("계정 기록 저장소를 여는 중 오류가 발생했습니다."));
  });
}

function getLegacySavedAccountRecords() {
  try {
    const saved = localStorage.getItem(ACCOUNT_RECORDS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.map(normalizeAccountRecord);
  } catch {
    return [];
  }
}

async function getSavedAccountRecords() {
  if (typeof indexedDB === "undefined") return getLegacySavedAccountRecords();
  const db = await openAccountRecordDb();
  try {
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(ACCOUNT_DB_STORE, "readonly");
      const request = tx.objectStore(ACCOUNT_DB_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error("계정 기록을 불러오는 중 오류가 발생했습니다."));
    });
    const normalized = records.map(normalizeAccountRecord);
    if (normalized.length > 0) return normalized;

    const legacy = getLegacySavedAccountRecords();
    if (legacy.length > 0) {
      await saveAccountRecords(legacy);
      try {
        localStorage.removeItem(ACCOUNT_RECORDS_STORAGE_KEY);
      } catch {
        // Ignore localStorage cleanup failures after migration.
      }
    }
    return legacy;
  } finally {
    db.close();
  }
}

async function saveAccountRecords(records) {
  const normalized = records.map(normalizeAccountRecord);
  if (typeof indexedDB === "undefined") {
    localStorage.setItem(ACCOUNT_RECORDS_STORAGE_KEY, JSON.stringify(normalized));
    return;
  }
  const db = await openAccountRecordDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ACCOUNT_DB_STORE, "readwrite");
      const store = tx.objectStore(ACCOUNT_DB_STORE);
      const clearRequest = store.clear();
      clearRequest.onerror = () => reject(new Error("기존 계정 기록을 정리하는 중 오류가 발생했습니다."));
      clearRequest.onsuccess = () => {
        normalized.forEach((record) => store.put(record));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("계정 기록 저장에 실패했습니다."));
      tx.onabort = () => reject(new Error("계정 기록 저장이 중단되었습니다."));
    });
    try {
      localStorage.removeItem(ACCOUNT_RECORDS_STORAGE_KEY);
    } catch {
      // Ignore localStorage cleanup failures after successful IndexedDB save.
    }
  } finally {
    db.close();
  }
}

// ═══════════════════════════════════════════════════════════════
//  Storage helpers
// ═══════════════════════════════════════════════════════════════

function getSavedClients() {
  try {
    const saved = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : initialClients;
    return parsed.map(normalizeClient);
  } catch {
    return initialClients.map(normalizeClient);
  }
}

function saveClients(clients) {
  localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients.map(normalizeClient)));
}

function getSavedSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return { webhookUrl: parsed.webhookUrl || DEFAULT_WEBHOOK_URL };
  } catch {
    return { webhookUrl: DEFAULT_WEBHOOK_URL };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function getSavedNotificationLog() {
  try {
    const saved = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveNotificationLog(log) {
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(log));
}

function getSavedAuthState() {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return { failedAttempts: Number(parsed.failedAttempts || 0), lockUntil: Number(parsed.lockUntil || 0) };
  } catch {
    return { failedAttempts: 0, lockUntil: 0 };
  }
}

function saveAuthState(state) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

function getSavedSession() {
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === "authenticated";
  } catch {
    return false;
  }
}

function setSavedSession(ok) {
  if (ok) sessionStorage.setItem(AUTH_SESSION_KEY, "authenticated");
  else sessionStorage.removeItem(AUTH_SESSION_KEY);
}

function isLocked(authState) {
  return Number(authState.lockUntil || 0) > Date.now();
}

function getRemainingLockMs(authState) {
  return Math.max(0, Number(authState.lockUntil || 0) - Date.now());
}

function formatRemainingLock(authState) {
  const remaining = getRemainingLockMs(authState);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
//  Webhook helpers
// ═══════════════════════════════════════════════════════════════

function buildNotificationItems(clients) {
  const today = getToday();
  const items = [];
  clients.forEach((client) => {
    if (client.displayStatus !== "active" || !client.startDate || !client.endDate) return;
    for (let cycle = 1; cycle <= client.purchaseMonths; cycle++) {
      const dueDate = calculateCycleDueDate(client.startDate, cycle);
      if (dueDate === today) {
        items.push({ key: `${client.id}:billing:${dueDate}:${cycle}`, type: "billing", cycle, client });
      }
    }
    if (EXPIRY_NOTIFICATION_DAYS.includes(client.left)) {
      items.push({
        key: `${client.id}:expiry:${client.endDate}:${client.left}`,
        type: "expiry",
        daysRemaining: client.left,
        client,
      });
    }
  });
  return items;
}

function createWebhookPayload(item) {
  const { client } = item;
  const monthlyCharge = getMonthlyCharge(client);
  const billingDueDate = item.type === "billing" ? calculateCycleDueDate(client.startDate, item.cycle) : "";
  const discountText = hasDiscount(client)
    ? `${DISCOUNT_TYPES[client.discountType] || "할인"} · ${formatCurrency(client.discountAmount)}`
    : "할인 없음";

  if (item.type === "billing") {
    return {
      content: `30일 결제일 알림입니다. ${client.buyerId} 고객 계약을 확인하세요.`,
      embeds: [{
        title: "30일 결제일 도래",
        color: 0x8b5cf6,
        fields: [
          { name: "구매자", value: client.buyerId, inline: true },
          { name: "봇 수", value: `${client.botCount}개`, inline: true },
          { name: "진행 회차", value: `${item.cycle} / ${client.purchaseMonths}개월`, inline: true },
          { name: "실결제 금액", value: formatCurrency(client.paymentAmount), inline: true },
          { name: "월 기준 금액", value: formatCurrency(monthlyCharge), inline: true },
          { name: "정가", value: formatCurrency(getOriginalAmount(client)), inline: true },
          { name: "할인", value: discountText, inline: false },
          { name: "결제일", value: billingDueDate, inline: true },
          { name: "계약 기간", value: `${client.startDate} ~ ${client.endDate}`, inline: true },
          { name: "비고", value: client.note || "비고 없음", inline: false },
        ],
        footer: { text: "LumiDesk 자동 결제 알림" },
        timestamp: new Date().toISOString(),
      }],
    };
  }

  const expiryLabel = item.daysRemaining === 0 ? "당일" : `${item.daysRemaining}일 전`;

  return {
    content: `계약 만료 ${expiryLabel} 알림입니다. ${client.buyerId} 고객 계약 갱신 여부를 확인하세요.`,
    embeds: [{
      title: `계약 만료 ${expiryLabel} 알림`,
      color: 0xf59e0b,
      fields: [
        { name: "구매자", value: client.buyerId, inline: true },
        { name: "봇 수", value: `${client.botCount}개`, inline: true },
        { name: "계약 개월 수", value: `${client.purchaseMonths}개월`, inline: true },
        { name: "실결제 금액", value: formatCurrency(client.paymentAmount), inline: true },
        { name: "할인", value: discountText, inline: true },
        { name: "만료일", value: client.endDate, inline: true },
        { name: "계약 기간", value: `${client.startDate} ~ ${client.endDate}`, inline: false },
        { name: "비고", value: client.note || "비고 없음", inline: false },
      ],
      footer: { text: "LumiDesk 자동 만료 알림" },
      timestamp: new Date().toISOString(),
    }],
  };
}

function createTestWebhookPayload() {
  return {
    content: "LumiDesk 테스트 알림입니다.",
    embeds: [{
      title: "디스코드 웹훅 연결 확인",
      color: 0x8b5cf6,
      description: "웹훅 설정이 정상적으로 연결되었습니다. 실제 운용 시에는 30일 결제일과 만료 3일/2일/1일 전, 그리고 당일에 자동 알림이 전송됩니다.",
      footer: { text: "LumiDesk 테스트 메시지" },
      timestamp: new Date().toISOString(),
    }],
  };
}

function emptyForm() {
  return {
    buyerId: "", botCount: 1, purchaseMonths: 1, paymentAmount: "",
    discountType: "none", discountAmount: "", note: "", promoText: "",
    startDate: "", endDate: "", status: "pending",
  };
}

function buildClientPayload(form) {
  const purchaseMonths = Math.max(1, Number(form.purchaseMonths || 1));
  const paymentAmount = Math.max(0, Number(form.paymentAmount || 0));
  const discountAmount = Math.max(0, Number(form.discountAmount || 0));
  const startDate = form.startDate || "";
  return {
    buyerId: form.buyerId.trim(),
    botCount: Math.max(1, Number(form.botCount || 1)),
    purchaseMonths,
    paymentAmount,
    discountType: form.discountType || "none",
    discountAmount,
    note: form.note.trim(),
    promoText: form.promoText.trim(),
    startDate,
    endDate: startDate ? calculateEndDate(startDate, purchaseMonths) : "",
    status: form.status,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Main App
// ═══════════════════════════════════════════════════════════════

export default function LumiBotManagerApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(getSavedSession);
  const [authState, setAuthState] = useState(getSavedAuthState);
  const [loginForm, setLoginForm] = useState({ userId: "", password: "" });
  const [loginMessage, setLoginMessage] = useState("관리자 전용 서비스입니다.");
  const [, setLockTick] = useState(0);

  const [clients, setClients] = useState(getSavedClients);
  const [accountRecords, setAccountRecords] = useState([]);
  const [settings, setSettings] = useState(getSavedSettings);
  const [activeTab, setActiveTab] = useState(DASHBOARD_TABS.clients);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkedAccountsClientId, setLinkedAccountsClientId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [accountForm, setAccountForm] = useState(emptyAccountForm());
  const [accountFormMessage, setAccountFormMessage] = useState("");
  const [notice, setNotice] = useState("웹훅이 연결되면 1분마다 결제일과 만료 3일/2일/1일 전 및 당일 알림을 확인합니다.");

  const sentNotificationsRef = useRef(getSavedNotificationLog());
  const notificationLockRef = useRef(false);

  useEffect(() => {
    if (!isLocked(authState)) return undefined;
    const id = window.setInterval(() => setLockTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [authState]);

  useEffect(() => {
    let cancelled = false;
    getSavedAccountRecords()
      .then((records) => {
        if (!cancelled) setAccountRecords(records);
      })
      .catch(() => {
        if (!cancelled) setAccountRecords(getLegacySavedAccountRecords());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedClients = useMemo(() => {
    return clients.map((client) => {
      const normalized = normalizeClient(client);
      const left = daysLeft(normalized.endDate);
      const autoExpired = normalized.status === "active" && left !== null && left < 0;
      return { ...normalized, displayStatus: autoExpired ? "expired" : normalized.status, left };
    });
  }, [clients]);

  const filteredClients = useMemo(() => {
    return normalizedClients.filter((client) => {
      const q = query.toLowerCase();
      const matchesQuery =
        client.buyerId.toLowerCase().includes(q) ||
        client.promoText.toLowerCase().includes(q) ||
        client.note.toLowerCase().includes(q);
      const matchesFilter = filter === "all" || client.displayStatus === filter;
      return matchesQuery && matchesFilter;
    });
  }, [normalizedClients, query, filter]);

  const filteredAccountRecords = useMemo(() => {
    return accountRecords.filter((record) => {
      const q = query.toLowerCase();
      if (!q) return true;
      return [
        ACCOUNT_STATUS[record.status],
        record.clientId,
        record.promoterName,
        record.vaultReference,
        record.maskedHint,
        record.note,
        ACCOUNT_FORMAT_LABELS[record.detectedFormat],
      ].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [accountRecords, query]);

  const linkedAccountsByBuyerId = useMemo(() => {
    return accountRecords.reduce((map, record) => {
      const buyerId = String(record.clientId || "").trim();
      if (!buyerId) return map;
      const current = map[buyerId] || [];
      map[buyerId] = [...current, record];
      return map;
    }, {});
  }, [accountRecords]);

  const linkedAccountsClient = useMemo(
    () => normalizedClients.find((client) => client.id === linkedAccountsClientId) || null,
    [linkedAccountsClientId, normalizedClients],
  );

  const linkedAccountsForModal = useMemo(() => {
    if (!linkedAccountsClient) return [];
    return linkedAccountsByBuyerId[linkedAccountsClient.buyerId] || [];
  }, [linkedAccountsByBuyerId, linkedAccountsClient]);

  const stats = useMemo(() => ({
    total: normalizedClients.length,
    active: normalizedClients.filter((c) => c.displayStatus === "active").length,
    pending: normalizedClients.filter((c) => c.displayStatus === "pending").length,
    expired: normalizedClients.filter((c) => c.displayStatus === "expired").length,
    bots: normalizedClients.reduce((sum, c) => sum + c.botCount, 0),
    revenue: normalizedClients.reduce((sum, c) => sum + c.paymentAmount, 0),
    discounted: normalizedClients.filter((c) => hasDiscount(c)).length,
  }), [normalizedClients]);

  const accountStats = useMemo(() => ({
    total: accountRecords.length,
    available: accountRecords.filter((record) => record.status === "available").length,
    linked: accountRecords.filter((record) => record.clientId).length,
    profiled: accountRecords.filter((record) => record.profileImageUrl).length,
    referenced: accountRecords.filter((record) => record.vaultReference).length,
    unknownFormat: accountRecords.filter((record) => record.detectedFormat === "unknown").length,
  }), [accountRecords]);

  const aiBrief = useMemo(() => {
    const expiringSoon = normalizedClients
      .filter((c) => c.displayStatus === "active" && c.left !== null && c.left <= 7)
      .sort((a, b) => a.left - b.left)
      .slice(0, 3);
    const pendingClients = normalizedClients.filter((c) => c.displayStatus === "pending");
    const discountClients = normalizedClients.filter((c) => hasDiscount(c)).slice(0, 3);
    return {
      expiringSoon,
      pendingClients,
      discountClients,
      message:
        expiringSoon.length > 0
          ? `${expiringSoon[0].buyerId} 고객이 가장 먼저 만료됩니다. (D-${expiringSoon[0].left})`
          : "가까운 만료 계약이 없습니다.",
    };
  }, [normalizedClients]);

  const accountNotice =
    notice.includes("계정") || notice.includes("원문")
      ? notice
      : "토큰, 비밀번호, 외부 보관 참조를 함께 저장합니다.";

  function persist(nextClients) {
    const normalized = nextClients.map(normalizeClient);
    setClients(normalized);
    saveClients(normalized);
  }

  async function persistAccounts(nextRecords) {
    const normalized = nextRecords.map(normalizeAccountRecord);
    setAccountRecords(normalized);
    await saveAccountRecords(normalized);
  }

  function updateForm(patch) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      const months = Math.max(1, Number(next.purchaseMonths || 1));
      next.endDate = next.startDate ? calculateEndDate(next.startDate, months) : "";
      return next;
    });
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEditForm(client) {
    setEditingId(client.id);
    setForm({
      buyerId: client.buyerId, botCount: client.botCount,
      purchaseMonths: client.purchaseMonths, paymentAmount: client.paymentAmount,
      discountType: client.discountType, discountAmount: client.discountAmount,
      note: client.note, promoText: client.promoText,
      startDate: client.startDate, endDate: client.endDate, status: client.status,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function openCreateAccountForm() {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm());
    setAccountFormMessage("");
    setAccountFormOpen(true);
  }

  function openEditAccountForm(record) {
    setEditingAccountId(record.id);
    setAccountForm({
      status: record.status,
      clientId: record.clientId,
      promoterName: record.promoterName,
      profileImageUrl: record.profileImageUrl,
      vaultReference: record.vaultReference,
      maskedHint: record.maskedHint,
      note: record.note,
    });
    setAccountFormMessage("");
    setAccountFormOpen(true);
  }

  function closeAccountForm() {
    setAccountFormOpen(false);
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm());
    setAccountFormMessage("");
  }

  async function handleAccountImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAccountFormMessage("이미지 파일만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAccountFormMessage("이미지는 2MB 이하 파일로 업로드해 주세요.");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAccountForm((prev) => ({ ...prev, profileImageUrl: dataUrl }));
      setAccountFormMessage("프로필 이미지를 업로드했습니다.");
    } catch (error) {
      setAccountFormMessage(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      event.target.value = "";
    }
  }

  function submitForm(event) {
    event.preventDefault();
    const payload = buildClientPayload(form);
    if (!payload.buyerId) return;
    if (editingId) {
      persist(clients.map((c) => (c.id === editingId ? { ...c, ...payload } : c)));
    } else {
      persist([{ id: crypto.randomUUID(), ...payload }, ...clients]);
    }
    closeForm();
  }

  async function submitAccountForm(event) {
    event.preventDefault();
    const payload = normalizeAccountRecord({
      ...accountForm,
      id: editingAccountId ?? crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    });
    if (!payload.promoterName) {
      setAccountFormMessage("홍보 계정 표시명을 입력해 주세요.");
      return;
    }
    if (payload.status === "assigned" && !payload.clientId) {
      setAccountFormMessage("고객에게 연결된 계정은 고객 아이디를 함께 입력해 주세요.");
      return;
    }
    try {
      if (editingAccountId) {
        await persistAccounts(accountRecords.map((record) => (record.id === editingAccountId ? payload : record)));
      } else {
        await persistAccounts([payload, ...accountRecords]);
      }
      setNotice("계정 정보를 보기 좋게 정리해 저장했습니다. 카드에서 전체 복사와 항목별 복사가 가능합니다.");
      closeAccountForm();
    } catch (error) {
      setAccountFormMessage(error instanceof Error ? error.message : "계정 기록 저장에 실패했습니다.");
    }
  }

  async function handleCopyAccountInfo(value, label) {
    try {
      await copyText(value);
      setNotice(`${label} 복사를 완료했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "복사에 실패했습니다.");
    }
  }

  function openLinkedAccountsModal(client) {
    setLinkedAccountsClientId(client.id);
  }

  function closeLinkedAccountsModal() {
    setLinkedAccountsClientId(null);
  }

  function openAccountsTabForClient(client) {
    setActiveTab(DASHBOARD_TABS.accounts);
    setQuery(client.buyerId);
    closeLinkedAccountsModal();
  }

  function deleteClient(id) {
    persist(clients.filter((c) => c.id !== id));
  }

  function deleteAccountRecord(id) {
    persistAccounts(accountRecords.filter((record) => record.id !== id))
      .then(() => setNotice("계정 참조 기록을 삭제했습니다."))
      .catch((error) => setNotice(error instanceof Error ? error.message : "계정 기록 삭제에 실패했습니다."));
  }

  function toggleExpanded(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function setQuickDates(months = 1) {
    updateForm({ startDate: getToday(), purchaseMonths: Math.max(1, Number(months || form.purchaseMonths || 1)), status: "active" });
  }

  function logout() {
    setSavedSession(false);
    setIsAuthenticated(false);
    setLoginForm({ userId: "", password: "" });
    setLoginMessage("로그아웃되었습니다.");
  }

  function handleQuickAdd() {
    if (activeTab === DASHBOARD_TABS.accounts) {
      openCreateAccountForm();
      return;
    }
    openCreateForm();
  }

  function handleLogin(event) {
    event.preventDefault();
    if (isLocked(authState)) {
      setLoginMessage(`잠금 해제까지 ${formatRemainingLock(authState)} 남았습니다.`);
      return;
    }
    if (loginForm.userId === AUTH_ID && loginForm.password === AUTH_PASSWORD) {
      const cleared = { failedAttempts: 0, lockUntil: 0 };
      saveAuthState(cleared);
      setAuthState(cleared);
      setSavedSession(true);
      setIsAuthenticated(true);
      setLoginMessage("관리자 전용 서비스입니다.");
      return;
    }
    const nextAttempts = Number(authState.failedAttempts || 0) + 1;
    if (nextAttempts >= 3) {
      const lockedState = { failedAttempts: 0, lockUntil: Date.now() + LOCK_MINUTES * 60 * 1000 };
      saveAuthState(lockedState);
      setAuthState(lockedState);
      setLoginMessage(`3회 실패로 ${LOCK_MINUTES}분 동안 잠금되었습니다.`);
      return;
    }
    const nextState = { failedAttempts: nextAttempts, lockUntil: 0 };
    saveAuthState(nextState);
    setAuthState(nextState);
    setLoginMessage(`로그인 실패. ${3 - nextAttempts}회 남았습니다.`);
  }

  const postWebhook = useCallback(async (payload) => {
    const response = await fetch("/api/discord-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: settings.webhookUrl, payload }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "웹훅 전송에 실패했습니다.");
    }
  }, [settings.webhookUrl]);

  async function sendTestWebhook() {
    try {
      if (!settings.webhookUrl.trim()) { setNotice("웹훅 URL을 먼저 입력하세요."); return; }
      await postWebhook(createTestWebhookPayload());
      setNotice("테스트 알림을 전송했습니다. 디스코드 채널을 확인해 주세요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "테스트 알림 전송에 실패했습니다.");
    }
  }

  useEffect(() => { saveSettings(settings); }, [settings]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    async function runNotificationCheck() {
      if (notificationLockRef.current || !settings.webhookUrl.trim()) return;
      const dueItems = buildNotificationItems(normalizedClients);
      if (dueItems.length === 0) return;
      notificationLockRef.current = true;
      try {
        let sentCount = 0;
        for (const item of dueItems) {
          if (sentNotificationsRef.current[item.key]) continue;
          await postWebhook(createWebhookPayload(item));
          sentNotificationsRef.current = { ...sentNotificationsRef.current, [item.key]: new Date().toISOString() };
          saveNotificationLog(sentNotificationsRef.current);
          sentCount++;
        }
        if (sentCount > 0) setNotice(`자동 알림 ${sentCount}건을 디스코드로 전송했습니다.`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "자동 알림 전송에 실패했습니다.");
      } finally {
        notificationLockRef.current = false;
      }
    }
    runNotificationCheck();
    const id = window.setInterval(runNotificationCheck, 60 * 1000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, normalizedClients, postWebhook, settings.webhookUrl]);

  // ─── Login ─────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div
        className="relative flex min-h-screen items-center justify-center px-4"
        style={{
          background: "#04060d",
          backgroundImage:
            "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 90%, rgba(99,102,241,0.1) 0%, transparent 50%)",
        }}
      >
        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Glow backdrop */}
          <div
            className="absolute -inset-px rounded-3xl"
            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.15), transparent 60%)" }}
          />

          <div
            className="relative rounded-3xl border border-white/[0.08] p-7"
            style={{ background: "rgba(10,14,26,0.95)", backdropFilter: "blur(24px)" }}
          >
            {/* Logo */}
            <div className="mb-7 flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.2))",
                  border: "1px solid rgba(139,92,246,0.3)",
                  boxShadow: "0 0 20px rgba(139,92,246,0.2)",
                }}
              >
                <Shield size={20} className="text-violet-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-400/70">Private Access</p>
                <h1 className="text-xl font-black text-white">LumiDesk Manager</h1>
              </div>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-slate-400">
              3회 연속 로그인 실패 시 {LOCK_MINUTES}분 동안 접근이 잠깁니다.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <LoginField label="아이디" icon={<KeyRound size={15} />}>
                <input
                  value={loginForm.userId}
                  onChange={(e) => setLoginForm((p) => ({ ...p, userId: e.target.value }))}
                  className="input pl-10"
                  placeholder="admin"
                  autoComplete="username"
                />
              </LoginField>

              <LoginField label="비밀번호" icon={<Lock size={15} />}>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                  className="input pl-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </LoginField>

              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: isLocked(authState) ? "#fca5a5" : "#94a3b8",
                }}
              >
                {isLocked(authState) ? `잠금 해제까지 ${formatRemainingLock(authState)} 남았습니다.` : loginMessage}
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-sm font-bold"
                disabled={isLocked(authState)}
              >
                관리자 로그인
              </Button>
            </form>
          </div>
        </motion.div>

        <style>{inputStyle}</style>
      </div>
    );
  }

  // ─── Main Dashboard ─────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#04060d",
        backgroundImage:
          "radial-gradient(ellipse 100% 50% at 50% -5%, rgba(139,92,246,0.1) 0%, transparent 55%), radial-gradient(ellipse 50% 30% at 90% 80%, rgba(99,102,241,0.06) 0%, transparent 50%)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-white/[0.05]"
        style={{ background: "rgba(4,6,13,0.85)", backdropFilter: "blur(20px)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.2))",
                border: "1px solid rgba(139,92,246,0.3)",
              }}
            >
              <Zap size={16} className="text-violet-300" />
            </div>
            <div>
              <span
                className="text-base font-black"
                style={{
                  background: "linear-gradient(90deg, #a78bfa, #818cf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                LumiDesk
              </span>
              <span className="ml-1.5 text-base font-black text-white">Manager</span>
            </div>
            <span
              className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
            >
              Private
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-500 sm:block">오늘 {getToday()}</span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] text-slate-400 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-slate-200"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={handleQuickAdd}
              className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white transition"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: "0 0 16px rgba(139,92,246,0.3)",
              }}
            >
              <Plus size={15} /> {activeTab === DASHBOARD_TABS.accounts ? "계정 추가" : "추가"}
            </button>
            <button
              onClick={logout}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.07] px-3 text-sm font-semibold text-slate-400 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-slate-200"
            >
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-5 py-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex rounded-2xl border border-white/[0.07] bg-black/20 p-1.5">
            {[
              [DASHBOARD_TABS.clients, "계약 관리"],
              [DASHBOARD_TABS.accounts, "계정 정리"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="relative rounded-xl px-4 py-2 text-sm font-semibold transition"
              >
                {activeTab === key && (
                  <motion.span
                    layoutId="dashboard-tab"
                    transition={spring}
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "rgba(139,92,246,0.22)", border: "1px solid rgba(139,92,246,0.3)" }}
                  />
                )}
                <span className={`relative z-10 ${activeTab === key ? "text-violet-100" : "text-slate-400"}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            {activeTab === DASHBOARD_TABS.accounts
              ? "토큰, 비밀번호, 외부 보관 참조를 한곳에서 정리합니다."
              : "구매자 계약, 알림, 일정 상태를 한 화면에서 관리합니다."}
          </div>
        </div>

        {activeTab === DASHBOARD_TABS.clients ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <StatChip label="전체" value={stats.total} icon={<Users size={14} />} color="violet" span={1} />
              <StatChip label="계약중" value={stats.active} icon={<span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />} color="emerald" span={1} />
              <StatChip label="신청 전" value={stats.pending} icon={<span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />} color="amber" span={1} />
              <StatChip label="만료" value={stats.expired} icon={<span className="h-2 w-2 rounded-full bg-slate-500" />} color="slate" span={1} />
              <StatChip label="총 봇" value={`${stats.bots}개`} icon={<Bot size={14} />} color="indigo" span={1} />
              <StatChip label="총 결제" value={formatCurrency(stats.revenue)} icon={<Wallet size={14} />} color="violet" span={1} className="col-span-2 sm:col-span-1 lg:col-span-2" />
            </div>

            <div
              className="rounded-2xl border border-white/[0.07] p-5"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(4,6,13,0.8) 60%)",
                borderColor: "rgba(139,92,246,0.15)",
              }}
            >
              <div className="mb-4 flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)" }}
                >
                  <Sparkles size={14} className="text-violet-300" />
                </div>
                <span className="text-sm font-bold text-violet-200">AI 브리핑</span>
              </div>
              <p className="mb-4 text-base font-semibold text-white">{aiBrief.message}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <InsightChip
                  icon={<AlertCircle size={14} />}
                  label="곧 만료"
                  value={
                    aiBrief.expiringSoon.length
                      ? aiBrief.expiringSoon.map((c) => `${c.buyerId} D-${c.left}`).join(", ")
                      : "없음"
                  }
                  color="rose"
                />
                <InsightChip
                  icon={<Clock3 size={14} />}
                  label="신청 전"
                  value={aiBrief.pendingClients.length ? `${aiBrief.pendingClients.length}건 후속 필요` : "없음"}
                  color="amber"
                />
                <InsightChip
                  icon={<BadgePercent size={14} />}
                  label="할인 계약"
                  value={aiBrief.discountClients.length ? `${aiBrief.discountClients.length}건 관리 중` : "없음"}
                  color="violet"
                />
              </div>
            </div>

            <div
              className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] p-4 sm:flex-row sm:items-center"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="구매자 아이디, 홍보 멘트, 비고 검색..."
                  className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.04] pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10"
                />
              </div>

              <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
                {[["all", "전체"], ["pending", "신청 전"], ["active", "계약중"], ["expired", "만료"]].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className="relative rounded-lg px-3.5 py-1.5 text-xs font-semibold transition"
                  >
                    {filter === key && (
                      <motion.span
                        layoutId="filter-indicator"
                        transition={spring}
                        className="absolute inset-0 rounded-lg"
                        style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)" }}
                      />
                    )}
                    <span className={`relative z-10 ${filter === key ? "text-violet-200" : "text-slate-400"}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="hidden items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-500 sm:flex">
                진행중 <span className="font-bold text-emerald-400">{stats.active}</span>건
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] px-4 py-2.5 text-xs text-slate-400" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
              {notice}
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/[0.07]" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div
                className="hidden grid-cols-[1.1fr_.4fr_.5fr_.95fr_1fr_.8fr_.65fr] gap-3 border-b border-white/[0.05] px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500 md:grid"
              >
                <div>구매자</div>
                <div>봇</div>
                <div>개월</div>
                <div>결제 / 할인</div>
                <div>계약 기간</div>
                <div>상태</div>
                <div className="text-right">관리</div>
              </div>

              <div className="divide-y divide-white/[0.04]">
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredClients.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-16 text-center"
                    >
                      <div
                        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] text-slate-600"
                        style={{ background: "rgba(255,255,255,0.03)" }}
                      >
                        <Search size={22} />
                      </div>
                      <p className="font-bold text-slate-300">검색 결과가 없습니다</p>
                      <p className="mt-1 text-sm text-slate-600">다른 키워드로 검색하거나 새 구매자를 추가하세요.</p>
                    </motion.div>
                  ) : (
                    filteredClients.map((client) => (
                      <ClientRow
                        key={client.id}
                        client={client}
                        linkedAccountCount={(linkedAccountsByBuyerId[client.buyerId] || []).length}
                        isExpanded={!!expanded[client.id]}
                        onOpenLinkedAccounts={() => openLinkedAccountsModal(client)}
                        onToggle={() => toggleExpanded(client.id)}
                        onEdit={() => openEditForm(client)}
                        onDelete={() => deleteClient(client.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatChip label="전체 기록" value={accountStats.total} icon={<Shield size={14} />} color="violet" />
              <StatChip label="사용 전" value={accountStats.available} icon={<span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />} color="slate" />
              <StatChip label="고객 연결" value={accountStats.linked} icon={<Users size={14} />} color="indigo" />
              <StatChip label="프로필 연결" value={accountStats.profiled} icon={<span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />} color="slate" />
              <StatChip label="보관 참조" value={accountStats.referenced} icon={<Link2 size={14} />} color="emerald" />
              <StatChip label="형식 확인 필요" value={accountStats.unknownFormat} icon={<AlertCircle size={14} />} color="amber" className="col-span-2 sm:col-span-1" />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <div
                className="rounded-2xl border border-white/[0.07] p-5"
                style={{
                  background: "linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(4,6,13,0.84) 58%)",
                  borderColor: "rgba(56,189,248,0.16)",
                }}
              >
                <div className="mb-4 flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)" }}
                  >
                    <Shield size={15} className="text-sky-300" />
                  </div>
                  <span className="text-sm font-bold text-sky-100">계정 정리 가이드</span>
                </div>
                <p className="text-base font-semibold text-white">원문 토큰, 비밀번호, 외부 금고 참조를 이 앱에 함께 저장할 수 있습니다.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InsightChip icon={<Link2 size={14} />} label="외부 금고 참조" value="1Password / Bitwarden 항목 ID나 링크만 보관" color="violet" />
                  <InsightChip icon={<MessageSquare size={14} />} label="계정 정보" value="예: user@site.com:token-pass:mail-pass:tok_xxxx" color="amber" />
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">자동 분류 형식</div>
                <div className="space-y-2 text-sm text-slate-300">
                  {Object.entries(ACCOUNT_FORMAT_LABELS).filter(([key]) => key !== "unknown").map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <span>{label}</span>
                      <span className="text-xs text-slate-500">{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] p-4 sm:flex-row sm:items-center"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="고객, 홍보 계정명, 보관 참조 ID, 메모 검색..."
                  className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.04] pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10"
                />
              </div>

              <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.06] px-3.5 py-2 text-xs text-sky-100">
                토큰/비밀번호 저장 가능
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] px-4 py-2.5 text-xs text-slate-400" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              {accountNotice}
            </div>

            <div className="grid gap-4">
              <AnimatePresence initial={false}>
                {filteredAccountRecords.length === 0 ? (
                  <motion.div
                    key="account-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-16 text-center"
                  >
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] text-slate-600" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <Shield size={22} />
                    </div>
                    <p className="font-bold text-slate-300">아직 정리된 계정 기록이 없습니다</p>
                    <p className="mt-1 text-sm text-slate-600">우측 상단의 계정 추가 버튼으로 안전한 참조 기록부터 만들어보세요.</p>
                  </motion.div>
                ) : (
                  filteredAccountRecords.map((record) => (
                    <AccountRecordCard
                      key={record.id}
                      record={record}
                      onEdit={() => openEditAccountForm(record)}
                      onDelete={() => deleteAccountRecord(record.id)}
                      onCopy={handleCopyAccountInfo}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>

      {/* Form modal */}
      <AnimatePresence>
        {linkedAccountsClient && (
          <Overlay onClose={closeLinkedAccountsModal}>
            <motion.div
              transition={spring}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="w-full max-w-4xl rounded-3xl border border-white/[0.08] p-6 shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
              style={{ background: "rgba(8,12,22,0.98)", backdropFilter: "blur(32px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader
                title={`${linkedAccountsClient.buyerId} 연결 계정`}
                description="계약 관리 화면에서 연결된 계정 목록만 빠르게 확인합니다."
                onClose={closeLinkedAccountsModal}
              />

              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <SummaryBlock label="계약 상태" value={STATUS[linkedAccountsClient.displayStatus] || STATUS.pending} />
                <SummaryBlock label="등록된 봇 수" value={`${linkedAccountsClient.botCount}개`} />
                <SummaryBlock label="연결 계정 수" value={`${linkedAccountsForModal.length}개`} />
                <SummaryBlock
                  label="계약 기간"
                  value={linkedAccountsClient.startDate && linkedAccountsClient.endDate ? `${linkedAccountsClient.startDate} ~ ${linkedAccountsClient.endDate}` : "기간 미설정"}
                />
              </div>

              {linkedAccountsForModal.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] text-slate-600" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <Bot size={22} />
                  </div>
                  <p className="font-bold text-slate-300">연결된 계정이 아직 없습니다</p>
                  <p className="mt-1 text-sm text-slate-600">계정 정리 탭에서 이 고객 아이디로 계정을 연결하면 여기에서 바로 확인할 수 있습니다.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {linkedAccountsForModal.map((record) => (
                    <LinkedAccountSummaryCard key={record.id} record={record} />
                  ))}
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <Button
                  type="button"
                  onClick={() => openAccountsTabForClient(linkedAccountsClient)}
                  className="h-11 flex-1 rounded-xl text-sm"
                >
                  <Users size={15} className="mr-2" /> 계정 관리에서 이어서 보기
                </Button>
                <Button type="button" variant="outline" onClick={closeLinkedAccountsModal} className="h-11 rounded-xl px-5">
                  닫기
                </Button>
              </div>
            </motion.div>
          </Overlay>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {formOpen && (
          <Overlay onClose={closeForm}>
            <motion.form
              layout
              transition={spring}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              onSubmit={submitForm}
              className="w-full max-w-4xl rounded-3xl border border-white/[0.08] p-6 shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
              style={{ background: "rgba(8,12,22,0.98)", backdropFilter: "blur(32px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader
                title={editingId ? "구매자 수정" : "구매자 추가"}
                description="계약, 할인, 비고 정보를 함께 관리합니다."
                onClose={closeForm}
              />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <FormField label="구매자 아이디">
                  <input value={form.buyerId} onChange={(e) => updateForm({ buyerId: e.target.value })} className="input" placeholder="discord_user_123" />
                </FormField>
                <FormField label="봇 수">
                  <input type="number" min="1" value={form.botCount} onChange={(e) => updateForm({ botCount: e.target.value })} className="input" />
                </FormField>
                <FormField label="구매 개월 수">
                  <input type="number" min="1" value={form.purchaseMonths} onChange={(e) => updateForm({ purchaseMonths: e.target.value })} className="input" />
                </FormField>
                <FormField label="실결제 금액">
                  <input type="number" min="0" step="1000" value={form.paymentAmount} onChange={(e) => updateForm({ paymentAmount: e.target.value })} className="input" placeholder="90000" />
                </FormField>
                <FormField label="할인 유형">
                  <select value={form.discountType} onChange={(e) => updateForm({ discountType: e.target.value })} className="input">
                    {Object.entries(DISCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </FormField>
                <FormField label="할인 금액">
                  <input type="number" min="0" step="1000" value={form.discountAmount} onChange={(e) => updateForm({ discountAmount: e.target.value })} className="input" placeholder="5000" />
                </FormField>
                <FormField label="시작일">
                  <input type="date" value={form.startDate} onChange={(e) => updateForm({ startDate: e.target.value })} className="input" />
                </FormField>
                <FormField label="계약 상태">
                  <select value={form.status} onChange={(e) => updateForm({ status: e.target.value })} className="input">
                    <option value="pending">신청 전</option>
                    <option value="active">계약중</option>
                    <option value="expired">계약 만료</option>
                  </select>
                </FormField>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <FormField label="홍보 멘트">
                  <textarea value={form.promoText} onChange={(e) => updateForm({ promoText: e.target.value })} rows={4} className="input resize-none py-3" style={{ height: "auto" }} placeholder="홍보 멘트를 입력하세요." />
                </FormField>
                <FormField label="비고">
                  <textarea value={form.note} onChange={(e) => updateForm({ note: e.target.value })} rows={4} className="input resize-none py-3" style={{ height: "auto" }} placeholder="지인 할인 이유, 후속 연락 메모 등을 남기세요." />
                </FormField>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_.7fr]">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Auto Summary</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <SummaryBlock label="만료일" value={form.endDate || "—"} />
                    <SummaryBlock label="정가" value={formatCurrency(Number(form.paymentAmount || 0) + Number(form.discountAmount || 0))} />
                    <SummaryBlock label="월 기준" value={formatCurrency(Math.round(Number(form.paymentAmount || 0) / Math.max(1, Number(form.purchaseMonths || 1))))} />
                    <SummaryBlock label="총 기간" value={`${Math.max(1, Number(form.purchaseMonths || 1)) * 30}일`} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setQuickDates(form.purchaseMonths)}
                  className="group rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-5 py-4 text-left text-sm font-semibold text-violet-300 transition hover:border-violet-500/35 hover:bg-violet-500/[0.1]"
                >
                  <Zap size={16} className="mb-2 text-violet-400" />
                  오늘부터 {Math.max(1, Number(form.purchaseMonths || 1))}개월 계약으로 빠르게 설정
                </button>
              </div>

              <div className="mt-5 flex gap-2">
                <Button type="submit" className="h-11 flex-1 rounded-xl text-sm">
                  <Save size={16} className="mr-2" /> 저장하기
                </Button>
                <Button type="button" variant="outline" onClick={closeForm} className="h-11 rounded-xl px-5">
                  취소
                </Button>
              </div>
            </motion.form>
          </Overlay>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {accountFormOpen && (
          <Overlay onClose={closeAccountForm}>
            <motion.form
              layout
              transition={spring}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              onSubmit={submitAccountForm}
              className="w-full max-w-3xl rounded-3xl border border-white/[0.08] p-6 shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
              style={{ background: "rgba(8,12,22,0.98)", backdropFilter: "blur(32px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader
                title={editingAccountId ? "계정 기록 수정" : "계정 기록 추가"}
                description="토큰, 비밀번호, 외부 금고 참조를 함께 기록합니다."
                onClose={closeAccountForm}
              />

              <div className="mb-4 rounded-2xl border border-sky-500/15 bg-sky-500/[0.06] px-4 py-3 text-sm leading-relaxed text-sky-100">
                실제 토큰, 이메일 비밀번호, 토큰 비밀번호를 그대로 저장할 수 있습니다. `사용 전` 계정은 고객 없이 먼저 적재해둘 수 있고, 판매 후 `고객 연결`로 바꾸면서 고객 아이디를 붙이면 됩니다.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="계정 상태">
                  <select
                    value={accountForm.status}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="input"
                  >
                    {Object.entries(ACCOUNT_STATUS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="어떤 고객의 것인지">
                  <input
                    value={accountForm.clientId}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, clientId: e.target.value }))}
                    className="input"
                    placeholder={accountForm.status === "available" ? "사용 전 계정이면 비워도 됩니다" : "discord_user_123"}
                    list="client-buyer-ids"
                  />
                </FormField>
                <FormField label="홍보 계정 표시명">
                  <input
                    value={accountForm.promoterName}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, promoterName: e.target.value }))}
                    className="input"
                    placeholder="promo_worker_alpha"
                    required
                  />
                </FormField>
                <FormField label="프로필 이미지 업로드">
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                        {accountForm.profileImageUrl ? (
                          <img src={accountForm.profileImageUrl} alt="프로필 미리보기" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-500">미리보기</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <label className="inline-flex cursor-pointer items-center rounded-xl border border-violet-500/25 bg-violet-500/[0.08] px-3 py-2 text-sm font-semibold text-violet-200 transition hover:border-violet-500/40 hover:bg-violet-500/[0.14]">
                          파일 선택
                          <input type="file" accept="image/*" className="hidden" onChange={handleAccountImageUpload} />
                        </label>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                          JPG, PNG, WEBP 이미지 업로드 가능. 2MB 이하 권장
                        </p>
                      </div>
                    </div>
                    {accountForm.profileImageUrl && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setAccountForm((prev) => ({ ...prev, profileImageUrl: "" }))}
                          className="text-xs font-semibold text-rose-300 transition hover:text-rose-200"
                        >
                          업로드한 이미지 제거
                        </button>
                      </div>
                    )}
                  </div>
                </FormField>
                <FormField label="외부 보관 참조 ID">
                  <input
                    value={accountForm.vaultReference}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, vaultReference: e.target.value }))}
                    className="input"
                    placeholder="1password://vault/item-id"
                  />
                </FormField>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
                <FormField label="계정 정보">
                  <textarea
                    value={accountForm.maskedHint}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, maskedHint: e.target.value }))}
                    rows={4}
                    className="input resize-none py-3"
                    style={{ height: "auto" }}
                    placeholder={"user@site.com:token-pass:mail-pass:tok_xxxx\n또는 여러 줄로 붙여넣기"}
                  />
                </FormField>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">자동 감지 형식</p>
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm font-semibold text-violet-100">
                    {ACCOUNT_FORMAT_LABELS[detectAccountFormat(accountForm.maskedHint)]}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    한 줄로 붙여넣어도 저장할 때 라벨이 붙은 여러 줄 블록으로 정리됩니다. 카드에서는 전체 복사와 항목별 복사를 바로 사용할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <FormField label="메모">
                  <textarea
                    value={accountForm.note}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, note: e.target.value }))}
                    rows={4}
                    className="input resize-none py-3"
                    style={{ height: "auto" }}
                    placeholder="계정 상태, 주의사항, 금고 위치 설명 등을 적어두세요."
                  />
                </FormField>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <p className="flex-1 text-xs text-slate-400">{accountFormMessage || "저장 시 계정 정리 탭과 목록에 바로 반영됩니다."}</p>
              </div>

              <div className="mt-3 flex gap-2">
                <Button type="submit" className="h-11 flex-1 rounded-xl text-sm">
                  <Save size={16} className="mr-2" /> 저장하기
                </Button>
                <Button type="button" variant="outline" onClick={closeAccountForm} className="h-11 rounded-xl px-5">
                  취소
                </Button>
              </div>
            </motion.form>
          </Overlay>
        )}
      </AnimatePresence>

      {/* Settings modal */}
      <AnimatePresence>
        {settingsOpen && (
          <Overlay onClose={() => setSettingsOpen(false)}>
            <motion.div
              transition={spring}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="w-full max-w-md rounded-3xl border border-white/[0.08] p-6 shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
              style={{ background: "rgba(8,12,22,0.98)", backdropFilter: "blur(32px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader
                title="자동 알림 설정"
                description="디스코드 웹훅과 테스트 전송을 관리합니다."
                onClose={() => setSettingsOpen(false)}
              />

              <FormField label="웹훅 URL">
                <div className="relative">
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input
                    value={settings.webhookUrl}
                    onChange={(e) => setSettings((p) => ({ ...p, webhookUrl: e.target.value }))}
                    className="input pl-10"
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>
              </FormField>

              <div className="mt-4 space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm leading-relaxed text-slate-400">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500" />
                  시작일 기준 30일마다 결제일 알림 전송
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500" />
                  만료 3일 전, 2일 전, 1일 전, 당일 갱신 알림 전송
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500" />
                  같은 알림은 중복 전송되지 않도록 기록
                </div>
                <p className="mt-1 text-xs text-slate-600">현재는 이 페이지가 열려 있는 동안 1분마다 체크합니다.</p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">{notice}</p>
                <Button variant="outline" onClick={sendTestWebhook} className="h-10 flex-shrink-0 rounded-xl px-4">
                  <Send size={14} className="mr-2" /> 테스트 전송
                </Button>
              </div>
            </motion.div>
          </Overlay>
        )}
      </AnimatePresence>

      <datalist id="client-buyer-ids">
        {normalizedClients.map((client) => (
          <option key={client.id} value={client.buyerId} />
        ))}
      </datalist>

      <style>{inputStyle}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

function Overlay({ children, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {children}
    </motion.div>
  );
}

function ModalHeader({ title, description, onClose }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-white/[0.07] p-2 text-slate-500 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-slate-200"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function LoginField({ label, icon, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-400">{label}</span>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
        {children}
      </div>
    </label>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function StatChip({ label, value, icon, color, className = "" }) {
  const colors = {
    violet: { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)", text: "#a78bfa" },
    emerald: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", text: "#34d399" },
    amber: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", text: "#fbbf24" },
    slate: { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)", text: "#94a3b8" },
    indigo: { bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.2)", text: "#818cf8" },
  };
  const c = colors[color] || colors.violet;
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-3.5 py-3 ${className}`}
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.text }}>{label}</p>
        <p className="mt-0.5 text-lg font-black text-white">{value}</p>
      </div>
      <span style={{ color: c.text }} className="opacity-70">{icon}</span>
    </div>
  );
}

function InsightChip({ icon, label, value, color }) {
  const colors = {
    rose: { bg: "rgba(244,63,94,0.06)", border: "rgba(244,63,94,0.15)", icon: "#fb7185", text: "#fda4af" },
    amber: { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)", icon: "#fbbf24", text: "#fcd34d" },
    violet: { bg: "rgba(139,92,246,0.06)", border: "rgba(139,92,246,0.15)", icon: "#a78bfa", text: "#c4b5fd" },
  };
  const c = colors[color] || colors.violet;
  return (
    <div className="rounded-xl border p-3.5" style={{ background: c.bg, borderColor: c.border }}>
      <div className="flex items-center gap-2 text-xs font-bold" style={{ color: c.icon }}>
        {icon} {label}
      </div>
      <p className="mt-2 text-sm text-slate-300">{value}</p>
    </div>
  );
}

function SummaryBlock({ label, value }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    active: { label: "계약중", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#34d399", glow: "rgba(16,185,129,0.25)" },
    pending: { label: "신청 전", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#fbbf24", glow: "rgba(245,158,11,0.25)" },
    expired: { label: "계약 만료", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)", text: "#64748b", glow: "transparent" },
  };
  const c = cfg[status] || cfg.expired;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-black"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        boxShadow: `0 0 10px ${c.glow}`,
      }}
    >
      {c.label}
    </span>
  );
}

function DiscountBadge({ client }) {
  if (!hasDiscount(client)) {
    return (
      <span className="inline-flex rounded-full border border-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-slate-500">
        할인 없음
      </span>
    );
  }
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{
        background: "rgba(139,92,246,0.1)",
        border: "1px solid rgba(139,92,246,0.25)",
        color: "#c4b5fd",
      }}
    >
      {DISCOUNT_TYPES[client.discountType]} · {formatCurrency(client.discountAmount)}
    </span>
  );
}

function DaysLeftBadge({ left }) {
  if (left === null) return null;
  const color =
    left <= 3 ? { text: "#f87171", glow: "rgba(248,113,113,0.3)" } :
    left <= 7 ? { text: "#fbbf24", glow: "rgba(251,191,36,0.3)" } :
                { text: "#34d399", glow: "rgba(52,211,153,0.2)" };
  return (
    <span
      className="text-xs font-black"
      style={{ color: color.text, textShadow: `0 0 10px ${color.glow}` }}
    >
      D-{left}
    </span>
  );
}

function ClientRow({ client, linkedAccountCount, isExpanded, onOpenLinkedAccounts, onToggle, onEdit, onDelete }) {
  const period =
    client.startDate && client.endDate
      ? `${client.startDate} ~ ${client.endDate}`
      : "기간 미설정";

  return (
    <motion.div
      layout
      transition={spring}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="group"
    >
      <div className="grid gap-3 px-5 py-4 transition-colors hover:bg-white/[0.02] md:grid-cols-[1.1fr_.4fr_.5fr_.95fr_1fr_.8fr_.65fr] md:items-center">
        {/* Buyer */}
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">구매자</p>
          <div className="flex items-center gap-2">
            <p className={`font-bold ${client.displayStatus === "expired" ? "text-slate-500" : "text-white"}`}>
              {client.buyerId}
            </p>
            {client.note && (
              <span className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[10px] text-slate-500">
                비고
              </span>
            )}
          </div>
        </div>

        {/* Bots */}
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">봇</p>
          <button
            type="button"
            onClick={onOpenLinkedAccounts}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.08] px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/35 hover:bg-cyan-500/[0.14]"
          >
            <Bot size={15} className="text-cyan-300" />
            <span>{client.botCount}개</span>
          </button>
          <p className="mt-1 text-[11px] text-slate-500">연결 계정 {linkedAccountCount}개 보기</p>
        </div>

        {/* Months */}
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">개월</p>
          <span className="text-sm font-semibold text-slate-300">{client.purchaseMonths}개월</span>
        </div>

        {/* Payment */}
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">결제/할인</p>
          <p className="text-sm font-bold text-slate-100">{formatCurrency(client.paymentAmount)}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">정가 {formatCurrency(getOriginalAmount(client))}</p>
        </div>

        {/* Period */}
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">계약 기간</p>
          <p className={`text-sm font-semibold ${client.displayStatus === "expired" ? "text-slate-500" : "text-slate-200"}`}>
            {period}
          </p>
          {client.left !== null && client.displayStatus === "active" && (
            <div className="mt-0.5">
              <DaysLeftBadge left={client.left} />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">상태</p>
          <StatusBadge status={client.displayStatus} />
          <div>
            <DiscountBadge client={client} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-1.5">
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] text-slate-400 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-slate-200"
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] text-slate-400 transition hover:border-violet-500/30 hover:bg-violet-500/[0.08] hover:text-violet-300"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/[0.15] bg-rose-500/[0.06] text-rose-400 transition hover:border-rose-500/30 hover:bg-rose-500/[0.12]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-white/[0.04]"
            style={{ background: "rgba(139,92,246,0.02)" }}
          >
            <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
              <DetailPanel icon={<MessageSquare size={13} />} label="홍보 멘트">
                {client.promoText || <span className="text-slate-600">홍보 멘트 없음</span>}
              </DetailPanel>
              <DetailPanel icon={<AlertCircle size={13} />} label="비고">
                {client.note || <span className="text-slate-600">비고 없음</span>}
              </DetailPanel>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function LinkedAccountSummaryCard({ record }) {
  const hasImage = Boolean(record.profileImageUrl);
  const statusLabel = ACCOUNT_STATUS[record.status] || ACCOUNT_STATUS.available;
  const formatLabel = ACCOUNT_FORMAT_LABELS[record.detectedFormat] || ACCOUNT_FORMAT_LABELS.unknown;
  const hasStoredInfo = parseAccountInfoSegments(record.maskedHint).length > 0;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]"
            style={{ boxShadow: hasImage ? "0 0 18px rgba(56,189,248,0.12)" : "none" }}
          >
            {hasImage ? (
              <img src={record.profileImageUrl} alt={record.promoterName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-black text-slate-500">{record.promoterName.slice(0, 1) || "?"}</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-black text-white">{record.promoterName}</h3>
              <AccountStatusBadge status={record.status} />
            </div>
            <p className="mt-1 text-sm text-slate-400">{statusLabel} · {formatLabel}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <AccountMeta label="외부 보관 참조">{record.vaultReference || "참조 ID 없음"}</AccountMeta>
              <AccountMeta label="저장 상태">{hasStoredInfo ? "계정 정보 저장됨" : "저장 정보 없음"}</AccountMeta>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">최근 수정 {formatDateTime(record.updatedAt)}</div>
      </div>

      <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 px-4 py-3 text-sm text-slate-300">
        {record.note || <span className="text-slate-600">메모 없음</span>}
      </div>
    </div>
  );
}

function AccountRecordCard({ record, onEdit, onDelete, onCopy }) {
  const formatLabel = ACCOUNT_FORMAT_LABELS[record.detectedFormat] || ACCOUNT_FORMAT_LABELS.unknown;
  const hasImage = Boolean(record.profileImageUrl);
  const statusLabel = ACCOUNT_STATUS[record.status] || ACCOUNT_STATUS.available;
  const accountInfoSegments = parseAccountInfoSegments(record.maskedHint);
  const compactAccountInfo = formatAccountInfoCompact(record.maskedHint);

  return (
    <motion.div
      layout
      transition={spring}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]"
            style={{ boxShadow: hasImage ? "0 0 18px rgba(56,189,248,0.12)" : "none" }}
          >
            {hasImage ? (
              <img src={record.profileImageUrl} alt={record.promoterName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-black text-slate-500">{record.promoterName.slice(0, 1) || "?"}</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-black text-white">{record.promoterName}</h3>
              <AccountStatusBadge status={record.status} />
              <span className="rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-2.5 py-1 text-[11px] font-bold text-violet-200">
                {record.clientId || (record.status === "available" ? "사용 전 계정" : "고객 미지정")}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{statusLabel} · {formatLabel}</p>
            <div className="mt-3 grid gap-3">
              <AccountMeta label="외부 보관 참조">{record.vaultReference || "참조 ID 없음"}</AccountMeta>
              <AccountInfoPanel
                segments={accountInfoSegments}
                compactValue={compactAccountInfo}
                prettyValue={record.maskedHint}
                onCopy={onCopy}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-1.5 self-end lg:self-start">
          <button
            onClick={onEdit}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] text-slate-400 transition hover:border-violet-500/30 hover:bg-violet-500/[0.08] hover:text-violet-300"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/[0.15] bg-rose-500/[0.06] text-rose-400 transition hover:border-rose-500/30 hover:bg-rose-500/[0.12]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="rounded-xl border border-white/[0.06] bg-black/10 px-4 py-3 text-sm text-slate-300">
          {record.note || <span className="text-slate-600">메모 없음</span>}
        </div>
        <div className="text-xs text-slate-500">최근 수정 {formatDateTime(record.updatedAt)}</div>
      </div>
    </motion.div>
  );
}

function AccountStatusBadge({ status }) {
  const config = status === "assigned"
    ? { label: ACCOUNT_STATUS.assigned, bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)", text: "#a5b4fc" }
    : { label: ACCOUNT_STATUS.available, bg: "rgba(34,211,238,0.12)", border: "rgba(34,211,238,0.28)", text: "#67e8f9" };

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-black"
      style={{ background: config.bg, border: `1px solid ${config.border}`, color: config.text }}
    >
      {config.label}
    </span>
  );
}

function AccountMeta({ label, children }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="break-all text-sm text-slate-200">{children}</div>
    </div>
  );
}

function AccountInfoPanel({ segments, compactValue, prettyValue, onCopy }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">계정 정보</div>
        <div className="flex flex-wrap gap-1.5">
          <CopyAction label="한 줄 복사" onClick={() => onCopy(compactValue, "계정 정보 한 줄")} disabled={!compactValue} />
          <CopyAction label="블록 복사" onClick={() => onCopy(prettyValue, "정리된 계정 정보")} disabled={!prettyValue} />
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="text-sm text-slate-500">저장된 정보 없음</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {segments.map((segment, index) => (
            <div
              key={`${segment.label}-${index}`}
              className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{segment.label}</span>
                <CopyAction label="복사" onClick={() => onCopy(segment.value, segment.label)} compact />
              </div>
              <div className="break-all text-sm text-slate-100">{segment.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyAction({ label, onClick, disabled = false, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/[0.08] font-semibold text-violet-200 transition hover:border-violet-500/35 hover:bg-violet-500/[0.14] disabled:cursor-not-allowed disabled:opacity-40 ${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
    >
      <Copy size={compact ? 11 : 12} />
      {label}
    </button>
  );
}

function DetailPanel({ icon, label, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {icon} {label}
      </div>
      <div
        className="min-h-[72px] rounded-xl border border-white/[0.06] px-4 py-3 text-sm leading-relaxed text-slate-300"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Global input style
// ═══════════════════════════════════════════════════════════════

const inputStyle = `
  .input {
    width: 100%;
    height: 44px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    padding: 0 14px;
    font-size: 14px;
    outline: none;
    transition: all 0.18s ease;
    color: #f1f5f9;
  }
  .input::placeholder { color: #475569; }
  .input:focus {
    border-color: rgba(139,92,246,0.45);
    box-shadow: 0 0 0 3px rgba(139,92,246,0.1);
    background: rgba(255,255,255,0.06);
  }
  select.input option { background: #0c1222; color: #f1f5f9; }
  textarea.input { height: auto; }
`;
