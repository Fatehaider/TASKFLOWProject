import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('MONGO_URI environment variable is required.');
}

function extractDatabaseName(uri) {
  const rawPath = uri.split('/').slice(3).join('/');
  const databaseName = rawPath.split('?')[0];
  return databaseName || 'taskmanagement';
}

const DATABASE_NAME = process.env.MONGO_DB_NAME || extractDatabaseName(MONGO_URI);

const colorByAssignee = {
  'Sarah Chen': '#4F46E5',
  'Marcus Reid': '#22C55E',
  'Priya Nair': '#F59E0B',
  'James Wu': '#EF4444',
};

const client = new MongoClient(MONGO_URI);
let tasksCollection;
let notificationsCollection;

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

function stripMongoId(record) {
  if (!record) {
    return record;
  }

  const { _id, ...rest } = record;
  return rest;
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
    createdAt: new Date().toISOString(),
  };
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

async function connectDatabase() {
  await client.connect();
  const db = client.db(DATABASE_NAME);
  tasksCollection = db.collection('taskflow_tasks');
  notificationsCollection = db.collection('taskflow_notifications');

  await tasksCollection.createIndex({ id: 1 }, { unique: true });
  await notificationsCollection.createIndex({ id: 1 }, { unique: true });
  await tasksCollection.createIndex({ createdAt: -1 });
  await notificationsCollection.createIndex({ createdAt: -1 });
}

async function appendNotification(notification) {
  await notificationsCollection.insertOne(notification);
}

async function getTasks() {
  const tasks = await tasksCollection.find({}).sort({ createdAt: -1 }).toArray();
  return tasks.map(stripMongoId);
}

async function getNotifications() {
  const notifications = await notificationsCollection.find({}).sort({ createdAt: -1 }).toArray();
  return notifications.map(stripMongoId);
}

app.use(cors());
app.use(express.json());

app.get('/api/tasks', async (_req, res) => {
  try {
    const tasks = await getTasks();
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load tasks.' });
  }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = stripMongoId(await tasksCollection.findOne({ id: req.params.id }));

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load task.' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const error = validateTaskInput(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const task = buildTask(req.body);
    await tasksCollection.insertOne(task);
    await appendNotification(buildNotification('task', `New task created: ${task.title}`, 'System'));

    res.status(201).json(stripMongoId(task));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create task.' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const currentTask = stripMongoId(await tasksCollection.findOne({ id: req.params.id }));

    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const safeBody = {
      ...req.body,
      title: typeof req.body.title === 'string' ? req.body.title : currentTask.title,
      description: typeof req.body.description === 'string' ? req.body.description : currentTask.description,
      status: isValidStatus(req.body.status) ? req.body.status : currentTask.status,
      priority: isValidPriority(req.body.priority) ? req.body.priority : currentTask.priority,
      dueDate: typeof req.body.dueDate === 'string' ? req.body.dueDate : currentTask.dueDate,
      assignee: typeof req.body.assignee === 'string' ? req.body.assignee : currentTask.assignee,
      tags: Array.isArray(req.body.tags) ? req.body.tags : currentTask.tags,
      progress: Number.isFinite(Number(req.body.progress)) ? Number(req.body.progress) : currentTask.progress,
      attachments: Number.isFinite(Number(req.body.attachments)) ? Number(req.body.attachments) : currentTask.attachments,
      comments: Number.isFinite(Number(req.body.comments)) ? Number(req.body.comments) : currentTask.comments,
    };

    const validationError = validateTaskInput(safeBody);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const updatedTask = {
      ...currentTask,
      ...safeBody,
      assigneeColor: colorByAssignee[safeBody.assignee] || currentTask.assigneeColor,
      tags: normalizeTags(safeBody.tags),
      progress: Math.max(0, Math.min(100, Number(safeBody.progress))),
      attachments: Math.max(0, Number(safeBody.attachments)),
      comments: Math.max(0, Number(safeBody.comments)),
    };

    await tasksCollection.replaceOne({ id: req.params.id }, updatedTask);

    if (safeBody.status !== currentTask.status) {
      await appendNotification(buildNotification('task', `Task ${updatedTask.title} moved to ${safeBody.status}.`, updatedTask.assignee, updatedTask.assigneeColor));
    }

    res.json(stripMongoId(updatedTask));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update task.' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const result = await tasksCollection.deleteOne({ id: req.params.id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete task.' });
  }
});

app.put('/api/tasks/:id/share', async (req, res) => {
  try {
    const task = stripMongoId(await tasksCollection.findOne({ id: req.params.id }));

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const userName = typeof req.body.userName === 'string' ? req.body.userName.trim() : '';
    if (!userName) {
      return res.status(400).json({ error: 'A user name is required.' });
    }

    const shared = Array.from(new Set([...task.shared, userName]));
    const updatedTask = { ...task, shared };

    await tasksCollection.replaceOne({ id: req.params.id }, updatedTask);
    await appendNotification(buildNotification('task', `${task.assignee} shared "${task.title}" with ${userName}.`, userName, '#4F46E5'));

    res.json(stripMongoId(updatedTask));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to share task.' });
  }
});

app.get('/api/tasks/shared', async (req, res) => {
  try {
    const userName = typeof req.query.user === 'string' ? req.query.user : '';
    const query = userName ? { shared: userName } : { shared: { $exists: true, $ne: [] } };
    const tasks = await tasksCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.json(tasks.map(stripMongoId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load shared tasks.' });
  }
});

app.get('/api/notifications', async (_req, res) => {
  try {
    const notifications = await getNotifications();
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load notifications.' });
  }
});

app.get('/api/analytics/overview', async (_req, res) => {
  try {
    const tasks = await getTasks();
    const completed = tasks.filter((task) => task.status === 'done').length;
    const pending = tasks.filter((task) => task.status !== 'done').length;
    const overdue = tasks.filter((task) => task.status !== 'done' && new Date(task.dueDate) < new Date()).length;

    res.json({
      totalTasks: tasks.length,
      completedTasks: completed,
      pendingTasks: pending,
      overdueTasks: overdue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load analytics.' });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

async function main() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`TaskFlow API server running on http://localhost:${PORT}`);
  });

  process.on('SIGINT', async () => {
    await client.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start TaskFlow API server:', error);
  process.exit(1);
});
