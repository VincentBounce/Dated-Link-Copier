# Dated Link Copier

Chrome extension that copies a dated link to the page you're on, in one click.

## Output

Click the toolbar icon. It shows ✓ when the line was copied, ✗ otherwise. The icon is greyed out where there is nothing to copy (new tab, `chrome://` pages, local files).

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

**Any other page (news articles, blogs…):** publish date from the page metadata and link

```
2026-09-30 https://www.leparisien.fr/seine-saint-denis-93/soupconnee-davoir-ecrit-son-devoir-avec-une-ia-une-etudiante-exclue-de-luniversite-sorbonne-paris-nord-4NEZKAEZDJGRDA4BPS5GTNIVNM.php
```

When the date can't be found, `?` takes its place. YouTube and Google Play pages that aren't a video or an app (home, channels, search…) are copied like any other page.

## Install

1. Download the zip from the [latest release](../../releases/latest) and unzip it
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Versions

| Version | Date | Built with | Changes |
|---|---|---|---|
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
