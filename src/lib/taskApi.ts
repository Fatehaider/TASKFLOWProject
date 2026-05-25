export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "critical";
  dueDate: string;
  assignee: string;
  assigneeColor: string;
  tags: string[];
  progress: number;
  attachments: number;
  comments: number;
  createdAt: string;
  shared: string[];
};

export type NotificationRecord = {
  id: string;
  type: "task" | "mention" | "deadline" | "system";
  message: string;
  time: string;
  read: boolean;
  actor: string;
  actorColor: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  color: string;
};

export type TaskPayload = {
  title: string;
  description: string;
  status: TaskRecord["status"];
  priority: TaskRecord["priority"];
  dueDate: string;
  assignee: string;
  tags: string[];
  progress?: number;
  attachments?: number;
  comments?: number;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data as T;
}

export async function registerUser(payload: RegisterPayload): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: LoginPayload): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listTasks(): Promise<TaskRecord[]> {
  return request<TaskRecord[]>("/tasks");
}

export async function getTask(taskId: string): Promise<TaskRecord> {
  return request<TaskRecord>(`/tasks/${taskId}`);
}

export async function createTask(payload: TaskPayload): Promise<TaskRecord> {
  return request<TaskRecord>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTask(taskId: string, payload: Partial<TaskPayload>): Promise<TaskRecord> {
  return request<TaskRecord>(`/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(taskId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function shareTask(taskId: string, userName: string): Promise<TaskRecord> {
  return request<TaskRecord>(`/tasks/${taskId}/share`, {
    method: "PUT",
    body: JSON.stringify({ userName }),
  });
}

export async function listNotifications(): Promise<NotificationRecord[]> {
  return request<NotificationRecord[]>("/notifications");
}
