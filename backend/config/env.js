'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);

module.exports = {
  NODE_ENV: process.env.NODE_ENV || (isVercel ? 'production' : 'development'),
  PORT: parseInt(process.env.PORT || '5000', 10),
  IS_VERCEL: isVercel,
  JWT_SECRET: process.env.JWT_SECRET || 'limelight_super_secret_jwt_key_2026_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DATABASE_TYPE: process.env.DATABASE_TYPE || (isVercel ? 'supabase' : 'sqlite'),
  DATABASE_PATH: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'backend', 'database', 'limelight.db'),
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://lwpueuxyuokszeflgyfv.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'sb_publishable_HX3OFYXKbLL9F2ylHmMdKQ_0bgNHF3W',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  UPLOAD_DIR: path.resolve(process.cwd(), 'uploads')
};
