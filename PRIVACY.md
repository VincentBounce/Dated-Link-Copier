# Dated Link Copier: privacy policy

Dated Link Copier collects no personal data. It has no server, no account, no analytics and no ads, and it stores nothing.

## What the extension does

When you click its toolbar icon, it reads the current tab's address and page data (date, title, canonical link), builds a dated line and writes it to your clipboard. Nothing is read before the click, and nothing is kept after it.

## Requests to other sites

Some pages don't show their date. Then, only after your click, the extension asks a public source for it, sending only the public identifier of the item you are looking at (no cookies of yours, no personal data):

- chrome-stats.com, for Android apps and Chrome or Edge extensions (the app or extension ID);
- the public APIs of GitHub, GitLab, Wikipedia, npm, Mozilla Add-ons and Apple (the repository, article, package, add-on or app name or ID);
- the site you are on, for its own public data (for example the YouTube channel's About page or Steam's app details).

These sites receive these requests like any visit and apply their own privacy policies. The extension doesn't share or sell any data, and the developer receives none.

## Permissions

- activeTab, scripting: read the clicked tab's page data, only after the click.
- clipboardWrite, offscreen: write the dated line to the clipboard.
- declarativeContent: color the toolbar icon on pages that can be dated.
- chrome-stats.com: read public release dates of apps and extensions.

## Contact

Open an issue: https://github.com/VincentBounce/Dated-Link-Copier/issues
