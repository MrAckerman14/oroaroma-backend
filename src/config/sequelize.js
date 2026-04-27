require('dotenv').config();

const {
  DB_HOST,
  DB_PORT = 5432,
  DB_NAME,
  DB_USER,
  DB_PASSWORD
} = process.env;

const defaultConfig = {
  dialect: 'postgres',
  timezone: '+03:00',
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  host: DB_HOST,
  port: Number(DB_PORT),
  define: {
    paranoid: true,
  },
};

module.exports = {
  development: {
    ...defaultConfig,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  },

  test: {
    ...defaultConfig,
    logging: false,
  },

  production: {
    ...defaultConfig,
    logging: false,
  },
};