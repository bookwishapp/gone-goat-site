/**
 * Gone Goat — script.js
 *
 * Responsibilities:
 *   1. Email form submission (Supabase or custom API — configurable below)
 *   2. Sticky CTA bar visibility (IntersectionObserver)
 *   3. Header scroll state (adds .scrolled class)
 *   4. Footer year (auto-updates)
 *
 * ─────────────────────────────────────────────────────────────────
 * CONNECTING THE EMAIL FORM
 *
 * Option A — Supabase (recommended for this stack):
 *   1. Create a free project at supabase.com
 *   2. Run the SQL at the bottom of this file in your SQL editor
 *   3. Copy your Project URL and anon key from Settings → API
 *   4. Paste them into CONFIG.SUPABASE_URL and CONFIG.SUPABASE_ANON_KEY
 *
 * Option B — Custom REST endpoint (Next.js API route, Railway, etc.):
 *   1. Build an endpoint that accepts POST { email: string }
 *   2. Set CONFIG.API_ENDPOINT to its URL (e.g. '/api/subscribe')
 *   3. Leave the Supabase fields empty
 *
 * Option C — Email service provider (Mailchimp, ConvertKit, Kit, etc.):
 *   Replace the submitEmail() function body with your ESP's API call.
 *   Many ESPs have a simple fetch-based embed option.
 *
 * No backend yet? Leave everything empty — the form will log to the
 * console and simulate success so you can test the UI without errors.
 * ─────────────────────────────────────────────────────────────────
 */


/* ─── CONFIGURATION ─────────────────────────────────────────────── */

const CONFIG = {

  /* --- Supabase (Option A) --- */
  SUPABASE_URL:      'https://mdqinxokexygytnywwsx.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_2KsjZLEOrJ1K11Qjr9no7Q_EJh_wxYd',
  SUPABASE_TABLE:    'subscribers',

  /* --- Custom endpoint (Option B) --- */
  API_ENDPOINT:      '',     // e.g. '/api/subscribe' or 'https://api.yoursite.com/subscribe'

  /* --- Post-signup redirect (optional) --- */
  // Set KS_URL to your Kickstarter prelaunch or campaign page.
  // Set REDIRECT_AFTER_SIGNUP to true to send users there after confirming.
  KS_URL:                 '',     // e.g. 'https://www.kickstarter.com/projects/...'
  REDIRECT_AFTER_SIGNUP:  false,
  REDIRECT_DELAY_MS:      2200,   // How long to show the success message before redirecting

};


/* ─── FORM SUBMISSION ────────────────────────────────────────────── */

/**
 * Sends the email to your configured backend.
 * Returns a Promise. Throws with a typed error string on failure:
 *   'already-subscribed' — user already in the list
 *   'server-error'       — backend returned a non-OK status
 */
async function submitEmail(email) {

  /* Option A: Supabase direct REST insert */
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.SUPABASE_TABLE}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      /* Supabase returns 409 when the unique constraint on email fires */
      if (res.status === 409) throw new Error('already-subscribed');
      throw new Error('server-error');
    }

    return; /* success */
  }

  /* Option B: Custom REST endpoint */
  if (CONFIG.API_ENDPOINT) {
    const res = await fetch(CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || data.error === 'already-subscribed') {
        throw new Error('already-subscribed');
      }
      throw new Error('server-error');
    }

    return; /* success */
  }

  /* Dev mode: no backend configured — log and simulate */
  console.log('[Gone Goat] Dev mode — email captured:', email);
  console.log('[Gone Goat] Set CONFIG.SUPABASE_URL or CONFIG.API_ENDPOINT to save to a real backend.');
  await new Promise(resolve => setTimeout(resolve, 700)); /* simulate latency */
}


/* ─── FORM HANDLER ───────────────────────────────────────────────── */

function initSignupForm() {
  const form      = document.getElementById('signup-form');
  const input     = document.getElementById('email');
  const statusEl  = document.getElementById('form-status');
  const submitBtn = form && form.querySelector('.btn-submit');

  if (!form || !input || !statusEl || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = input.value.trim();

    /* Client-side validation — catches obvious errors before the network call */
    if (!email || !isValidEmail(email)) {
      setStatus('error', 'Please enter a valid email address.');
      input.focus();
      return;
    }

    /* Loading state */
    setStatus('', '');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending…';

    try {
      await submitEmail(email);

      /* Success */
      setStatus('success', "You're on the list. We'll reach out the moment we launch.");
      form.reset();

      /* Optional: redirect to Kickstarter after a short delay */
      if (CONFIG.REDIRECT_AFTER_SIGNUP && CONFIG.KS_URL) {
        setTimeout(() => {
          window.location.href = CONFIG.KS_URL;
        }, CONFIG.REDIRECT_DELAY_MS);
      }

    } catch (err) {
      if (err.message === 'already-subscribed') {
        /* Treat this as a soft success — don't alarm the user */
        setStatus('success', "You're already on the list — we'll see you at launch.");
      } else {
        setStatus('error', 'Something went wrong. Please try again in a moment.');
        console.error('[Gone Goat] Form error:', err);
      }
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Notify me';
    }
  });

  /**
   * Writes a message to the status element with a semantic class.
   * @param {'success'|'error'|''} type
   * @param {string} message
   */
  function setStatus(type, message) {
    statusEl.textContent = message;
    statusEl.className   = 'form-status' + (type ? ' ' + type : '');
  }
}

/**
 * Basic email format check.
 * Intentionally simple — the server should do thorough validation.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/* ─── STICKY CTA BAR ─────────────────────────────────────────────── */

/**
 * Shows the sticky bar once the hero CTA scrolls out of view.
 * Hides it again once the signup section is on screen (no need
 * to nag someone who's already looking at the form).
 *
 * Uses IntersectionObserver — no scroll event listener, no jank.
 */
function initStickyCTA() {
  const heroCTA      = document.querySelector('.section-hero .btn-primary');
  const signupSection = document.getElementById('signup');
  const stickyCTA    = document.getElementById('sticky-cta');

  if (!heroCTA || !stickyCTA) return;

  /* Track visibility of both targets */
  let heroInView   = true;
  let signupInView = false;

  function updateBar() {
    const shouldHide = heroInView || signupInView;

    if (shouldHide) {
      stickyCTA.classList.remove('visible');
      stickyCTA.setAttribute('aria-hidden', 'true');
    } else {
      stickyCTA.classList.add('visible');
      stickyCTA.removeAttribute('aria-hidden');
    }
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.target === heroCTA)       heroInView   = entry.isIntersecting;
      if (entry.target === signupSection) signupInView = entry.isIntersecting;
    });
    updateBar();
  }, {
    threshold: 0,
    /* rootMargin: leave at default — fire as soon as element leaves viewport */
  });

  observer.observe(heroCTA);
  if (signupSection) observer.observe(signupSection);
}


/* ─── HEADER SCROLL STATE ────────────────────────────────────────── */

/**
 * Adds .scrolled to the header after 20px scroll.
 * CSS transitions the border and background from there.
 * passive: true keeps scroll handling off the main thread.
 */
function initHeaderScroll() {
  const header = document.getElementById('site-header');
  if (!header) return;

  const THRESHOLD = 20;

  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > THRESHOLD);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); /* Run once on load in case page is pre-scrolled (e.g. back/forward cache) */
}


/* ─── FOOTER YEAR ────────────────────────────────────────────────── */

function initFooterYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}


/* ─── INIT ───────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initSignupForm();
  initStickyCTA();
  initHeaderScroll();
  initFooterYear();
});


/* ─────────────────────────────────────────────────────────────────
   SUPABASE SETUP SQL
   Run this in your Supabase project's SQL editor
   (Dashboard → SQL Editor → New query).

   Creates a 'subscribers' table with:
     - Auto-increment ID
     - Unique email (prevents duplicates at the DB level)
     - Source tag (so you can track which form/campaign captured the address)
     - Timestamp

   Row Level Security is enabled with:
     - Public INSERT allowed (so the browser can write rows)
     - Public SELECT blocked (so your list stays private)
     Only your service-role key (never exposed in JS) can read.

────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscribers (
  id         bigserial       PRIMARY KEY,
  email      text            NOT NULL UNIQUE,
  source     text            NOT NULL DEFAULT 'gone-goat-prelaunch',
  created_at timestamptz     NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous browser inserts
CREATE POLICY "allow_public_insert"
  ON subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Block all public reads (protect your email list)
CREATE POLICY "block_public_select"
  ON subscribers
  FOR SELECT
  TO anon
  USING (false);

-- To export your list later, use the Supabase dashboard or
-- connect with your service-role key from a server environment.

──────────────────────────────────────────────────────────────────── */
