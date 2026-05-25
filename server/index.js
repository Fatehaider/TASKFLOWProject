import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

const colorByAssignee = {
  'Sarah Chen': '#4F46E5',
  'Marcus Reid': '#22C55E',
  'Priya Nair': '#F59E0B',
  'James Wu': '#EF4444',
};

const DEFAULT_TASKS = [
  {
    id: 'T-001',
    title: 'Redesign user onboarding flow',
    description: 'Create a new onboarding experience that reduces time-to-value for new users by 40%. Includes interactive tooltips, progress tracking, and personalized checklists.',
    status: 'in-progress',
    priority: 'high',
    dueDate: '2026-06-15',
    assignee: 'Sarah Chen',
    assigneeColor: '#4F46E5',
    tags: ['design', 'ux'],
    progress: 65,
    attachments: 3,
    comments: 8,
    createdAt: '2026-05-01',
    shared: ['Marcus Reid', 'Priya Nair'],
  },
  {
    id: 'T-002',
    title: 'Integrate Stripe payment gateway',
    description: 'Connect payment processing to support subscriptions, one-time payments, and invoice generation. Handle webhooks for all payment lifecycle events.',
    status: 'done',
    priority: 'critical',
    dueDate: '2026-05-20',
    assignee: 'Marcus Reid',
    assigneeColor: '#22C55E',
    tags: ['backend', 'payments'],
    progress: 100,
    attachments: 2,
    comments: 14,
    createdAt: '2026-04-18',
    shared: ['Sarah Chen'],
  },
  {
    id: 'T-003',
    title: 'Write API documentation',
    description: 'Document all REST endpoints with request/response examples, authentication flows, rate limiting, and error codes. Target: OpenAPI 3.0 spec.',
    status: 'review',
    priority: 'medium',
    dueDate: '2026-06-01',
    assignee: 'Priya Nair',
    assigneeColor: '#F59E0B',
    tags: ['docs', 'api'],
    progress: 80,
    attachments: 1,
    comments: 3,
    createdAt: '2026-05-05',
    shared: ['Marcus Reid', 'James Wu'],
  },
  {
    id: 'T-004',
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing, linting, and deployment to staging and production environments. Include rollback procedures.',
    status: 'todo',
    priority: 'high',
    dueDate: '2026-06-10',
    assignee: 'James Wu',
    assigneeColor: '#EF4444',
    tags: ['devops', 'infra'],
    progress: 0,
    attachments: 0,
    comments: 2,
    createdAt: '2026-05-10',
    shared: [],
  },
];

const DEFAULT_NOTIFICATIONS = [
  { id: 'N-001', type: 'mention', message: 'Sarah Chen mentioned you in T-001: "Need @you to review the wireframes"', time: '5m ago', read: false, actor: 'SC', actorColor: '#4F46E5' },
  { id: 'N-002', type: 'deadline', message: 'T-007 Mobile accessibility audit is due in 5 days', time: '1h ago', read: false, actor: '⚠', actorColor: '#F59E0B' },
  { id: 'N-003', type: 'task', message: 'Marcus Reid completed Stripe payment gateway integration', time: '2h ago', read: false, actor: 'MR', actorColor: '#22C55E' },
  { id: 'N-004', type: 'task', message: 'James Wu added you as a collaborator on T-004', time: '4h ago', read: true, actor: 'JW', actorColor: '#EF4444' },
  { id: 'N-005', type: 'system', message: 'Your storage is at 80% capacity. Consider upgrading your plan.', time: '1d ago', read: true, actor: '⚡', actorColor: '#6366F1' },
  { id: 'N-006', type: 'mention', message: 'Priya Nair assigned T-003 to you for review', time: '1d ago', read: true, actor: 'PN', actorColor: '#F59E0B' },
];

app.use(cors());
app.use(express.json());

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(TASKS_FILE);
  } catch {
    await fs.writeFile(TASKS_FILE, JSON.stringify(DEFAULT_TASKS, null, 2), 'utf8');
  }

  try {
    await fs.access(NOTIFICATIONS_FILE);
  } catch {
    await fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(DEFAULT_NOTIFICATIONS, null, 2), 'utf8');
  }
}

async function readJson(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function isValidStatus(status) {
  return ['todo', 'in-progress', 'review', 'done'].includes(status);
}

function isValidPriority(priority) {
  return ['low', 'medium', 'high', 'critical'].includes(priority);
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => String(tag).trim())
    .filter(Boolean);
}

function buildTask(taskData) {
  const assignee = String(taskData.assignee || '').trim();

  return {
    id: `T-${randomUUID().slice(0, 8)}`,
    title: String(taskData.title || '').trim(),
    description: String(taskData.description || '').trim(),
    status: isValidStatus(taskData.status) ? taskData.status : 'todo',
    priority: isValidPriority(taskData.priority) ? taskData.priority : 'medium',
    dueDate: String(taskData.dueDate || '').trim(),
    assignee,
    assigneeColor: colorByAssignee[assignee] || '#94A3B8',
    tags: normalizeTags(taskData.tags),
    progress: Number.isFinite(Number(taskData.progress)) ? Math.max(0, Math.min(100, Number(taskData.progress))) : 0,
    attachments: Number.isFinite(Number(taskData.attachments)) ? Math.max(0, Number(taskData.attachments)) : 0,
    comments: Number.isFinite(Number(taskData.comments)) ? Math.max(0, Number(taskData.comments)) : 0,
    createdAt: new Date().toISOString().slice(0, 10),
    shared: Array.isArray(taskData.shared) ? taskData.shared.filter(Boolean) : [],
  };
}

function buildNotification(type, message, actor = 'System', actorColor = '#6366F1') {
  return {
    id: `N-${randomUUID().slice(0, 8)}`,
    type,
    message,
    time: 'Just now',
    read: false,
    actor,
    actorColor,
  };
}

async function appendNotification(notification) {
  const notifications = await readJson(NOTIFICATIONS_FILE);
  notifications.unshift(notification);
  await writeJson(NOTIFICATIONS_FILE, notifications);
}

function validateTaskInput(body) {
  if (typeof body.title !== 'string' || !body.title.trim()) {
    return 'Title is required.';
  }
  if (typeof body.description !== 'string' || !body.description.trim()) {
    return 'Description is required.';
  }
  if (typeof body.assignee !== 'string' || !body.assignee.trim()) {
    return 'Assignee is required.';
  }
  if (!isValidStatus(body.status)) {
    return 'Status must be one of: todo, in-progress, review, done.';
  }
  if (!isValidPriority(body.priority)) {
    return 'Priority must be one of: low, medium, high, critical.';
  }
  if (typeof body.dueDate !== 'string' || !body.dueDate.trim()) {
    return 'Due date is required.';
  }

  return null;
}

app.get('/api/tasks', async (_req, res) => {
  const tasks = await readJson(TASKS_FILE);
  res.json(tasks);
});

app.get('/api/tasks/:id', async (req, res) => {
  const tasks = await readJson(TASKS_FILE);
  const task = tasks.find((item) => item.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  res.json(task);
});

app.post('/api/tasks', async (req, res) => {
  const error = validateTaskInput(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const tasks = await readJson(TASKS_FILE);
  const task = buildTask(req.body);
  tasks.unshift(task);
  await writeJson(TASKS_FILE, tasks);
  await appendNotification(buildNotification('task', `New task created: ${task.title}`, 'System'));

  res.status(201).json(task);
});

app.put('/api/tasks/:id', async (req, res) => {
  const tasks = await readJson(TASKS_FILE);
  const task = tasks.find((item) => item.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const safeBody = {
    ...req.body,
    title: typeof req.body.title === 'string' ? req.body.title : task.title,
    description: typeof req.body.description === 'string' ? req.body.description : task.description,
    status: isValidStatus(req.body.status) ? req.body.status : task.status,
    priority: isValidPriority(req.body.priority) ? req.body.priority : task.priority,
    dueDate: typeof req.body.dueDate === 'string' ? req.body.dueDate : task.dueDate,
    assignee: typeof req.body.assignee === 'string' ? req.body.assignee : task.assignee,
    tags: Array.isArray(req.body.tags) ? req.body.tags : task.tags,
    progress: Number.isFinite(Number(req.body.progress)) ? Number(req.body.progress) : task.progress,
    attachments: Number.isFinite(Number(req.body.attachments)) ? Number(req.body.attachments) : task.attachments,
    comments: Number.isFinite(Number(req.body.comments)) ? Number(req.body.comments) : task.comments,
  };

  const validationError = validateTaskInput(safeBody);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const updatedTask = {
    ...task,
    ...safeBody,
    assigneeColor: colorByAssignee[safeBody.assignee] || task.assigneeColor,
    tags: normalizeTags(safeBody.tags),
    progress: Math.max(0, Math.min(100, Number(safeBody.progress))),
    attachments: Math.max(0, Number(safeBody.attachments)),
    comments: Math.max(0, Number(safeBody.comments)),
  };

  const nextTasks = tasks.map((item) => (item.id === req.params.id ? updatedTask : item));
  await writeJson(TASKS_FILE, nextTasks);

  if (safeBody.status !== task.status) {
    await appendNotification(buildNotification('task', `Task ${updatedTask.title} moved to ${safeBody.status}.`, updatedTask.assignee, updatedTask.assigneeColor));
  }

  res.json(updatedTask);
});

app.delete('/api/tasks/:id', async (req, res) => {
  const tasks = await readJson(TASKS_FILE);
  const filtered = tasks.filter((item) => item.id !== req.params.id);

  if (filtered.length === tasks.length) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  await writeJson(TASKS_FILE, filtered);
  res.json({ message: 'Task deleted successfully.' });
});

app.put('/api/tasks/:id/share', async (req, res) => {
  const tasks = await readJson(TASKS_FILE);
  const task = tasks.find((item) => item.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const userName = typeof req.body.userName === 'string' ? req.body.userName.trim() : '';
  if (!userName) {
    return res.status(400).json({ error: 'A user name is required.' });
  }

  const shared = Array.from(new Set([...task.shared, userName]));
  const updatedTask = { ...task, shared };

  const nextTasks = tasks.map((item) => (item.id === req.params.id ? updatedTask : item));
  await writeJson(TASKS_FILE, nextTasks);
  await appendNotification(buildNotification('task', `${task.assignee} shared "${task.title}" with ${userName}.`, userName, '#4F46E5'));

  res.json(updatedTask);
});

app.get('/api/tasks/shared', async (req, res) => {
  const tasks = await readJson(TASKS_FILE);
  const userName = typeof req.query.user === 'string' ? req.query.user : '';

  const sharedTasks = userName
    ? tasks.filter((task) => task.shared.includes(userName))
    : tasks.filter((task) => task.shared.length > 0);

  res.json(sharedTasks);
});

app.get('/api/notifications', async (_req, res) => {
  const notifications = await readJson(NOTIFICATIONS_FILE);
  res.json(notifications);
});

app.get('/api/analytics/overview', async (_req, res) => {
  const tasks = await readJson(TASKS_FILE);
  const completed = tasks.filter((task) => task.status === 'done').length;
  const pending = tasks.filter((task) => task.status !== 'done').length;
  const overdue = tasks.filter((task) => task.status !== 'done' && new Date(task.dueDate) < new Date()).length;

  res.json({
    totalTasks: tasks.length,
    completedTasks: completed,
    pendingTasks: pending,
    overdueTasks: overdue,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

await ensureStorage();

app.listen(PORT, () => {
  console.log(`TaskFlow API server running on http://localhost:${PORT}`);
});
