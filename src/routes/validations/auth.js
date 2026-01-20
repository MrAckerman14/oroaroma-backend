import { body } from 'express-validator';

export const loginRules = [
  body('email').isEmail().exists(),
  body('password').exists(),
];

export const registerRules = [
  body('name').exists(),
  body('email').isEmail().exists(),
  body('password').isLength({ min: 6 }).exists(),
  body('rol').exists()
];

export const updateProfileRules = [
  body('name').exists(),
  body('email').isEmail().exists(),
  body('password').isLength({ min: 6 }).exists(),
  body('rol').exists()
];

export const changePasswordRules = [
  body('current').exists(),
  body('password').isLength({ min: 6 }).exists(),
];
