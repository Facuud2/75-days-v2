import { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import questRoutes from '../src/routes/quests';

const app = express();
app.use(express.json());
// mock auth
app.use((req, res, next) => {
  req.user = { id: 'f68c5d22-53ab-40d0-b7c0-780829febcac' } as any;
  next();
});
app.use('/api/quests', questRoutes);

request(app)
  .get('/api/quests/available')
  .expect(200)
  .end((err, res) => {
    if (err) throw err;
    console.log('RESPONSE:', res.body);
  });
