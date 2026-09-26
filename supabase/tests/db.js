// Test harness: a throwaway Postgres (PGlite) that looks enough like Supabase
// for our migrations: the anon/authenticated roles, an auth.users table,
// auth.uid() reading the JWT "sub" claim, and Supabase's default grants.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

`;

// Older Supabase projects grant everything in public to the API roles by default and rely on RLS.
const SUPABASE_DEFAULT_GRANTS = `
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export function migrationFiles() {
  const dir = join(root, 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f, sql: readFileSync(join(dir, f), 'utf8') }));
}

export function seedSql() {
  return readFileSync(join(root, 'seed.sql'), 'utf8');
}

// usersBeforeSetup: [{ email, fullName }] created before the migrations run,
// like people who signed up before setup.sql was applied.
// defaultGrants: false mimics newer projects that do not auto-expose new tables.
export async function createDb({ seed = false, usersBeforeSetup = [], defaultGrants = true } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  if (defaultGrants) await db.exec(SUPABASE_DEFAULT_GRANTS);
  for (const [i, u] of usersBeforeSetup.entries()) {
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data, created_at) values ($1, $2, $3, now() - make_interval(mins => $4))`,
      [randomUUID(), u.email, JSON.stringify({ full_name: u.fullName }), 100 - i],
    );
  }
  for (const file of migrationFiles()) {
    try {
      await db.exec(file.sql);
    } catch (err) {
      err.message = `${file.name}: ${err.message}`;
      throw err;
    }
  }
  if (seed) {
    await db.exec(seedSql());
  }
  return db;
}

// Creates an auth user (the profile trigger fires) and returns its id.
export async function signUp(db, email, fullName) {
  const id = randomUUID();
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
    [id, email, JSON.stringify({ full_name: fullName })],
  );
  return id;
}

// Runs one query the way PostgREST would for a signed-in user:
// inside a transaction, as the "authenticated" role, with the JWT sub set.
export async function asUser(db, userId, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`set local role authenticated`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    return tx.query(sql, params);
  });
}

export async function asAnon(db, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`set local role anon`);
    return tx.query(sql, params);
  });
}

// Convenience for "select fn(...) as v" calls.
export async function call(db, userId, sql, params = []) {
  const res = await asUser(db, userId, `select ${sql} as v`, params);
  return res.rows[0].v;
}
