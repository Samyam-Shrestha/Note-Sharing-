import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.js";
import { signTokenPair, verifyAuth } from "./middleware/auth.js";
import { createUser, ensureUsersTable, ensureAdminUser, findUserByEmail, validatePassword, getAllUsers, verifyUser } from "./models/user.js";
import { createNote, deleteNote, ensureNotesTable, listAccessibleNotes, shareNote, updateNote } from "./models/note.js";
import { sendVerificationCode } from "./mailer.js";

const app = express();
app.use(express.json());
app.use(helmet()); // Security: adds secure default headers (CSP, X-Content-Type-Options, etc.).
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [process.env.FRONTEND_ORIGIN, "http://localhost:5173", "http://localhost:5174"];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  })
);
app.use(apiLimiter);
app.use("/auth", authLimiter);

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  if (!pwdRegex.test(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters, and include uppercase, lowercase, number, and special character." });
  }

  let user = await findUserByEmail(email);
  if (user) return res.status(400).json({ error: "Email already exists" });

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user = await createUser(email, password, "user", false, code);
    await sendVerificationCode(email, code);
    return res.status(201).json({ message: "User created. Verification code sent." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create user" });
  }
});

app.post("/auth/verify-email", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "email and code are required" });

  const ok = await verifyUser(email, code);
  if (!ok) return res.status(400).json({ error: "Invalid or expired verification code" });

  const user = await findUserByEmail(email);
  const tokens = signTokenPair({ sub: user.id, email: user.email, role: user.role });
  return res.json({ user: { id: user.id, email: user.email, role: user.role }, ...tokens });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  if (!user.is_verified) return res.status(403).json({ error: "Please verify your email first", unverified: true });

  const valid = await validatePassword(user, password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const tokens = signTokenPair({ sub: user.id, email: user.email, role: user.role });
  return res.json({ user: { id: user.id, email: user.email, role: user.role }, ...tokens });
});

// Admin-only middleware
const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

app.get("/admin/users", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/notes", verifyAuth, async (req, res) => {
  const notes = await listAccessibleNotes(req.user.sub);
  return res.json({ notes });
});

app.post("/notes", verifyAuth, async (req, res) => {
  const { title, content, tags } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title and content are required" });
  const note = await createNote({ ownerId: req.user.sub, title, content, tags: tags || [] });
  return res.status(201).json({ note });
});

app.patch("/notes/:id", verifyAuth, async (req, res) => {
  const note = await updateNote({
    id: Number(req.params.id),
    userId: req.user.sub,
    title: req.body.title,
    content: req.body.content,
    tags: req.body.tags,
    is_pinned: req.body.is_pinned,
    is_archived: req.body.is_archived,
    is_trashed: req.body.is_trashed
  });
  if (!note) return res.status(403).json({ error: "Not permitted" });
  return res.json({ note });
});

app.delete("/notes/:id", verifyAuth, async (req, res) => {
  const ok = await deleteNote({ id: Number(req.params.id), userId: req.user.sub });
  if (!ok) return res.status(403).json({ error: "Not permitted" });
  return res.status(204).send();
});

app.post("/notes/:id/share", verifyAuth, async (req, res) => {
  const { targetEmail, role } = req.body;
  if (!targetEmail || !["viewer", "editor"].includes(role)) {
    return res.status(400).json({ error: "targetEmail and role(viewer|editor) are required" });
  }

  const targetUser = await findUserByEmail(targetEmail);
  if (!targetUser) {
    return res.status(404).json({ error: "User with that email not found" });
  }
  
  if (targetUser.id === req.user.sub) {
    return res.status(400).json({ error: "Cannot share a note with yourself" });
  }

  const note = await shareNote({
    id: Number(req.params.id),
    userId: req.user.sub,
    targetUserId: targetUser.id,
    role
  });
  
  if (!note) return res.status(403).json({ error: "Not permitted or note not found" });
  return res.json({ note });
});

export default app;

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT || 4000);
  (async () => {
    await ensureUsersTable();
    await ensureAdminUser();
    await ensureNotesTable();
    app.listen(port, () => {
      // Security: do not print sensitive environment variables in logs.
      console.log(`Backend listening on ${port}`);
    });
  })().catch((error) => {
    console.error("Startup failed:", error.message);
    process.exit(1);
  });
}
