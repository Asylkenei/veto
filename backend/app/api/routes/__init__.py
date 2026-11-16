from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.places import router as places_router
from app.api.routes.rooms import router as rooms_router
from app.api.routes.support import router as support_router
from app.api.routes.users import router as users_router
from app.api.routes.votes import router as votes_router

ALL = [health_router, auth_router, users_router, rooms_router, votes_router,
       notifications_router, places_router, support_router]
