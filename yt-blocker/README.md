# Strict YouTube Distraction Blocker

A Manifest V3 browser extension that strictly blocks YouTube Shorts

## What it blocks

- Direct visits to `youtube.com/shorts/...`
- Direct visits to `youtube.com/playables/...`
- YouTube single-page app navigation into Shorts or Playables
- Clicks on Shorts and Playables links before they open
- Shorts and Playables sidebar entries, shelves, cards, and mobile navigation items

## Install in Chrome or Edge

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `yt-blocker`.

## Notes

The extension redirects blocked pages back to the YouTube homepage. It also keeps removing blocked UI as YouTube dynamically loads new content.
