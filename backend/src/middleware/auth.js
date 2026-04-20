import jwt from "jsonwebtoken";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

function getKeys() {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;
  if (!privateKey || !publicKey) {
    throw new Error("JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be configured");
  }
  return { privateKey, publicKey };
}

export function signTokenPair(payload) {
  const { privateKey } = getKeys();
  // Security: RS256 asymmetric signing avoids sharing signing secret with verifiers.
  const accessToken = jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: REFRESH_TTL });
  return { accessToken, refreshToken };
}

export function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const { publicKey } = getKeys();
    req.user = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
