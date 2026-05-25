
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

## Demo recording checklist

Use this checklist before recording your final submission video:

1. Start both servers:
   - `npm run dev:backend`
   - `npm run dev`
2. Open the app at `http://127.0.0.1:5173`
3. Record the following flow:
   - Login or open the dashboard
   - Create a new task
   - Edit an existing task
   - Share a task
   - Open task detail screen
   - Show notifications
4. Keep the recording short and clear (60–120 seconds is enough).
5. Mention the backend URL and the frontend URL in the video intro.

## GitHub submission checklist

Before pushing to GitHub, confirm that the repository contains:

- Working frontend and backend code
- Updated `README.md` with setup instructions
- Screenshots or a short demo note if needed
- A public repository link
- A clear project description and features list

If you want, I can also help draft the GitHub repository description and the final video script.
  