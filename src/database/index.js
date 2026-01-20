import { Sequelize } from 'sequelize';

import * as config from '@/config/sequelize';

// import models
import userModel from './models/user';
import tweetModel from './models/tweet';
import store from './models/store';
import sale from './models/sale';
import sale_detail from './models/sale_detail';
import closure from './models/closure';
import closureDetail from './models/closureDetail';
import inventoryReport from './models/inventoryReport';
import inventoryReportDetail from './models/inventoryReportDetail';

// Configuration
const env = process.env.NODE_ENV || 'development';
// const sequelizeConfig = config[env];

// Create sequelize instance
// const sequelize = new Sequelize(sequelizeConfig);

const currentConfig = config[env];

// Si la configuración usa DATABASE_URL:
const sequelize = currentConfig.use_env_variable
  ? new Sequelize(process.env[currentConfig.use_env_variable], currentConfig)
  : new Sequelize(currentConfig);

// Import all model files
const modelDefiners = [
  userModel,
  tweetModel,
  store,
  sale,
  sale_detail,
  closure,
  closureDetail,
  inventoryReport,
  inventoryReportDetail
];

// eslint-disable-next-line no-restricted-syntax
for (const modelDefiner of modelDefiners) {
  modelDefiner(sequelize);
}

// Associations
Object.keys(sequelize.models)
  .forEach((modelName) => {
    if (sequelize.models[modelName].associate) {
      sequelize.models[modelName].associate(sequelize.models);
    }
  });

// export default sequelize;

export default {
  sequelize,
  models: sequelize.models
}