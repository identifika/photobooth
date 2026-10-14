import pg from 'pg';

let pool: pg.Pool | null = null;

export function getDbPool(databaseUrl?: string): pg.Pool | null {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', (err) => {
      console.warn('Gateway Postgres pool error:', err);
    });
  }
  return pool;
}

export async function getDbDailyUsage(databaseUrl: string, uid: string, usageDate: string): Promise<number | null> {
  const p = getDbPool(databaseUrl);
  if (!p) return null;
  try {
    const res = await p.query<{ count: number }>(
      'SELECT count FROM ai_daily_usage WHERE uid = $1 AND usage_date = $2 LIMIT 1;',
      [uid, usageDate]
    );
    return res.rows[0]?.count ?? 0;
  } catch (err) {
    console.warn('Gateway DB getDailyUsage error, using fallback:', err);
    return null;
  }
}

export async function incrementDbDailyUsage(
  databaseUrl: string,
  uid: string,
  email: string,
  usageDate: string,
  lastPrompt: string
): Promise<number | null> {
  const p = getDbPool(databaseUrl);
  if (!p) return null;
  try {
    const res = await p.query<{ count: number }>(
      `INSERT INTO ai_daily_usage (id, uid, email, usage_date, count, last_prompt, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, NOW(), NOW())
       ON CONFLICT (uid, usage_date)
       DO UPDATE SET count = ai_daily_usage.count + 1, email = EXCLUDED.email, last_prompt = EXCLUDED.last_prompt, updated_at = NOW()
       RETURNING count;`,
      [uid, email || '', usageDate, lastPrompt.slice(0, 200)]
    );
    return res.rows[0]?.count ?? null;
  } catch (err) {
    console.warn('Gateway DB incrementDailyUsage error, using fallback:', err);
    return null;
  }
}

export async function decrementDbDailyUsage(
  databaseUrl: string,
  uid: string,
  usageDate: string
): Promise<void> {
  const p = getDbPool(databaseUrl);
  if (!p) return;
  try {
    await p.query(
      `UPDATE ai_daily_usage SET count = GREATEST(0, count - 1), updated_at = NOW()
       WHERE uid = $1 AND usage_date = $2;`,
      [uid, usageDate]
    );
  } catch (err) {
    console.warn('Gateway DB decrementDailyUsage error:', err);
  }
}

export async function getSessionFromDb(
  databaseUrl: string,
  token: string
): Promise<{ uid: string; email?: string } | null> {
  const p = getDbPool(databaseUrl);
  if (!p) return null;
  try {
    const res = await p.query<{ user_id: string; email: string }>(
      `SELECT s.user_id, u.email
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()
       LIMIT 1;`,
      [token]
    );
    if (!res.rows[0]) return null;
    return { uid: res.rows[0].user_id, email: res.rows[0].email };
  } catch (err) {
    console.warn('Gateway DB getSessionFromDb error:', err);
    return null;
  }
}
