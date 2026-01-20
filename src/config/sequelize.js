import 'dotenv/config';

const {
  DB_HOST, DB_PORT = 5432, DB_NAME, DB_USER, DB_PASSWORD, DATABASE_URL
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

export const development = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  define: { paranoid: true },
  dialectOptions: {
    ssl: {
      require: true,       // obliga SSL
      rejectUnauthorized: false, // necesario en Render
    },
  },
   logging: false,
};

export const test = {
  ...defaultConfig,
  logging: false,
};

export const production = {
  ...defaultConfig,
  logging: false,
};
