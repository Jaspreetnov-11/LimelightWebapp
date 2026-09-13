'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || (isVercel ? 'production' : 'development'),
  PORT: parseInt(process.env.PORT || '5000', 10),
  IS_VERCEL: isVercel,
  JWT_SECRET: process.env.JWT_SECRET || 'limelight_super_secret_jwt_key_2026_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '365d', // one login per device

  // Data lives in Supabase Postgres when DATABASE_URL is set; otherwise a local SQLite file
  // (on Vercel the bundle is read-only, so that file goes under /tmp and is ephemeral).
  DATABASE_URL,
  DATABASE_TYPE: DATABASE_URL ? 'postgres' : 'sqlite',
  DATABASE_PATH: isVercel
    ? (String(process.env.DATABASE_PATH || '').startsWith('/tmp') ? process.env.DATABASE_PATH : '/tmp/limelight.db')
    : (process.env.DATABASE_PATH || path.resolve(process.cwd(), 'backend', 'database', 'limelight.db')),

  // Supabase Auth is the single source of truth for logins. Employee ids are the Auth user ids.
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://lwpueuxyuokszeflgyfv.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'sb_publishable_HX3OFYXKbLL9F2ylHmMdKQ_0bgNHF3W',
  SUPABASE_SERVICE_ROLE_KEY: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || 'admin@limelight.in').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  DEFAULT_STAFF_PASSWORD: process.env.DEFAULT_STAFF_PASSWORD || 'Limelight@123',

  UPLOAD_DIR: isVercel
    ? (String(process.env.UPLOAD_DIR || '').startsWith('/tmp') ? process.env.UPLOAD_DIR : '/tmp/uploads')
    : (process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads')),
  GIT_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7),
  // Simran assistant (optional): Claude answers when a key is set; WhatsApp Cloud API sends when both are set
  ANTHROPIC_API_KEY: (process.env.ANTHROPIC_API_KEY || '').trim(),
  ANTHROPIC_MODEL: (process.env.ANTHROPIC_MODEL || 'claude-opus-5').trim(),
  // AI Agent page (prompts, content, scripts, schedule, ads): Gemini free tier first, Claude if only that key exists
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim(),
  GEMINI_MODEL: (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim(),
  // PPT tab: Google Slides via a service account (JSON key, raw or base64). Optional Drive folder shared with that account.
  GOOGLE_SERVICE_ACCOUNT_JSON: (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim(),
  GOOGLE_DRIVE_FOLDER_ID: (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim(),
  WHATSAPP_TOKEN: (process.env.WHATSAPP_TOKEN || '').trim(),
  WHATSAPP_PHONE_ID: (process.env.WHATSAPP_PHONE_ID || '').trim()
};
