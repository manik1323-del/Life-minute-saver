/// <reference types="vite/client" />
import { User } from "../types";

/**
 * DEMO_MODE flag — driven by the DEMO_MODE environment variable.
 * When true, the application skips authentication entirely and uses
 * DEMO_USER as the authenticated user.
 *
 * To disable demo mode:
 *   Set DEMO_MODE=false in your .env file and restart the dev server.
 *
 * NOTE: The real authentication system (login, signup, JWT, refresh tokens,
 * middleware, protected routes) remains completely intact and is used
 * whenever DEMO_MODE is false.
 */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === "true";

/**
 * Fixed demo user ID — must match the seed created on the server side
 * via GET /api/demo/init so that all API calls return real data.
 */
export const DEMO_USER_ID = "demo-user-001";

/**
 * Realistic demo user object.
 * All fields satisfy the User type required by the application.
 */
export const DEMO_USER: User = {
  id: DEMO_USER_ID,
  email: "demo@example.com",
  name: "Demo User",
  productivityScore: 87,
  theme: "dark",
  workHoursStart: "09:00",
  workHoursEnd: "18:00",
  focusPeriod: 25,
  streakCount: 14,
  role: "user",
  googleCalendarLinked: false,
  organizationIds: ["org-demo-001"],
  teamIds: ["team-demo-001"],
  projectIds: ["proj-demo-001"],
  skills: ["Planning", "Focus", "Time Management"],
  currentWorkload: 72,
  active: true,
};

/**
 * A synthetic demo token stored in localStorage so that all API
 * calls that read `last_minute_token` pick it up automatically.
 * The server validates this token when processing demo API requests.
 */
export const DEMO_TOKEN = "demo-token-last-minute-life-saver";
