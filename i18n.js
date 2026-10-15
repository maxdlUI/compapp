// Zentrale Übersetzung Deutsch / Englisch.
// Alle sichtbaren Texte stehen hier an einer Stelle. Die Oberfläche nutzt t('schlüssel', { parameter }).
// Statische Texte in index.html tragen data-i18n="schlüssel" und werden von applyStatic() gefüllt.
// Nutzerdaten (Preset-Namen, Notizen) laufen nie durch dieses Modul.
// Ein Test (test/i18n.test.js) prüft, dass beide Sprachen dieselben Schlüssel und Platzhalter haben.

export const LANGS = ['de', 'en'];
export const LANG_KEY = 'fnc.v1.lang';

const de = {
  'meta.description': 'Storm-Timer, Net Damage, Rotation-Countdown, Storm-Surge-Info, Map und Match-Notizen. Unabhängiges Fanprojekt, nicht von Epic Games.',
  'lang.label': 'Sprache',
  'nav.label': 'Bereiche',
  'nav.storm': 'Storm',
  'nav.damage': 'Damage',
  'nav.rotation': 'Rotation',
  'nav.surge': 'Surge',
  'nav.map': 'Map',
  'nav.notes': 'Notizen',
  'storage.warning': 'Speichern auf diesem Gerät ist nicht möglich (z. B. privater Modus). Daten gehen beim Schließen verloren.',
  'footer': 'Unabhängiges Fanprojekt. Nicht von Epic Games oder Fortnite unterstützt oder betrieben. Alle Daten bleiben auf diesem Gerät.',

  'common.start': 'Start',
  'common.pause': 'Pause',
  'common.resume': 'Fortsetzen',
  'common.restart': 'Neu starten',
  'common.reset': 'Reset',
  'common.close': 'Schließen',
  'common.unknown': 'unbekannt',

  // Storm
  'storm.title': 'Storm',
  'storm.rateLabel': 'Storm-Schaden pro Sekunde',
  'storm.rateOption': '{n} Schaden pro Sekunde',
  'storm.time': 'Zeit',
  'storm.status.idle': 'Bereit',
  'storm.status.running': 'Läuft',
  'storm.status.paused': 'Pausiert',
  'storm.statRate': 'Schaden pro Sekunde',
  'storm.statDamage': 'Geschätzter Schaden',
  'storm.barLabel': 'Storm-Schaden bis 600',
  'storm.barValue': '{n} von 600 Schaden',
  'storm.thLeft': 'Noch {n} Schaden · ca. {t}',
  'storm.thReached': 'Erreicht ({n} Schaden)',
  'storm.resetLabel': 'Storm-Timer zurücksetzen',
  'storm.hint': 'Schätzung. Der Timer liest keine Live-Daten aus Fortnite aus. Wähle den Schaden passend zur aktuellen Phase.',

  // Net Damage
  'net.title': 'Net Damage',
  'net.formula': 'Net Damage = Damage Dealt − Damage Taken',
  'net.dealt': 'Damage Dealt',
  'net.taken': 'Damage Taken',
  'net.dealtHint': 'Verursachten Schaden hinzufügen',
  'net.takenHint': 'Erlittenen Schaden hinzufügen',
  'net.dealtGroup': 'Damage Dealt erhöhen',
  'net.takenGroup': 'Eingehenden Schaden zu Damage Taken addieren',
  'net.addDealt': '{n} Damage zu Damage Dealt hinzufügen',
  'net.addTaken': '{n} Damage zu Damage Taken hinzufügen',
  'net.damageWord': 'Damage',
  'net.clearDealt': 'Dealt leeren',
  'net.clearTaken': 'Taken leeren',
  'net.clearDealtLabel': 'Damage Dealt auf 0 zurücksetzen',
  'net.clearTakenLabel': 'Damage Taken auf 0 zurücksetzen',
  'net.undo': 'Rückgängig',
  'net.undoLabel': 'Letzte Änderung rückgängig machen',
  'net.resetLabel': 'Net Damage zurücksetzen',
  'net.kind.positive': 'Im Plus',
  'net.kind.negative': 'Im Minus',
  'net.kind.even': 'Ausgeglichen',
  'net.kind.invalid': 'Ungültige Eingabe',
  'net.err.negative': 'Keine negativen Werte.',
  'net.err.format': 'Nur ganze Zahlen ohne Komma oder Buchstaben.',
  'net.err.max': 'Höchstens {max}.',

  // Rotation
  'rot.title': 'Rotation',
  'rot.soundLabel': 'Ton bei Ablauf',
  'rot.soundOn': 'Ton an',
  'rot.soundOff': 'Ton aus',
  'rot.edit': 'Presets bearbeiten',
  'rot.presets': 'Rotation-Dauer',
  'rot.duration': '{m} Min. {s} Sek.',
  'rot.locked': 'Zum Wechseln des Presets zuerst Reset drücken.',
  'rot.remaining': 'Restzeit',
  'rot.status.idle': 'Bereit',
  'rot.status.running': 'Läuft',
  'rot.status.paused': 'Pausiert',
  'rot.status.finished': 'Abgelaufen',
  'rot.warn': 'Noch 10 Sekunden',
  'rot.done': 'Zeit abgelaufen. Rotation jetzt!',
  'rot.resetLabel': 'Rotation-Countdown zurücksetzen',

  // Preset-Editor
  'pe.title': 'Presets bearbeiten',
  'pe.intro': 'Name und Dauer festlegen, Reihenfolge ändern. Änderungen gelten nach „Speichern“.',
  'pe.rowLabel': 'Preset {n}',
  'pe.name': 'Name',
  'pe.namePlaceholder': 'z. B. Endzone',
  'pe.min': 'Min',
  'pe.sec': 'Sek',
  'pe.up': 'Nach oben',
  'pe.down': 'Nach unten',
  'pe.delete': 'Löschen',
  'pe.upLabel': 'Preset {n} nach oben',
  'pe.downLabel': 'Preset {n} nach unten',
  'pe.deleteLabel': 'Preset {n} löschen',
  'pe.add': 'Preset hinzufügen',
  'pe.defaults': 'Standard-Presets',
  'pe.defaultsLabel': 'Standard-Presets in den Entwurf laden',
  'pe.save': 'Speichern',
  'pe.cancel': 'Abbrechen',
  'pe.err.empty': 'Name fehlt.',
  'pe.err.long': 'Höchstens {max} Zeichen.',
  'pe.err.minutes': 'Minuten: ganze Zahl von 0 bis 99.',
  'pe.err.seconds': 'Sekunden: ganze Zahl von 0 bis 59.',
  'pe.err.zero': 'Die Dauer muss mindestens 1 Sekunde betragen.',
  'pe.err.max': 'Die Dauer darf höchstens 99:59 betragen.',
  'pe.err.count': 'Höchstens {max} Presets.',
  'pe.err.none': 'Mindestens ein Preset ist nötig.',
  'pe.fixErrors': 'Bitte die markierten Felder korrigieren.',
  'pe.saved': 'Presets gespeichert.',
  'pe.saveFailed': 'Die Presets gelten jetzt, konnten aber nicht dauerhaft gespeichert werden.',
  'pe.activeNote': 'Der laufende Countdown behält seine Dauer. Änderungen gelten nach dem Zurücksetzen.',

  // Map
  'map.title': 'Map',
  'map.emptyTitle': 'Lade deine Fortnite-Map hoch',
  'map.emptyHint': 'PNG, JPG oder WEBP. Das Bild bleibt nur auf diesem Gerät gespeichert.',
  'map.upload': 'Map hochladen',
  'map.yours': 'Deine Karte',
  'map.name': 'Fortnite-Map',
  'map.chips': 'Bildinformationen',
  'map.fullscreen': 'Vollbild',
  'map.replace': 'Ersetzen',
  'map.remove': 'Entfernen',
  'map.alt': 'Hochgeladene Fortnite-Map',
  'map.viewer': 'Map im Vollbild',
  'map.viewerAlt': 'Fortnite-Map, große Ansicht',
  'map.zoom': 'Zoom',
  'map.zoomOut': 'Verkleinern',
  'map.zoomIn': 'Vergrößern',
  'map.chipStored': 'Lokal gespeichert',
  'map.chipNotStored': 'Nicht gespeichert',
  'map.noteStored': 'Das Bild liegt nur auf diesem Gerät und bleibt nach dem Neuladen erhalten.',
  'map.noteNotStored': 'Das Bild wird nur in dieser Sitzung angezeigt. Nach dem Neuladen ist es weg.',
  'map.say.displayFail': 'Das Bild konnte nicht angezeigt werden.',
  'map.say.unsupported': 'Dieses Dateiformat wird nicht unterstützt. Bitte wähle ein PNG, JPG oder WEBP.',
  'map.say.tooLarge': 'Die Datei ist zu groß ({size}). Erlaubt sind bis zu {max}.',
  'map.say.loading': 'Bild wird geladen …',
  'map.say.loadFail': 'Das Bild konnte nicht geladen werden. Die Datei ist beschädigt oder wird nicht unterstützt.',
  'map.say.saved': 'Map gespeichert.',
  'map.say.savedResized': 'Map gespeichert. Das Bild wurde für den Speicher verkleinert.',
  'map.say.saveFail': 'Die Map wird angezeigt, konnte aber nicht gespeichert werden (Speicher voll oder gesperrt). Nach dem Neuladen ist sie weg.',
  'map.say.removed': 'Map entfernt. Du kannst jetzt ein neues Bild hochladen.',
  'map.say.removeFail': 'Die Map wurde ausgeblendet, konnte aber nicht aus dem Speicher gelöscht werden. Nach dem Neuladen kann sie zurückkommen.',

  // Notizen
  'notes.title': 'Match-Notizen',
  'notes.inputLabel': 'Notiz zum aktuellen Match',
  'notes.placeholder': 'Notizen zum aktuellen Match …',
  'notes.save': 'Speichern',
  'notes.export': 'Export .txt',
  'notes.share': 'Teilen',
  'notes.delete': 'Löschen',
  'notes.confirmText': 'Alle gespeicherten Notizen und den Entwurf endgültig löschen? Timer, Net Damage und Map bleiben unverändert.',
  'notes.confirmCancel': 'Abbrechen',
  'notes.confirmOk': 'Endgültig löschen',
  'notes.list': 'Gespeicherte Notizen',
  'notes.empty': 'Noch keine gespeicherten Notizen.',
  'notes.draftLabel': 'Entwurf, nicht gespeichert',
  'notes.shareTitle': 'Match-Notizen',
  'notes.say.empty': 'Nichts zu speichern. Das Feld ist leer.',
  'notes.say.saveFail': 'Speichern fehlgeschlagen. Der Text bleibt im Feld erhalten.',
  'notes.say.saved': 'Notiz gespeichert.',
  'notes.say.noExport': 'Keine Notizen zum Exportieren.',
  'notes.say.exported': 'Textdatei erstellt.',
  'notes.say.exportFail': 'Export fehlgeschlagen. Nutze „Teilen“ oder kopiere den Text.',
  'notes.say.noShare': 'Keine Notizen zum Teilen.',
  'notes.say.shared': 'Geteilt.',
  'notes.say.copied': 'Teilen ist hier nicht verfügbar. Der Text wurde in die Zwischenablage kopiert.',
  'notes.say.shareFail': 'Teilen und Kopieren sind nicht möglich. Nutze „Export .txt“.',
  'notes.say.deleteFail': 'Löschen im Speicher fehlgeschlagen.',
  'notes.say.deleted': 'Notizen gelöscht.',

  // Storm Surge
  'surge.title': 'Storm Surge',
  'surge.badge.loading': 'Lädt …',
  'surge.badge.empty': 'Keine Daten',
  'surge.badge.ready': 'Daten geladen',
  'surge.badge.fixture': 'Testdaten',
  'surge.badge.error': 'Nicht ladbar',
  'surge.emptyTitle': 'Nicht genügend verlässliche Daten',
  'surge.emptyLead': 'Es gibt hier noch keine belastbare Auswertung. Es wird bewusst nichts geschätzt.',
  'surge.why1': 'Es wurde keine öffentlich zugängliche, überprüfbare Datenreihe mit Storm-Surge-Werten pro Zone gefunden.',
  'surge.why2': 'Die echte Schwelle ist nach den geprüften Quellen relativ zur Lobby und wird im Spiel angezeigt. Sie lässt sich nicht aus alten Matches ableiten.',
  'surge.why3': 'Surge bezieht sich laut Quellen auf Damage Dealt. Net Damage (Dealt − Taken) ist nicht automatisch dieselbe Kennzahl.',
  'surge.noLive': 'Die App zeigt keinen Live-Schwellenwert und kein „über/unter Surge“. Historische Werte sind keine aktuelle Schwelle.',
  'surge.sourcesTitle': 'Geprüfte Quellen und Methode',
  'surge.sourcesIntro': 'Geprüft am {date}. Diese Quellen enthalten keine verwertbaren Zonenwerte:',
  'surge.sourcesMethod': 'Neue Daten kommen nur über die versionierte Datei surge-data.json in die App. Sie wird beim Laden geprüft; Gruppen ohne nachvollziehbare Quelle werden verworfen.',
  'surge.dataset': 'Datensammlung {v} · Stand {date} · Datengruppen: {n}',
  'surge.datasetNoDate': 'Datensammlung {v} · Stand unbekannt · Datengruppen: {n}',
  'surge.error': 'Die Datensammlung konnte nicht geladen werden. Alle anderen Bereiche der App funktionieren weiter.',
  'surge.invalid': 'Die Datensammlung hat ein unbekanntes Format und wird nicht verwendet.',
  'surge.retry': 'Erneut versuchen',
  'surge.dropped': 'Wegen Formatfehlern ignorierte Datengruppen: {n}',
  'surge.fixture': 'TESTDATEN: Diese Werte sind erfunden und nur zum Prüfen der Anzeige gedacht.',
  'surge.group': 'Datengruppe',
  'surge.zones': 'Zone',
  'surge.zoneLabel': 'Zone {n}',
  'surge.noZones': 'Diese Datengruppe enthält keine Zonen.',
  'surge.median': 'Median',
  'surge.range': 'Bereich P10–P90',
  'surge.sample': 'Stichprobe',
  'surge.nValue': 'n = {n}',
  'surge.midHalf': 'Mittlere Hälfte (P25–P75)',
  'surge.minMax': 'Minimum bis Maximum',
  'surge.q.ok': 'Ausreichend für eine grobe Einordnung (n ≥ {min})',
  'surge.q.low': 'Geringe Aussagekraft, nur Orientierung (n < {min})',
  'surge.q.insufficient': 'Zu wenige Daten (n < {min}): keine Statistik',
  'surge.rangeNote': 'Der Bereich zeigt, wo 80 % der beobachteten Werte lagen. Er ist kein Konfidenzintervall und keine Garantie für künftige Matches.',
  'surge.meta.tournament': 'Turnier',
  'surge.meta.version': 'Spielversion',
  'surge.meta.format': 'Format',
  'surge.meta.region': 'Region',
  'surge.meta.metric': 'Kennzahl',
  'surge.meta.definition': 'Definition',
  'surge.meta.unit': 'Beobachtung',
  'surge.meta.source': 'Quelle',
  'surge.meta.asOf': 'Stand',
  'surge.meta.method': 'Berechnung',
  'surge.metric.damage_dealt': 'Damage Dealt',
  'surge.metric.net_damage': 'Net Damage (Dealt − Taken)',
  'surge.w.noVersion': 'Spielversion unbekannt: eingeschränkt vergleichbar.',
  'surge.w.noFormat': 'Format unbekannt: eingeschränkt vergleichbar.',
  'surge.w.noDate': 'Stand der Daten unbekannt.',
  'surge.w.stale': 'Veraltet: Stand älter als {days} Tage.',
  'surge.w.otherMetric': 'Andere Kennzahl: kein Vergleich mit deinen Eingaben.',
  'surge.context': 'Die App erkennt weder deine aktuelle Zone noch Spielversion oder Format. Wähle die Zone selbst; die Vergleichbarkeit ist eingeschränkt.',
  'surge.cmp.title': 'Dein Wert im Vergleich',
  'surge.cmp.dealt': 'Dein Damage Dealt: {v}',
  'surge.cmp.net': 'Dein Net Damage: {v}',
  'surge.cmp.low': 'eher niedrig',
  'surge.cmp.typical': 'im typischen Bereich',
  'surge.cmp.high': 'eher hoch',
  'surge.cmp.basis': 'Bezogen auf {n} Beobachtungen: {group}, Zone {zone}. Mittlere Hälfte: {a} – {b}.',
  'surge.cmp.caveat': 'Das ist eine Einordnung, kein Schwellenwert. Sie sagt nicht, ob du in deinem Match über oder unter Surge liegst.',
  'surge.cmp.no.metric': 'Kein Vergleich: Die Daten nutzen eine andere Kennzahl als deine Eingaben.',
  'surge.cmp.no.context': 'Kein Vergleich: Spielversion oder Format der Daten sind unbekannt.',
  'surge.cmp.no.sample': 'Kein Vergleich: Die Stichprobe ist zu klein (n < {min}).',
  'surge.cmp.no.input': 'Kein Vergleich: Bei Damage Dealt oder Damage Taken steht eine ungültige Eingabe.',
  'surge.cmp.no.empty': 'Kein Vergleich: Bei Net Damage sind noch keine Werte eingegeben.',
};

const en = {
  'meta.description': 'Storm timer, net damage, rotation countdown, Storm Surge info, map and match notes. Independent fan project, not affiliated with Epic Games.',
  'lang.label': 'Language',
  'nav.label': 'Sections',
  'nav.storm': 'Storm',
  'nav.damage': 'Damage',
  'nav.rotation': 'Rotation',
  'nav.surge': 'Surge',
  'nav.map': 'Map',
  'nav.notes': 'Notes',
  'storage.warning': 'Saving on this device is not possible (e.g. private mode). Data is lost when you close the page.',
  'footer': 'Independent fan project. Not endorsed or operated by Epic Games or Fortnite. All data stays on this device.',

  'common.start': 'Start',
  'common.pause': 'Pause',
  'common.resume': 'Resume',
  'common.restart': 'Restart',
  'common.reset': 'Reset',
  'common.close': 'Close',
  'common.unknown': 'unknown',

  // Storm
  'storm.title': 'Storm',
  'storm.rateLabel': 'Storm damage per second',
  'storm.rateOption': '{n} damage per second',
  'storm.time': 'Time',
  'storm.status.idle': 'Ready',
  'storm.status.running': 'Running',
  'storm.status.paused': 'Paused',
  'storm.statRate': 'Damage per second',
  'storm.statDamage': 'Estimated damage',
  'storm.barLabel': 'Storm damage up to 600',
  'storm.barValue': '{n} of 600 damage',
  'storm.thLeft': '{n} damage left · approx. {t}',
  'storm.thReached': 'Reached ({n} damage)',
  'storm.resetLabel': 'Reset storm timer',
  'storm.hint': 'Estimate. The timer does not read any live data from Fortnite. Pick the damage that matches the current phase.',

  // Net Damage
  'net.title': 'Net Damage',
  'net.formula': 'Net Damage = Damage Dealt − Damage Taken',
  'net.dealt': 'Damage Dealt',
  'net.taken': 'Damage Taken',
  'net.dealtHint': 'Add damage you dealt',
  'net.takenHint': 'Add damage you took',
  'net.dealtGroup': 'Increase Damage Dealt',
  'net.takenGroup': 'Add incoming damage to Damage Taken',
  'net.addDealt': 'Add {n} damage to Damage Dealt',
  'net.addTaken': 'Add {n} damage to Damage Taken',
  'net.damageWord': 'Damage',
  'net.clearDealt': 'Clear Dealt',
  'net.clearTaken': 'Clear Taken',
  'net.clearDealtLabel': 'Reset Damage Dealt to 0',
  'net.clearTakenLabel': 'Reset Damage Taken to 0',
  'net.undo': 'Undo',
  'net.undoLabel': 'Undo last change',
  'net.resetLabel': 'Reset net damage',
  'net.kind.positive': 'Net positive',
  'net.kind.negative': 'Net negative',
  'net.kind.even': 'Even',
  'net.kind.invalid': 'Invalid input',
  'net.err.negative': 'No negative values.',
  'net.err.format': 'Whole numbers only, no decimals or letters.',
  'net.err.max': 'At most {max}.',

  // Rotation
  'rot.title': 'Rotation',
  'rot.soundLabel': 'Sound when time is up',
  'rot.soundOn': 'Sound on',
  'rot.soundOff': 'Sound off',
  'rot.edit': 'Edit presets',
  'rot.presets': 'Rotation duration',
  'rot.duration': '{m} min {s} sec',
  'rot.locked': 'Press Reset first to switch presets.',
  'rot.remaining': 'Time left',
  'rot.status.idle': 'Ready',
  'rot.status.running': 'Running',
  'rot.status.paused': 'Paused',
  'rot.status.finished': 'Time’s up',
  'rot.warn': '10 seconds left',
  'rot.done': 'Time’s up. Rotate now!',
  'rot.resetLabel': 'Reset rotation countdown',

  // Preset-Editor
  'pe.title': 'Edit presets',
  'pe.intro': 'Set name and duration, change the order. Changes apply after “Save”.',
  'pe.rowLabel': 'Preset {n}',
  'pe.name': 'Name',
  'pe.namePlaceholder': 'e.g. Endgame',
  'pe.min': 'Min',
  'pe.sec': 'Sec',
  'pe.up': 'Move up',
  'pe.down': 'Move down',
  'pe.delete': 'Delete',
  'pe.upLabel': 'Move preset {n} up',
  'pe.downLabel': 'Move preset {n} down',
  'pe.deleteLabel': 'Delete preset {n}',
  'pe.add': 'Add preset',
  'pe.defaults': 'Default presets',
  'pe.defaultsLabel': 'Load default presets into the draft',
  'pe.save': 'Save',
  'pe.cancel': 'Cancel',
  'pe.err.empty': 'Name is missing.',
  'pe.err.long': 'At most {max} characters.',
  'pe.err.minutes': 'Minutes: whole number from 0 to 99.',
  'pe.err.seconds': 'Seconds: whole number from 0 to 59.',
  'pe.err.zero': 'The duration must be at least 1 second.',
  'pe.err.max': 'The duration must be 99:59 at most.',
  'pe.err.count': 'At most {max} presets.',
  'pe.err.none': 'At least one preset is required.',
  'pe.fixErrors': 'Please fix the highlighted fields.',
  'pe.saved': 'Presets saved.',
  'pe.saveFailed': 'The presets are active now but could not be saved permanently.',
  'pe.activeNote': 'The running countdown keeps its duration. Changes apply after reset.',

  // Map
  'map.title': 'Map',
  'map.emptyTitle': 'Upload your Fortnite map',
  'map.emptyHint': 'PNG, JPG or WEBP. The image stays on this device only.',
  'map.upload': 'Upload map',
  'map.yours': 'Your map',
  'map.name': 'Fortnite map',
  'map.chips': 'Image details',
  'map.fullscreen': 'Fullscreen',
  'map.replace': 'Replace',
  'map.remove': 'Remove',
  'map.alt': 'Uploaded Fortnite map',
  'map.viewer': 'Map fullscreen',
  'map.viewerAlt': 'Fortnite map, large view',
  'map.zoom': 'Zoom',
  'map.zoomOut': 'Zoom out',
  'map.zoomIn': 'Zoom in',
  'map.chipStored': 'Saved locally',
  'map.chipNotStored': 'Not saved',
  'map.noteStored': 'The image lives on this device only and stays after a reload.',
  'map.noteNotStored': 'The image is only shown in this session. It is gone after a reload.',
  'map.say.displayFail': 'The image could not be displayed.',
  'map.say.unsupported': 'This file format is not supported. Please choose a PNG, JPG or WEBP.',
  'map.say.tooLarge': 'The file is too large ({size}). Up to {max} is allowed.',
  'map.say.loading': 'Loading image …',
  'map.say.loadFail': 'The image could not be loaded. The file is damaged or not supported.',
  'map.say.saved': 'Map saved.',
  'map.say.savedResized': 'Map saved. The image was scaled down to save space.',
  'map.say.saveFail': 'The map is shown but could not be saved (storage full or blocked). It is gone after a reload.',
  'map.say.removed': 'Map removed. You can upload a new image now.',
  'map.say.removeFail': 'The map was hidden but could not be deleted from storage. It may come back after a reload.',

  // Notes
  'notes.title': 'Match notes',
  'notes.inputLabel': 'Note for the current match',
  'notes.placeholder': 'Notes for the current match …',
  'notes.save': 'Save',
  'notes.export': 'Export .txt',
  'notes.share': 'Share',
  'notes.delete': 'Delete',
  'notes.confirmText': 'Permanently delete all saved notes and the draft? Timers, net damage and map stay unchanged.',
  'notes.confirmCancel': 'Cancel',
  'notes.confirmOk': 'Delete permanently',
  'notes.list': 'Saved notes',
  'notes.empty': 'No saved notes yet.',
  'notes.draftLabel': 'Draft, not saved',
  'notes.shareTitle': 'Match notes',
  'notes.say.empty': 'Nothing to save. The field is empty.',
  'notes.say.saveFail': 'Saving failed. The text stays in the field.',
  'notes.say.saved': 'Note saved.',
  'notes.say.noExport': 'No notes to export.',
  'notes.say.exported': 'Text file created.',
  'notes.say.exportFail': 'Export failed. Use “Share” or copy the text.',
  'notes.say.noShare': 'No notes to share.',
  'notes.say.shared': 'Shared.',
  'notes.say.copied': 'Sharing is not available here. The text was copied to the clipboard.',
  'notes.say.shareFail': 'Sharing and copying are not possible. Use “Export .txt”.',
  'notes.say.deleteFail': 'Deleting from storage failed.',
  'notes.say.deleted': 'Notes deleted.',

  // Storm Surge
  'surge.title': 'Storm Surge',
  'surge.badge.loading': 'Loading …',
  'surge.badge.empty': 'No data',
  'surge.badge.ready': 'Data loaded',
  'surge.badge.fixture': 'Test data',
  'surge.badge.error': 'Unavailable',
  'surge.emptyTitle': 'Not enough reliable data',
  'surge.emptyLead': 'There is no reliable analysis here yet. Nothing is estimated on purpose.',
  'surge.why1': 'No publicly available, verifiable data series with per-zone Storm Surge values was found.',
  'surge.why2': 'According to the reviewed sources, the real threshold is relative to the lobby and shown in the game. It cannot be derived from past matches.',
  'surge.why3': 'According to the sources, Surge is based on damage dealt. Net Damage (Dealt − Taken) is not automatically the same metric.',
  'surge.noLive': 'The app shows no live threshold and no “above/below Surge”. Historical values are not a current threshold.',
  'surge.sourcesTitle': 'Reviewed sources and method',
  'surge.sourcesIntro': 'Checked on {date}. These sources contain no usable per-zone values:',
  'surge.sourcesMethod': 'New data enters the app only through the versioned file surge-data.json. It is validated on load; groups without a traceable source are discarded.',
  'surge.dataset': 'Dataset {v} · as of {date} · data groups: {n}',
  'surge.datasetNoDate': 'Dataset {v} · date unknown · data groups: {n}',
  'surge.error': 'The dataset could not be loaded. All other parts of the app keep working.',
  'surge.invalid': 'The dataset has an unknown format and is not used.',
  'surge.retry': 'Try again',
  'surge.dropped': 'Data groups ignored because of format errors: {n}',
  'surge.fixture': 'TEST DATA: These values are made up and only meant to check the display.',
  'surge.group': 'Data group',
  'surge.zones': 'Zone',
  'surge.zoneLabel': 'Zone {n}',
  'surge.noZones': 'This data group contains no zones.',
  'surge.median': 'Median',
  'surge.range': 'Range P10–P90',
  'surge.sample': 'Sample size',
  'surge.nValue': 'n = {n}',
  'surge.midHalf': 'Middle half (P25–P75)',
  'surge.minMax': 'Minimum to maximum',
  'surge.q.ok': 'Sufficient for a rough classification (n ≥ {min})',
  'surge.q.low': 'Low significance, orientation only (n < {min})',
  'surge.q.insufficient': 'Too little data (n < {min}): no statistics',
  'surge.rangeNote': 'The range shows where 80% of the observed values fell. It is not a confidence interval and no guarantee for future matches.',
  'surge.meta.tournament': 'Tournament',
  'surge.meta.version': 'Game version',
  'surge.meta.format': 'Format',
  'surge.meta.region': 'Region',
  'surge.meta.metric': 'Metric',
  'surge.meta.definition': 'Definition',
  'surge.meta.unit': 'Observation',
  'surge.meta.source': 'Source',
  'surge.meta.asOf': 'As of',
  'surge.meta.method': 'Calculation',
  'surge.metric.damage_dealt': 'Damage Dealt',
  'surge.metric.net_damage': 'Net Damage (Dealt − Taken)',
  'surge.w.noVersion': 'Game version unknown: limited comparability.',
  'surge.w.noFormat': 'Format unknown: limited comparability.',
  'surge.w.noDate': 'Date of the data unknown.',
  'surge.w.stale': 'Outdated: data older than {days} days.',
  'surge.w.otherMetric': 'Different metric: no comparison with your inputs.',
  'surge.context': 'The app cannot detect your current zone, game version or format. Pick the zone yourself; comparability is limited.',
  'surge.cmp.title': 'Your value compared',
  'surge.cmp.dealt': 'Your Damage Dealt: {v}',
  'surge.cmp.net': 'Your Net Damage: {v}',
  'surge.cmp.low': 'rather low',
  'surge.cmp.typical': 'in the typical range',
  'surge.cmp.high': 'rather high',
  'surge.cmp.basis': 'Based on {n} observations: {group}, zone {zone}. Middle half: {a} – {b}.',
  'surge.cmp.caveat': 'This is a classification, not a threshold. It does not tell whether you are above or below Surge in your match.',
  'surge.cmp.no.metric': 'No comparison: the data uses a different metric than your inputs.',
  'surge.cmp.no.context': 'No comparison: the game version or format of the data is unknown.',
  'surge.cmp.no.sample': 'No comparison: the sample is too small (n < {min}).',
  'surge.cmp.no.input': 'No comparison: Damage Dealt or Damage Taken contains an invalid input.',
  'surge.cmp.no.empty': 'No comparison: no values entered in Net Damage yet.',
};

export const DICT = { de, en };

// ---------- Übersetzen ----------

/** Fehlt ein Schlüssel in der Sprache, wird Deutsch genutzt, sonst der Schlüssel selbst (sichtbarer Fehler, vom Test abgefangen). */
export function translate(lang, key, params) {
  const table = DICT[lang] || DICT.de;
  const raw = table[key] ?? DICT.de[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

/** Gespeicherte Wahl hat Vorrang, sonst Browsersprache (de* -> Deutsch, alles andere -> Englisch). */
export function detectLanguage(stored, browserLanguages = []) {
  if (LANGS.includes(stored)) return stored;
  const first = String(browserLanguages[0] ?? '').toLowerCase();
  return first.startsWith('de') ? 'de' : 'en';
}

let current = 'de';
const listeners = new Set();

export const getLang = () => current;
export const getLocale = () => (current === 'de' ? 'de-DE' : 'en-US');
export const t = (key, params) => translate(current, key, params);

/** Registriert eine Funktion, die nach jedem Sprachwechsel die dynamischen Anzeigen neu zeichnet. */
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Füllt statische Texte: data-i18n (Text), data-i18n-attr="attr=schlüssel;attr2=schlüssel2". */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const text = t(el.dataset.i18n);
    if (el.textContent !== text) el.textContent = text;
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split('=').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

/** Setzt die Sprache sofort, ohne Neuladen. Speichern der Wahl ist optional (Fehler werden ignoriert). */
export function setLanguage(lang, { persist = true } = {}) {
  if (!LANGS.includes(lang)) return current;
  current = lang;
  document.documentElement.lang = lang;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', t('meta.description'));
  applyStatic();
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
  });
  if (persist) {
    try {
      localStorage.setItem(LANG_KEY, JSON.stringify(lang));
    } catch {
      /* Auswahl gilt dann nur bis zum Schließen */
    }
  }
  listeners.forEach((fn) => {
    try {
      fn(lang);
    } catch {
      /* eine fehlerhafte Anzeige darf andere nicht blockieren */
    }
  });
  return current;
}

/** Beim Start: gespeicherte Wahl lesen, sonst Browsersprache. Schreibt dabei nichts. */
export function initLanguage() {
  let stored = null;
  try {
    const raw = localStorage.getItem(LANG_KEY);
    stored = raw === null ? null : JSON.parse(raw);
  } catch {
    stored = null;
  }
  const langs = (typeof navigator !== 'undefined' && (navigator.languages?.length ? navigator.languages : [navigator.language])) || [];
  return setLanguage(detectLanguage(stored, langs), { persist: false });
}
