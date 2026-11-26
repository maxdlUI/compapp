# Video kit (white style)

Everything a fresh session needs to build a Repline TikTok in the white, black-type style (marrentm calm + reisshub pace).

## Steps

1. **Gameplay:** owner's Google Drive folder https://drive.google.com/drive/folders/1KCF67b-cqe3pzWcShbgTU3V77y6z_chZ
   - list files: `pip install gdown` then `gdown.download_folder(url, skip_download=True)` (prints id + name)
   - download: `curl -L "https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t" -o clip.mp4`
   - transcode: `ffmpeg -i clip.mp4 -an -vf "scale=1280:-2,fps=30" -c:v libx264 -crf 20 -g 30 gN.mp4`
2. **Analyse every clip** before using it (owner's rule): 1-fps contact sheets with timestamps, motion per second (frame difference), and on the V5 edit map the edit counter top left (it rises by one per clean edit; where it stalls, there was a mistake). Only use windows with clean edits and real building at speed. Note the windows you used in `../learnings.md`.
3. **Voice:** ElevenLabs connector, voice "Udem · Calm & Clear Educational Narrator" (`g4XAeWx0tMolN1G3c3P5`), model `eleven_v4`, `generations_count: 1`, audio tags like `[calm]`, `[serious]`, `[short pause]`. Download the mp3 from `elevenlabsusercontent.com`.
4. **Word timings:** `pip install pocketsphinx`, edit the `text` block in `align10.py` to the script (lowercase, no punctuation, contractions without apostrophe), add missing words to the dictionary list, run `python3 align10.py vo.raw words.json` on 16 kHz mono raw audio (`ffmpeg -i vo.mp3 -ar 16000 -ac 1 -f s16le vo.raw`).
5. **Music:** `python3 lofi.py music.wav <duration> <quiet start> <quiet end>` (calm 82 bpm beat, silent window for the key line).
6. **Build:** copy `gen_white_template.py`, adapt scenes, words and clip windows, put assets (this folder's `assets/`, `vo.wav`, `music.wav`, clips) into `<project>/assets`, then `npx --yes hyperframes@0.9.77 lint|snapshot|render <project>`. Check snapshots before rendering.
7. **Loudness:** `ffmpeg -i raw.mp4 -c:v copy -af "loudnorm=I=-15:TP=-1.5:LRA=9" -c:a aac -b:a 192k out.mp4`.

Look: white page, Inter 900 black, words appear one by one (display none → inline-block so lines stay centred), one black-boxed key word per frame, gameplay as a rounded window on white, step counter, explanations with zoom on the crosshair + spotlight + drawn arrow and label (never a plain circle), no outro, loop ending, Repline only as one small line at the end.
