# SGMI-KK LENDMART

A simple, clean, mobile-first finance management app for small daily finance businesses.

## Features

- Admin registration, login, forgot password, protected routes, logout
- Borrower add/edit/delete/search/filter/profile
- Auto loan calculations for interest, expected return, EMI, and end date
- Realtime Firestore dashboard cards
- Payment collection with partial/full payments and history
- Due/active/completed/overdue borrower statuses
- WhatsApp receipt/reminder message generation
- Printable borrower and summary reports with PDF download
- Admin profile section

## Firebase Setup

Create a Firebase project and enable:

- Authentication with Email/Password
- Firestore Database
- Storage if you later store generated reports

Copy `.env.example` to `.env` and fill in your Firebase web app values:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Firestore Collections

The app uses these collections:

- `users`
- `borrowers`
- `payments`
- `loans`

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- OTP screen includes validation and flow routing. For real SMS OTP delivery, connect Firebase Phone Authentication with a configured reCAPTCHA verifier.
- Delete actions use confirmation dialogs.
- Reports use browser print plus `html2canvas` and `jsPDF` for downloads.
