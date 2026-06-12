# securePDF — GAS Office→PDF Web App

The Office→PDF conversion backend (Google Apps Script). `Code.gs` is the script;
`appsscript.json` is the manifest (Drive advanced service + Web App settings).

**Full setup, wiring, security and limits:** see
[`docs/office-conversion.md`](../../docs/office-conversion.md).

Quick version:

1. Sign in to the dedicated conversion Google account, not a personal main
   account. Paste `Code.gs` into a project at <https://script.google.com>, apply
   `appsscript.json`.
2. Script property `SHARED_SECRET` = a random string; enable the **Drive** advanced
   service.
3. Deploy as **Web app** (Execute as: Me, Access: Anyone) → copy the `/exec` URL.
   "Me" must be the dedicated conversion account.
4. `wrangler secret put GAS_CONVERT_URL` (the URL) and `GAS_TOKEN` (the secret).
