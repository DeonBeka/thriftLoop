# ThriftLoop

ThriftLoop is an iOS-first marketplace app for buying and selling second-hand clothing. It is built with React Native (Expo, TypeScript, Expo Router) on the front end and FastAPI, SQLAlchemy and SQLite on the back end.

People sign up with a Gmail address and confirm it with a 6-digit code. After that they can browse, search and filter listings, save favorites, list items with several photos, message sellers and edit their profile.

```
ThriftLoop/
├── frontend/          Expo app (iOS)
│   └── src/
│       ├── app/          Screens (Expo Router: (auth), (tabs), product, user, messages, profile)
│       ├── components/   Reusable UI (ui/, product/, sell/, explore/, auth/, profile/)
│       ├── constants/    Theme colors and catalog (categories, sizes, conditions)
│       ├── hooks/        useAuth, useFavorites, useApi, useUnreadCount
│       ├── services/     API layer (api.ts), API URL config, secure token storage
│       ├── types/        Shared TypeScript types
│       └── utils/        Formatting helpers
└── backend/           FastAPI REST API
    ├── app/
    │   ├── core/         Settings (.env), security (bcrypt, JWT, OTP hashing), auth dependencies
    │   ├── models/       SQLAlchemy models: User, Product, ProductImage, Favorite, Conversation, Message
    │   ├── schemas/      Pydantic request and response models
    │   ├── routers/      auth, users, products, favorites, conversations
    │   ├── services/     Gmail SMTP, image storage and resizing, serializers
    │   ├── database.py   Engine and session (SQLite, foreign keys on)
    │   ├── main.py       App, CORS, /uploads static files
    │   └── seed.py       Demo data
    ├── tests/            API tests (pytest)
    ├── uploads/          Uploaded photos (created at runtime, not committed)
    ├── requirements.txt
    └── .env.example
```

## 1. Run the backend

Requires Python 3.11 or newer.

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env
python -m app.seed --reset        # demo users and listings
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API docs are at http://localhost:8000/docs.

**Demo account (from the seed data):** `maya.vintage@gmail.com` / `thriftloop123`. Three more sellers, `leo.threads@gmail.com`, `sofia.loops@gmail.com` and `noah.archive@gmail.com`, use the same password.

### Email verification (off by default)

Out of the box, `REQUIRE_EMAIL_VERIFICATION=false`: new accounts are signed in straight after registering and no code is sent. To turn the 6-digit code back on, set `REQUIRE_EMAIL_VERIFICATION=true` in `backend/.env` and set up Gmail as below (or use `EMAIL_DEV_MODE=true` to read codes from the backend terminal).

#### Gmail verification emails

1. Turn on 2-Step Verification on the Gmail account the app sends from. This is your own developer account, not the users' accounts.
2. Create an App Password at https://myaccount.google.com/apppasswords.
3. Put the account and the password in `backend/.env`:
   ```
   SMTP_USERNAME=your.app.account@gmail.com
   SMTP_PASSWORD=abcd efgh ijkl mnop
   EMAIL_DEV_MODE=false
   ```
4. Restart the backend.

Until SMTP is configured (or while `EMAIL_DEV_MODE=true`), the code is **printed in the backend terminal** instead of being emailed, so you can still demo sign-up. The code is never sent to the app.

How verification works:
- Codes are random, 6 digits long and valid for 5 minutes.
- Only an HMAC-SHA256 hash of the code is stored, and a code can be used once.
- Resending is allowed again after 60 seconds.
- After 5 wrong attempts the code stops working and a new one is needed.
- Unverified accounts can't sign in or call any protected endpoint.

## 2. Run the iOS app

Requires Node 20 or newer. Use either the **Expo Go** app on an iPhone or the iOS Simulator (macOS only).

```powershell
cd frontend
npm install
npx expo start
```

- **iPhone with Expo Go:** scan the QR code. The phone and the computer must be on the same Wi-Fi. The app works out the backend address from the Metro host automatically. If it can't reach the server, create `frontend/.env` with `EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8000`. On Windows, also allow port 8000 through the firewall.
- **iOS Simulator:** press `i`. It uses `http://localhost:8000`.

Checks:

```powershell
cd frontend
npx tsc --noEmit
cd ..\backend
.\.venv\Scripts\python -m pytest -q
```

## Features

| Area | What works |
| --- | --- |
| Auth | Register (username, Gmail, password, confirm), 6-digit OTP screen with autofill, resend countdown, wrong-code shake, JWT stored in the iOS Keychain (SecureStore), auto sign-out when the token expires, logout |
| Home | Greeting, search, category pills, a "Featured" carousel (most saved), "Recently added", "Picked for you" (ranked by the categories you save), pull to refresh, unread-message badge |
| Explore | Debounced search, category chips, a filter sheet (sort: newest / price ↑ / price ↓ / most saved; price presets or a min–max range; condition; size), removable filter chips, pagination when you scroll |
| Product | Swipeable photo gallery, details, seller card with a link to their profile, animated favorite button, "Message seller". Owners get Edit, Mark sold / Mark available and Delete (with confirmation) |
| Sell | Up to 8 photos from the library or camera (reorder the cover with a long press), validation, a preview modal, publish. Editing uses the same form |
| Favorites | Saved on the server and kept in sync across screens. Sold items get a badge, and deleted listings drop out automatically (cascade delete) |
| Messages | Inbox with unread counts and the listing each chat is about. Chat with grouped bubbles, sending that shows the message right away with retry if it fails, and polling every 4 seconds while open |
| Profile | Avatar, bio, join date, counts for active / sold / saved, Listings and Sold tabs, profile editing (photo, username, bio). Other sellers' profiles are public |

## API

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | Creates an unverified user and emails the OTP |
| POST | `/auth/verify-email` | `{email, code}` → JWT and user |
| POST | `/auth/resend-code` | 60-second cooldown (HTTP 429 with `Retry-After`) |
| POST | `/auth/login` | Verified accounts only (HTTP 403 otherwise) |
| GET | `/auth/me` | |
| GET | `/products` | `q, category, size, condition, min_price, max_price, sort, seller_id, status, exclude_own, limit, offset` |
| GET | `/products/{id}` | |
| POST | `/products` | multipart: fields + `images[]` |
| PUT | `/products/{id}` | multipart: any fields, `status`, `keep_image_ids`, new `images[]` |
| DELETE | `/products/{id}` | Owner only. Removes image files |
| GET / POST / DELETE | `/favorites`, `/favorites/{product_id}` | |
| GET | `/users/{id}`, `/users/{id}/products` | |
| PUT | `/users/me` | multipart: `username, bio, profile_image, remove_profile_image` |
| GET / POST | `/conversations` | POST `{product_id, message?}` returns the existing chat if there is one |
| GET | `/conversations/{id}` | |
| GET / POST | `/conversations/{id}/messages` | GET marks incoming messages as read. `after_id` is used for polling |

Images are resized to at most 1600 px, saved as JPEG under `backend/uploads/` and served at `/uploads/...`. The database stores only the relative path.
