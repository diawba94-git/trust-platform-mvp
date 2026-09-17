from typing import Dict, List, Any
import asyncio


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket):
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket):
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(websocket)
            except ValueError:
                pass

    async def send_to_user(self, user_id: int, message: Dict[str, Any]):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


class EventBus:
    def __init__(self):
        self.manager = ConnectionManager()

    async def connect(self, user_id: int, websocket):
        await self.manager.connect(user_id, websocket)

    def disconnect(self, user_id: int, websocket):
        self.manager.disconnect(user_id, websocket)

    async def send_to_user(self, user_id: int, message: Dict[str, Any]):
        await self.manager.send_to_user(user_id, message)
