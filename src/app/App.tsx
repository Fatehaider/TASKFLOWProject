import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, CheckSquare, BarChart2, Settings, Bell, Search, Plus,
  ChevronDown, ChevronRight, ChevronLeft, MoreHorizontal, X, Upload,
  Calendar, Tag, Users, Paperclip, MessageSquare, Clock, TrendingUp,
  TrendingDown, AlertCircle, CheckCircle2, Circle, Eye, Edit2, Trash2,
  Filter, Download, Share2, LogOut, Moon, Sun, User, Shield, Zap,
  Activity, ArrowUpRight, ArrowDownRight, FileText, Hash, AtSign,
  Menu, Star, Flag, Link, Copy, ExternalLink
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from "recharts";
import { createTask, deleteTask, listNotifications, listTasks, shareTask, updateTask } from "../lib/taskApi";

// ─── Types ───────────────────────────────────────────────────────────────────

type Page = "login" | "register" | "dashboard" | "tasks" | "task-detail" | "analytics" | "settings";
type Status = "todo" | "in-progress" | "review" | "done";
type Priority = "low" | "medium" | "high" | "critical";

interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string;
  assignee: string;
  assigneeColor: string;
  tags: string[];
  progress: number;
  attachments: number;
  comments: number;
  createdAt: string;
  shared: string[];
}

interface Notification {
  id: string;
  type: "task" | "mention" | "deadline" | "system";
  message: string;
  time: string;
  read: boolean;
  actor: string;
  actorColor: string;
}

interface ActivityItem {
  id: string;
  actor: string;
  actorColor: string;
  action: string;
  time: string;
  detail?: string;
}

interface UserAccount {
  name: string;
  email: string;
  password: string;
  color: string;
}

const AUTH_USERS_KEY = "taskflow-users";
const AUTH_CURRENT_USER_KEY = "taskflow-current-user";

function hashColor(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }

  const palette = ["#4F46E5", "#22C55E", "#F59E0B", "#EF4444", "#0F172A", "#8B5CF6"];
  const safeIndex = Math.abs(hash) % palette.length;
  return palette[safeIndex];
}

function loadStoredUsers(): UserAccount[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(AUTH_USERS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadCurrentUser(): UserAccount | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_CURRENT_USER_KEY) ?? window.sessionStorage.getItem(AUTH_CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return typeof parsed?.email === "string" && typeof parsed?.name === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function persistCurrentUser(user: UserAccount | null, remember: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(AUTH_CURRENT_USER_KEY);
    window.sessionStorage.removeItem(AUTH_CURRENT_USER_KEY);
    return;
  }

  const payload = JSON.stringify(user);
  if (remember) {
    window.localStorage.setItem(AUTH_CURRENT_USER_KEY, payload);
    window.sessionStorage.removeItem(AUTH_CURRENT_USER_KEY);
    return;
  }

  window.sessionStorage.setItem(AUTH_CURRENT_USER_KEY, payload);
  window.localStorage.removeItem(AUTH_CURRENT_USER_KEY);
}

function scopeTasksForUser(tasks: Task[], user: UserAccount | null) {
  if (!user) {
    return [];
  }

  const userName = user.name.trim();
  return tasks.filter(task => task.assignee === userName || task.shared.includes(userName));
}

function scopeNotificationsForUser(notifications: Notification[], user: UserAccount | null) {
  if (!user) {
    return [];
  }

  const name = user.name.toLowerCase();
  const email = user.email.toLowerCase();
  return notifications.filter(notification => {
    const message = notification.message.toLowerCase();
    return notification.actor === user.name || notification.actor === user.email || message.includes(name) || message.includes(email);
  });
}

const ACTIVITY: ActivityItem[] = [
  { id: "A-001", actor: "Sarah Chen", actorColor: "#4F46E5", action: "updated the status to In Progress", time: "Today, 10:23 AM" },
  { id: "A-002", actor: "Marcus Reid", actorColor: "#22C55E", action: "added a comment", time: "Yesterday, 3:45 PM", detail: "The wireframes look great! Just need to align the CTA buttons with our design system." },
  { id: "A-003", actor: "You", actorColor: "#6366F1", action: "uploaded 2 attachments", time: "Yesterday, 2:10 PM", detail: "onboarding-v2.fig, user-flow-diagram.pdf" },
  { id: "A-004", actor: "Priya Nair", actorColor: "#F59E0B", action: "changed priority from Medium to High", time: "May 22, 9:00 AM" },
  { id: "A-005", actor: "Sarah Chen", actorColor: "#4F46E5", action: "created this task", time: "May 20, 11:30 AM" },
];

const analyticsWeekly = [
  { day: "Mon", completed: 4, created: 6, overdue: 1 },
  { day: "Tue", completed: 7, created: 5, overdue: 0 },
  { day: "Wed", completed: 3, created: 8, overdue: 2 },
  { day: "Thu", completed: 9, created: 4, overdue: 0 },
  { day: "Fri", completed: 6, created: 7, overdue: 1 },
  { day: "Sat", completed: 2, created: 2, overdue: 0 },
  { day: "Sun", completed: 1, created: 1, overdue: 0 },
];

const analyticsMonthly = [
  { month: "Jan", completed: 42, target: 50 },
  { month: "Feb", completed: 58, target: 55 },
  { month: "Mar", completed: 63, target: 60 },
  { month: "Apr", completed: 71, target: 65 },
  { month: "May", completed: 54, target: 70 },
];

const analyticsPie = [
  { name: "Done", value: 32, color: "#22C55E" },
  { name: "In Progress", value: 24, color: "#4F46E5" },
  { name: "Review", value: 18, color: "#F59E0B" },
  { name: "To Do", value: 26, color: "#94A3B8" },
];

const velocityData = [
  { week: "W18", velocity: 22 },
  { week: "W19", velocity: 31 },
  { week: "W20", velocity: 28 },
  { week: "W21", velocity: 35 },
  { week: "W22", velocity: 42 },
  { week: "W23", velocity: 38 },
];

// ─── Design System Components ─────────────────────────────────────────────────

const cx = (...classes: (string | false | undefined | null)[]) => classes.filter(Boolean).join(" ");

function Badge({ status, priority, custom }: { status?: Status; priority?: Priority; custom?: string }) {
  if (status) {
    const map: Record<Status, string> = {
      "todo": "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
      "in-progress": "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
      "review": "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      "done": "bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    };
    const labels: Record<Status, string> = { "todo": "To Do", "in-progress": "In Progress", "review": "Review", "done": "Done" };
    return <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-mono", map[status])}>{labels[status]}</span>;
  }
  if (priority) {
    const map: Record<Priority, string> = {
      "low": "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
      "medium": "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
      "high": "bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
      "critical": "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300",
    };
    const icons: Record<Priority, string> = { low: "↓", medium: "→", high: "↑", critical: "⚡" };
    return <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-mono capitalize", map[priority])}>{icons[priority]} {priority}</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{custom}</span>;
}

function Button({ children, variant = "primary", size = "md", onClick, className, disabled, type = "button" }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg"; onClick?: () => void; className?: string; disabled?: boolean; type?: "button" | "submit";
}) {
  const base = "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm rounded-lg", md: "px-4 py-2 text-sm rounded-xl", lg: "px-6 py-3 text-base rounded-xl" };
  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] shadow-sm shadow-primary/20",
    secondary: "bg-secondary text-secondary-foreground hover:bg-accent border border-border",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
    outline: "border border-border bg-card text-foreground hover:bg-muted",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className={cx(base, sizes[size], variants[variant], className)}>
      {children}
    </button>
  );
}

function Input({ label, type = "text", placeholder, value, onChange, icon, className, required }: {
  label?: string; type?: string; placeholder?: string; value?: string; onChange?: (v: string) => void;
  icon?: React.ReactNode; className?: string; required?: boolean;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && <label className="text-sm font-medium text-foreground">{label}{required && <span className="text-destructive ml-1">*</span>}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        <input type={type} placeholder={placeholder} value={value} onChange={e => onChange?.(e.target.value)}
          className={cx(
            "w-full bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all duration-150",
            icon ? "pl-10" : ""
          )} />
      </div>
    </div>
  );
}

function Card({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick}
      className={cx("bg-card rounded-2xl border border-border", onClick ? "cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200" : "", className)}>
      {children}
    </div>
  );
}

function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("");
  const sizes = { sm: "w-6 h-6 text-xs", md: "w-8 h-8 text-sm", lg: "w-10 h-10 text-base" };
  return (
    <div className={cx("rounded-full flex items-center justify-center font-semibold text-white shrink-0", sizes[size])}
      style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
}

function ProgressBar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={cx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

function StatCard({ label, value, trend, icon, color }: { label: string; value: string; trend?: number; icon: React.ReactNode; color: string }) {
  const isPositive = (trend ?? 0) >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {trend !== undefined && (
            <div className={cx("flex items-center gap-1 mt-2 text-xs font-medium", isPositive ? "text-green-600" : "text-red-500")}>
              {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{Math.abs(trend)}% vs last week</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: color + "18" }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
    </Card>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ navigate }: { navigate: (p: Page) => void }) {
  const [email, setEmail] = useState("alex.morgan@taskflow.io");
  const [password, setPassword] = useState("••••••••");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); navigate("dashboard"); }, 900);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width: `${20 + Math.random() * 80}px`, height: `${20 + Math.random() * 80}px`, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.3 + Math.random() * 0.5 }} />
          ))}
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">TaskFlow</span>
          </div>
          <div>
            <h2 className="text-4xl font-bold leading-tight mb-4">Organize work.<br />Ship faster.</h2>
            <p className="text-white/70 text-lg leading-relaxed">TaskFlow brings your team together with smart task management, real-time collaboration, and powerful analytics.</p>
            <div className="mt-10 flex flex-col gap-4">
              {[
                { icon: <CheckCircle2 size={16} />, text: "Real-time collaboration with your team" },
                { icon: <Activity size={16} />, text: "Analytics that surface what matters" },
                { icon: <Shield size={16} />, text: "Enterprise-grade security & permissions" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-white/80">
                  <div className="text-white/60">{item.icon}</div>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {["#4F46E5", "#22C55E", "#F59E0B", "#EF4444"].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: c }}>
                  {["S", "M", "P", "J"][i]}
                </div>
              ))}
            </div>
            <p className="text-sm text-white/70">Trusted by 12,000+ teams worldwide</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-foreground">TaskFlow</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-8">Sign in to continue to your workspace</p>

          <div className="flex flex-col gap-4">
            <Input label="Email address" type="email" placeholder="you@company.com" value={email} onChange={setEmail} icon={<AtSign size={16} />} />
            <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={setPassword} icon={<Shield size={16} />} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setRemember(!remember)}
                  className={cx("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors", remember ? "bg-primary border-primary" : "border-border bg-card")}>
                  {remember && <CheckCircle2 size={10} className="text-white" />}
                </div>
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>
              <button className="text-sm text-primary font-medium hover:underline">Forgot password?</button>
            </div>
            <Button variant="primary" size="lg" onClick={handleLogin} disabled={loading} className="w-full mt-2">
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</> : "Sign in"}
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">or continue with</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {["Google", "GitHub"].map(provider => (
              <button key={provider} className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors">
                {provider === "Google" ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-foreground"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                )}
                {provider}
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Don't have an account?{" "}
            <button onClick={() => navigate("register")} className="text-primary font-medium hover:underline">Create one free</button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Register Page ────────────────────────────────────────────────────────────

function RegisterPage({ navigate }: { navigate: (p: Page) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const update = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleRegister = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); navigate("dashboard"); }, 900);
  };

  const strength = form.password.length > 12 ? 3 : form.password.length > 8 ? 2 : form.password.length > 4 ? 1 : 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-foreground">TaskFlow</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
        <p className="text-sm text-muted-foreground mb-8">Free forever for personal use. No credit card needed.</p>

        <div className="flex flex-col gap-4">
          <Input label="Full name" placeholder="Alex Morgan" value={form.name} onChange={update("name")} icon={<User size={16} />} required />
          <Input label="Work email" type="email" placeholder="alex@company.com" value={form.email} onChange={update("email")} icon={<AtSign size={16} />} required />
          <div>
            <Input label="Password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={update("password")} icon={<Shield size={16} />} required />
            {form.password && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className={cx("h-1 flex-1 rounded-full transition-colors", i <= strength ? ["bg-red-400", "bg-amber-400", "bg-green-500"][strength - 1] : "bg-muted")} />
                ))}
                <span className="text-xs text-muted-foreground ml-2">{["", "Weak", "Good", "Strong"][strength]}</span>
              </div>
            )}
          </div>
          <Input label="Confirm password" type="password" placeholder="Re-enter password" value={form.confirm} onChange={update("confirm")} icon={<Shield size={16} />} required />
          <Button variant="primary" size="lg" onClick={handleRegister} disabled={loading} className="w-full mt-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account…</> : "Create account"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By registering, you agree to our <span className="text-primary cursor-pointer hover:underline">Terms</span> and <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Already have an account?{" "}
          <button onClick={() => navigate("login")} className="text-primary font-medium hover:underline">Sign in</button>
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "dashboard" as Page, label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "tasks" as Page, label: "Tasks", icon: <CheckSquare size={18} />, badge: "8" },
  { id: "analytics" as Page, label: "Analytics", icon: <BarChart2 size={18} /> },
  { id: "settings" as Page, label: "Settings", icon: <Settings size={18} /> },
];

function Sidebar({ current, navigate, collapsed, setCollapsed, currentUser }: {
  current: Page; navigate: (p: Page) => void; collapsed: boolean; setCollapsed: (v: boolean) => void; currentUser: UserAccount | null;
}) {
  return (
    <aside className={cx(
      "h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 shrink-0",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className="flex items-center justify-between p-4 h-16 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-foreground tracking-tight">TaskFlow</span>
          </div>
        )}
        {collapsed && <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center mx-auto"><Zap size={14} className="text-white" /></div>}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)} className="p-2 mx-auto mt-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
          <Menu size={18} />
        </button>
      )}

      <nav className="flex-1 p-3 flex flex-col gap-1">
        {NAV_ITEMS.map(item => {
          const active = current === item.id || (item.id === "task-detail" && current === "task-detail");
          const isActive = current === item.id;
          return (
            <button key={item.id} onClick={() => navigate(item.id)}
              className={cx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 w-full text-left group relative",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
              <span className={cx("shrink-0", isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-foreground")}>{item.icon}</span>
              {!collapsed && <span className="text-sm truncate">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-mono">{item.badge}</span>
              )}
              {collapsed && isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-l-full" />}
            </button>
          );
        })}
      </nav>

      <div className={cx("p-3 border-t border-sidebar-border", collapsed ? "flex justify-center" : "")}>
        <div className={cx("flex items-center gap-3 p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors", collapsed ? "" : "")}>
          <Avatar name={currentUser?.name ?? "User"} color={currentUser?.color ?? "#4F46E5"} size="sm" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{currentUser?.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser?.email ?? "Sign in to view profile"}</p>
            </div>
          )}
          {!collapsed && <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
        </div>
      </div>
    </aside>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ title, notifCount, onNotifClick, onSearch, isDark, setIsDark, currentUser }: {
  title: string; notifCount: number; onNotifClick: () => void;
  onSearch?: (q: string) => void; isDark: boolean; setIsDark: (v: boolean) => void; currentUser: UserAccount | null;
}) {
  const [q, setQ] = useState("");
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {onSearch && (
          <div className="relative hidden sm:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => { setQ(e.target.value); onSearch(e.target.value); }}
              placeholder="Search tasks…" className="pl-9 pr-4 py-2 text-sm bg-muted border border-border rounded-xl w-64 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all" />
          </div>
        )}
        <button onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button onClick={onNotifClick} className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
        <Avatar name={currentUser?.name ?? "User"} color={currentUser?.color ?? "#4F46E5"} size="sm" />
      </div>
    </header>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

function DashboardPage({ tasks, navigate, currentUser }: { tasks: Task[]; navigate: (p: Page, id?: string) => void; currentUser: UserAccount | null }) {
  const done = tasks.filter(t => t.status === "done").length;
  const inProgress = tasks.filter(t => t.status === "in-progress").length;
  const review = tasks.filter(t => t.status === "review").length;
  const overdue = tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== "done").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Good morning, {currentUser?.name.split(" ")[0] ?? "User"} 👋</h2>
          <p className="text-sm text-muted-foreground mt-0.5">You have {inProgress} tasks in progress and {review} waiting for review</p>
        </div>
        <Button variant="primary" onClick={() => navigate("tasks")} className="hidden sm:flex">
          <Plus size={16} /> New Task
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={String(tasks.length)} trend={12} icon={<CheckSquare size={20} />} color="#4F46E5" />
        <StatCard label="Completed" value={String(done)} trend={8} icon={<CheckCircle2 size={20} />} color="#22C55E" />
        <StatCard label="In Progress" value={String(inProgress)} icon={<Activity size={20} />} color="#6366F1" />
        <StatCard label="Overdue" value={String(overdue)} trend={-15} icon={<AlertCircle size={20} />} color="#EF4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Recent Tasks</h3>
            <button onClick={() => navigate("tasks")} className="text-sm text-primary hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></button>
          </div>
          <div className="flex flex-col gap-3">
            {tasks.slice(0, 5).map(task => (
              <Card key={task.id} className="p-4" onClick={() => navigate("task-detail", task.id)}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {task.status === "done" ? <CheckCircle2 size={18} className="text-green-500" /> :
                      task.status === "in-progress" ? <div className="w-[18px] h-[18px] rounded-full border-2 border-primary border-t-transparent animate-spin" style={{ animationDuration: "2s" }} /> :
                        <Circle size={18} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{task.title}</span>
                      <Badge priority={task.priority} />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="font-mono">{task.id}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} />{task.dueDate}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={11} />{task.comments}</span>
                    </div>
                    {task.status === "in-progress" && (
                      <div className="mt-2"><ProgressBar value={task.progress} /></div>
                    )}
                  </div>
                  <Badge status={task.status} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Progress Overview</h3>
          <Card className="p-5">
            <div className="flex flex-col gap-4">
              {[
                { label: "Completed", count: done, total: tasks.length, color: "bg-green-500" },
                { label: "In Progress", count: inProgress, total: tasks.length, color: "bg-primary" },
                { label: "Review", count: review, total: tasks.length, color: "bg-amber-500" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground font-mono">{item.count}/{item.total}</span>
                  </div>
                  <ProgressBar value={(item.count / item.total) * 100} color={item.color} />
                </div>
              ))}
            </div>
          </Card>

          <h3 className="font-semibold text-foreground">Team Members</h3>
          <Card className="p-5">
            <div className="flex flex-col gap-3">
              {[
                { name: "Sarah Chen", role: "Designer", color: "#4F46E5", tasks: 2 },
                { name: "Marcus Reid", color: "#22C55E", role: "Engineer", tasks: 1 },
                { name: "Priya Nair", color: "#F59E0B", role: "PM", tasks: 2 },
                { name: "James Wu", color: "#EF4444", role: "DevOps", tasks: 2 },
              ].map(m => (
                <div key={m.name} className="flex items-center gap-3">
                  <Avatar name={m.name} color={m.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{m.tasks} tasks</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Tasks Page ───────────────────────────────────────────────────────────────

function TasksPage({ tasks, onAddTask, navigate }: {
  tasks: Task[]; onAddTask: () => void; navigate: (p: Page, id?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

  const filtered = tasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">All Tasks</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} task{filtered.length !== 1 ? "s" : ""} found</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm"><Download size={14} /> Export</Button>
          <Button variant="primary" size="sm" onClick={onAddTask}><Plus size={14} /> Add Task</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by title or ID…"
            className="pl-9 pr-4 py-2 text-sm bg-muted border border-border rounded-xl w-full text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as any); setPage(1); }}
          className="text-sm bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer">
          <option value="all">All Status</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value as any); setPage(1); }}
          className="text-sm bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer">
          <option value="all">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Task", "Status", "Priority", "Assignee", "Due Date", "Progress", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map(task => (
                <tr key={task.id} onClick={() => navigate("task-detail", task.id)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors group">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-muted-foreground">{task.id}</span>
                          <div className="flex gap-1">
                            {task.tags.map(t => <Badge key={t} custom={t} />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap"><Badge status={task.status} /></td>
                  <td className="px-4 py-3.5 whitespace-nowrap"><Badge priority={task.priority} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={task.assignee} color={task.assigneeColor} size="sm" />
                      <span className="text-sm text-foreground whitespace-nowrap hidden md:block">{task.assignee}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap font-mono">{task.dueDate}</td>
                  <td className="px-4 py-3.5 min-w-24">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={task.progress} />
                      <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">{task.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                      onClick={e => e.stopPropagation()}>
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No tasks match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={cx("w-8 h-8 text-sm rounded-lg transition-colors", p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {p}
                </button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({ onClose, onSave, editTask }: {
  onClose: () => void; onSave: (t: Partial<Task>) => Promise<void>; editTask?: Task;
}) {
  const [form, setForm] = useState({
    title: editTask?.title ?? "",
    description: editTask?.description ?? "",
    status: editTask?.status ?? "todo" as Status,
    priority: editTask?.priority ?? "medium" as Priority,
    dueDate: editTask?.dueDate ?? "",
    assignee: editTask?.assignee ?? "",
    tags: editTask?.tags.join(", ") ?? "",
  });
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const update = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold text-foreground">{editTask ? "Edit Task" : "Create New Task"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <Input label="Title" placeholder="What needs to be done?" value={form.title} onChange={update("title")} required />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea value={form.description} onChange={e => update("description")(e.target.value)}
              placeholder="Add more context, acceptance criteria, or relevant links…"
              rows={3}
              className="w-full bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Status</label>
              <select value={form.status} onChange={e => update("status")(e.target.value)}
                className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all">
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Priority</label>
              <select value={form.priority} onChange={e => update("priority")(e.target.value)}
                className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => update("dueDate")(e.target.value)}
                className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Assignee</label>
              <select value={form.assignee} onChange={e => update("assignee")(e.target.value)}
                className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all">
                <option value="">Unassigned</option>
                <option>Sarah Chen</option>
                <option>Marcus Reid</option>
                <option>Priya Nair</option>
                <option>James Wu</option>
              </select>
            </div>
          </div>

          <Input label="Tags" placeholder="design, frontend, api (comma separated)" value={form.tags} onChange={update("tags")} icon={<Hash size={14} />} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Attachments</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const names = Array.from(e.dataTransfer.files).map(f => f.name); setFiles(p => [...p, ...names]); }}
              className={cx(
                "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
                dragging ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}>
              <Upload size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Drop files here or <span className="text-primary font-medium">browse</span></p>
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, ZIP up to 50MB</p>
            </div>
            {files.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                {files.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                    <FileText size={12} /><span className="flex-1 truncate">{f}</span>
                    <button onClick={() => setFiles(p => p.filter(x => x !== f))}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                await onSave(form);
                onClose();
              } finally {
                setIsSaving(false);
              }
            }}
          >
            {isSaving ? "Saving…" : editTask ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Detail Page ─────────────────────────────────────────────────────────

function TaskDetailPage({ task, navigate, onEdit, onDelete, onShare }: {
  task: Task;
  navigate: (p: Page) => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: (userName: string) => Promise<void>;
}) {
  const [showShare, setShowShare] = useState(false);
  const [comment, setComment] = useState("");
  const [shareValue, setShareValue] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!shareValue.trim()) {
      return;
    }

    setIsSharing(true);
    try {
      await onShare(shareValue.trim());
      setShareValue("");
      setShowShare(false);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <button onClick={() => navigate("tasks")} className="hover:text-primary transition-colors">Tasks</button>
        <ChevronRight size={14} />
        <span className="font-mono text-foreground">{task.id}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{task.title}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge status={task.status} />
                  <Badge priority={task.priority} />
                  {task.tags.map(t => <Badge key={t} custom={t} />)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setShowShare(!showShare)}><Share2 size={14} /> Share</Button>
                <Button variant="primary" size="sm" onClick={onEdit}><Edit2 size={14} /> Edit</Button>
                <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono font-medium text-foreground">{task.progress}%</span>
              </div>
              <ProgressBar value={task.progress} />
            </div>
          </Card>

          {showShare && (
            <Card className="p-5">
              <h3 className="font-semibold text-foreground mb-3">Share Task</h3>
              <div className="flex gap-2 mb-4">
                <input
                  value={shareValue}
                  onChange={(e) => setShareValue(e.target.value)}
                  placeholder="Invite by name or email…"
                  className="flex-1 bg-input-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <Button variant="primary" size="sm" disabled={isSharing} onClick={handleShare}>{isSharing ? "Sharing…" : "Invite"}</Button>
              </div>
              <div className="flex flex-col gap-2">
                {["Alex Morgan", ...task.shared].map((name, i) => (
                  <div key={name} className="flex items-center gap-3">
                    <Avatar name={name} color={["#4F46E5", "#22C55E", "#F59E0B"][i % 3]} size="sm" />
                    <span className="flex-1 text-sm text-foreground">{name}</span>
                    <span className="text-xs text-muted-foreground">{i === 0 ? "Owner" : "Editor"}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                <input readOnly value={`https://taskflow.io/t/${task.id}`} className="flex-1 bg-muted text-muted-foreground text-sm rounded-lg px-3 py-1.5 font-mono" />
                <Button variant="outline" size="sm"><Copy size={12} /> Copy link</Button>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Paperclip size={16} className="text-muted-foreground" /> Attachments ({task.attachments})
            </h3>
            {task.attachments > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: task.attachments }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-muted rounded-xl hover:bg-accent transition-colors cursor-pointer group">
                    <FileText size={16} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{["wireframe-v2.fig", "user-flow.pdf", "spec-doc.pdf", "mockup.png", "research.pdf", "notes.txt"][i]}</p>
                      <p className="text-xs text-muted-foreground">{["2.4 MB", "1.1 MB", "890 KB", "3.2 MB", "1.8 MB", "24 KB"][i]}</p>
                    </div>
                    <ExternalLink size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No attachments yet.</p>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity size={16} className="text-muted-foreground" /> Activity Timeline
            </h3>
            <div className="flex flex-col gap-0">
              {ACTIVITY.map((item, idx) => (
                <div key={item.id} className="flex gap-3 relative">
                  {idx < ACTIVITY.length - 1 && (
                    <div className="absolute left-4 top-8 w-px bg-border h-full" />
                  )}
                  <Avatar name={item.actor} color={item.actorColor} size="sm" />
                  <div className="flex-1 pb-5">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{item.actor}</span>{" "}
                      <span className="text-muted-foreground">{item.action}</span>
                    </p>
                    {item.detail && (
                      <div className="mt-2 p-3 bg-muted rounded-xl text-sm text-foreground">
                        {item.detail}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock size={10} /> {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-2 pt-4 border-t border-border">
              <Avatar name="Alex Morgan" color="#4F46E5" size="sm" />
              <div className="flex-1 flex gap-2">
                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment…"
                  className="flex-1 bg-input-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                <Button variant="primary" size="sm" disabled={!comment} onClick={() => setComment("")}>Post</Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Details</h3>
            <div className="flex flex-col gap-3 text-sm">
              {[
                { label: "Assignee", value: <div className="flex items-center gap-2"><Avatar name={task.assignee} color={task.assigneeColor} size="sm" />{task.assignee}</div> },
                { label: "Created", value: task.createdAt },
                { label: "Due Date", value: task.dueDate },
                { label: "Comments", value: task.comments },
                { label: "Attachments", value: task.attachments },
              ].map(d => (
                <div key={d.label} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="text-foreground font-medium font-mono">{d.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users size={14} className="text-muted-foreground" /> Collaborators
            </h3>
            <div className="flex flex-col gap-3">
              {["Alex Morgan", ...task.shared].map((name, i) => (
                <div key={name} className="flex items-center gap-2">
                  <Avatar name={name} color={["#4F46E5", "#22C55E", "#F59E0B"][i % 3]} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{i === 0 ? "Owner" : "Editor"}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full justify-center"><Link size={14} /> Copy link</Button>
            <Button variant="danger" className="w-full justify-center"><Trash2 size={14} /> Delete task</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel({ notifs, onClose, onMarkAll }: {
  notifs: Notification[]; onClose: () => void; onMarkAll: () => void;
}) {
  const typeIcon = (t: Notification["type"]) => {
    if (t === "mention") return <AtSign size={12} className="text-primary" />;
    if (t === "deadline") return <AlertCircle size={12} className="text-amber-500" />;
    if (t === "task") return <CheckCircle2 size={12} className="text-green-500" />;
    return <Zap size={12} className="text-purple-500" />;
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card w-full max-w-sm h-full shadow-2xl border-l border-border flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Notifications</h2>
            <p className="text-xs text-muted-foreground">{notifs.filter(n => !n.read).length} unread</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onMarkAll} className="text-xs text-primary hover:underline">Mark all read</button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {["Unread", "Earlier"].map(group => {
            const items = group === "Unread" ? notifs.filter(n => !n.read) : notifs.filter(n => n.read);
            if (!items.length) return null;
            return (
              <div key={group}>
                <p className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">{group}</p>
                {items.map(n => (
                  <div key={n.id} className={cx("px-5 py-4 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer", !n.read && "bg-primary/5")}>
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: n.actorColor }}>
                          {n.actor}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-card flex items-center justify-center border border-border">
                          {typeIcon(n.type)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock size={10} /> {n.time}
                        </p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-border">
          <button className="w-full text-sm text-primary font-medium text-center hover:underline">View all notifications</button>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────

function AnalyticsPage() {
  const COLORS = ["#22C55E", "#4F46E5", "#F59E0B", "#94A3B8"];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Analytics</h2>
        <p className="text-sm text-muted-foreground">Performance metrics for the last 30 days</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Completion Rate" value="78%" trend={5} icon={<TrendingUp size={20} />} color="#22C55E" />
        <StatCard label="Avg. Cycle Time" value="3.2d" trend={-12} icon={<Clock size={20} />} color="#4F46E5" />
        <StatCard label="Team Velocity" value="42" trend={18} icon={<Zap size={20} />} color="#F59E0B" />
        <StatCard label="Blocked Tasks" value="3" trend={-40} icon={<AlertCircle size={20} />} color="#EF4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-foreground">Weekly Task Activity</h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Completed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />Created</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Overdue</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analyticsWeekly} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }} />
                <Bar dataKey="completed" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="created" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="overdue" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Task Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={analyticsPie} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {analyticsPie.map((entry, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 mt-2">
            {analyticsPie.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-muted-foreground flex-1">{item.name}</span>
                <span className="font-mono font-medium text-foreground">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Monthly Completion vs Target</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analyticsMonthly}>
              <defs>
                <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="completed" stroke="#4F46E5" strokeWidth={2} fill="url(#completedGrad)" name="Completed" />
              <Line type="monotone" dataKey="target" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Target" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Team Velocity (pts/week)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={velocityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="velocity" stroke="#22C55E" strokeWidth={2.5} dot={{ fill: "#22C55E", r: 4 }} activeDot={{ r: 6 }} name="Velocity" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage({ isDark, setIsDark }: { isDark: boolean; setIsDark: (v: boolean) => void }) {
  const [profile, setProfile] = useState({ name: "Alex Morgan", email: "alex.morgan@taskflow.io", role: "Product Designer", bio: "Designing user-centric products with a focus on accessibility and clarity." });
  const [notifPrefs, setNotifPrefs] = useState({ mentions: true, deadlines: true, tasks: true, digests: false });
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const update = (k: keyof typeof profile) => (v: string) => setProfile(p => ({ ...p, [k]: v }));
  const toggleNotif = (k: keyof typeof notifPrefs) => setNotifPrefs(p => ({ ...p, [k]: !p[k] }));

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={cx("relative w-10 h-6 rounded-full transition-colors duration-200", checked ? "bg-primary" : "bg-switch-background")}>
      <div className={cx("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200", checked ? "translate-x-5" : "translate-x-1")} />
    </button>
  );

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account, preferences, and notifications</p>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-5">Profile</h3>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <Avatar name={profile.name} color="#4F46E5" size="lg" />
            <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <Edit2 size={10} className="text-white" />
            </button>
          </div>
          <div>
            <p className="font-semibold text-foreground">{profile.name}</p>
            <p className="text-sm text-muted-foreground">{profile.role}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name" value={profile.name} onChange={update("name")} />
          <Input label="Email" type="email" value={profile.email} onChange={update("email")} />
          <Input label="Role" value={profile.role} onChange={update("role")} />
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Bio</label>
          <textarea value={profile.bio} onChange={e => update("bio")(e.target.value)} rows={3}
            className="w-full bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all resize-none" />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-5">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Dark Mode</p>
            <p className="text-xs text-muted-foreground mt-0.5">Switch between light and dark interface</p>
          </div>
          <Toggle checked={isDark} onChange={() => setIsDark(!isDark)} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "System", icon: <Activity size={16} /> },
            { label: "Compact", icon: <Menu size={16} /> },
            { label: "Spacious", icon: <Star size={16} /> },
          ].map((opt, i) => (
            <button key={opt.label}
              className={cx("flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm",
                i === 1 ? "border-primary bg-accent text-primary" : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground")}>
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-5">Notifications</h3>
        <div className="flex flex-col gap-5">
          {[
            { key: "mentions" as const, label: "Mentions", desc: "Get notified when someone @mentions you" },
            { key: "deadlines" as const, label: "Deadlines", desc: "Reminders 24h before due dates" },
            { key: "tasks" as const, label: "Task Updates", desc: "Status changes and assignments" },
            { key: "digests" as const, label: "Weekly Digest", desc: "Summary email every Monday morning" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Toggle checked={notifPrefs[item.key]} onChange={() => toggleNotif(item.key)} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-5">Security</h3>
        <div className="flex flex-col gap-3">
          <Button variant="outline" className="justify-start"><Shield size={16} /> Change Password</Button>
          <Button variant="outline" className="justify-start"><Star size={16} /> Enable Two-Factor Auth</Button>
          <Button variant="outline" className="justify-start"><Download size={16} /> Export My Data</Button>
          <div className="pt-2 border-t border-border">
            <Button variant="danger" className="justify-start"><Trash2 size={16} /> Delete Account</Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline">Discard Changes</Button>
        <Button variant="primary" onClick={handleSave}>
          {saved ? <><CheckCircle2 size={16} /> Saved!</> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>(() => loadCurrentUser() ? "dashboard" : "login");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [editTask, setEditTask] = useState<Task | undefined>();
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => loadCurrentUser());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (!currentUser && page !== "login" && page !== "register") {
      setPage("login");
      return;
    }

    if (currentUser && page === "login") {
      setPage("dashboard");
    }
  }, [currentUser, page]);

  useEffect(() => {
    if (!currentUser) {
      setTasks([]);
      setNotifications([]);
      return;
    }

    let mounted = true;

    const loadData = async () => {
      try {
        const [serverTasks, serverNotifications] = await Promise.all([
          listTasks(),
          listNotifications(),
        ]);

        if (!mounted) {
          return;
        }

        setTasks(scopeTasksForUser(serverTasks, currentUser));
        setNotifications(scopeNotificationsForUser(serverNotifications, currentUser));
        setApiError(null);
      } catch (error) {
        if (mounted) {
          setApiError("Backend is unavailable. Load the API server to fetch tasks and notifications.");
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [currentUser]);

  const navigate = (p: Page, id?: string) => {
    if (id) setSelectedTaskId(id);
    setPage(p);
    setShowNotifs(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? tasks[0];

  const handleAuthSuccess = async (user: UserAccount, remember: boolean) => {
    setCurrentUser(user);
    persistCurrentUser(user, remember);
    setApiError(null);
  };

  const refreshNotifications = async () => {
    if (!currentUser) {
      return;
    }

    try {
      const serverNotifications = await listNotifications();
      setNotifications(scopeNotificationsForUser(serverNotifications, currentUser));
    } catch {
      // Ignore notification refresh failures and keep the current local state.
    }
  };

  const handleSaveTask = async (data: Partial<Task>) => {
    if (!currentUser) {
      setApiError("Sign in to create or edit tasks.");
      return;
    }

    try {
      setApiError(null);

      if (editTask) {
        const updatedTask = await updateTask(editTask.id, {
          title: data.title ?? editTask.title,
          description: data.description ?? editTask.description,
          status: data.status ?? editTask.status,
          priority: data.priority ?? editTask.priority,
          dueDate: data.dueDate ?? editTask.dueDate,
          assignee: data.assignee ?? editTask.assignee,
          tags: typeof data.tags === "string" ? data.tags.split(",").map((item) => item.trim()).filter(Boolean) : data.tags ?? editTask.tags,
        });

        setTasks(ts => scopeTasksForUser(ts.map(task => (task.id === updatedTask.id ? updatedTask : task)), currentUser));
      } else {
        const createdTask = await createTask({
          title: data.title ?? "Untitled Task",
          description: data.description ?? "",
          status: data.status ?? "todo",
          priority: data.priority ?? "medium",
          dueDate: data.dueDate ?? "",
          assignee: data.assignee ?? currentUser.name,
          tags: typeof data.tags === "string" ? data.tags.split(",").map((item) => item.trim()).filter(Boolean) : data.tags ?? [],
        });

        setTasks(ts => scopeTasksForUser([createdTask, ...ts], currentUser));
      }

      await refreshNotifications();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to save task.");
      throw error;
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) {
      return;
    }

    if (!window.confirm(`Delete ${selectedTask.title}?`)) {
      return;
    }

    try {
      await deleteTask(selectedTask.id);
      setTasks(ts => ts.filter(task => task.id !== selectedTask.id));
      setSelectedTaskId(null);
      setPage("tasks");
      await refreshNotifications();
      setApiError(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to delete task.");
    }
  };

  const handleShareTask = async (userName: string) => {
    if (!selectedTask) {
      return;
    }

    try {
      const updatedTask = await shareTask(selectedTask.id, userName);
      setTasks(ts => scopeTasksForUser(ts.map(task => (task.id === updatedTask.id ? updatedTask : task)), currentUser));
      await refreshNotifications();
      setApiError(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to share task.");
      throw error;
    }
  };

  const pageTitles: Partial<Record<Page, string>> = {
    dashboard: "Dashboard",
    tasks: "Tasks",
    "task-detail": "Task Detail",
    analytics: "Analytics",
    settings: "Settings",
  };

  const isAuthPage = page === "login" || page === "register";

  if (isAuthPage) {
    return page === "login"
      ? <LoginPage navigate={navigate} onLogin={handleAuthSuccess} />
      : <RegisterPage navigate={navigate} onRegister={handleAuthSuccess} />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{ fontFamily: "var(--font-sans)" }}>
      <Sidebar current={page} navigate={navigate} collapsed={collapsed} setCollapsed={setCollapsed} currentUser={currentUser} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={pageTitles[page] ?? ""}
          notifCount={unreadCount}
          onNotifClick={() => setShowNotifs(true)}
          onSearch={page === "tasks" ? () => {} : undefined}
          isDark={isDark}
          setIsDark={setIsDark}
          currentUser={currentUser}
        />

        {apiError && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            {apiError}
          </div>
        )}

        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
          {page === "dashboard" && <DashboardPage tasks={tasks} navigate={navigate} />}
          {page === "tasks" && (
            <TasksPage tasks={tasks} onAddTask={() => { setEditTask(undefined); setShowModal(true); }} navigate={navigate} />
          )}
          {page === "task-detail" && selectedTask && (
            <TaskDetailPage
              task={selectedTask}
              navigate={navigate}
              onEdit={() => { setEditTask(selectedTask); setShowModal(true); }}
              onDelete={handleDeleteTask}
              onShare={handleShareTask}
            />
          )}
          {page === "analytics" && <AnalyticsPage />}
          {page === "settings" && <SettingsPage isDark={isDark} setIsDark={setIsDark} />}
        </main>
      </div>

      {showNotifs && (
        <NotificationsPanel
          notifs={notifications}
          onClose={() => setShowNotifs(false)}
          onMarkAll={() => setNotifications(n => n.map(x => ({ ...x, read: true })))}
        />
      )}

      {showModal && (
        <TaskModal
          onClose={() => {
            setShowModal(false);
            setEditTask(undefined);
          }}
          editTask={editTask}
          onSave={handleSaveTask}
        />
      )}
    </div>
  );
}
