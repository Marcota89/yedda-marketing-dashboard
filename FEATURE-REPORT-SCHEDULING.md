# Feature Report — Smart Scheduling + Post Rating + Approval Queue
## Yedda.ai Marketing Dashboard
### Analysis Date: May 13, 2026

---

## REQUEST SUMMARY

Three features requested:
1. **Bot that creates new posting schedules** — generate a content calendar on demand
2. **Post rating system** — rate each post (e.g., "very good", "ok", "reject")
3. **Approved post queue** — posts rated positively are queued and auto-published later

---

## FEATURE 1 — Schedule Generator Bot

### What it does
A conversational or form-based interface inside the dashboard that generates a new LinkedIn content calendar based on user-defined parameters: date range, frequency, topics, pillars, persona (Abbey/Kai).

### Implementation options

#### Option A — Prompt-based generator (Recommended)
A panel in the dashboard with fields:
- **Start date / End date**
- **Posts per week** (2 / 3 / 5)
- **Focus pillars** (checkboxes: Thought Leadership, Social Proof, Education, Engagement, Case Study)
- **Persona** (Abbey / Kai / Mixed)
- **Custom topic or keyword** (optional text field)

User fills the form → clicks "Generate Schedule" → calls Claude API → returns a new batch of posts formatted exactly like the existing ones in the `posts[]` array → appended to the calendar.

**Tech stack needed:**
- Claude API (Anthropic SDK) — `claude-sonnet-4-6` model
- A small Node.js/Express backend OR a serverless function (Vercel Serverless Function — free tier)
- The existing `posts[]` array in index.html becomes dynamic (loaded from a JSON file or localStorage)

#### Option B — Static prompt template (Zero code, immediate)
A dedicated section in the dashboard with a "Generate New Schedule" button that copies a pre-filled Claude prompt to clipboard. User pastes it into Claude.ai to generate the next batch of posts, then pastes the result back.

**Effort:** 2h | **Cost:** $0 | **Limitation:** manual paste step

#### Option C — Google Sheets integration (No backend)
Posts stored in a Google Sheet. A Google Apps Script generates new rows based on a schedule template. Dashboard reads from the Sheet via API.

**Effort:** 4h | **Cost:** $0 | **Limitation:** requires Google account auth

### Recommended path
**Start with Option B** (immediate, no backend) → upgrade to Option A when volume justifies the backend cost.

---

## FEATURE 2 — Post Rating System

### What it does
After previewing a post, the user can rate it with a simple 3-tier system:
- ✅ **Approved** — "This is very good. Queue it."
- 🔁 **Needs revision** — "Good idea, but rewrite."
- ❌ **Rejected** — "Not relevant. Don't use."

### UI design suggestion

```
┌─────────────────────────────────────┐
│  Rate this post:                    │
│  [✅ Approve]  [🔁 Revise]  [❌ Skip] │
│                                     │
│  Rating saved: ✅ APPROVED           │
│  Added to publish queue → May 15    │
└─────────────────────────────────────┘
```

Rating is saved in **localStorage** (no backend required). Each post gets a `rating` key: `approved | revise | rejected | unrated`.

### Data structure
```json
{
  "postRatings": {
    "apr21": "approved",
    "apr22": "approved",
    "apr24": "revise",
    "apr25": "rejected"
  }
}
```

### Visual feedback in calendar list
Posts in the left-side calendar show a colored dot next to the date:
- 🟢 Green dot = Approved
- 🟡 Yellow dot = Needs revision
- 🔴 Red dot = Rejected
- ⚪ Gray = Unrated

### Implementation effort
~3 hours | Zero backend | Works offline | Persists across browser sessions

---

## FEATURE 3 — Approved Post Auto-Queue

### What it does
All posts rated ✅ Approved appear in a dedicated "Publish Queue" tab. The queue shows:
- Post preview (first 2 lines)
- Scheduled publish date/time
- Status: Scheduled / Published / Pending

### Queue panel UI

```
┌──────────────────────────────────────────────────────┐
│  📅 PUBLISH QUEUE  ·  4 posts approved               │
├──────────────────────────────────────────────────────┤
│  🟢  Apr 21  "95% of enterprise AI pilots fail..."   │
│       📋 Copy  ·  Scheduled: Apr 21 · 9AM SGT        │
├──────────────────────────────────────────────────────┤
│  🟢  Apr 22  "3 in 10 retail fraud attempts..."      │
│       📋 Copy  ·  Scheduled: Apr 22 · 12PM SGT       │
├──────────────────────────────────────────────────────┤
│  🟢  Apr 29  "GE Appliances deployed 800 AI..."      │
│       📋 Copy  ·  Scheduled: Apr 29 · 12PM SGT       │
├──────────────────────────────────────────────────────┤
│  🟢  May 2   "Sales teams using AI generate 77%..."  │
│       📋 Copy  ·  Scheduled: May 2 · 9AM SGT         │
└──────────────────────────────────────────────────────┘
```

### Auto-publish (advanced)
True auto-publish requires connecting to the LinkedIn API or Buffer API. Two paths:

#### Path A — Buffer API (Recommended for auto-publish)
1. User connects their Buffer account (OAuth, one-time setup)
2. When a post is rated ✅ Approved, the dashboard calls Buffer's API: `POST /updates/create`
3. Buffer schedules the post for the assigned date/time
4. Status in the queue updates to "Scheduled in Buffer"

**Cost:** Buffer Free (3 channels, 10 scheduled posts) or Buffer Essentials $6/month (unlimited)
**Effort:** ~6h (OAuth flow + API integration)

#### Path B — Copy-to-clipboard queue (Zero backend, immediate)
The queue tab lists all approved posts in order. Each has a "📋 Copy" button. User opens LinkedIn/Buffer, pastes. Queue item is marked "✓ Published" manually via a button click.

**Cost:** $0 | **Effort:** ~2h | **Limitation:** manual publish step

#### Path C — Zapier webhook
Dashboard sends a webhook when a post is approved → Zapier catches it → posts to LinkedIn via Zapier's LinkedIn action.

**Cost:** Zapier Free (100 tasks/month) | **Effort:** 3h | **Limitation:** Zapier free tier limits

---

## IMPLEMENTATION ROADMAP

### Phase 1 — Immediate (this week, ~5h total, zero cost)
| Feature | Approach | Hours |
|---|---|---|
| Post rating (3-tier) | localStorage, colored dots in calendar | 2h |
| Approved queue tab | Filter approved posts, copy buttons | 2h |
| Schedule generator | Copy-prompt button (Option B) | 1h |

**Result:** Full rating + queue workflow, manual publish via clipboard.

### Phase 2 — Short-term (2 weeks, ~8h, optional cost)
| Feature | Approach | Hours |
|---|---|---|
| Buffer integration | OAuth + Buffer API for auto-schedule | 5h |
| Schedule bot (Claude API) | Vercel serverless function | 3h |

**Result:** True auto-scheduling to LinkedIn via Buffer. AI-generated new post batches on demand.

### Phase 3 — Long-term (1 month)
| Feature | Approach |
|---|---|
| Rating analytics | Track which pillars/personas get most approvals |
| AI learning loop | Feed approved posts back to schedule generator as style reference |
| LinkedIn native API | Direct post-to-page (requires LinkedIn Partner approval) |

---

## TECHNICAL ARCHITECTURE (Phase 1 — pure frontend)

```
index.html
├── posts[] array (existing)
├── postRatings{} — localStorage key
├── renderPost(i) — adds rating buttons to preview
├── ratePost(i, rating) — saves to localStorage, updates dot color
├── renderQueue() — filters approved posts, renders queue tab
└── copyApprovedPost(i) — copy to clipboard with confirmation
```

No server. No database. No cost. Works offline. Ratings survive page refresh.

---

## WHAT GETS BUILT IN THE DASHBOARD (Phase 1 visual)

### Nav bar — new tab added
```
[Modules] [Cases] [Content ●] [Queue 4✅] [Characters] [Market]
```
The Queue tab shows a badge with count of approved posts.

### Post preview — rating bar added below image prompt bar
```
┌─ LinkedIn Preview ──────────────────────────────────┐
│  [post content]                                     │
│  ─────────────────────────────────────────────────  │
│  👍 Like   💬 Comment   🔁 Repost   📋 Copy Post    │
│  🎨 Gemini Image Prompt        [📸 Copy Image Prompt]│
│  ─────────────────────────────────────────────────  │
│  Rate this post:                                    │
│  [✅ Approve]    [🔁 Needs Revision]    [❌ Skip]    │
│  ─────────────────────────────────────────────────  │
│  Time · Persona · Audience · Day                    │
└─────────────────────────────────────────────────────┘
```

### Calendar list — rating dots
```
┌── WEEK APR 19–25 · 2026 ─────────────────────────┐
│  🟢 21 APR  "95% of enterprise AI pilots..."      │
│  🟢 22 APR  "3 in 10 retail fraud attempts..."    │
│  🟡 24 APR  "2026 is the year AI stops..."        │
│  ⚪ 25 APR  "80% get results. Two-thirds..."      │
└───────────────────────────────────────────────────┘
```

---

## RECOMMENDATION

**Build Phase 1 now.** It requires no external services, no API keys, no cost — only frontend changes to index.html. It delivers the complete rating + queue workflow immediately.

**Then evaluate Phase 2** based on post volume. If publishing more than 8 posts/month, Buffer integration ($6/month) saves more time than it costs.

The AI schedule generator (Claude API) is valuable once the rating system has 2–3 weeks of data — because approved posts become the training signal for what to generate next.

---

## NEXT STEP

Confirm which phase to implement first and I will build it directly into index.html.
- **"Phase 1"** → rating system + queue tab, this session, ~5h
- **"Phase 2"** → include Buffer API integration plan
- **"Both"** → full roadmap, phased delivery
