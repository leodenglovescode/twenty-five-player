# Twenty Five

An independently built browser tribute to the original 2001 iPod, made with
HTML, CSS, and JavaScript. Includes a CSS-drawn enclosure, scroll-wheel controls,
local audio playback, and three original synthesized demo tracks.

## Run

```sh
python3 serve.py --open
```

Open http://127.0.0.1:8766. On macOS, you can also double-click `Start.command`.
Python 3 is required; there are no packages to install or build steps.

## Controls

- Drag around the wheel to navigate; mouse scrolling only scrolls the page.
- Center selects, Menu goes back, and the other buttons control playback.
- Focus the player to use arrow keys, Enter, Escape, and Space.
- During playback, turn the wheel for volume. Press Center to seek, then turn
  the wheel or drag the playhead. Press Center again to return to volume.
- The top hold switch locks the controls. Settings includes shuffle, repeat,
  backlight, click sounds, and volume.
- Add audio through the file picker or drag and drop. Files stay in your browser
  tab and are cleared on refresh; nothing is uploaded.
- Immersion mode hides the surrounding page. Press Escape to leave, or use the
  exit control in the top-right corner. Playback continues through mode changes.

Codec support depends on the browser. Filenames like `Artist - Title.mp3` supply
artist and title; embedded metadata and artwork are not parsed. The interface
and bundled demos work offline once served locally.

Only one music element plays at a time. Copies of Twenty Five on the same origin
coordinate playback so starting a song in one tab pauses another. This does not
control unrelated sites or other browsers.

## Development

Run playback regression checks with Node.js:

```sh
node tests/playback.test.mjs
```

Regenerate the original demo audio with `python3 generate_demo.py`.

## License and credits

Original player code, CSS artwork, click synthesis, and demo audio are licensed
under [MIT](LICENSE).

The display uses [Chicago Kare](https://github.com/KingDuane/Chicago-Kare) by
Duane King, also MIT-licensed. Its attribution and license are included in
[fonts/LICENSE-ChicagoKare.txt](fonts/LICENSE-ChicagoKare.txt).

This is a visual tribute, not a firmware or hardware emulator. No Apple
JavaScript, images, proprietary font files, music, or catalog are included.
iPod is a trademark of Apple Inc. This project is not affiliated with or endorsed
by Apple. The MIT license does not grant rights in Apple's trademarks or product
designs.
