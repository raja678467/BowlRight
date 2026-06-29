# 🎳 BowlRight Professional Project Documentation

## 📝 Project Identity
- **Name:** BowlRight
- **Core Purpose:** A high-performance, secure mobile application for account management, featuring state-of-the-art biometric authentication and real-time administrative control.
- **Created:** May 2026
- **Primary Goal:** To transition a mobile prototype into a production-ready system with enterprise-grade security and premium aesthetics.

---

## 🛠️ Technology Stack

### Frontend (Mobile App)
- **Framework:** Expo 55 (React Native 0.83)
- **Routing:** Expo Router (File-based navigation)
- **Styling:** NativeWind (Tailwind CSS) & Vanilla StyleSheet
- **Visuals:** Glassmorphism, Floating Pill Navigation, Linear Gradients, Haptics, Blur Effects
- **Security:** Hardware-backed `expo-secure-store` & `expo-local-authentication`
- **Real-time:** Native WebSocket implementation with exponential backoff and heartbeat logic.

### Backend (API & Logic)
- **Framework:** FastAPI (Python)
- **Real-time:** WebSockets (using secure Subprotocol handshakes)
- **Database:** SQLite with SQLAlchemy ORM
- **Authentication:** JWT (JSON Web Tokens) with PBKDF2 password hashing.
- **Biometric Security:** Dual-secret hashed linkage (Server stores hash, Client stores raw secret in Secure Enclave).

---

## ✨ Key Features & Architecture

### 🔐 Advanced Security Model
- **Hardened Biometrics:** 
  - **Single-Prompt UX:** Unified trigger through `SecureStore` (configured with `requireAuthentication: true`).
  - **Concurrency Guard:** Mutex-style lock preventing "Authentication in progress" crashes.
  - **Security Linkage:** Password changes or account resets automatically invalidate biometric secrets.
  - **Secret Entropy:** Dual-UUID high-entropy secrets, only the hash is stored server-side.
- **Session Integrity:** 
  - **Remote Termination:** Real-time logout signal sent via WebSockets.
  - **Subprotocol Protection:** Tokens are hidden in subprotocols to prevent leakage in server access logs.

### 👥 User & Profile Management
- **Full Profile Lifecycle:** Name updates, secure profile picture uploads (Local disk storage with static serving).
- **Session verification:** Background re-validation of JWT tokens on app resume.
- **Password Recovery:** `/forgot-password` and `/reset-password` endpoints with 15-minute expiring tokens.

### 🛡️ Administrative Control
- **Admin Dashboard:** Built-in HTML-based user management interface.
- **Audit Logging:** Systematic tracking of administrative actions (creation, role changes, deletions).
- **Remote Sync:** "SYNC" signals sent via WebSocket to force clients to refresh their local user data.

---

## 🏗️ Database Schema

### `users` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String (PK) | Unique User UUID |
| `email` | String | Indexed & Unique email address |
| `full_name` | String | Display name |
| `profile_image`| String | URL path to local storage |
| `hashed_password`| String | PBKDF2 hash |
| `biometric_secret`| String | PBKDF2 hash of the device secret |
| `is_admin` | Boolean | Role flag |
| `created_at` | DateTime | UTC Timestamp |

### `audit_logs` Table
- Tracks `action`, `performed_by` (FK to user), `target_id`, and `details`.

---

## 📡 API Endpoints

### Authentication & Biometrics
- `POST /signup`: Create account & return JWT.
- `POST /login`: Standard password login.
- `POST /biometrics/enable`: Generates and links a new biometric secret.
- `POST /biometrics/login`: Fast login using the SecureStore secret.
- `POST /forgot-password`: Issues a reset token (mock email).
- `POST /reset-password`: Consumes token and updates credentials.

### Account & Profiles
- `GET /me`: Returns current user data.
- `PATCH /me`: Update name or profile image URL.
- `POST /upload-profile-image`: Multi-part file upload for avatars.

---

## ✅ Recent Accomplishments (Session: May 13)
- **Premium UI:** Implemented the "Floating Pill" Glassmorphic bottom navigation with active glowing states.
- **Precision Styling:** Resolved all vertical centering issues for navigation icons.
- **Auth Hardening:** Fixed biometric race conditions and "Authentication in progress" errors.
- **UX Polish:** Force-disabled OS-level biometric prompts on signup page via `textContentType` suppression.
- **Documentation:** Created this comprehensive project overview for maintenance and onboarding.

---

## 🗺️ Roadmap
- [ ] **Email Integration:** Connect a production mailer (Resend/SendGrid) for forgot-password links.
- [ ] **Social Auth:** Implement Google and Apple OAuth providers.
- [ ] **Backend Modularization:** Split `main.py` into smaller, task-specific routers.
- [ ] **Home Analytics:** Add an activity feed and real-time dashboard stats to the main screen.

---
*Last Updated: 2026-05-13*
