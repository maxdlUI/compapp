import wave, json
from piper import PiperVoice
from piper.config import SynthesisConfig
v = PiperVoice.load('voices/de_DE-thorsten-high.onnx')
P = {
 'STORM': '[[ stˈɔɾm ]]', 'NETDMG': '[[ nˈɛt dˈɛmɪtʃ ]]', 'DEALT': '[[ dˈɛmɪtʃ dˈɛlt ]]', 'TAKEN': '[[ dˈɛmɪtʃ tˈeːɪkən ]]',
 'SICK': '[[ stˈɔɾm sˈɪknəs ]]', 'SURGE': '[[ tˈiːm nˈɛt sˈœɾtʃ ]]', 'FNC': '[[ fˈɔɾtnaɪt kɔmpˈɛtɪtɪf ]]',
 'MAP': '[[ mˈɛp ]]', 'DISCORD': '[[ dˈɪskɔɾt ]]', 'PRESETS': '[[ pɾˈiːsɛts ]]', 'TIMER': '[[ stˈɔɾmtaɪmɐ ]]',
}
lines = [
 "Der Sturm zieht sich zusammen. Jede Sekunde zählt.",
 "Das ist Krewo. Dein Begleiter für FNC. Kostenlos, direkt im Browser.",
 "Der TIMER schätzt deinen Sturmschaden. Wähle den Schaden pro Sekunde, und drück auf Start.",
 "Ab fünfhundert Schaden warnt dich Krewo vor SICK. Ab sechshundert wird es akut.",
 "NETDMG rechnet für dich: ausgeteilter Schaden, minus erlittener Schaden. Mit Schnellknöpfen und Rückgängig.",
 "Im Duo oder Trio meldest du dich mit DISCORD an und teilst einen Link. SURGE zeigt eure gemeinsame Summe.",
 "Der Rotation-Countdown läuft mit deinen eigenen PRESETS. Auf Wunsch mit Ton.",
 "Lade deine eigene MAP hoch, und zoome im Vollbild hinein. Alles bleibt auf deinem Gerät.",
 "Krewo. Jetzt kostenlos öffnen.",
]
cfg = SynthesisConfig(length_scale=1.07, noise_scale=0.6, noise_w_scale=0.7)
out = []
for i, l in enumerate(lines):
    for k, p in P.items(): l = l.replace(k, p)
    with wave.open(f'vo/{i}.wav', 'wb') as w:
        v.synthesize_wav(l, w, syn_config=cfg)
    with wave.open(f'vo/{i}.wav') as w: d = w.getnframes() / w.getframerate(); sr = w.getframerate()
    out.append(round(d, 2))
print(sr, out, sum(out))
