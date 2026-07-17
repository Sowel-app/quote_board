# Quote Board

A fullscreen board of drifting, fading quotes — usable as a website, an
installable app, a "living screensaver" during work/study, or an actual
animated desktop wallpaper via Wallpaper Engine.

## Files

- `index.html` — the whole app (works standalone too, just open it in a browser)
- `manifest.json` + `sw.js` + `icons/` — makes it installable as an app (PWA)

## 1. Just use it locally

Double-click `index.html`. Everything works except:
- "Install app" (browsers require a real server, even a local one, for that)
- **Music playback of "Suggested tracks"** — YouTube's embedded player does
  not work when a page is opened as a local `file://` path (its
  cross-frame communication breaks with a `file://` origin). Your own
  uploaded audio files in the "Playlist" section work fine locally, though.

To test music, you need step 2 below (or run `python3 -m http.server` in
this folder and open `http://localhost:8000` — that's enough, no real
hosting needed just to test).

## 2. Host it (needed for install-to-home-screen / PWA)

Any static host works. Two free, quick options:

**GitHub Pages**
1. Create a new GitHub repo, upload all files (keep the folder structure).
2. Repo Settings → Pages → set source to the main branch.
3. Your app will be live at `https://<username>.github.io/<repo>/`.

**Netlify (drag-and-drop, no account needed for a quick test)**
1. Go to https://app.netlify.com/drop
2. Drag the whole `pwa` folder onto the page.
3. You get a live URL instantly.

## 3. Install it like an app

- **Phone (Android/iOS):** open the hosted URL in the browser, then use
  "Add to Home Screen" (Chrome: menu → Add to Home Screen. Safari: Share →
  Add to Home Screen). It opens fullscreen, no browser bar — closest thing
  to a live wallpaper a website can be.
- **Desktop (Chrome/Edge):** open the URL, click the install icon in the
  address bar ("Install Quote Board").

## 4. "Screensaver mode" (built into the app)

Click **Screensaver mode** in the menu. It goes fullscreen, hides the UI,
and (where supported) keeps the screen from sleeping. Moving the mouse,
tapping, or pressing a key exits it. Good for a spare monitor, a tablet
propped on a desk, or just while you work.

## 5. Real animated desktop wallpaper (Windows/Mac)

Web pages can't literally become your OS wallpaper on their own, but
**Wallpaper Engine** (on Steam) can run any local website as a live
wallpaper: create a new wallpaper → "Website" type → point it at your local
`index.html`. Since the app is already fullscreen/borderless with no
scrollbars, it drops in with no changes needed.

## 6. Donate button

The panel footer has a "Buy me a coffee" link pointing at a placeholder
Ko-fi URL (`https://ko-fi.com/yourname`) in `index.html` — swap in your own
Ko-fi / Buy Me a Coffee page. Totally optional, no functionality is gated
behind it.

## 7. Quote packs & import/export

- "Quick packs" adds a themed set of quotes with one click (Stoic, Focus,
  Grind, Warmth) — edit the `quotePacks` object near the top of the script
  in `index.html` to add your own packs.
- "Export JSON" downloads your current quote list as `quotes.json`.
- "Import JSON" loads a quote list back in (accepts either a list of plain
  strings or a list of `{ "text": "...", "author": "..." }` objects) — handy
  for sharing a collection or backing one up.
