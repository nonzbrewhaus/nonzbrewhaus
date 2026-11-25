# NonzBrewHaus — Home Coffee Pickup Reservations (v1 Plan)

## Goal
Customers reserve a pickup time, choose drinks, and pay via InstaPay. The owner confirms each payment and runs the day's orders by pickup time.

## Decisions
| Topic | Decision |
|---|---|
| Brand | **Nonzz's Brew Haus**. Tagline "Pick up, sip, repeat." Pickup only |
| Ordering | Menu items + quantity, **add-ons per drink**, plus a free-text notes field |
| Hours | Daily **8 AM – 3 PM** (Morning) and **7 PM – 10 PM** (Evening) |
| Slots | **1-hour slots**. Each slot has **two limits: max 5 orders AND max N drinks**. Whichever fills first makes the slot full (N is set in admin, default 10) |
| Payment | InstaPay. Customer uploads a receipt screenshot; owner confirms it manually |
| Unpaid hold | Drinks are held in the slot for **30 min**. Unpaid orders then expire and the capacity is released |
| Customer identity | Name + phone (WhatsApp), no login |
| Language | English only |
| Booking window | Today + the next 2 days |

## Order lifecycle
```
pending_payment ──(screenshot uploaded)──> payment_submitted ──(owner confirms)──> confirmed ──> ready ──> picked_up
      │                                            │
      └──(30 min, no screenshot)──> expired        └──(owner rejects)──> cancelled
```
- `pending_payment`, `payment_submitted` and `confirmed` all **count against slot capacity**.
- `expired` and `cancelled` free the capacity.
- Once a screenshot is uploaded, the order does **not** auto-expire; it waits for the owner. (Open question: confirm this.)

## Pages
### Customer (separate pages; the cart is kept in the browser between steps)
1. **`/` Menu**: brand header, drinks list (no photos), quantity buttons, notes.
2. **`/time` Pick pickup time**: day tabs (Today / +1 / +2) and a slot grid. A slot is shown as full if it can't fit the drinks in the cart.
3. **`/details` Your details**: name, phone, order summary, then "Place order".
4. **`/o/[code]` Order page** (private link with a short code): summary, InstaPay instructions, a 30-min countdown, the screenshot upload, a live status badge and a WhatsApp button.

Wireframes for every screen are in the **Design** section below.

### Owner (admin, Supabase login)
1. **`/admin` Today**: orders grouped by slot, in time order. Buttons: Confirm payment (view screenshot), Reject, Mark ready, Picked up. Each order has a WhatsApp link to the customer.
2. **`/admin/pending`**: the queue of orders with an uploaded screenshot that need payment confirmation.
3. **`/admin/menu`**: add and edit drinks and add-ons (name, category, description, price, signature ✦, display order). Every item has a **status**:

   | Status | Customer sees | Use for |
   |---|---|---|
   | **Active** | Orderable | Normal |
   | **Paused** | Shown greyed as "Not available today", or hidden (your choice per item). Optional **"back on" date**; it turns Active again automatically that day | Seasonal items like Pumpkin Spice, or out for a while |
   | **Archived** | Hidden everywhere | Removed for good. Kept in the database so past orders, sales and margins stay correct. Can be restored any time |

   - **Add new item:** fill in the details, create its first recipe, then set it Active. It starts as Paused (draft), so it isn't visible until it's ready.
   - **Price changes** only affect new orders. Past orders keep the price they were sold at.
   - Nothing that has ever been ordered can be hard-deleted, only archived. Items never ordered can be deleted.
   - Filter tabs: Active / Paused / Archived.
4. **`/admin/schedule`**: working hours per weekday, slot length (e.g. 15 min), max drinks per slot, and blocked dates (days off).
5. **`/admin/settings`**: InstaPay handle, WhatsApp number, hold time (default 30), overhead % (default 10%), and the time of the daily low-stock email.
6. **`/admin/inventory`**: every ingredient and packaging item. Columns: name, on hand, unit, average cost per unit, **reserved** (by confirmed orders not yet picked up), **days left**, and a status badge (OK / Low / Out).
   - **Restock** button: enter the quantity and the total price paid. This raises the stock and blends the price into the weighted average cost.
   - **Adjust** button: for waste, spills or a recount. Needs a reason, and it's logged.
   - Clicking an item shows its history (restocks, orders, adjustments).
7. **`/admin/recipes`**: recipes for each drink and add-on, i.e. which ingredients and how much of each. For example, Iced Latte = 18 g beans, 200 ml milk, 1 cup, 1 lid, 1 straw. Add-ons have recipes too (Oat Milk swaps cow's milk for oat milk, see below).
   - **Several recipes per product, only one active.** Each product can have any number of named recipe versions (e.g. "Iced Latte – v1 (18 g)", "Iced Latte – v2 double shot"). Exactly **one** is active.
   - **Set active** switches with one tap. From then on, new confirmed orders use the new recipe for stock and cost.
   - **Duplicate** copies a recipe so you can tweak it without touching the active one.
   - **Compare:** each version shows its cost and margin side by side, so you can see the margin before switching.
   - Old versions are never deleted while orders use them; they can only be archived. Past orders keep the recipe and cost they were made with.
   - A product with **no active recipe** can't be set Active on the menu. This prevents selling something that doesn't deduct stock.
8. **`/admin/margins`**: a table of every drink. Columns: selling price, ingredient cost, packaging cost, overhead, **total cost**, **profit (EGP)** and **margin %**. Margins below a target (default 60%) are colored red. Add-ons appear in their own rows. A summary for the selected date range (today / 7 days / 30 days) shows revenue, cost, profit, and the best and worst sellers.

9. **`/admin/dashboard` KPIs**: see "Owner dashboard" below.
10. **`/admin/customers`**: every customer (identified by phone number). Shows first order, last order, number of orders, total spent, favorite drink and add-on, and a New/Returning badge. Click a customer to see their order history and tap to WhatsApp them.

### Owner dashboard (`/admin/dashboard`)
**Period picker:** This week · Last week · This month · Last month · Custom range. Every KPI shows the **change vs the previous period** (▲/▼ %).
- Weeks run **Saturday–Friday** (changeable in settings). All dates use Cairo time.
- Only orders that are **confirmed, ready or picked up** count. Pending, expired and cancelled orders are excluded.
- Orders are counted on their **pickup date**.

**1. Sales**
- Revenue, number of orders, drinks sold, average order value, and average drinks per order
- Revenue per day (bar chart); Morning vs Evening split; busiest pickup hours (heat strip by hour)
- Weekly view: a bar per day. Monthly view: a bar per week, plus a line for the same month last year once that data exists

**2. Cost**
- Cost of goods sold (COGS), split into ingredients, packaging and overhead, plus the average cost per drink
- **Restock spend** (money paid for stock this period), shown separately from COGS

**3. Consumption**
- Per ingredient and packaging item: quantity used, cost used, and the change vs the previous period
- Top 10 most-consumed items by cost
- **Waste:** quantity and cost from waste/recount adjustments, and waste as a % of COGS

**4. Margins**
- Gross profit (EGP) and gross margin %, plus a trend line per day or per week
- Margin per drink for the period (based on the actual costs saved at confirmation)
- Drinks under the margin target are flagged

**5. Customers** (identified by phone number, normalized to the +20 format)
- Unique customers, **new** customers (first ever confirmed order in this period) and **returning** customers (had an order before this period)
- New vs returning: share of customers and share of revenue
- **Repeat rate:** % of this period's customers who ordered 2 or more times. Also average orders per customer
- **Top customers:** by orders and by spend
- Returning customers who haven't ordered in 30+ days ("we miss you" list, with a WhatsApp button)

**6. Products**
- **Most sold / least sold:** ranked by quantity and by revenue. Least sold also includes active items with **zero sales** in the period
- **Add-ons:**
  - Most added add-ons and their **attach rate** (% of drinks that got that add-on)
  - **Which drinks:** a drinks × add-ons matrix, e.g. Oat Milk is added to 38% of Iced Lattes and 12% of Spanish Matcha
  - Revenue and profit from add-ons
- **Product mix:**
  - Each drink's share of quantity and of revenue, as a stacked bar and a table
  - Category mix: Coffee vs Matcha vs Add-ons
- **Menu matrix:** popularity vs margin in four quadrants: **Stars** (popular + high margin), **Workhorses** (popular, low margin), **Puzzles** (high margin, low sales) and **Dogs** (neither). This shows which drinks to promote, reprice or drop.

**How it's built**
- The numbers come from Postgres SQL functions (`kpi_sales`, `kpi_costs`, `kpi_consumption`, `kpi_customers`, `kpi_products`). Each takes a date range, and only `is_admin()` can call them.
- They read the snapshots saved on orders and stock movements, so history never changes after the fact.
- Charts use **Recharts** in the brand colors. The page works on phone (KPI cards stacked) and desktop (grid).

### Owner-only access
- The admin area is only for the owner. Sign-in uses a Supabase Auth **email magic link** (a one-time link sent to the email, no password).
- **Public sign-ups are turned off** in Supabase. The owner's email is the only allowed address, kept in an `admins` table, not in the code.
- Protected in **two layers**:
  1. Next.js middleware sends anyone not signed in as an admin away from `/admin/*`.
  2. Database RLS: every admin table (inventory, recipes, costs, all orders, payment proofs) is readable and writable only when `is_admin()` is true. `is_admin()` checks that the signed-in email is in `admins`.
- So even someone who finds an admin URL or calls the API directly can't see costs, margins or orders.
- Customers never see costs. The public menu view exposes only name, description, price and availability.

## Design

### Theme: Nonzz's Brew Haus brand (source files in `brand/`)
- `brand/logo.pdf`: the logo (a cup pouring into the "i" of NONZZ'S, plus a cat, "BREW HAUS" underneath). It will be exported to SVG/PNG for the site.
- `brand/menu-design.jpg` and `brand/pickup-slots-design.png` are the owner's own designs. The site copies their look.
- **Colors** (sampled from the designs; to be confirmed against the original files). They become CSS variables in one place:

| Token | Hex | Use |
|---|---|---|
| `--pink` | `#F2C6D3` | main card/page background |
| `--cream` | `#F0E4DA` | alternate stripe, pills, light surfaces |
| `--brown` | `#3A2218` | text, borders, dark stripes, primary buttons |
| `--rose` | `#E46C88` | hearts, highlights, accent |
| `--muted` | `#DDA9B8` | full/disabled slots |
| `--gold` | `#E3B25B` | signature-drink star |

- **Fonts** (Google Fonts that are close to the designs):
  - Headings ("Menu", "Coffee", "Morning"): a bold italic serif, e.g. *Fraunces Italic*
  - Script accents ("Pick up, sip, repeat.", "Pickup slots"): a brush script, e.g. *Yellowtail*
  - Body and prices: a geometric sans, e.g. *DM Sans*
  - Small labels ("PICKUP ONLY", "5 OF 5 LEFT"): DM Sans in uppercase with letter spacing
- **Style details:** vertical pink/cream (or brown) stripes as the page background. Rounded cards with a 1.5px brown border and a hard offset shadow (no blur). Pill-shaped labels. Small hearts as decoration. Dotted leaders between drink name and price, like the printed menu.
- **Menu:** a clean list with no photos, grouped Coffee / Matcha / Add-ons. "The Nour Signature" gets a gold ✦.
- **Slot cards** copy the slot design: the time range, then dots (● open, ○ booked), then "4 of 5 left". Full slots are greyed out and show "FULL". Slots are grouped under **Morning** and **Evening** headers.
- **Mobile-first:** designed for phone width first, then scaled up for desktop. Buttons are at least 44px tall, and contrast meets WCAG AA.
- **Status colors** (the same on every screen):
  - Waiting for payment: amber
  - Under review: blue
  - Confirmed: green
  - Ready: brand accent
  - Expired/Cancelled: grey

### Screens: customer (phone)
```
1. MENU  /                    2. PICKUP TIME  /time           3. DETAILS  /details
┌──────────────────────┐      ┌──────────────────────┐        ┌──────────────────────┐
│     [NONZZ'S LOGO]   │      │ ← Back  Pickup slots │        │ ← Back   Your details│
│  Menu                │      │ [Today][Thu][Fri]    │        │ Name  [____________] │
│  Pick up, sip, repeat│      │ (Morning   8AM–3PM ) │        │ Phone [____________] │
│ Coffee               │      │ ┌8–9AM─┐┌9–10AM┐     │        │──────────────────────│
│ ✦Nour Signature··135 │      │ │●●●●● ││●●●●○ │     │        │ Iced Latte    125    │
│              [ Add ] │      │ │5 left││4 left│     │        │  + Oat Milk    40    │
│ Iced Latte·······125 │      │ └──────┘└──────┘     │        │ Nour Signature 135   │
│              [- 1 +] │      │ ┌11–12─┐ greyed FULL │        │ Notes: less ice      │
│  + Oat Milk +40   ☑  │      │ (Evening   7PM–10PM) │        │ Pickup: Thu 9–10 AM  │
│ Matcha ...           │      │ ┌7–8PM─┐┌8–9PM─┐...  │        │ Total        300 EGP │
│ Notes [____________] │      │                      │        │                      │
│╔════════════════════╗│      │╔════════════════════╗│        │╔════════════════════╗│
│║2 drinks·300  Next →║│      │║Thu 9–10 AM   Next →║│        │║   Place order      ║│
│╚════════════════════╝│      │╚════════════════════╝│        │╚════════════════════╝│
└──────────────────────┘      └──────────────────────┘        └──────────────────────┘
Add-ons: tapping "Add" on a drink opens a small sheet with Cold Foam / Oat / Coconut
checkboxes, then adds that drink (with its add-ons) as one cart line.

### Animation: "drop into the basket" (add to cart)
When a drink is added, a small brand-style **cup icon** (brown outline, pink fill, like the menu's
coffee/matcha cup icons) leaves the drink row and **drops along a curved arc into the basket**
on the sticky cart bar at the bottom.
```
 Iced Latte·······125 [Add]
          ☕ ↘
              ↘  (arc, slight spin, shrinks)
                 ↘
╔═══════════════[🧺]═══╗   ← basket squishes/bounces when the cup lands,
║ 2 drinks · 300  Next →║     count ticks 1 → 2, total counts up, small ♥ pops
╚══════════════════════╝
```
- **Timing:** about 600 ms on an ease-in curve (like falling). The basket does a 150 ms squash-and-bounce on landing. A tiny rose heart (♥) floats up and fades out.
- **Cup icon:** coffee drinks drop a brown-filled cup, matcha drinks a green one (matching the menu icons). With add-ons, the cup gets a small foam/milk dot.
- **Remove / minus:** no drop. The count just ticks down, and the basket gives a gentle shake.
- **Built with:** the browser's own Web Animations API (no extra library). The icon is animated from the row's position to the basket's position, so it works on any screen size.
- **Accessibility:** when the phone has **Reduce motion** turned on, the drop is skipped and only the count and total update. A screen-reader message says "Iced Latte added, 2 drinks, 300 EGP".
- **Double taps:** tapping quickly sends several cups. Each one lands and adds one drink.

4. ORDER PAGE  /o/[code]
┌──────────────────────┐   After screenshot:      After owner confirms:
│ [LOGO]  Order #K7Q2  │   ┌──────────────────┐   ┌──────────────────┐
│ ● Waiting for payment│   │ ● Under review   │   │ ● Confirmed ✓    │
│ Pay within 27:41     │   │ We're checking   │   │ See you Thu 09:30│
│──────────────────────│   │ your payment.    │   │ [Get directions] │
│ Send 265 EGP via     │   └──────────────────┘   └──────────────────┘
│ InstaPay to:         │
│ nonz@instapay [copy] │   Expired: "Time ran out. Your slot was
│──────────────────────│   released." [Order again]
│ [ Upload screenshot ]│
│──────────────────────│
│ Thu 09:30 · 3 drinks │
│ [WhatsApp us]        │
└──────────────────────┘
```

### Screens: owner (phone + desktop)
```
TODAY  /admin                               PENDING  /admin/pending
┌───────────────────────────────────────┐   ┌──────────────────────────────┐
│ [LOGO] Today · Thu 27 Nov   [Pending 2]│   │ #K7Q2 · Sara · 265 EGP       │
│ Menu  Schedule  Settings      Log out  │   │ Thu 09:30 · 3 drinks         │
│───────────────────────────────────────│   │ ┌──────────┐                 │
│ 8–9 AM  orders 1/5 · drinks 3/10      │   │ │screenshot│ (tap to zoom)   │
│   #K7Q2 Sara  2×Latte,1×V60  ●Confirmed│  │ └──────────┘                 │
│        oat milk      [Ready] [WhatsApp]│  │ [ Confirm ✓ ]  [ Reject ✕ ]  │
│ 9–10 AM orders 0/5 · drinks 0/10      │   └──────────────────────────────┘
│ 10–11AM orders 1/5 · drinks 2/10      │
│   #P3M8 Ali   2×Latte     ●Under review│  MENU /admin/menu: list rows with name, price
│                  [Review payment]      │    and an available toggle; [+ Add drink]
└───────────────────────────────────────┘  SCHEDULE /admin/schedule: a row per weekday
                                              (open, close), slot minutes, max drinks
                                              per slot, blocked dates
                                            SETTINGS: InstaPay handle, WhatsApp, hold min
```
- Owner screens use the same theme but are denser. On phones, the Today board becomes a stack of cards, one per slot.

## Data model (Supabase / Postgres)
- `menu_items`: id, category (coffee | matcha), name, description, price, is_signature, status (active | paused | archived), paused_display (greyed | hidden), resume_on (date, nullable), sort_order
- `addons`: id, name, price, status, paused_display, resume_on (Sweet Cream Cold Foam 50, Oat Milk 40, Coconut Milk 40)
- A daily `pg_cron` job sets paused items whose `resume_on` is today back to `active`.
- `schedule_rules`: weekday, shift (morning | evening), open_time, close_time, slot_minutes (60), max_orders_per_slot (5), max_drinks_per_slot (10)
- `blocked_dates`: date, reason
- `settings`: instapay_handle, whatsapp_number, hold_minutes
- `orders`: id, code, customer_name, phone, pickup_at, status, total, notes, payment_proof_path, created_at, expires_at, confirmed_at
- `order_items`: id, order_id, menu_item_id, name_snapshot, price_snapshot, qty
- `order_item_addons`: order_item_id, addon_id, name_snapshot, price_snapshot

### Inventory & costing tables
- `admins`: email (only the owner)
- `ingredients`: id, name, kind (ingredient | packaging), unit (g | ml | pcs), on_hand, avg_unit_cost, low_threshold, is_active
- `recipes`: id, menu_item_id **or** addon_id, name, is_active, archived_at, created_at
  - A **unique partial index** on (product) where is_active guarantees at most one active recipe per product. "Set active" swaps it in one transaction.
- `recipe_lines`: id, recipe_id, ingredient_id, qty, `replaces_ingredient_id` (nullable)
- `order_items` and `order_item_addons` also store `recipe_id` and `unit_cost_snapshot` at confirmation.
  - `replaces_ingredient_id` handles swaps. For example, the Oat Milk add-on = +200 ml oat milk, replacing 200 ml milk. Margins and stock stay correct.
- `stock_movements`: id, ingredient_id, change (+/-), unit_cost, reason (restock | order | order_cancelled | waste | recount), order_id (nullable), note, created_at
  - `on_hand` = sum of movements (a ledger, so every change can be traced).
- `settings` gains: overhead_pct, margin_target_pct, low_stock_email_time

### How the numbers work
- **Drink cost** = Σ (recipe qty × avg_unit_cost) for ingredients and packaging, × (1 + overhead %). Add-ons add their own lines and subtract any line they replace.
- **Profit** = selling price − drink cost. **Margin %** = profit ÷ selling price.
- **Order cost is snapshotted** at confirmation. Each confirmed order item stores its cost at that moment, so past margins don't change when prices change later.
- **Deduction:** when the owner **confirms payment**, a DB function writes `order` stock movements for every recipe line of every drink and add-on. Cancelling a confirmed order writes `order_cancelled` movements that give the stock back.
- **Weighted average on restock:** new_avg = (on_hand × avg + qty × unit_price) ÷ (on_hand + qty).
- **Running-out forecast:**
  - avg daily use = the last 14 days of `order` movements ÷ 14
  - available = on_hand − stock needed by pending (unconfirmed) orders
  - days left = available ÷ avg daily use
  - **Low** if available < low_threshold or days left < 3. **Out** if available ≤ 0.
- **Stock-aware ordering (safety):** if an ingredient is **Out**, drinks that need it are shown as "Sold out" on the customer menu automatically.

### Low-stock alerts
- In admin: badges on `/admin/inventory`, plus a red banner on the Today board listing low items.
- **Daily email** to the owner at the set time (default 7:00 AM Cairo) listing Low and Out items with days left. Sent by a Supabase Edge Function scheduled with `pg_cron`, using **Resend** (free tier) for delivery. No email is sent if nothing is low.

### Seed data (from `brand/menu-design.jpg`)
| Category | Item | EGP |
|---|---|---|
| Coffee | ✦ The Nour Signature | 135 |
| Coffee | Classic Spanish Latte | 125 |
| Coffee | Iced Pumpkin Spice Latte | 150 |
| Coffee | Iced Latte | 125 |
| Coffee | Iced White Mocha Latte | 125 |
| Coffee | Iced Sea Salt Vanilla Latte | 125 |
| Matcha | Iced Sea Salt Matcha | 165 |
| Matcha | Iced Spanish Matcha | 165 |
| Matcha | Iced Matcha | 150 |
| Add-on | Sweet Cream Cold Foam | +50 |
| Add-on | Oat Milk | +40 |
| Add-on | Coconut Milk | +40 |

Schedule seed: every day, Morning 08:00–15:00 and Evening 19:00–22:00, with 1-hour slots, max 5 orders and 10 drinks per slot.
- Storage bucket `payment-proofs` (private; only the owner can view)

### Integrity / security
- Order creation goes through a **Postgres function** (`create_order`). It locks the slot, checks **both** the remaining orders (5) and the remaining drinks (N), and inserts the order atomically, so two customers can't overbook the same slot.
- Expiry: a `pg_cron` job runs every minute and marks unpaid orders past `expires_at` as `expired`. Capacity checks also ignore stale pending orders.
- RLS: the public can read the menu and slot availability only. Customers read their own order only via its code (through an RPC). Only the authenticated owner can read and update all orders and view proofs.
- Prices are calculated on the server from `menu_items`, never trusted from the browser.

## Tech stack
- **Next.js (App Router) + TypeScript + Tailwind** on **Vercel**
- **Supabase**: Postgres, Auth (owner login only), Storage (screenshots), Realtime (live status on the order page and admin)
- **GitHub** repo connected to Vercel for auto-deploys

## Build phases
1. **Setup**: GitHub repo, Next.js scaffold, Supabase project + schema/migrations, Vercel project + env vars.
2. **Admin basics**: owner login, menu CRUD, schedule and settings.
3. **Customer booking**: menu → cart → slot picker (capacity-aware) → details → `create_order`.
4. **Payment flow**: order page, InstaPay instructions, screenshot upload, countdown, auto-expiry cron.
5. **Admin operations**: today board, pending-payments queue, status buttons, realtime updates.
6. **Inventory & margins**: ingredients, recipes, restock/adjust, deduction on confirm, the margins page, the forecast, sold-out on the menu, and the daily low-stock email.
7. **Dashboard & customers**: the KPI SQL functions, the dashboard charts and the customers page.
8. **Polish & launch**: mobile-first styling and branding, test bookings end to end, deploy to production.

## Later (not v1)
- Automatic WhatsApp messages for status changes
- Sales reports per day/week
- Loyalty / repeat-customer lookup by phone

## Open questions
- **Inventory list + recipes:** your ingredients and packaging (with current stock and what you paid), and how much of each goes into every drink. I can pre-fill typical recipes for you to correct.
- **Resend account** for the daily email (free). You'll create it and add its API key in Vercel/Supabase yourself.
- Max **drinks** per slot: 10 is a placeholder. What's your real limit per hour?
- Logo as SVG/PNG: is the PDF vector? If not, a high-res PNG with a transparent background would be ideal.
- Exact brand hex codes and fonts, if you have them from Canva. Otherwise the sampled values above are used.
- Confirm: an order with an uploaded screenshot waits for you and never auto-expires?
- Existing Supabase project / Vercel team to use, or create new ones? Preferred GitHub repo name?
