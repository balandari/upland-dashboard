# Upland Dashboard -- Implementation Plan

## Goal
Transform the dashboard from a manual data tracker into an actionable guide with Upland API integration, guide mode (recommendations), and a data-driven decision engine.

## Constraints
- Modify existing project in place (no rebuild)
- Vanilla HTML/CSS/JS (no framework)
- Vercel serverless functions for backend
- Upstash Redis (free tier) for session storage
- Multi-page architecture allowed
- Developer account registration required (manual Upland approval -- setup instructions provided, code built to work once approved)

---

## Design Foundation

### Token Specification (Existing)

The project already has `token-specification.md` with resolved tokens. Per the frontend-design skill Entry Check, INTENT/direction derivation is skipped. All new pages and components use these resolved tokens:

```
DIRECTION: Precision Instrument with Density: mid-to-compact, Saturation: low-to-muted

TYPOGRAPHY:  geometric-sans headings (600-700), humanist-sans body, 14px min, 1.5 line-height, 1.200 minor-third scale, 1 family (system stack)
COLOR:       saturated-cool accent (1), cool neutrals (wide 8-10 steps), neutrals-only surfaces, light-on-dark
SPACING:     6px base, comfortable density, 18-30px section gaps, 12-18px component padding
SHAPE:       4-6px radius, subtle-1px borders, no shadows
MOTION:      150-250ms, standard-ease, functional-only
LAYOUT:      5-8 content groups per viewport, regular grid, minimal whitespace
```

These tokens are already implemented in `styles.css` as CSS custom properties (`:root` block, lines 15-83). All new CSS additions must use existing custom properties -- no raw values.

### Architecture Decisions (Per Page)

Per the frontend-design skill Architecture Decision Framework, each new page gets an architecture decision before implementation.

**Dashboard (dashboard.html) -- Existing, Bento Grid**
- Already a 2-column grid with mixed-width cards (standard + wide). No architecture change needed.
- Enhancement: inline recommendation components added within existing card bodies.

**Landing Page (index.html) -- Hero-Dominant**
- Single primary action: "Connect Your Account"
- The page must communicate its purpose in 3 seconds: "Connect your Upland account to get personalized strategy recommendations"
- Hero contains: headline + brief description + Connect button
- Below fold: feature preview (what you get when connected) -- optional, not required for MVP
- Minimal page. Auth flow is the content.

**Portfolio Page (portfolio.html) -- Precision Instrument (Data Table)**
- Expert user viewing property data. Information density is the priority.
- Architecture: Summary stats at top (property count, total assessed, total NFTs) + data table below
- Table structure matches Precision Instrument: tight rows, monospace data, subtle borders, alternating row hints
- NFT section below properties: compact grid with thumbnails
- If not connected: centered message with Connect link (no hero, no decoration)

**Guide Page (guide.html) -- Bento Grid (Action Cards)**
- Multiple action items, non-linear exploration (user picks what to act on)
- Summary stat bar at top (total actions, high-priority count, last sync)
- Action cards grouped by category, sorted by priority within groups
- Each card is self-contained: priority badge + action type + title + detail + link
- Mobile: cards stack single-column

### Component Standards (New Components)

All new components follow the frontend-design skill Component Standards plus existing design tokens:

**Navigation Bar**
- Sticky top, `var(--color-surface)` background, `1px solid var(--color-border)` bottom border
- Current page indicated with `var(--color-accent)` text color
- Touch targets minimum 44px on mobile
- No more than 5 nav items (Dashboard, Portfolio, Guide, Connect/Username)
- Mobile: hamburger with slide-in panel (not bottom nav)
- Focus indicators on all interactive elements

**Recommendation Cards**
- Left border: 3px solid signal color (green/yellow/red/accent per action type)
- Background: `var(--color-surface-raised)`
- Action type prefix in `var(--font-weight-semibold)` + signal color
- Body text in `var(--color-text-secondary)`, `var(--text-sm)`
- Padding: `var(--space-3)` (9px) -- compact per Precision Instrument
- Radius: `var(--radius-sm)` (4px)

**Auth Flow States**
- OTP code display: `var(--font-mono)`, `var(--text-3xl)`, `var(--color-accent)`, centered
- Polling indicator: subtle CSS-only spinner using `var(--color-accent)`, `var(--transition-slow)`
- Status messages: `.info-note` style (existing component)
- Error state: red left border variant of `.info-note`

**Property Table**
- Dense rows per Precision Instrument direction
- Monospace data columns (`var(--font-mono)`)
- Header row: `var(--color-text-secondary)`, `var(--text-sm)`, `var(--font-weight-medium)`
- Data rows: `var(--text-base)`, subtle bottom border per `.stat-row` pattern
- Editable valuation cells: `.form-input` style, inline
- Alternating row tint: every other row gets `var(--color-surface-raised)` background

**Synced Badge**
- Small inline indicator when a field is auto-populated from API
- Uses `.badge` pattern but with green signal color
- Text: "Synced" in `var(--text-xs)`

### Responsive Strategy

Per RESPONSIVE-RULES.md:
- Test all viewports: desktop (1440px+), laptop (1024px), tablet portrait (768px), phone portrait (375px), phone landscape (667x375)
- Existing breakpoints maintained: 768px (tablet), 600px (split layouts), 480px (mobile)
- Navigation: visible links on desktop, hamburger on mobile (below 768px)
- Property table: horizontal scroll on narrow viewports (not column hiding)
- Guide cards: 2-column on desktop, 1-column on mobile
- Auth flow: centered single-column at all viewports
- Proportional spacing per responsive rules: use existing `var(--space-*)` scale, not fixed px values

---

## Architecture

### Pages

| Page | File | Pattern | Purpose |
|------|------|---------|---------|
| Landing | `index.html` | Hero-Dominant | Connect account (OTP auth flow) |
| Dashboard | `dashboard.html` | Bento Grid | Main 6-section dashboard (existing, enhanced) |
| Portfolio | `portfolio.html` | Data Table | Property-level detail + manual valuations |
| Guide | `guide.html` | Bento Grid | Consolidated action items from all sections |

### Backend (Vercel Serverless Functions)

```
api/
  auth/
    init.js       POST  -- Calls Upland /auth/otp/init, returns connection code
    webhook.js    POST  -- Receives JWT from Upland, stores in Redis
    status.js     GET   -- Frontend polls for auth completion
    logout.js     POST  -- Clears session
  user/
    profile.js    GET   -- Proxies /user/profile (networth, level, city)
    balances.js   GET   -- Proxies /user/balances (UPX, Spark)
    properties.js GET   -- Proxies /user/assets/properties (paginated, fetches all)
    nfts.js       GET   -- Proxies /user/assets/nfts (paginated, fetches all)
```

### Frontend JS Modules

```
js/
  store.js          Extracted Store object (shared across all pages)
  api.js            API client (session management, fetch wrapper, error handling)
  nav.js            Navigation bar (shared across all pages)
  auth.js           Auth state (session check, connect/disconnect, redirect)
  guide-engine.js   Recommendation engine (rules + data -> action items)
  pages/
    landing.js      Auth flow UI (display code, poll status, redirect)
    dashboard.js    Main dashboard (evolved from app.js, API-aware)
    portfolio.js    Property detail + manual valuation entry
    guide.js        Consolidated action guide rendering
```

### Data Flow

**API data mapping (what the Upland API provides):**

| API Endpoint | Response Field | Maps To Store Key | Currently Manual? |
|--------------|---------------|-------------------|-------------------|
| `/user/profile` | `networth` | `portfolio_value` | Yes -- number input |
| `/user/profile` | `username`, `level` | `user_profile` (new) | N/A (new) |
| `/user/balances` | `availableUpx` | `upx_balance` | Yes -- number input |
| `/user/balances` | `availableSpark` | `sparklet_balance` | Yes -- number input |
| `/user/balances` | `stakedSpark` | `staked_spark` (new) | N/A (new) |
| `/user/assets/properties` | `results[]` | `properties` (new) | N/A (new) |
| `/user/assets/nfts` | `results[]` | `nfts` (new) | N/A (new) |

**What stays manual (API does not provide):**
- `sparklet_price` (USD market price -- no API source)
- `liq_discount` (marketplace discount assumption)
- `monthly_hours` (subjective)
- `liq_increasing_engagement`, `liq_base_rate_2_seasons`, `liq_declining_3_seasons` (subjective toggles)
- `liq_thresholds` (personal signal thresholds)
- `task_count` (mission completion -- API has no endpoint for this)
- Per-property valuations (API returns address/neighborhood but not assessed value or mint price)
- `structures` (sparklet build targets)

**Dual-mode behavior:**
- When connected: API-sourced fields auto-populate, inputs become read-only with "Synced" badge
- When disconnected: All manual entry works exactly as before (zero regression)
- User can disconnect at any time from nav bar

### Session Management

```
Auth Flow:
1. Frontend calls POST /api/auth/init
2. Server calls Upland /auth/otp/init with Basic Auth (App ID + Secret)
3. Server generates sessionId (UUID), stores {sessionId, code, status:"pending"} in Redis (TTL: 10 min)
4. Returns {sessionId, code} to frontend
5. Frontend displays code, tells user to enter it in Upland app
6. Frontend polls GET /api/auth/status?sessionId=X every 3 seconds
7. Meanwhile, Upland calls POST /api/auth/webhook with {type:"AuthenticationSuccess", data:{accessToken}}
8. Webhook handler stores {sessionId, accessToken, userId, status:"connected"} in Redis (TTL: 30 days)
9. Next poll from frontend gets status:"connected"
10. Frontend stores sessionId in localStorage, redirects to /dashboard
11. All /api/user/* calls include sessionId in header; server looks up accessToken from Redis
```

---

## Implementation Tasks

### Phase 0: Project Scaffolding (3 tasks)

**Task 1: Add package.json and vercel.json**
- Create `package.json` with `@upstash/redis` dependency
- Create `vercel.json` with `cleanUrls: true`
- Add `.env.example` documenting required env vars: `UPLAND_APP_ID`, `UPLAND_APP_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `WEBHOOK_SECRET`

**Task 2: Extract shared JS modules**
- Extract `Store` object from app.js into `js/store.js`
- Extract `formatNumber`, `escapeHtml`, `debouncedRender` into `js/store.js` (they're tightly coupled)
- Extract season calendar constants (`SEASONS`, `YIELD_MULTIPLIERS`, `BASE_YIELD_RATE`, `DEFAULT_STRUCTURES`) into `js/store.js`
- Create `js/api.js` -- API client with `getSession()`, `fetchApi(endpoint)`, `isConnected()`, `syncFromApi()`
- Create `js/auth.js` -- `checkAuth()`, `startAuth()`, `pollStatus()`, `logout()`
- Create `js/nav.js` -- renders nav bar into a `#nav` element on each page

**Task 3: Create page HTML shells + nav**
- Rename current `index.html` to `dashboard.html` (the existing dashboard becomes the dashboard page)
- Create new `index.html` (landing page -- Hero-Dominant architecture)
- Create `portfolio.html` (Data Table architecture)
- Create `guide.html` (Bento Grid architecture)
- Each page: same `<head>` (styles.css + shared tokens), `<div id="nav">` placeholder, page-specific `<script>` tags loading shared modules then page module
- All pages share `styles.css`
- Build nav component (js/nav.js) with sticky top bar, page links, connection status
- Add all new CSS: nav, recommendation cards, auth flow, property table, synced badge, page layouts
- Follow token specification for all values -- use CSS custom properties exclusively

### Phase 1: Landing Page + Auth Backend (3 tasks)

**Task 4: Build landing page (index.html)**
- Hero-Dominant architecture: headline + description + Connect button
- Auth flow UI states (per Component Standards above):
  1. Initial: "Connect" button
  2. Code display: OTP code in monospace, polling spinner, instruction text
  3. Success: "Connected as [username]" + redirect to /dashboard
  4. Error: Error message + "Try Again" button
- If already connected: Show connected state + "Go to Dashboard" + "Disconnect"
- `js/pages/landing.js`: Handles auth flow state machine

**Task 5: Auth serverless functions**
- `api/auth/init.js`:
  - POST handler
  - Calls `https://api.prod.upland.me/developers-api/auth/otp/init` with Basic Auth
  - Generates UUID sessionId
  - Stores in Redis: `session:{sessionId}` = `{code, status:"pending", created}` with 600s TTL
  - Returns `{sessionId, code}`
- `api/auth/webhook.js`:
  - POST handler
  - Validates webhook access token from header/body
  - On `AuthenticationSuccess`: finds session by code, updates to `{status:"connected", accessToken, userId}`, extends TTL to 30 days
  - On `AuthenticationFailure`: updates status to "failed" with error message
  - On `UserDisconnectedApplication`: finds session by userId, deletes
  - Returns 200 OK
- `api/auth/status.js`:
  - GET handler, reads `sessionId` from query param
  - Looks up Redis `session:{sessionId}`
  - Returns `{status, username?}` (never exposes accessToken to frontend)
- `api/auth/logout.js`:
  - POST handler, reads sessionId
  - Deletes from Redis
  - Returns `{success: true}`

**Task 6: User data proxy functions**
- `api/user/profile.js`: GET, reads sessionId from `x-session-id` header, looks up accessToken in Redis, calls Upland `/user/profile` with Bearer token, returns response
- `api/user/balances.js`: Same pattern for `/user/balances`
- `api/user/properties.js`: Same pattern, but auto-paginates (fetches all pages, returns combined results array with totalResults)
- `api/user/nfts.js`: Same pattern with auto-pagination
- All endpoints: return 401 if session not found/expired, 502 if Upland API errors

### Phase 2: Dashboard API Integration (2 tasks)

**Task 7: API sync layer**
- In `js/api.js`, add `syncFromApi()`:
  1. Check if connected (sessionId in localStorage)
  2. Fetch `/api/user/profile` -> Store.set('portfolio_value', profile.networth), Store.set('user_profile', {username, level, currentCity, avatarUrl})
  3. Fetch `/api/user/balances` -> Store.set('upx_balance', balances.availableUpx), Store.set('sparklet_balance', balances.availableSpark), Store.set('staked_spark', balances.stakedSpark)
  4. Fetch `/api/user/properties` -> Store.set('properties', results)
  5. Fetch `/api/user/nfts` -> Store.set('nfts', results)
  6. Store.set('last_sync', Date.now())
- Called on dashboard page load + manual "Refresh" button in nav
- Errors: show toast notification, fall back to cached localStorage values

**Task 8: Dashboard dual-mode rendering**
- Modify `js/pages/dashboard.js` (evolved from app.js):
  - Each section checks `isConnected()` to decide rendering mode
  - API-synced fields: render as read-only display (not input) with "Synced" badge
  - Manual-only fields: render as editable inputs (unchanged)
  - Portfolio section (#6): Show property count from API, "View Properties" link to /portfolio
  - Yield section (#3): Portfolio value from API networth, read-only when synced
  - Liquidation section (#5): Auto-populated fields (portfolio_value, upx_balance, sparklet_balance) become read-only when synced; manual fields (discount, hours, sparklet_price, toggles, thresholds) stay editable
  - Sparklet section (#2): Balance from API, but structures list stays manual
  - Missions section (#1): Fully manual (no API for mission data)
  - Priorities section (#4): Stays static for now (enhanced in Phase 3)

### Phase 3: Guide Engine + Recommendations (4 tasks)

**Task 9: Build recommendation engine**
- `js/guide-engine.js` exports `generateRecommendations(storeData)` -> returns array of recommendation objects
- Each recommendation: `{id, category, priority, action, title, detail, signal}`
  - `category`: mission | yield | sparklet | property | liquidation
  - `priority`: 1 (high) | 2 (medium) | 3 (low)
  - `action`: do | consider | skip | hold
  - `signal`: green | yellow | red | accent

- **Mission recommendations:**
  - If task_count < 5 and season active: "Complete X more missions to reach 5-task sweet spot" (HIGH, DO)
  - If task_count >= 5: "5-task threshold met. Additional missions add <0.1x multiplier" (LOW, SKIP)
  - If intermission: "No active season. Missions reset next [date]" (LOW, HOLD)

- **Yield recommendations:**
  - If portfolio_value > 0 and task_count >= 5: "Collect yield every 3 hours. Current rate: $X/day" (MEDIUM, DO)
  - If effective_rate < BASE_YIELD_RATE * 3.0: "Increase tasks to boost from Xx to 3.0x" (HIGH, DO)

- **Sparklet recommendations:**
  - If sparklet_balance > minimum structure cost and not building: "Deploy sparklet to [cheapest structure]. Est. X days" (MEDIUM, CONSIDER)
  - If staked_spark > 0: "X Spark staked in active builds. Will return on completion" (LOW, HOLD)

- **Property recommendations:**
  - If upx_balance > 0: "Deploy X UPX into properties to earn $Y/year additional yield" (HIGH, DO)
  - If properties.length > 0 and some have manual valuations: show per-property actions
  - Collection completion opportunities (if property data allows cross-reference with collections catalog)

- **Liquidation recommendations:**
  - Mirrors existing signal logic but with action-oriented language
  - RED: "Consider liquidating. Total est. value: $X. Hourly return ($Y) below threshold" (HIGH, DO)
  - GREEN: "Hold position. Returns strong at $X/hr. Liquidation value ($Y) too low to justify exit" (LOW, HOLD)
  - YELLOW: "Review position. Marginal returns. Consider optimizing before deciding" (MEDIUM, CONSIDER)

**Task 10: Add inline recommendations to dashboard sections**
- Each dashboard section gets a "Recommendations" sub-area below the data
- Uses `.recommendation` component (per Component Standards above)
- Recommendations rendered by calling `generateRecommendations()` and filtering by category
- Visually distinct from data per Precision Instrument: signal-colored left border, raised surface background
- Action verb prefix in semibold + signal color: "DO:", "CONSIDER:", "SKIP:", "HOLD:"
- Collapsible if more than 2 recommendations per section

**Task 11: Dynamic Optimization Priorities**
- Replace static priority list with data-driven priorities
- Priority ranking changes based on actual portfolio state:
  - If task_count < 5: "#1 Hit 5 tasks" stays on top
  - If task_count >= 5 and upx_balance > 0: "#1 Deploy idle UPX" moves to top
  - If sparklet not deployed and balance sufficient: Sparklet deployment moves up
  - If liquidation signal is RED: "Evaluate exit strategy" becomes #1
- Each priority shows calculated impact: "Deploying X UPX would add $Y/year to yield"
- Keep the existing visual style (numbered list with accent circles)

**Task 12: Build guide page**
- `guide.html` + `js/pages/guide.js`
- Bento Grid architecture: summary stat bar at top, action cards grouped by category
- Consolidated view of ALL recommendations sorted by priority
- Each card: priority badge, action type, title, detail, "Go to section" link
- Uses recommendation component styles + guide-specific layout (2-column grid on desktop)
- Refresh button to re-sync API data and regenerate

### Phase 4: Portfolio Detail Page (1 task)

**Task 13: Build portfolio detail page**
- `portfolio.html` + `js/pages/portfolio.js`
- Data Table architecture per Component Standards:
  - Summary stats at top: property count, total assessed value, total NFTs
  - Property table: address, city, neighborhood, manual valuation column (editable inline)
  - Calculated columns (when valuation entered): est. yield/year, liquidation value
  - Dense rows per Precision Instrument: monospace data, subtle borders, alternating row tint
- NFT section: compact grid of NFT cards with name, rarity badge, thumbnail
- If not connected: centered message with Connect link
- Responsive: horizontal scroll on narrow viewports for table

---

## File Change Summary

### New Files
```
package.json
vercel.json
.env.example
js/store.js
js/api.js
js/auth.js
js/nav.js
js/guide-engine.js
js/pages/landing.js
js/pages/dashboard.js
js/pages/portfolio.js
js/pages/guide.js
api/auth/init.js
api/auth/webhook.js
api/auth/status.js
api/auth/logout.js
api/user/profile.js
api/user/balances.js
api/user/properties.js
api/user/nfts.js
dashboard.html
portfolio.html
guide.html
```

### Modified Files
```
index.html        -- Becomes landing page (full rewrite)
styles.css        -- Add nav, recommendation, auth flow, property table, synced badge, guide/portfolio layouts
.gitignore        -- Add node_modules/, .env
```

### Deleted Files
```
app.js            -- Split into js/store.js + js/pages/dashboard.js
```

---

## Developer Account Setup (Pre-requisite)

Before the API integration works, you need to:

1. Register at https://developer.upland.me
2. Verify email, connect your Upland account (identity verification required)
3. Wait for Upland approval (manual review, may take days)
4. Create an application:
   - Name: "Upland Dashboard"
   - Webhook URL: `https://upland-dashboard.vercel.app/api/auth/webhook`
   - Scope: "Read"
   - Note the App ID and Secret Key (shown once)
5. Set Vercel environment variables:
   - `UPLAND_APP_ID` = your App ID
   - `UPLAND_APP_SECRET` = your Secret Key
   - `WEBHOOK_SECRET` = the webhook access token you set during app creation
6. Install Upstash Redis via Vercel Marketplace (auto-sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`)

The dashboard works in manual-only mode until this setup is complete. All API features gracefully degrade.

---

## Task Execution Order

```
Phase 0 (scaffolding):      Task 1 -> Task 2 -> Task 3
Phase 1 (landing + auth):   Task 4 + Task 5 (parallel) -> Task 6
Phase 2 (integration):      Task 7 -> Task 8
Phase 3 (guide engine):     Task 9 -> Task 10 + Task 11 (parallel) -> Task 12
Phase 4 (portfolio):        Task 13
```

13 tasks total. Phases can be shipped incrementally -- each phase produces a working state.
