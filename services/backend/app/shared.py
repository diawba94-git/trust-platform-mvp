from .event_bus import EventBus

# Instance unique de l'event bus, partagée entre main.py (endpoint /ws) et tous les routers
# qui doivent notifier un utilisateur connecté — sinon chaque module aurait sa propre liste
# de connexions WebSocket, vide, et les notifications ne partiraient jamais.
event_bus = EventBus()
