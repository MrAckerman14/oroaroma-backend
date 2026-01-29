import authRouter from '@/routes/auth';
import indexRouter from '@/routes/index';
// import tweetRouter from '@/routes/tweet';
import users from '@/routes/user';
import store from '@/routes/store';
import sale from '@/routes/sale';
import report from '@/routes/report'

export default function (app) {
  app.use('/', indexRouter);
  app.use('/auth', authRouter);
  // app.use('/tweets', tweetRouter);
  app.use('/users', users);
  app.use('/store', store);
  app.use('/sales', sale);
  app.use('/reports', report);
}
