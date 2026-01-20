import jwt from 'jsonwebtoken';

export const generateToken = (data, expiresIn = '12h') => {
  const options = {
    expiresIn,
  };
  return jwt.sign(data, process.env.JWT_SECRET_KEY, options);
};

// export const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET_KEY);

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET_KEY)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED')
    }
    throw err
  }
}
