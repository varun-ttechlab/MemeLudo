# Meme asset folders

The default meme catalog uses approved Tenor embeds. Add local assets here when
you want to replace an embed or provide an offline fallback:

- `gifs/` — short GIF or animated image reactions
- `audio/` — short reaction sounds and celebration clips

Recommended formats:

- GIF/WebP: 1–4 seconds, ideally under 2 MB
- Audio: MP3, WAV, or OGG; ideally under 1 MB and under 3 seconds

Use simple filenames such as `capture-01.webp`, `capture-02.gif`, and
`capture-01.mp3`. Avoid spaces and special characters in filenames.

After adding an asset, register it in the `MEMES` catalog in
`public/js/game.js`, for example:

```js
{
  language: 'ಕನ್ನಡ',
  emoji: '😂',
  caption: 'ಅಯ್ಯೋ! ಮನೆಗೆ ವಾಪಸ್!',
  detail: 'Pawn sent home.',
  media: { type: 'image', src: '/memes/gifs/capture-01.webp' },
  audio: '/memes/audio/capture-01.mp3'
}
```

For a Tenor-backed entry, keep the `postId`, `href`, and attribution link from
the Tenor embed snippet. Tenor media requires an internet connection and may
load more slowly than local files.

The current catalog includes `audio/capture-ranganna.mp3`,
`audio/naavu-bayi-muchkond-idivi.mp3`, and `audio/pradeep-eshwar.mp3` as
audio-only pinned reactions. A six-roll plays `audio/lottery.mp3`, and the
winner screen plays `audio/winning.mp3`. Add
an `audio` property to another catalog entry if that reaction should also play
a sound when posted.

YouTube Shorts can be supported as iframe embeds using the video's ID, for
example `https://www.youtube.com/embed/q2IDLW40nKs`. Use them sparingly: the
player is heavier than a GIF, needs internet access, may show controls/ads, and
autoplay can be blocked by the browser. Local audio and Tenor GIFs remain the
better default for quick party reactions.

Only use media your team created or has permission to use. Do not rely on
Instagram URLs at runtime; Tenor embeds or local files are more reliable.
