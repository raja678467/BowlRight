# 🎳 BowlRight

BowlRight is a secure, high-performance mobile application for account management, featuring state-of-the-art biometric authentication and real-time administrative control.

This repository contains both the **React Native / Expo mobile app** (in the root directory) and the **Python FastAPI backend server** (in the `backend/` directory).

---

## 🛠️ Technology Stack

### Frontend (Mobile App)
- **Framework:** Expo 55 (React Native 0.83)
- **Routing:** Expo Router (File-based navigation)
- **Styling:** NativeWind (Tailwind CSS) & Vanilla StyleSheet
- **Security:** Hardware-backed `expo-secure-store` & `expo-local-authentication`
- **Real-time:** Native WebSocket client with auto-reconnection and heartbeat logic

### Backend (API & Relational DB)
- **Framework:** FastAPI (Python 3.10+)
- **Database:** SQLite with SQLAlchemy ORM
- **Authentication:** JWT (JSON Web Tokens) & PBKDF2 password hashing
- **Biometric Security:** Dual-secret hashed linkage (Server stores PBKDF2 hash of client secret)
- **Real-time:** WebSockets with secure token validation hidden in WebSocket Subprotocols

---

## 🔐 Core Security & Architecture

### 1. Hardened Biometrics
- **Hardware Bind:** Utilizes iOS Secure Enclave / Android Keystore to protect key credentials.
- **Unified Prompt:** Uses a unified trigger via `SecureStore` (with `requireAuthentication: true`) to avoid multiple consecutive OS biometric popups.
- **Dual-Secret Hash:** During enrollment, a high-entropy secret is generated. Only the PBKDF2 hash of this secret is sent to the server. The raw secret remains inside the client enclave.
- **Security Linkage:** Resetting passwords or altering critical user data automatically invalidates the biometric secrets both locally and on the server.

### 2. Session Integrity & Remote Sync
- **WebSocket Connection:** The client maintains a background-safe WebSocket connection to the backend.
- **Remote Termination:** Admins can instantly terminate user sessions via the Admin Dashboard. The server broadcasts a `LOGOUT` command over WebSockets, prompting the client to wipe local auth stores immediately.
- **Real-time Syncing:** If user roles or details change, a `SYNC` broadcast triggers the mobile client to silently re-fetch user data.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Expo Go app or an emulator (Android Studio / Xcode)

---

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` folder (it is ignored by Git):
   ```env
   SECRET_KEY=your_super_secret_jwt_key
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   DATABASE_URL=sqlite:///./users.db
   ```
5. Run the server:
   ```bash
   python main.py
   ```
   The backend will start on `http://localhost:8000`. You can access the auto-generated documentation at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

1. Install Node modules from the root directory:
   ```bash
   npm install
   ```
2. Create a `.env` file in the root directory (it is ignored by Git):
   ```env
   # Replace with your computer's actual local IPv4 address (e.g. found via `ipconfig` or `ifconfig`)
   # 'localhost' will NOT work on physical mobile devices.
   EXPO_PUBLIC_API_URL=http://192.168.0.108:8000
   ```
3. Run the Expo development client:
   ```bash
   npx expo start --dev-client
   ```
4. Press **`a`** for Android Emulator, **`i`** for iOS Simulator, or scan the QR code to run on a physical device.

---

## 📂 Project Structure

```text
├── backend/                  # FastAPI Backend Server
│   ├── uploads/              # Uploaded user profile images
│   ├── admin.py              # Admin control panel endpoints
│   ├── auth.py               # Password hashing & JWT logic
│   ├── database.py           # SQLite connection & sessionmaker
│   ├── main.py               # Main application routing
│   ├── models.py             # SQLAlchemy models (UserDB, AuditLog)
│   ├── schemas.py            # Pydantic validation schemas
│   └── utils.py              # WebSocket connection manager
│
├── src/                      # Mobile Application source
│   ├── app/                  # Expo Router navigation screens
│   │   ├── (app)/            # Authenticated App Screens (Home, Profile, Admin)
│   │   ├── login.tsx         # Passcode/Password authentication screen
│   │   └── signup.tsx        # Account registration screen
│   ├── components/           # Reusable UI components
│   ├── context/              # Authentication & WebSocket context providers
│   └── config.ts             # API base URL configuration mapping
```
