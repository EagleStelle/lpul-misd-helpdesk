# LPU MISD Helpdesk

LPU MISD Helpdesk is a ticketing and support application for MISD service requests. It includes a React/Vite frontend, an Express API, Supabase-backed data/auth flows, ticket chat, admin management, analytics, knowledge base features, and an optional AI chatbot.

## Tech Stack

- React 19
- Vite
- Tailwind CSS
- Express 4
- Supabase
- Docker / Docker Compose

## Repository Structure

```text
.
|-- backend/              # Express API, routes, services, Supabase setup
|-- public/               # Static frontend assets
|-- src/                  # React application
|-- Dockerfile            # Multi-stage production image
|-- docker-compose.yml    # Single-service app deployment
|-- package.json          # Frontend scripts/dependencies
`-- .env.example          # Local environment template
```

## Prerequisites

- Node.js 20 or newer
- npm
- Docker and Docker Compose
- Supabase project
- Supabase SQL schema from [backend/schema.sql](backend/schema.sql) applied once

## Environment Variables

Required values:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
```

Optional values:

```env
MAGIC_LINK_ALLOWED_DOMAINS=@lpulaguna.edu.ph,@lpusc.edu.ph
ADMIN_SEED_FULL_NAME=System Admin
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
GEMINI_API_KEY=
GROQ_API_KEY=
```

Notes:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are browser-visible public values.
- `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` are backend-only secrets.
- `GEMINI_API_KEY` and `GROQ_API_KEY` are only needed for AI/chatbot features.
- Admin invitation email is sent by Supabase Auth using the Supabase project's configured email provider.
- Docker deployment does not require a separate `.env` file. Set the values directly in the deployment `docker-compose.yml` shown below.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the contents of [backend/schema.sql](backend/schema.sql).
4. For local development, copy the project URL, anon key, and service role key into the relevant `.env` files.
5. Configure Supabase Auth email settings if admin invitations or magic-link login are used.

## Local Development

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Create local environment files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Start the backend:

```bash
cd backend
npm start
```

Start the frontend in another terminal:

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Health check: `http://localhost:5000/health`

## Docker

The Docker image is a single production image. The frontend is built in a temporary stage, backend production dependencies are installed in a separate stage, and the final container runs Express as the non-root `node` user. Express serves both the API and the compiled frontend.

Runtime environment values are not baked into the image. Browser runtime config is served dynamically from `/env.js`.

When using the repository `docker-compose.yml` for local builds, provide environment values through your shell or a local `.env` file. For server deployment without a `.env` file, use the deployment Compose setup below.

Build the image:

```bash
docker compose build
```

Run locally with Docker Compose:

```bash
docker compose up -d
```

Default Docker URLs:

- App: `http://localhost:8080`
- API: `http://localhost:8080/api`
- Health check: `http://localhost:8080/health`

Stop the app:

```bash
docker compose down
```

## Publishing

The Compose file tags the image as:

```text
eaglestelle/lpul-misd-helpdesk:latest
```

Build and push:

```bash
docker compose build
docker push eaglestelle/lpul-misd-helpdesk:latest
```

## Server Deployment

On the server, create a deployment directory and place only `docker-compose.yml` in it.

Use this Docker Compose setup and replace the placeholder values before starting the container:

```yaml
services:
  lpul-misd-helpdesk:
    image: eaglestelle/lpul-misd-helpdesk:latest
    environment:
      VITE_SUPABASE_URL: https://your-project-id.supabase.co
      VITE_SUPABASE_ANON_KEY: your-anon-key-here
      SUPABASE_SERVICE_ROLE_KEY: your-service-role-key-here
      JWT_SECRET: replace-with-a-long-random-hex-string
      MAGIC_LINK_ALLOWED_DOMAINS: "@lpulaguna.edu.ph,@lpusc.edu.ph"
      ADMIN_SEED_FULL_NAME: System Admin
      ADMIN_SEED_EMAIL: admin@example.com
      ADMIN_SEED_PASSWORD: change-me-now
      GEMINI_API_KEY: ""
      GROQ_API_KEY: ""
    ports:
      - "8080:5000"
    restart: unless-stopped
```

Keep the server copy of `docker-compose.yml` private because it contains backend secrets.

Pull and start the published image:

```bash
docker compose pull
docker compose up -d
```

View logs:

```bash
docker compose logs -f lpul-misd-helpdesk
```

Update to a newer image:

```bash
docker compose pull
docker compose up -d
```

Do not use `docker compose up --build` on a server that only has the deployment `docker-compose.yml`; building requires the full repository.

## Scripts

Frontend scripts:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Backend scripts:

```bash
cd backend
npm start
npm run dev
```

## Verification

Before handing off or deploying changes:

```bash
npm run lint
npm run build
docker compose config --quiet
docker compose build
```

Optional dependency checks:

```bash
npm audit --omit=dev
cd backend
npm audit --omit=dev
```

## Troubleshooting

If the backend fails on startup, confirm that:

- `SUPABASE_SERVICE_ROLE_KEY` is set.
- `JWT_SECRET` is set.
- `backend/schema.sql` has been applied to Supabase.
- Supabase Auth email settings are configured if invitation or magic-link email is used.

If the frontend cannot connect to the API in Docker, confirm that:

- The app is opened through `http://localhost:8080`.
- Requests use same-origin `/api`.
- `/env.js` returns the expected public Supabase values.

If chatbot or AI features fail, confirm that the required provider keys are configured:

- `GEMINI_API_KEY`
- `GROQ_API_KEY`
