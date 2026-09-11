'use strict';

/**
 * Supabase Auth client (single source of truth for logins).
 *
 *  - `anon`  : public client, used for password sign-in.
 *  - `admin` : service-role client (server only), used to create / update / delete Auth users
 *              when an admin manages staff. `null` when SUPABASE_SERVICE_ROLE_KEY is not set.
 *
 * Employee ids in lh_employees are the Supabase Auth user ids (UUIDs).
 */

const { createClient } = require('@supabase/supabase-js');
const env = require('./env');
const AppError = require('../utils/appError');

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

const anon = env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts) : null;
const admin = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts) : null;

function requireAdmin() {
  if (!admin) {
    throw new AppError('Staff accounts need SUPABASE_SERVICE_ROLE_KEY on the server. Add it to the environment and redeploy.', 503);
  }
  return admin;
}

/** Password sign-in. Returns the Supabase user or throws 401. */
async function signIn(email, password) {
  if (!anon) throw new AppError('Supabase Auth is not configured.', 503);
  const { data, error } = await anon.auth.signInWithPassword({ email: String(email).trim(), password });
  if (error || !data || !data.user) {
    const msg = (error && error.message) || '';
    if (/confirm/i.test(msg)) throw new AppError('Email not confirmed yet. Ask an admin to confirm your account.', 401);
    throw new AppError('Incorrect email or password.', 401);
  }
  return data.user;
}

/** Find an Auth user by email (admin API). */
async function findUserByEmail(email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target || !admin) return null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new AppError('Could not look up accounts: ' + error.message, 502);
    const users = (data && data.users) || [];
    const hit = users.find(u => String(u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) break;
  }
  return null;
}

/** Create an Auth user (confirmed, so they can log in immediately). Returns the user. */
async function createUser({ email, password, name = '' }) {
  const client = requireAdmin();
  const { data, error } = await client.auth.admin.createUser({
    email: String(email).trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name }
  });
  if (error) {
    if (/already|exists|registered/i.test(error.message)) {
      const existing = await findUserByEmail(email);
      if (existing) return existing;
      throw new AppError('An account with this email already exists.', 409);
    }
    throw new AppError('Could not create login: ' + error.message, 502);
  }
  return data.user;
}

/** Update email / password / name of an Auth user. */
async function updateUser(id, { email, password, name } = {}) {
  const client = requireAdmin();
  const patch = {};
  if (email) patch.email = String(email).trim().toLowerCase();
  if (password) patch.password = password;
  if (name !== undefined) patch.user_metadata = { name };
  if (!Object.keys(patch).length) return null;
  const { data, error } = await client.auth.admin.updateUserById(id, patch);
  if (error) throw new AppError('Could not update login: ' + error.message, 502);
  return data.user;
}

/** Delete an Auth user; ignored when the account is already gone. */
async function deleteUser(id) {
  if (!admin) return false;
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error && !/not found/i.test(error.message)) {
    throw new AppError('Could not remove login: ' + error.message, 502);
  }
  return true;
}

module.exports = { anon, admin, signIn, findUserByEmail, createUser, updateUser, deleteUser };
