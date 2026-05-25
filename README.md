
# TaskFlow

TaskFlow is a React-based task management dashboard with a lightweight Express backend for CRUD, sharing, notifications, and analytics-style data.

## Features

- Create, edit, and delete tasks
- Search and filter tasks from the UI
- Share tasks with collaborators
- View task notifications
- Backend APIs backed by a local JSON store

## Running the app

1. Install dependencies

   `npm install`

2. Start the backend API

   `npm run dev:backend`

3. In a second terminal, start the frontend

   `npm run dev`

4. Open the frontend at `http://localhost:5173`

## API routes

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `PUT /api/tasks/:id/share`
- `GET /api/tasks/shared`
- `GET /api/notifications`
- `GET /api/analytics/overview`

## Notes

The frontend proxies `/api` requests to `http://localhost:4000` during development, so both servers need to be running at the same time.
  