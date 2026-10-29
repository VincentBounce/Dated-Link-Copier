# Dated Link Copier

Chrome extension that copies a dated link to the page you're on, in one click.

## Output

Click the toolbar icon. It shows ✓ when the line was copied, ✗ otherwise. The icon is greyed out where there is nothing to copy: YouTube pages other than videos (home, channels, search…), Google Play pages other than apps, Reddit, X and LinkedIn pages other than posts, Amazon pages other than products, new tab, `chrome://` pages and local files.

**YouTube videos:** publish date, channels, title and short link

```
2025-02-06 @Katie Couric - Microplastics are accumulating in human brains at an alarming rate https://youtu.be/0PT5c1z3LL8
```

- `YYYY-MM-DD` publish date, as shown by YouTube
- One `@` per channel, so collaborations list every channel: `@RMC @Les Grandes Gueules`
- ` - ` inside the channel names and the title is replaced with `, `
- Characters forbidden in file names (`\ / : * ? " > < |`) are replaced with full-width look-alikes (`＼／：＊？＂＞＜｜`), so the line can be used as a file name

**Google Play apps:** release date and store link

```
Android 2012-12-14 https://play.google.com/store/apps/details?id=fr.laposte.lapostemobile
```

**App Store apps:** compatible platforms, first release date and link (iPhone/iPad apps that also run on Apple silicon Macs or Apple Vision Pro count as macOS / visionOS)

```
iOS-iPadOS 2026-10-26 https://apps.apple.com/us/app/claude-duet-by-anthropic/id6803276000
macOS-iOS-iPadOS-watchOS-visionOS 2015-03-19 https://apps.apple.com/us/app/carrot-weather-alerts-radar/id961390574
```

**Chrome Web Store extensions:** release date (from Chrome-Stats, as the Store shows only the last update) and link

```
Chrome ext 2021-05-31 https://chromewebstore.google.com/detail/copy-clean-link/oegijnfjkadehneapgaejnnappgdpgng
```

**Chrome-Stats pages:** release date and link of the Android app or browser extension, without the page title

```
2026-10-24 https://chrome-stats.com/d/com.anthropic.aibo
```

**Reddit posts:** post date and link (old and new Reddit; comment links are copied as the post link)

```
2026-10-07 https://www.reddit.com/r/chrome/comments/1abcde/my_post_title/
```

**Reddit subreddits:** date the subreddit was created ("Created Jan 25, 2008") and its link (old and new Reddit, also on the sort tabs)

```
2008-01-25 https://www.reddit.com/r/apple/
```

**X (Twitter) posts:** post date and link, read from the post ID (works without signing in; `?` for posts older than November 2010)

```
2026-10-10 https://x.com/RobertDaleSmith/status/2108787905225245094
```

**X (Twitter) profiles:** month the account joined X ("Joined October 2021", in any page language) and profile link

```
2021-10-xx https://x.com/iamlaurael
```

**TikTok videos, Instagram and Threads posts, Bluesky posts:** post date and link, read from the post ID like on X (works signed in or out); on Instagram, whose links rarely name the creator, `@user` before the link

```
2019-07-27 https://www.tiktok.com/@scout2015/video/6718335390845095173
2026-10-29 @instagram https://www.instagram.com/reel/DfFSUCaB3Ty/
2026-10-12 https://www.threads.com/@zuck/post/DeZtp-TkQHh
2023-04-29 https://bsky.app/profile/jay.bsky.team/post/3juk2oypfkc2g
```

**LinkedIn posts:** post date and link, read from the post ID like on X (works signed in or out)

```
2026-05-13 https://www.linkedin.com/posts/nasrin-haghani-15020078_south-korean-scientists-reactivated-inner-share-7460201952430276608-TXVo/
```

**Amazon products:** "Date First Available" from the product details, else the date of the oldest review shown (amazon.com, .ca, .co.uk, .fr, .de, .es, .it), and the product link without search parameters

```
2023-01-17 https://www.amazon.com/Apple-MacBook-Laptop-12%E2%80%91core-19%E2%80%91core/dp/B0BSHF7WHW/
```

**Hacker News:** post or comment date and link, with the story title (the link doesn't carry it)

```
2026-10-10 REA Reverse – Engineer Anything https://news.ycombinator.com/item?id=50028275
```

**PubMed:** online (Epub) date, else the issue date (`2026-01-xx` when the day or month is missing), with the title

```
2026-01-14 Intranasal Human NSC-Derived EVs Therapy Can Restrain Inflammatory Microglial Transcriptome, and NLRP3 and cGAS-STING Signaling, in Aged Hippocampus https://pubmed.ncbi.nlm.nih.gov/41648159/
```

**SoundCloud tracks:** publish date and link

```
2012-08-28 https://soundcloud.com/dubstep/bullet-train-by-stephen-swartz
```

**Pouët productions:** date added to Pouët, groups and name like YouTube

```
2026-05-17 @Desire - Wake Up! 16b https://www.pouet.net/prod.php?which=106210
```

**Suno songs:** creation date, artist and title like YouTube, and the share link

```
2026-10-26 @toutankamo - The future speaks to us https://suno.com/s/VMQ54WCwvvaYSw3b
```

**Shadertoy shaders:** upload date and shader name (the link only has the ID)

```
2026-10-24 Vor∞noi https://www.shadertoy.com/view/73ySRh
```

**iCloud shared shortcuts:** creation date and shortcut name (the link only has the ID)

```
2025-12-15 Remove Tracking From URL https://www.icloud.com/shortcuts/ab1ded25b53442968da40a1dd677b2a1
```

**GitHub releases:** publication date and link

```
2026-10-29 https://github.com/VincentBounce/Dated-Link-Copier/releases/tag/v2.32.0
```

**PyPI projects:** date of the first release and link

```
2023-07-24 https://pypi.org/project/textual-paint/
```

**Have I Been Pwned breaches:** date the breach was added to HIBP and link

```
2020-12-20 https://haveibeenpwned.com/Breach/Ledger
```

**Y Combinator companies:** founding year ("Founded: 2023") and link

```
2023-xx-xx https://www.ycombinator.com/companies/nanocorp
```

**ScienceDirect Topics:** these pages compile excerpts and have no date of their own, so the year of the source their definition is based on is used (else the oldest excerpt)

```
2022-xx-xx https://www.sciencedirect.com/topics/engineering/photon-polymerization
```

**Sony news and press releases:** release date and link (English and Japanese pages)

```
1998-09-29 Sony Announces New Personal LCD Monitor PC Glasstron https://www.sony.com/en/SonyInfo/News/Press/199809/98-101/
```

**Any other page (news articles, blogs…):** publish date from the page metadata, else a date shown on the page (`<time>`, "Publié le 14.11.2021", "Published on November 14, 2021"…), and link

```
2026-09-30 https://www.leparisien.fr/seine-saint-denis-93/soupconnee-davoir-ecrit-son-devoir-avec-une-ia-une-etudiante-exclue-de-luniversite-sorbonne-paris-nord-4NEZKAEZDJGRDA4BPS5GTNIVNM.php
```

When the link doesn't carry the title (fewer than half of the title's words appear in it), the title is added, made file name safe like on YouTube. Scientific journals' `citation_*` and Dublin Core dates are read too:

```
2025-06-03 AI tutoring outperforms in-class active learning： an RCT introducing a novel research-based design in an authentic educational setting https://www.nature.com/articles/s41598-025-97652-6
```

On YouTube, Google Play, Reddit, Hacker News, PubMed, Amazon, SoundCloud, Pouët, Suno, Shadertoy, iCloud shortcuts, GitHub releases, PyPI, Have I Been Pwned, Y Combinator companies, ScienceDirect Topics and Sony news, `?` replaces a date that can't be found. On other pages, nothing is copied without a publish date and the icon shows ✗.

## Install

1. Download the zip from the [latest release](../../releases/latest) and unzip it
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Clean Link shortcut (iPhone, iPad, Mac)

[`shortcut/Clean Link.shortcut`](shortcut/Clean%20Link.shortcut) cleans the links in the clipboard, without the date: run it and the clipboard holds the clean text. Add it from iCloud: https://www.icloud.com/shortcuts/454decdd52a6409792a0d28ecc2e84fc

```
https://x.com/Parlons_Cyber/status/2115345322289570046?a=kGeGtTmLpX3NrwK3rv0&s=20  →  https://x.com/Parlons_Cyber/status/2115345322289570046
https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc&t=83                           →  https://youtu.be/dQw4w9WgXcQ?t=83
https://www.amazon.fr/Some-Product/dp/B0ABCDEFGH/ref=sr_1_1?crid=X                →  https://www.amazon.fr/dp/B0ABCDEFGH
https://example.com/?utm_source=nl&id=5&srsltid=AfmBOo&page=2#section             →  https://example.com/?id=5&page=2#section
https://fr.wikipedia.org/wiki/%C3%89cole_normale_sup%C3%A9rieure_(Paris)          →  https://fr.wikipedia.org/wiki/École_normale_supérieure_(Paris)
```

X posts, YouTube videos (start time kept), Google Play apps, Amazon products, Reddit and LinkedIn posts get the link built from their ID; other links lose the extension's tracking parameters and keep everything else. The script is [`shortcut/clean-link.js`](shortcut/clean-link.js); `python3 tools/make_shortcut.py` builds and signs the shortcut with the extension's own tracking list and link decoding.

## Versions

| Version | Date | Built with | Changes |
|---|---|---|---|
| 2.33.0 | 2026-10-29 | Claude Code (Claude Opus 5.5) | GitHub releases: `date link` with the publication date |
| 2.32.0 | 2026-10-29 | Claude Code (Claude Opus 5.5) | Instagram posts: `date @user link`, the creator from the post page's `og:url` |
| 2.31.0 | 2026-10-29 | Claude Code (Claude Opus 5.5) | TikTok videos, Instagram and Threads posts, Bluesky posts: `date link`, dated by their ID |
| 2.30.2 | 2026-10-29 | Claude Code (Claude Opus 5.5) | Clean Link shortcut: links copied on iOS (URL items) are cleaned instead of being replaced by their page's HTML |
| 2.30.1 | 2026-10-29 | Claude Code (Claude Opus 5.5) | Clean Link shortcut: now changes the clipboard (the web page step got its URL in a form it ignored), without a trailing line break |
| 2.30.0 | 2026-10-29 | Claude Code (Claude Opus 5.5) | Clean Link shortcut for iPhone, iPad and Mac: cleans the links in the clipboard with the extension's rules |
| 2.29.0 | 2026-10-29 | Claude Code (Claude Opus 5.5) | Other pages without a canonical link: more tracking parameters removed (Matomo, Piwik, HubSpot, Google `gbraid`/`wbraid`/`gad_source`/`srsltid`, Microsoft, Instagram, TikTok, X, LinkedIn, Yandex, Mailchimp, Marketo…) |
| 2.28.0 | 2026-10-29 | Claude Code (Claude Opus 5.5) | Links shown with their Unicode characters, as in the address bar (`clean-link-—-copy`, not `clean-link-%E2%80%94-copy`) |
| 2.27.0 | 2026-10-29 | Claude Code (Claude Opus 5.5) | Chrome Web Store extensions: `Chrome ext date link`, date from Chrome-Stats; the line is copied through an offscreen document (works on Store pages, which no extension may script) |
| 2.26.0 | 2026-10-29 | Claude Code (Claude Opus 5.5) | iCloud shared shortcuts: `date name link` with the creation date |
| 2.25.0 | 2026-10-28 | Claude Code (Claude Opus 5.5) | Other pages: also the date shown without label in the article's date element (ameli.fr: `<p class="date">12 août 2025</p>`) |
| 2.24.0 | 2026-10-28 | Claude Code (Claude Opus 5.5) | Google Play apps without a release date on Google Play: date from Chrome-Stats (new host permission: chrome-stats.com) before trying other regions |
| 2.23.0 | 2026-10-28 | Claude Code (Claude Opus 5.5) | Chrome-Stats pages: `date link`, no title |
| 2.22.0 | 2026-10-28 | Claude Code (Claude Opus 5.5) | App Store apps: `platforms date link`, first release date |
| 2.21.0 | 2026-10-27 | Claude Code (Claude Opus 5.5) | Reddit subreddits: `date link`, creation date |
| 2.20.0 | 2026-10-27 | Claude Code (Claude Opus 5.5) | X profiles: `YYYY-MM-xx link`, month joined |
| 2.19.0 | 2026-10-27 | Claude Code (Claude Opus 5.5) | SoundCloud tracks: `date link` |
| 2.18.0 | 2026-10-27 | Claude Code (Claude Opus 5.5) | Pouët productions: `date @group - name link` |
| 2.17.0 | 2026-10-26 | Claude Code (Claude Opus 5.5) | Suno songs: `date @artist - title link`, share link kept |
| 2.16.0 | 2026-10-25 | Claude Code (Claude Opus 5.5) | Shadertoy shaders: `date name link` |
| 2.15.0 | 2026-10-24 | Claude Code (Claude Opus 5.5) | PyPI projects: `date link` with the first release date |
| 2.14.0 | 2026-10-17 | Claude Code (Claude Opus 5.5) | Have I Been Pwned breach pages: `date link` with the date added to HIBP |
| 2.13.0 | 2026-10-17 | Claude Code (Claude Opus 5.5) | Y Combinator company pages: `2023-xx-xx link` with the founding year |
| 2.12.0 | 2026-10-16 | Claude Code (Claude Opus 5.5) | Pages without date metadata: date shown on the page (`<time>`, "Publié le…", "Published on…" in 5 languages) instead of ✗; site name after " \| " removed from titles |
| 2.11.0 | 2026-10-14 | Claude Code (Claude Opus 5.5) | PubMed articles: `date title link` (Epub date first) |
| 2.10.0 | 2026-10-13 | Claude Code (Claude Opus 5.5) | Hacker News posts and comments: `date title link` |
| 2.9.0 | 2026-10-13 | Claude Code (Claude Opus 5.5) | ScienceDirect Topics: `2022-xx-xx link`, year of the source the definition is based on |
| 2.8.1 | 2026-10-13 | Claude Code (Claude Opus 5.5) | Journals whose issue date is a month only (Nature Human Behaviour "2026/07") get their online date instead of ✗ |
| 2.8.0 | 2026-10-13 | Claude Code (Claude Opus 5.5) | Title added when the link doesn't carry it (Nature, Sony press releases…); journal `citation_*` / Dublin Core dates |
| 2.7.0 | 2026-10-12 | Claude Code (Claude Opus 5.5) | LinkedIn posts: `date link`, date read from the post ID (icon greyed out on other LinkedIn pages except Pulse articles) |
| 2.6.1 | 2026-10-12 | Claude Code (Claude Opus 5.5) | Amazon: products without a "Date First Available" get the date of the oldest review shown |
| 2.6.0 | 2026-10-12 | Claude Code (Claude Opus 5.5) | Amazon products: `date link` with the "Date First Available" (icon greyed out on other Amazon pages) |
| 2.5.0 | 2026-10-12 | Claude Code (Claude Opus 5.5) | X (Twitter) posts: `date link`, date read from the post ID (icon greyed out on other X pages) |
| 2.4.0 | 2026-10-09 | Claude Code (Claude Opus 5.5) | Sony news and press releases: `date link` |
| 2.3.0 | 2026-10-08 | Claude Code (Claude Opus 5.5) | Reddit posts: `date link` (icon greyed out on other Reddit pages) |
| 2.2.3 | 2026-10-08 | Claude Code (Claude Opus 5.5) | Google Play: release date found when signed in to Google; instant again (the US, French, British and Swiss pages are only fetched when the loaded page has no date) |
| 2.2.2 | 2026-10-07 | Claude Code (Claude Opus 5.5) | Google Play: release date read from the US page first, then the French, British and Swiss ones |
| 2.2.1 | 2026-10-07 | Claude Code (Claude Opus 5.5) | Google Play: release date found for apps whose page has none in some regions (e.g. France) |
| 2.2.0 | 2026-10-07 | Claude Code (Claude Opus 5.5) | Pages without a publish date (other than YouTube and Google Play) are no longer copied as `? <link>`: the icon shows ✗ |
| 2.1.2 | 2026-10-07 | Claude Code (Claude Opus 5.5) | Icon really greyed out on web pages with nothing to copy (Chrome kept disabled icons colored on sites reachable through activeTab) |
| 2.1.1 | 2026-10-07 | Claude Code (Claude Opus 5.5) | Icon greyed out on YouTube pages other than videos and Google Play pages other than apps |
| 2.1.0 | 2026-10-07 | Claude Code (Claude Opus 5.5) | Icon (calendar + link), greyed out where there is nothing to copy; YouTube and Google Play pages other than videos and apps copied as regular pages |
| 2.0.0 | 2026-10-06 | Claude Code (Claude Opus 5.5) | Renamed Dated Link Copier; Google Play apps and any page with a publish date (Le Parisien…) |
| 1.1.0 | 2026-09-24 | Claude Code (Claude Opus 5.5) | Multiple channels for collaborations, file name safe characters |
| 1.0.0 | 2026-09-24 | Claude Code (Claude Opus 5.5) | First reliable version: injected on click, data read from the YouTube player, ✓/✗ badge |
| 0.3.0 | 2026-01-28 | Perplexity | Retries, date fallback, Shorts support |
| 0.2.0 | 2025-10-04 | Perplexity | First real copy: date, channel, title and short link |
| 0.1.0 | 2025-05-05 | Grok | Prototype |

Vibe coded: 0.1 with Grok, 0.2 and 0.3 with Perplexity, 1.0 and later with Claude Code (Claude Opus 5.5).

## License

[MIT](LICENSE)
