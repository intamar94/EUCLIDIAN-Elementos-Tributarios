# Datenschutzerklärung — ENTWURF, NICHT VERÖFFENTLICHEN
**Website:** {{PROJEKT_NAME}} / {{DOMAIN}} · Stand {{DATUM}}
Dieser Entwurf ist ein **Arbeitsdokument** und muss anhand realer Datenflüsse und Anbieterunterlagen fertiggestellt werden. Bis zur Freigabe nicht als gültige Datenschutzerklärung ausgeben.

## 1. Verantwortliche Stelle
{{VOLLSTAENDIGER_RECHTLICHER_NAME}}, handelnd unter der Geschäftsbezeichnung Faro de Intamar.
{{LADUNGSFAEHIGE_ADRESSE}}, Deutschland.
E-Mail für Datenschutzanfragen: {{DATENSCHUTZ_KONTAKT_EMAIL}}.
Datenschutzbeauftragte/r: {{NUR_WENN_BESTELLT_ODER_GESETZLICH_NOETIG}}.

## 2. Bereitstellung der Website / Hosting
Der Webauftritt wird über **Vercel** bereitgestellt. Bei Aufruf können IP-Adresse, Datum/Uhrzeit, Seitenabrufe, technische Verbindungsdaten, Fehlermeldungen und Security-Logs verarbeitet werden. Zwecke: technische Bereitstellung, Sicherheit, Fehlersuche.
Rechtsgrundlage ist nach Prüfung regelmäßig Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) oder Art. 6 Abs. 1 lit. b, soweit vertraglich erforderlich.
**Noch prüfen:** Vertragspartei, tatsächliche Standorte/Subdienstleister, DPA/AVV, Löschfristen, Interessenabwägung und etwaige Drittlandtransfers.

## 3. Nutzerkonto / Anmeldung / Abonnements (EUCLIDIAN)
Anmeldung und Nutzerverwaltung laufen über **Supabase Auth**; relevante Daten: E-Mail-Adresse, Authentifizierungsdaten und technische Kontometadaten. Zur Durchsetzung der Zugriffsrechte können Nutzer-ID, Planzugang und Nutzungskontingent in Supabase verarbeitet werden.
Zwecke: Kontoerstellung, Authentifizierung, Bereitstellung des gebuchten Dienstes, Missbrauchsschutz und Support; Rechtsgrundlage je nach Vorgang Art. 6 Abs. 1 lit. b/f DSGVO.
**Noch prüfen:** konkrete Tabellen, Aufbewahrungsfristen, Löschkonzept, alle Datenflüsse und Auth-E-Mails. Das Supabase-Projekt liegt in **sa-east-1 (Brasilien)**. Datenschutzrechtliche Drittlandbedingungen, Subdienstleister, vertragliche Garantien und etwaige Angemessenheitsbeschlüsse sind **nicht bestätigt**.

## 4. Browser-Speicher und Zugangstokens
EUCLIDIAN verwendet aktuell `localStorage` für Access-/Refresh-Tokens und persönliche Themeneinstellungen sowie `sessionStorage` für einen internen Zugangsmodus. Notwendigkeit nach § 25 Abs. 2 TDDDG im Einzelfall prüfen; auch bei technisch notwendigen Funktionen muss die Datenverarbeitung nach DSGVO erklärt werden. Einwilligungspflichtige Zusatzdienste erst nach Einwilligung aktivieren.
**Sicherheitsprüfung:** Token-Aufbewahrung/Content-Security-Policy, XSS-Schutz und Löschung beim Logout.

## 5. Externe Schriftarten
Die Weboberfläche lädt aktuell **Google Fonts** direkt von `fonts.googleapis.com` und `fonts.gstatic.com`. Dabei können Verbindungsdaten an Dritte übertragen werden.
**Empfehlung:** Selbst hosten bzw. Systemschriften einsetzen, bevor die Erklärung veröffentlicht wird. Anbieter, Rechtsgrundlage, mögliche Einwilligung und Drittlandtransfer sonst gesondert prüfen.

## 6. Externe Links und Quellen
Fachliche Dokumente können zu offiziellen DIAN-Websites führen. Beim freiwilligen Verlassen des Angebots gelten die Datenschutzregeln der Zielseite. Prüfen, ob vor Klick Daten an Dritte gehen.

## 7. Zahlungen und kostenpflichtige Abos
Zum Zeitpunkt dieses Entwurfs ist die Online-Bezahlung **nicht live**. Die Oberfläche enthält technisch vorbereitete Stripe-Weiterleitungen. **Vor Aktivierung** ergänzen: konkreter Zahlungsanbieter/Vertragspartner, Datenkategorien, Zwecke, Rechtsgrundlagen, Übermittlungen, Speicherdauer, Aufbewahrungspflichten und Widerruf/Kündigung.

## 8. Kontakt, Betroffenenrechte und Aufbewahrung
Bei Kontakt per E-Mail werden mitgeteilte Daten zur Bearbeitung der Anfrage verarbeitet. {{KONTAKT_AUFBEWAHRUNGSFRIST_UND_RECHTSGRUNDLAGE}}
Betroffene haben je nach Voraussetzungen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Widerruf erteilter Einwilligungen. Zudem besteht ein Beschwerderecht bei einer zuständigen Datenschutzaufsichtsbehörde ({{BEHOERDE_PRUEFEN}}).
Für jede Datenkategorie konkrete Löschfristen oder Entscheidungskriterien festlegen. Sicherheitsvorfälle und Auftragsverarbeitung dokumentieren.

## 9. Weitere Dienste
{{ANALYTICS_NEWSLETTER_COOKIES_CAPTCHA_KI_FOTOS_NUR_NACH_TATSAECHLICHER_PRUEFUNG}}

**Freigabe erst nach:** tatsächlicher Inventur, AVV/DPA-Prüfung, IP-/Log-Löschfristen, juristischer Prüfung der Datenflüsse nach Brasilien und in weitere Drittländer, Entscheidung Google Fonts, E-Mail-Adresse und Kontakt.

Rechtsgrundlagen: https://eur-lex.europa.eu/eli/reg/2016/679/oj und https://www.gesetze-im-internet.de/ttdsg/__25.html
