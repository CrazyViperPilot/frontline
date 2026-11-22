# Entwurf: Abschnitt „Spielstatistik und Feedback“ für die Datenschutzerklärung

Entwurf für Daniel zum Prüfen, keine Rechtsberatung. Einzufügen in die bestehende Datenschutzerklärung der Seite.
Platzhalter in eckigen Klammern selbst füllen. Regeln dazu: [docs/prd/statistik.md](prd/statistik.md).

---

## Spielstatistik und Feedback im Spiel „Frontline“

Damit wir verstehen, wie Frontline gespielt wird, und Fehler finden, erfassen wir eine Nutzungsstatistik. Wir setzen dafür
keine Dienste Dritter ein und laden keine fremden Skripte. Alle Daten liegen auf unserem Server bei [Hoster, Standort Deutschland].

### Ohne Einwilligung (Reichweitenmessung ohne Zugriff auf Ihr Gerät)

Beim Aufruf und während des Spiels sendet Frontline folgende Angaben an unseren Server:

- Aufruf von Spiel oder Karteneditor, Öffnen des Startmenüs und der Hilfe,
- Start und Ende einer Partie mit Spielmodus, Zahl und Schwierigkeit der Computergegner, Karte, gewählten Spieloptionen,
  Ausgang (Sieg, Niederlage, abgebrochen, Fenster geschlossen), Spieldauer und Spielminute,
- während einer Partie einmal je Minute ein Lebenszeichen, solange das Spiel sichtbar ist und nicht pausiert,
- Fehlermeldungen des Spiels (Meldungstext, Programmdatei, Zeile, Spielversion).

Aus der IP-Adresse und der Browserkennung (User-Agent) bilden wir auf dem Server eine Prüfsumme mit einem geheimen Schlüssel, der
jeden Tag neu erzeugt und der alte gelöscht wird. Gespeichert wird nur diese Prüfsumme, nie die IP-Adresse. So können wir
Besucher eines Tages zählen, sie aber an einem anderen Tag nicht wiedererkennen. Aus der Browserkennung leiten wir zusätzlich
grob die Geräteart (Handy, Tablet, Computer) und die Browserfamilie ab. Abrufe durch Suchmaschinen und Programme filtern wir heraus.

Auf Ihrem Gerät wird dafür nichts gespeichert oder ausgelesen, es gibt keine Cookies. Wenn Sie die Frage nach der Spielstatistik
beantworten, merkt sich Ihr Browser nur diese Antwort, damit die Frage nicht erneut erscheint.

Rechtsgrundlage ist unser berechtigtes Interesse an einem fehlerfreien und verbesserten Spiel (Art. 6 Abs. 1 lit. f DSGVO).

### Mit Einwilligung (Spieler-ID)

Im Startmenü fragen wir „Anonyme Spielstatistik teilen?“. Wenn Sie zustimmen, speichert Ihr Browser eine zufällige Spieler-ID
(local Storage) und schickt sie mit den oben genannten Angaben. Damit sehen wir, ob Spieler wiederkommen, wie viele Partien sie
spielen und wie lange sie insgesamt spielen. Ohne Netz hält Ihr Browser bis zu 200 Ereignisse zurück und sendet sie später.

Sind Sie mit einem Benutzerkonto angemeldet, speichern wir die Spieler-ID an Ihrem Konto, damit auf all Ihren Geräten dieselbe ID
gilt. Die Statistik lässt sich dann Ihrem Konto zuordnen (pseudonym); wir werten sie nur gesammelt aus.

Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Sie können sie jederzeit im Startmenü
unter „Spielstatistik teilen“ widerrufen. Dann löschen wir alle Daten zu Ihrer Spieler-ID, und Ihr Browser löscht die ID.
Die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt. Löschen Sie Ihr Konto, löschen wir die Statistik dazu.

### Feedback

Über „Feedback geben“ im Pausenmenü und nach einer Partie können Sie uns eine Nachricht (bis 1000 Zeichen) und eine Bewertung
schicken. Dazu speichern wir Spielversion, Dauer und Modus der Partie, grob Geräteart und Browser sowie, falls Sie eingewilligt
haben, Ihre Spieler-ID. Bitte schreiben Sie keine persönlichen Angaben in den Text. Rechtsgrundlage ist unser berechtigtes Interesse
an Rückmeldungen zum Spiel (Art. 6 Abs. 1 lit. f DSGVO). Wir löschen Rückmeldungen, sobald sie erledigt sind, spätestens nach
[Frist, z. B. 12 Monaten].

### Speicherdauer

Einzelne Ereignisse löschen wir nach 90 Tagen; danach behalten wir nur Tagessummen ohne Personenbezug (z. B. Zahl der Aufrufe und
Partien eines Tages). Gruppierte Fehlermeldungen löschen wir 90 Tage nach ihrem letzten Auftreten. Die Spieler-ID und die Tage, an
denen sie aktiv war, speichern wir bis zu Ihrem Widerruf.

### Empfänger

Die Daten sieht nur der Betreiber im geschützten Verwaltungsbereich. Eine Weitergabe an Dritte findet nicht statt, abgesehen von
unserem Hoster als Auftragsverarbeiter [Name des Hosters].

### Ihre Rechte

Es gelten die oben in dieser Datenschutzerklärung genannten Rechte (Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch,
Beschwerde bei einer Aufsichtsbehörde). Gegen die Verarbeitung ohne Einwilligung können Sie jederzeit widersprechen, z. B. per
Mail an [Kontaktadresse]. Ohne Spieler-ID können wir Ihnen gespeicherte Daten allerdings nicht zuordnen.
