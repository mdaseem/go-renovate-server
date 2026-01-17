import jwt from "jsonwebtoken";

export function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  

  if (!token) {
    return res.status(401).json({ error: "No token provided" }); 
  }

  try {
    const decoded = jwt.verify(token, "any_random_string_generated_once");
    req.user = decoded; // { userId, email }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
