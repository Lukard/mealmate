# Deployment Guide

This guide covers deploying the Meal Automation application to production using Vercel (UI), Railway (API), and Supabase (Database).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Database Setup (Supabase)](#database-setup-supabase)
4. [API Deployment (Railway)](#api-deployment-railway)
5. [UI Deployment (Vercel)](#ui-deployment-vercel)
6. [DNS Configuration](#dns-configuration)
7. [SSL Certificates](#ssl-certificates)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- Node.js 20+ installed locally
- Git repository with your code
- Accounts on:
  - [Supabase](https://supabase.com) (free tier available)
  - [Railway](https://railway.app) (hobby plan available)
  - [Vercel](https://vercel.com) (free tier available)
- Domain name (optional, for custom domains)

---

## Environment Variables

### API Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Supabase PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) | Yes |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (min 32 chars) | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time (e.g., `15m`) | No |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration (e.g., `7d`) | No |
| `REDIS_URL` | Redis connection string (optional) | No |
| `CORS_ORIGIN` | Allowed CORS origin (your UI URL) | Yes |
| `NODE_ENV` | Environment (`production`) | Yes |

### UI Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `NEXT_PUBLIC_GA_ID` | Google Analytics ID | No |

### Generating Secrets

```bash
# Generate JWT secrets (use different values for each)
openssl rand -base64 32
```

---

## Database Setup (Supabase)

### 1. Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details:
   - Name: `meal-automation`
   - Database Password: Use a strong password
   - Region: Choose closest to your users

### 2. Get Connection String

1. Go to Project Settings > Database
2. Copy the "Connection string" (URI format)
3. Replace `[YOUR-PASSWORD]` with your database password

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 3. Run Database Migrations

```bash
# Set the DATABASE_URL environment variable
export DATABASE_URL="your-supabase-connection-string"

# Run migrations
cd src/api
npm run db:migrate
```

### 4. Enable Row Level Security (RLS)

In Supabase SQL Editor, run:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

-- Create policies (example for users table)
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

---

## API Deployment (Railway)

### 1. Connect Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" > "Deploy from GitHub repo"
3. Select your repository
4. Configure the service:
   - Root Directory: `/` (monorepo root)
   - Build Command: `cd src/api && npm ci && npm run build`
   - Start Command: `cd src/api && npm run start`

### 2. Configure Environment Variables

In Railway project settings, add:

```
DATABASE_URL=your-supabase-connection-string
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
NODE_ENV=production
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

### 3. Add Health Check

Railway will automatically detect the health check endpoint from `railway.json`:
- Path: `/api/v1/health`
- Timeout: 30 seconds

### 4. Custom Domain (Optional)

1. Go to Settings > Domains
2. Add your custom domain
3. Configure DNS (see [DNS Configuration](#dns-configuration))

---

## UI Deployment (Vercel)

### 1. Import Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" > "Project"
3. Import your GitHub repository
4. Configure:
   - Framework: Next.js (auto-detected)
   - Root Directory: `src/ui`

### 2. Configure Environment Variables

In Vercel project settings, add:

```
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
```

For production, use your custom API domain if configured.

### 3. Configure Build Settings

Vercel will use `vercel.json` automatically:
- Build Command: `npm run build`
- Output Directory: `.next`

### 4. Custom Domain (Optional)

1. Go to Settings > Domains
2. Add your custom domain
3. Configure DNS (see [DNS Configuration](#dns-configuration))

---

## DNS Configuration

### For Custom Domains

#### API Domain (Railway)

Add these DNS records:

| Type | Name | Value |
|------|------|-------|
| CNAME | api | your-railway-app.up.railway.app |

#### UI Domain (Vercel)

Add these DNS records:

| Type | Name | Value |
|------|------|-------|
| CNAME | @ or www | cname.vercel-dns.com |
| A | @ | 76.76.21.21 |

### DNS Propagation

DNS changes can take up to 48 hours to propagate. Use tools like:
- [DNS Checker](https://dnschecker.org)
- [What's My DNS](https://whatsmydns.net)

---

## SSL Certificates

### Railway
- SSL certificates are automatically provisioned via Let's Encrypt
- HTTPS is enabled by default for all custom domains

### Vercel
- SSL certificates are automatically provisioned
- HTTPS is enforced by default
- Supports automatic renewal

### Supabase
- All connections use SSL by default
- Connection string includes `?sslmode=require`

---

## CI/CD Pipeline

### GitHub Actions Setup

1. Go to your repository Settings > Secrets and variables > Actions
2. Add these secrets:

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API token |
| `RAILWAY_PROJECT_ID` | Railway project ID |
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `CODECOV_TOKEN` | Codecov token (optional) |
| `SNYK_TOKEN` | Snyk token (optional) |

### Getting Tokens

**Railway:**
```bash
railway login
railway whoami  # Shows your token
```

**Vercel:**
1. Go to Account Settings > Tokens
2. Create a new token with full access

### Workflow Triggers

- **CI Pipeline**: Runs on every push and PR to `main` and `develop`
- **Deploy Pipeline**: Runs on push to `main` or manual trigger

---

## Monitoring and Logging

### Railway
- Built-in logging in the dashboard
- Metrics for CPU, memory, and network
- Set up alerts in Settings > Alerts

### Vercel
- Built-in analytics (Vercel Analytics)
- Function logs in the dashboard
- Edge network monitoring

### Recommended External Tools

1. **Error Tracking**: [Sentry](https://sentry.io)
2. **APM**: [Datadog](https://datadoghq.com) or [New Relic](https://newrelic.com)
3. **Uptime Monitoring**: [UptimeRobot](https://uptimerobot.com) or [Pingdom](https://pingdom.com)

### Adding Sentry

```bash
# Install Sentry
npm install @sentry/node @sentry/nextjs
```

Configure in your applications following Sentry's documentation.

---

## Troubleshooting

### Common Issues

#### Database Connection Errors

```
Error: Connection refused
```

**Solution:**
1. Check DATABASE_URL is correct
2. Verify Supabase project is active
3. Check if IP is whitelisted (if using connection pooling)

#### Build Failures

```
Error: Module not found
```

**Solution:**
1. Ensure all dependencies are in `package.json`
2. Check for case-sensitive import issues
3. Verify monorepo workspace configuration

#### CORS Errors

```
Access-Control-Allow-Origin header missing
```

**Solution:**
1. Verify `CORS_ORIGIN` matches your UI URL exactly
2. Include protocol (https://)
3. No trailing slash

#### JWT Errors

```
Error: Invalid token
```

**Solution:**
1. Ensure JWT_SECRET matches between API and token generation
2. Check token expiration
3. Verify token format in Authorization header

### Health Check Endpoints

Test your deployments:

```bash
# API health check
curl https://your-api-url.com/api/v1/health

# Expected response
{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

### Logs Access

**Railway:**
```bash
railway logs -f
```

**Vercel:**
```bash
vercel logs your-project-url
```

---

## Rollback Procedures

### Railway
1. Go to Deployments tab
2. Click on a previous deployment
3. Click "Redeploy"

### Vercel
1. Go to Deployments tab
2. Find the previous deployment
3. Click "..." > "Promote to Production"

### Database
```bash
# If using Drizzle migrations
npm run db:rollback

# Or restore from Supabase backup
# Go to Database > Backups in Supabase dashboard
```

---

## Security Checklist

Before going to production, verify:

- [ ] All secrets are stored in environment variables
- [ ] JWT secrets are unique and at least 32 characters
- [ ] Database uses SSL connections
- [ ] RLS policies are enabled on all tables
- [ ] CORS is configured for specific origins only
- [ ] Rate limiting is enabled
- [ ] Input validation is in place
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are up to date (npm audit)
- [ ] HTTPS is enforced on all endpoints

---

## Support

For issues:
- Railway: [Railway Discord](https://discord.gg/railway)
- Vercel: [Vercel Support](https://vercel.com/support)
- Supabase: [Supabase Discord](https://discord.supabase.com)
