import db from '@/database';
import { tokenHelper } from '@/helpers';

export default async function authenticate(req, res, next) {
  // Get authorization header from request
  const authorization = req.headers.authorization || '';
  const refreshToken = req.headers.refreshtoken || '';

  // Firstly, set request user to null
  req.user = null;

  // console.log(req.path)
  if(req.path == "/auth/login" || req.path == "/auth/register" || req.path == "/users/create-admin")return next();

  // Check for empty Authorization header
  if (!authorization) {
    return res.status(401).json({ data: "No tienes acceso!" });
  }

  // Make sure the token is bearer token
  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({ data: "Acceso denegado" });
  }

  // Extract token from header
  const token = authorization.substring(7);
  const tokenData = await tokenHelper.verifyToken(token)

  // Find user from database
  const user = await db.models.user.findByPk(tokenData.id).catch(() => null);

  // Check if user exists
  if (!user) {
    return res.status(401).json({ data: "Acceso denegado" });
  }

  // Set request user
  req.user = user;

  // Check if the token renewal time is coming
  const now = new Date();
  const exp = new Date(tokenData.exp * 1000);
  const difference = exp.getTime() - now.getTime();
  const minutes = Math.round(difference / 60000);

  // Check for refresh token and time left
  if (refreshToken && minutes < 15) {
    // Verify refresh token and get refresh token data
    const refreshTokenData = await tokenHelper.verifyToken(refreshToken);

    // Check the user of refresh token
    if (refreshTokenData.id === tokenData.id) {
      // Generate new tokens
      const newToken = user.generateToken();
      const newRefreshToken = user.generateToken('12h');

      // Set response headers
      res.setHeader('Token', newToken);
      res.setHeader('RefreshToken', newRefreshToken);
    }
  }

  // Go to next middleware
  return next();
}
