import express from 'express';import cors from 'cors';import helmet from 'helmet';import rateLimit from 'express-rate-limit';
import { pool } from './db.js';import { isEmailConfigured, validateEmailConfiguration } from './utils/email.js';import authRoutes from './routes/auth.js';import productRoutes from './routes/products.js';import orderRoutes from './routes/orders.js';import adminRoutes from './routes/admin.js';import paymentRoutes from './routes/payments.js';import staffRoutes from './routes/staff.js';import deliveryRoutes from './routes/delivery.js';import employeeRoutes from './routes/employee.js';
if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET==='replace_with_a_long_random_secret_at_least_32_characters') throw new Error('JWT_SECRET must be set to a unique random value of at least 32 characters.');
validateEmailConfiguration();
if(process.env.NODE_ENV==='production' && !isEmailConfigured()) throw new Error('RESEND_API_KEY and AUTH_EMAIL_FROM are required in production.');
const clientOrigins=(process.env.CLIENT_ORIGIN||'http://localhost:5173').split(',').map(s=>s.trim());
if(process.env.NODE_ENV==='production'){
  if(!process.env.CLIENT_ORIGIN) throw new Error('CLIENT_ORIGIN must be set to the production storefront origin.');
  for(const origin of clientOrigins){
    const parsedOrigin=new URL(origin);
    if(parsedOrigin.protocol!=='https:' || parsedOrigin.origin!==origin) throw new Error('Production CLIENT_ORIGIN entries must be HTTPS origins without a trailing slash.');
  }
}
if(process.env.NODE_ENV==='production' && process.env.DATABASE_SSL!=='true') throw new Error('DATABASE_SSL=true is required in production to enforce verified PostgreSQL TLS.');
if(process.env.GOOGLE_CLIENT_ID) console.log('Google sign-in: configured ✓'); else console.warn('Google sign-in: GOOGLE_CLIENT_ID not set — Google authentication will be unavailable.');
const app=express();app.disable('x-powered-by');app.use(helmet());app.use(cors({origin:clientOrigins,credentials:false}));
app.use(express.json({limit:'8mb'}));
app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok',database:'connected'});}catch{res.status(503).json({status:'error',database:'unavailable'});}});
const authLimiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false,message:{message:'Too many authentication attempts. Try again later.'}});
for(const path of ['/api/auth/login','/api/auth/register','/api/auth/forgot-password','/api/auth/reset-password','/api/auth/google'])app.use(path,authLimiter);
app.use('/api/auth',authRoutes);app.use('/api/products',productRoutes);app.use('/api/orders',orderRoutes);app.use('/api/payments',paymentRoutes);app.use('/api/admin',adminRoutes);app.use('/api/staff',staffRoutes);app.use('/api/delivery',deliveryRoutes);app.use('/api/employee',employeeRoutes);
app.use((err,_req,res,_next)=>{
  if(err.type==='entity.parse.failed')return res.status(400).json({message:'Request body must contain valid JSON.'});
  if(err.name==='ZodError') return res.status(400).json({message:'Please check the submitted information.',errors:err.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  if(err.code==='23505') return res.status(409).json({message:'A record with this value already exists.'});
  // Log every unexpected error with enough detail to diagnose in development
  const isDev = process.env.NODE_ENV !== 'production';
  if(isDev) {
    console.error('[ERROR]', err.status ? `HTTP ${err.status}` : 'Unhandled', err.message);
    if(!err.status) console.error(err.stack || err); // full stack for unexpected errors only
  } else {
    if(!err.status) console.error('[ERROR] Unhandled server error:', err.message);
  }
  res.status(err.status||500).json({message:err.status?err.message:'An unexpected server error occurred.'});
});
const port=Number(process.env.PORT||4000);const server=app.listen(port,()=>console.log(`Hawassa-Ketema API listening on http://localhost:${port}`));
const shutdown=async()=>{server.close(async()=>{await pool.end();process.exit(0);});};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
