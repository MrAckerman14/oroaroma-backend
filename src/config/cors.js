export default {
  origin:[
      process.env.CORS_ALLOWED_ORIGIN,
      'http://localhost:9000',
      'http://192.168.1.6:9000',
      'http://192.168.1.3:9000'
  ],
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'RefreshToken'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'RefreshToken', 'Token'],
};
