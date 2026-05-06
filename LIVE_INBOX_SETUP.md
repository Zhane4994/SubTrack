# Live Inbox Sync Setup (Gmail)

1. In Google Cloud Console, create OAuth 2.0 credentials (Web application).
2. Add this authorized redirect URI:
   - `http://localhost:8787/auth/google/callback`
3. In this folder, create `.env` from `.env.example` and fill:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET`
   - `FRONTEND_ORIGIN` (where your dashboard runs, e.g. `http://localhost:5500`)
4. Install backend dependencies:
   - `npm install`
5. Start backend:
   - `npm start`
6. Run your frontend as a local server (not `file://`), open `dashboard.html`, then:
   - Create/login to a SubTrack account
   - Click `Link Gmail`
   - Approve Google access
   - Click `Scan Live Inbox`
   - Confirm each detected subscription before adding

## Notes
- Inbox scanning uses Gmail read-only scope.
- Only receipts are parsed; final add still requires user confirmation in the modal.
- If backend is offline, the page falls back to pasted receipt text parsing.
