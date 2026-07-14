---
name: phantom-recommender
description: Recommend the right PhantomBuster Phantom(s), or a full chained Phantom workflow, for any lead-gen, scraping, enrichment, or outreach goal, based on the public Phantom Database (Notion site). Use this skill whenever the user asks "which Phantom should I use", "is there a Phantom that...", "what Phantoms would you recommend for...", or describes a goal involving extracting/scraping leads, enriching contact data, finding emails, or automating outreach on LinkedIn, Sales Navigator, Instagram, X/Twitter, Facebook, Google Maps, the web, or syncing to a CRM (HubSpot, Salesforce, Pipedrive, lemlist). Trigger even when the word "Phantom" isn't used, e.g. "a customer wants to reach CTOs who commented on a competitor's post", "how can I build a list of local restaurants with emails", "what workflow should I suggest for influencer outreach". Also use when prepping Phantom recommendations for customer calls, recap emails, or playbooks.
---

# Phantom Recommender

Recommends specific Phantoms (PhantomBuster automations) based on what the user wants to achieve, using the team's curated Phantom Database, published publicly on Notion.

## Step 1: Read the Phantom Database first

The source of truth is the public Phantoms Database (Notion site):

`https://thephantomcompany.notion.site/d22ab00a50994f078509e07b416c356a?v=f1c1b6f00fe6430aa4204ffee45b8bdc&p=56e68191a1b34d7395d900865ec93b32&pm=s`

How to read it, in order of preference:

1. **PhantomBuster MCP connected (this project — preferred):** the live API is a
   better source of truth than the Notion snapshot. Use `scripts_fetch_all` to
   enumerate the real catalog, and `agents_fetch`/`agents_fetch_all` to see what
   is already configured in the workspace. Cross-check against Notion only for
   the curated metadata (Goal Category, safety caps).
2. Notion MCP connected: pass the URL to the `notion-fetch` tool (it supports `*.notion.site` URLs), then query the data source it returns (`notion-query-data-sources`) selecting: `Phantom's Name`, `Performed action`, `Goal Category`, `Input type`, `Input supported`, `Output`, `Phantom link`, `Phantom's Type`, `Phantom's Status`. Filter to `Phantom's Status` in ('Released', 'Beta'). Never recommend Deprecated, Abandoned, Unlisted, or Renamed Phantoms.
3. No Notion access: fetch the public URL with a web tool. NOTE: the Notion page
   is JS-rendered, so a plain WebFetch returns an empty shell — prefer option 1.
4. Offline fallback: read `references/phantom-catalog.md`, a bundled snapshot (date noted at the top).

Never recommend a Phantom from memory alone. Only recommend Phantoms that exist in the database.

The key fields and how to use them:

- Performed action: the Phantom's main objective; match it to the user's goal.
- Goal Category: `Scrape` (build a list), `Enrich` (complete the data), `Engage` (act on the list); use it to place the Phantom in the funnel.
- Input type / Input supported: what the user must already have (search URL, profile URLs, session cookie, CRM connection...); use it to check the recommendation is actionable from what they have today.
- Output: what the run produces (fields, CSV, CRM records); use it to confirm it delivers the outcome they want and feeds the next step of a chain.
- Phantom link: the phantombuster.com URL to include with every recommendation.

## Step 2: Understand the goal

Identify from the request (ask one clarifying question only if genuinely ambiguous):

- Platform(s): LinkedIn, Sales Navigator, Instagram, X/Twitter, Facebook, Google Maps, generic web, CRM...
- Input the user already has: a search URL, a list of names/emails, a competitor account, a post URL, a CRM full of contacts, or nothing yet. Match against the database's `Input type`.
- Desired outcome: a lead list (Scrape), completed data like emails/firmographics (Enrich), or actual outreach/visibility (Engage). Match against `Goal Category` and `Output`.
- Audience temperature: prefer Warm/Lukewarm sources when available (post engagers, event guests, profile viewers, group members, existing connections) over cold search exports. Warmer lists convert better and this is core PhantomBuster strategy advice.

## Step 3: Pick the response mode

Shortlist mode, when the user asks "which Phantom does X" or the goal maps to a single capability:
- Recommend 1 to 3 best-fit Phantoms, each with one sentence on why it fits, what it needs as input, what it outputs, and its phantombuster.com link.
- If two Phantoms overlap, say which one to prefer and why.

Workflow mode, when the user describes an end-to-end goal (e.g. "reach marketing directors who engaged with a competitor's post"):
- Chain Phantoms in funnel order: Scrape -> Enrich -> Engage.
- For each step, state: the Phantom, what goes in (from `Input type`), what comes out (from `Output`), and how the output feeds the next step.
- Before chaining 3+ Phantoms, check the database for an all-in-one workflow Phantom that already covers the chain (e.g. LinkedIn Search to Lead Connection, Google Maps Search to Contact Data, LinkedIn Post Engagers to Lead Outreach, LinkedIn Search to lemlist Campaign, LinkedIn Outreach). If one exists, lead with it and offer the manual chain as the flexible alternative.
- End with one practical tip (rate limits, warm-up sequencing, or account-safety caps noted in the database).

## Output style

- Keep recommendations skimmable: short intro, then the Phantoms/steps, each with its link.
- Always include the phantombuster.com link (`Phantom link`) for every recommended Phantom.
- Relay rate limits and safety caps whenever the Phantom has them noted (e.g. Instagram Auto Liker max 1 post/hour, Facebook Profile Scraper max 5/hour, LinkedIn Auto Follow 80/week Basic).
- If nothing in the database fits the goal, say so honestly and suggest the closest alternative. Do not invent Phantoms.

## Project context (Yedda Marketing Agent)

This workspace already runs a production pipeline — factor it in before recommending:

- **Plan:** Start ($69/mo) — 5 agent slots (1 used), **20 h execution/month** (hard
  cap; runs stop when exhausted, no mid-cycle top-up). Execution time is the ONLY
  scarce resource: AI credits and email credits are unused by this pipeline.
- **Live Phantom:** LinkedIn Activity Extractor (agent `2486032159169760`) — 75
  profiles/launch, Posts only, 5 items each, daily 08:00 America/Sao_Paulo, custom
  webhook → `https://yedda-marketing-dashboard.vercel.app/api/linkedin-posts`.
- **Contact source:** Google Sheet (73 tiered contacts from Roi's CRM).
- **Downstream:** webhook → Supabase `linkedin_contacts_posts` → dashboard Radar →
  Roi comment generator (Gemini) → per-contact approval policy → manual post.
- **Config-as-code:** `scripts/phantombuster/desired-config.json` + `pb-sync.mjs`,
  applied by the `phantombuster-sync` GitHub Actions workflow. Any new Phantom
  should be added there, not clicked into the UI.
- **Known trap:** `repeatedLaunchTimes` needs day/dow/month FULLY populated
  (`dow`/`month` are string enums). Empty arrays are accepted by the API but the
  cron then matches nothing and the agent silently never runs.

Budget any recommendation against the 20 h/month cap and say what it costs.

## Refreshing the snapshot

`references/phantom-catalog.md` is only an offline fallback. When the user asks to refresh it, or mentions a Phantom missing from it, re-read the live public database (Step 1), then regenerate the snapshot file from the live data (copy the skill to a writable location first if it's installed read-only) and offer the user a re-packaged `.skill` file.
