const maxAge = 120000;

export function seoulDay(now = Date.now()) {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const read = db => db.prepare('SELECT day,expires,payload FROM visit_rank_cache WHERE id=1').first();

// The guarded write lets the database choose one refresher across Worker instances.
const refresh = `
  WITH totals AS (
    SELECT g.owner, SUM(v.visit_count) AS total,
      SUM(CASE WHEN v.day=? THEN v.visit_count ELSE 0 END) AS daily
    FROM visits v
    JOIN galleries g ON g.id=v.gallery_id
    JOIN beta_members m ON m.user_id=g.owner
    WHERE m.active=1 AND m.role NOT IN ('admin','super_admin') AND v.visitor<>g.owner
    GROUP BY g.owner
    HAVING SUM(v.visit_count)>0
  ),
  ranks AS (
    SELECT owner,daily,
      RANK() OVER (ORDER BY total DESC) AS total_rank,
      RANK() OVER (ORDER BY daily DESC) AS daily_rank
    FROM totals
  )
  UPDATE visit_rank_cache SET day=?,expires=?,payload=(
    SELECT json_group_object(owner,json_object(
      'total',CASE WHEN total_rank<=3 THEN total_rank END,
      'daily',CASE WHEN daily>0 AND daily_rank<=3 THEN daily_rank END
    )) FROM ranks WHERE total_rank<=3 OR (daily>0 AND daily_rank<=3)
  )
  WHERE id=1 AND (day<? OR (day=? AND expires<=?))
  RETURNING day,expires,payload
`;

export async function visitRanks(db, now = Date.now()) {
  const day = seoulDay(now);
  let snapshot = await read(db);
  if (!snapshot || snapshot.day < day || (snapshot.day === day && snapshot.expires <= now)) {
    snapshot = await db.prepare(refresh).bind(day,day,now+maxAge,day,day,now).first() || await read(db);
  }
  // An older request cannot overwrite a snapshot from after midnight.
  return {day,badges: snapshot?.day === day ? JSON.parse(snapshot.payload) : {}};
}

export function memberBadges(snapshot, owner) {
  return Object.hasOwn(snapshot.badges, owner) ? snapshot.badges[owner] : null;
}
