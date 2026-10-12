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

**Reddit posts:** post date and link (old and new Reddit; comment links are copied as the post link)

```
2026-10-07 https://www.reddit.com/r/chrome/comments/1abcde/my_post_title/
```

**X (Twitter) posts:** post date and link, read from the post ID (works without signing in; `?` for posts older than November 2010)

```
2026-10-10 https://x.com/RobertDaleSmith/status/2108787905225245094
```

**LinkedIn posts:** post date and link, read from the post ID like on X (works signed in or out)

```
2026-05-13 https://www.linkedin.com/posts/nasrin-haghani-15020078_south-korean-scientists-reactivated-inner-share-7460201952430276608-TXVo/
```

**Amazon products:** "Date First Available" from the product details, else the date of the oldest review shown (amazon.com, .ca, .co.uk, .fr, .de, .es, .it), and the product link without search parameters

```
2023-01-17 https://www.amazon.com/Apple-MacBook-Laptop-12%E2%80%91core-19%E2%80%91core/dp/B0BSHF7WHW/
```

**Sony news and press releases:** release date and link (English and Japanese pages)

```
1998-09-29 Sony Announces New Personal LCD Monitor PC Glasstron https://www.sony.com/en/SonyInfo/News/Press/199809/98-101/
```

**Any other page (news articles, blogs…):** publish date from the page metadata and link

```
2026-09-30 https://www.leparisien.fr/seine-saint-denis-93/soupconnee-davoir-ecrit-son-devoir-avec-une-ia-une-etudiante-exclue-de-luniversite-sorbonne-paris-nord-4NEZKAEZDJGRDA4BPS5GTNIVNM.php
```

When the link doesn't carry the title (fewer than half of the title's words appear in it), the title is added, made file name safe like on YouTube. Scientific journals' `citation_*` and Dublin Core dates are read too:

```
2025-06-03 AI tutoring outperforms in-class active learning： an RCT introducing a novel research-based design in an authentic educational setting https://www.nature.com/articles/s41598-025-97652-6
```

On YouTube, Google Play, Reddit, Amazon and Sony news, `?` replaces a date that can't be found. On other pages, nothing is copied without a publish date and the icon shows ✗.

## Install

1. Download the zip from the [latest release](../../releases/latest) and unzip it
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Versions

| Version | Date | Built with | Changes |
|---|---|---|---|
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
