const CAST_TYPES = {
  float8: "DOUBLE",
  float4: "DOUBLE",
  float: "DOUBLE",
  double: "DOUBLE",
  int8: "SIGNED",
  int4: "SIGNED",
  int: "SIGNED",
  integer: "SIGNED",
  bigint: "SIGNED",
  text: "CHAR",
  date: "DATE",
  boolean: null,
  bool: null,
  timestamptz: null,
  timestamp: null,
};

function translateConflict(sql) {
  if (!/ON\s+CONFLICT/i.test(sql)) return sql;
  if (/DO\s+NOTHING/i.test(sql)) {
    const body = sql.replace(/\s+ON\s+CONFLICT\b[\s\S]*$/i, "");
    return body.replace(/^\s*INSERT\s+/i, "INSERT IGNORE ");
  }
  const match = sql.match(/^([\s\S]*?)\s+ON\s+CONFLICT\s*\([^)]*\)\s+DO\s+UPDATE\s+SET\s+([\s\S]+)$/i);
  if (!match) return sql;
  const sets = match[2].replace(/\bEXCLUDED\.([A-Za-z0-9_]+)/gi, "new.$1");
  return `${match[1].trim()} AS new ON DUPLICATE KEY UPDATE ${sets}`;
}

function translateFilters(sql) {
  return sql.replace(
    /\b(COUNT|AVG|SUM)\s*\(([^()]*)\)\s*FILTER\s*\(\s*WHERE\s+([^()]+)\)/gi,
    (_, fn, arg, cond) => {
      const name = fn.toUpperCase();
      if (name === "COUNT") return `COALESCE(SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END), 0)`;
      if (name === "AVG") return `AVG(CASE WHEN ${cond} THEN ${arg} END)`;
      return `SUM(CASE WHEN ${cond} THEN ${arg} ELSE 0 END)`;
    }
  );
}

function translateDates(sql) {
  let text = sql;
  text = text.replace(/date_trunc\(\s*'week'\s*,\s*NOW\(\)\s*\)/gi, "DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)");
  text = text.replace(/date_trunc\(\s*'month'\s*,\s*NOW\(\)\s*\)/gi, "DATE_FORMAT(CURDATE(), '%Y-%m-01')");
  text = text.replace(/date_trunc\(\s*'year'\s*,\s*NOW\(\)\s*\)/gi, "DATE_FORMAT(CURDATE(), '%Y-01-01')");
  text = text.replace(/date_trunc\(\s*'day'\s*,\s*([^)]+)\)/gi, "DATE($1)");
  text = text.replace(/INTERVAL\s+'(\d+)\s+days?'/gi, "INTERVAL $1 DAY");
  text = text.replace(/INTERVAL\s+'(\d+)\s+weeks?'/gi, "INTERVAL $1 WEEK");
  text = text.replace(/INTERVAL\s+'(\d+)\s+months?'/gi, "INTERVAL $1 MONTH");
  text = text.replace(/INTERVAL\s+'(\d+)\s+years?'/gi, "INTERVAL $1 YEAR");
  text = text.replace(/\bCURRENT_DATE\s*-\s*1\b/gi, "DATE_SUB(CURDATE(), INTERVAL 1 DAY)");
  text = text.replace(/\bCURRENT_DATE\b/gi, "CURDATE()");
  text = text.replace(/to_char\(\s*([^,]+?)\s*,\s*'HH24:00'\s*\)/gi, "DATE_FORMAT($1, '%H:00')");
  text = text.replace(/to_char\(\s*([^,]+?)\s*,\s*'Mon DD'\s*\)/gi, "DATE_FORMAT($1, '%b %d')");
  return text;
}

function findExprStart(sql, end) {
  let i = end - 1;
  while (i >= 0 && /\s/.test(sql[i])) i -= 1;
  if (i < 0) return 0;
  if (sql[i] === ")") {
    let depth = 0;
    for (let j = i; j >= 0; j -= 1) {
      if (sql[j] === ")") depth += 1;
      else if (sql[j] === "(") {
        depth -= 1;
        if (depth === 0) {
          let k = j - 1;
          while (k >= 0 && /\s/.test(sql[k])) k -= 1;
          while (k >= 0 && /[A-Za-z0-9_]/.test(sql[k])) k -= 1;
          return k + 1;
        }
      }
    }
  }
  let j = i;
  while (j >= 0 && /[A-Za-z0-9_.$]/.test(sql[j])) j -= 1;
  return j + 1;
}

function wrapCasts(sql) {
  let out = sql;
  for (let guard = 0; guard < 80 && /::/.test(out); guard += 1) {
    const idx = out.search(/::(float8|float4|float|double|int8|int4|integer|bigint|int|text|date|boolean|bool|timestamptz|timestamp)\b/i);
    if (idx < 0) break;
    const typeMatch = out.slice(idx).match(/^::([A-Za-z0-9]+)/);
    const mapped = CAST_TYPES[typeMatch[1].toLowerCase()];
    const start = findExprStart(out, idx);
    const expr = out.slice(start, idx);
    let replacement = `(${expr})`;
    if (mapped === "DATE") replacement = `DATE(${expr})`;
    else if (mapped) replacement = `CAST(${expr} AS ${mapped})`;
    out = out.slice(0, start) + replacement + out.slice(idx + typeMatch[0].length);
  }
  return out;
}

function bindPlaceholders(sql, params) {
  const bound = [];
  const text = sql.replace(/\$(\d+)/g, (_, n) => {
    const index = Number(n) - 1;
    if (index < 0 || index >= params.length) {
      throw new Error(`Missing SQL parameter $${n}`);
    }
    bound.push(params[index]);
    return "?";
  });
  return { sql: text, params: bound };
}

function trendSeries(params) {
  const ids = (Array.isArray(params[0]) ? params[0] : [params[0]]).map((id) => Number(id)).filter((id) => id > 0);
  const idList = ids.length ? ids : [0];
  const marks = idList.map(() => "?").join(", ");
  const from = params[2];
  const to = params[3];
  const select = `SELECT DATE_FORMAT(dates.dt, '%b %d') AS day,
            DATE_FORMAT(dates.dt, '%Y-%m-%d') AS date,
            CAST(COALESCE(SUM(o.total), 0) AS DOUBLE) AS sales
     FROM dates
     LEFT JOIN orders o
       ON DATE(o.created_at) = dates.dt
      AND o.restaurant_id IN (${marks})
      AND o.payment_status = 'paid'
     GROUP BY dates.dt, DATE_FORMAT(dates.dt, '%b %d'), DATE_FORMAT(dates.dt, '%Y-%m-%d')
     ORDER BY dates.dt`;
  if (from && to) {
    return {
      sql: `WITH RECURSIVE dates AS (
         SELECT DATE(?) AS dt
         UNION ALL
         SELECT DATE_ADD(dt, INTERVAL 1 DAY) FROM dates WHERE dt < DATE_ADD(DATE(?), INTERVAL 1 DAY)
       )
       ${select}`,
      params: [from, to, ...idList],
      returning: null,
    };
  }
  const days = Math.max(1, Number(params[1]) || 1);
  return {
    sql: `WITH RECURSIVE dates AS (
       SELECT DATE_SUB(CURDATE(), INTERVAL ? DAY) AS dt
       UNION ALL
       SELECT DATE_ADD(dt, INTERVAL 1 DAY) FROM dates WHERE dt < CURDATE()
     )
     ${select}`,
    params: [days - 1, ...idList],
    returning: null,
  };
}

export function translateSql(sql, params = []) {
  const source = String(sql);
  const returningMatch = source.match(/\sRETURNING\s+([\s\S]+)$/i);
  const returning = returningMatch ? returningMatch[1].trim() : null;
  let text = returningMatch ? source.slice(0, returningMatch.index).trim() : source;

  if (/generate_series\s*\(/i.test(text)) {
    return trendSeries(params || []);
  }

  text = text.replace(/\bILIKE\b/gi, "LIKE");
  text = text.replace(/\bbtrim\s*\(/gi, "TRIM(");
  text = translateConflict(text);
  text = text.replace(/=\s*ANY\s*\(\s*(\$\d+)\s*::[A-Za-z0-9_[\]]+\s*\)/gi, "IN ($1)");
  text = text.replace(/(\$\d+)::[A-Za-z0-9_]+/gi, "$1");
  text = translateFilters(text);
  text = translateDates(text);
  text = wrapCasts(text);
  const bound = bindPlaceholders(text, params || []);
  return { ...bound, returning };
}

export function assertMysql(sql) {
  if (/::|\$\d+|\bILIKE\b|\bRETURNING\b|\bON\s+CONFLICT\b|\bgenerate_series\s*\(|\bdate_trunc\s*\(|\bto_regclass\s*\(/i.test(sql)) {
    throw new Error(`Untranslated PostgreSQL syntax: ${sql}`);
  }
}
