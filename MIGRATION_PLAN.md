# MealMate Migration Plan: Railway → Vercel + Supabase

## Current Architecture
- **API:** Hono + @hono/node-server + Drizzle ORM
- **UI:** Next.js 14
- **Database:** PostgreSQL (Railway)
- **Cache:** Redis (optional)

## Target Architecture
- **API:** Vercel Serverless Functions (or Edge)
- **UI:** Vercel (native Next.js)
- **Database:** Supabase PostgreSQL
- **Cache:** Upstash Redis (if needed)

---

## Step 1: Set up Supabase

1. Go to https://supabase.com
2. Create new project "mealmate"
3. Get connection string from Settings > Database
4. Note: Use "Connection Pooler" URL for serverless

## Step 2: Migrate Database

```bash
# Export from Railway (if still accessible)
pg_dump $RAILWAY_DATABASE_URL > mealmate_backup.sql

# Import to Supabase
psql $SUPABASE_DATABASE_URL < mealmate_backup.sql

# Or use Drizzle to push schema
cd src/api
DATABASE_URL=$SUPABASE_DATABASE_URL npm run db:push
npm run db:seed
```

## Step 3: Configure Vercel

1. Go to https://vercel.com
2. Import from GitHub: Lukard/mealmate
3. Configure:
   - Root Directory: `src/ui`
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

## Step 4: API Deployment Options

### Option A: Vercel Serverless (Recommended)
Create `src/ui/app/api/[...route]/route.ts`:
```typescript
import { Hono } from 'hono'
import { handle } from 'hono/vercel'

const app = new Hono().basePath('/api')

// Import routes from API package
// app.route('/v1', apiRoutes)

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
```

### Option B: Separate API on Render/Fly.io
Keep API separate, deploy to free tier of Render or Fly.io

## Step 5: Environment Variables (Vercel)

```
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
JWT_SECRET=your-production-secret
JWT_REFRESH_SECRET=your-refresh-secret
NEXT_PUBLIC_API_URL=https://mealmate.vercel.app/api
```

## Step 6: Update CORS

In API, update CORS to allow Vercel domain:
```typescript
app.use('*', cors({
  origin: ['https://mealmate.vercel.app', 'http://localhost:3000']
}))
```

---

## Timeline
- [ ] Set up Supabase (5 min)
- [ ] Migrate/recreate database schema (10 min)
- [ ] Deploy UI to Vercel (5 min)
- [ ] Integrate API routes (30 min)
- [ ] Test deployment (10 min)

**Total: ~1 hour**
