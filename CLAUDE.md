# Dated Link Copier

Chrome MV3 extension: one click copies a dated reference line for the current page. Everything is in `background.js`: on click it injects self-contained functions with `chrome.scripting.executeScript` (permissions: scripting, activeTab, clipboardWrite, declarativeContent; no host permissions).

## Output formats (`?` when the date is missing)

- YouTube video: `YYYY-MM-DD @Channel1 @Channel2 - Title https://youtu.be/ID`. Data comes from the player (`#movie_player.getPlayerResponse()`, MAIN world), checked against the video ID in the URL; collaborators come from the owner block's "Collaborators" dialog data. In channels and title, ` - ` becomes `, ` and `\ / : * ? " > < |` become `＼／：＊？＂＞＜｜`.
- Google Play app: `Android YYYY-MM-DD https://play.google.com/store/apps/details?id=…`. Release date = timestamp at `app[10][1][0]` of the `ds:5` data block, falling back to fetching the app page after in-page navigation.
- Any other page: `YYYY-MM-DD <link>` from `article:published_time` / `datePublished`; canonical link when on the same host, else the URL without tracking parameters.

## Icon

`icons/icon.svg` (blue rounded square, white calendar, blue chain link) with 16/32/48/128 px PNGs. The action is disabled (greyed) by default and enabled with declarativeContent on YouTube videos/Shorts, Google Play app pages, and any other site (`anyHostExcept()` builds a lookahead-free regex, since rules can't exclude hosts).

## Working rules (from the owner)

- Don't ask questions: pick the sensible default, do it, say in one line what you chose.
- For each change: test it for real, commit to `main`, bump the SemVer version in `manifest.json` (patch = fix, minor = feature, major = big change), tag `vX.Y.Z`, push, and create the GitHub release with the zip: `git archive --format=zip --prefix=dated-link-copier-X.Y.Z/ -o dated-link-copier-X.Y.Z.zip vX.Y.Z manifest.json background.js icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png`. Release notes end with `_Built with Claude Code (<model>)._`
- Update the README (formats and versions table) when behavior changes.
- Everything on GitHub (code, comments, commits, README, release notes) is English only. Talk to the owner in French.
- Version history: 0.1 vibe coded with Grok, 0.2–0.3 with Perplexity, 1.0 and later with Claude Code. The commits up to 1.1.0 are backdated imports of older folders.

## Open bug (2026-10-07)

On the owner's Chrome 154 with 2.1.1, the icon stays colored on `https://www.youtube.com/` (it should be grey there). A new empty tab is grey, but typing `youtube.com` in a new tab gives a colored icon, so one of the 3 conditions seems to match the YouTube home page in Chrome.

Already checked: the rules are installed (`chrome.declarativeContent.onPageChanged.getRules` in the service worker console shows them), the conditions pass an 18-URL test in JavaScriptCore, and no activeTab grant was involved. `chrome.action.isEnabled()` ignores declarative state, so it can't be used to test. Next step: load the extension in a real browser where the toolbar can be seen (e.g. Brave), test each condition alone, and find which one matches `https://www.youtube.com/`.
