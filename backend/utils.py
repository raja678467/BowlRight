import subprocess
from fastapi import WebSocket

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        # Use a list of websockets per user_id to support multiple devices
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        # We assume the connection is already accepted by the endpoint
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        print(f"[WS] Device registered for user: {user_id} (Total: {len(self.active_connections[user_id])})")

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                print(f"[WS] Device disconnected for user: {user_id}")
            
            # Clean up empty lists
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_logout_signal(self, user_id: str):
        if user_id in self.active_connections:
            print(f"[WS] Sending LOGOUT signal to {len(self.active_connections[user_id])} devices for user: {user_id}")
            # Iterate over a copy to avoid issues if a socket closes during iteration
            for websocket in list(self.active_connections[user_id]):
                try:
                    await websocket.send_text("LOGOUT")
                except Exception as e:
                    print(f"[WS] Failed to send logout to a device: {e}")

    async def send_sync_signal(self, user_id: str):
        if user_id in self.active_connections:
            print(f"[WS] Sending SYNC signal to {len(self.active_connections[user_id])} devices for user: {user_id}")
            for websocket in list(self.active_connections[user_id]):
                try:
                    await websocket.send_text("SYNC")
                except Exception as e:
                    print(f"[WS] Failed to send sync to a device: {e}")

manager = ConnectionManager()

def update_readable_dump():
    """Exports the binary SQLite database to a human-readable .sql text file."""
    try:
        with open("database_dump.sql", "w", encoding="utf-8") as f:
            subprocess.run(["sqlite3", "users.db", ".dump"], stdout=f, check=True)
    except Exception as e:
        print(f"Error creating readable dump: {e}")
