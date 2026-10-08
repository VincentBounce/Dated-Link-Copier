# Dated Link Copier

Chrome MV3 extension: one click copies a dated reference line for the current page. Everything is in `background.js`: on click it injects self-contained functions with `chrome.scripting.executeScript` (permissions: scripting, activeTab, clipboardWrite, declarativeContent; no host permissions).

## Output formats (`?` when the date is missing on YouTube / Google Play / Reddit)

- YouTube video: `YYYY-MM-DD @Channel1 @Channel2 - Title https://youtu.be/ID`. Data comes from the player (`#movie_player.getPlayerResponse()`, MAIN world), checked against the video ID in the URL; collaborators come from the owner block's "Collaborators" dialog data. In channels and title, ` - ` becomes `, ` and `\ / : * ? " > < |` become `＼／：＊？＂＞＜｜`.
- Google Play app: `Android YYYY-MM-DD https://play.google.com/store/apps/details?id=…`. Release date = timestamp at `app[10][1][0]` of the AF_initDataCallback block whose `[1][2][77][0]` is the app id (key `ds:5` when signed out, another key when signed in). Read from the loaded page first (instant); only when it has none (some regions get no date for some apps, or stale page after in-page navigation) fetch the app page for regions US, then FR, GB, CH (~1 s each).
- Reddit post: `YYYY-MM-DD https://www.reddit.com/r/<sub>/comments/<id>/<slug>/`. Date = `created-timestamp` of `shreddit-post[id="t3_<id>"]` (new Reddit) or `data-timestamp` of `.thing[data-fullname="t3_<id>"]` (old Reddit), else JSON-LD `datePublished`, shown as the local date like Reddit does. Comment permalinks give the post link. reddit.com blocks curl with a bot check; test in a real browser.
- Any other page: `YYYY-MM-DD <link>` (nothing copied and ✗ when no date is found) from `article:published_time` / `datePublished`; canonical link when on the same host, else the URL without tracking parameters.

## Icon

`icons/icon.svg` (blue rounded square, white calendar, blue chain link) with 16/32/48/128 px PNGs, plus grey 16/32 px copies (`icons/icon-disabled-*.png`) used as the toolbar default. Chrome draws a disabled action grey only on pages the extension can't access, and activeTab makes every web page accessible, so `chrome.action.disable()` alone never greys the icon on http(s) pages. Hence: default icon = grey copy, and a declarativeContent rule (ShowAction + SetIcon with the colored image data) on YouTube videos/Shorts, Google Play app pages, Reddit posts, and any other site (`anyHostExcept()` builds a lookahead-free regex, since rules can't exclude hosts).

## Working rules (from the owner)

- Don't ask questions: pick the sensible default, do it, say in one line what you chose.
- For each change: test it for real, commit to `main`, bump the SemVer version in `manifest.json` (patch = fix, minor = feature, major = big change), tag `vX.Y.Z`, push, and create the GitHub release with the zip: `git archive --format=zip --prefix=dated-link-copier-X.Y.Z/ -o dated-link-copier-X.Y.Z.zip vX.Y.Z manifest.json background.js icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png icons/icon-disabled-16.png icons/icon-disabled-32.png`. Release notes end with `_Built with Claude Code (<model>)._`
- Update the README (formats and versions table) when behavior changes.
- Everything on GitHub (code, comments, commits, README, release notes) is English only. Talk to the owner in French.
- Version history: 0.1 vibe coded with Grok, 0.2–0.3 with Perplexity, 1.0 and later with Claude Code. The commits up to 1.1.0 are backdated imports of older folders.
