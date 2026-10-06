# Dated Link Copier

Chrome extension that copies a dated reference line for the page you're on, in one click.

It currently supports YouTube videos. Support for more sites (Google Play apps, news articles) is planned for 2.0.0, when the extension takes the "Dated Link Copier" name.

## Output

Click the toolbar icon on a YouTube video:

```
2025-02-06 @Katie Couric - Microplastics are accumulating in human brains at an alarming rate https://youtu.be/0PT5c1z3LL8
```

- `YYYY-MM-DD` publish date, as shown by YouTube
- One `@` per channel, so collaborations list every channel: `@RMC @Les Grandes Gueules`
- ` - ` inside the channel names and the title is replaced with `, `
- Characters forbidden in file names (`\ / : * ? " > < |`) are replaced with full-width look-alikes (`＼／：＊？＂＞＜｜`), so the line can be used as a file name
- Short `https://youtu.be/` link

The icon shows ✓ when the line was copied, ✗ otherwise.

## Install

1. Download the zip from the [latest release](../../releases/latest) and unzip it
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Versions

| Version | Date | Changes |
|---|---|---|
| 1.1.0 | 2026-09-24 | Multiple channels for collaborations, file name safe characters |
| 1.0.0 | 2026-09-24 | First reliable version: injected on click, data read from the YouTube player, ✓/✗ badge |
| 0.3.0 | 2026-01-28 | Retries, date fallback, Shorts support |
| 0.2.0 | 2025-10-04 | First real copy: date, channel, title and short link |
| 0.1.0 | 2025-05-05 | Prototype |

## License

[MIT](LICENSE)
