const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const ROOT_DIR = __dirname;
const DATABASE = require("./database.js");

const PORT = Number(process.env.PORT || 3000);
const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "mealmap",
  password: process.env.DB_PASSWORD || "mealmap1234",
  database: process.env.DB_NAME || "mealmap",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
};

const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

  if (isLocalOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});
app.use(express.json({ limit: "1mb" }));

let pool;

start().catch((error) => {
  console.error("Failed to start server");
  console.error(error);
  process.exit(1);
});

async function start() {
  pool = mysql.createPool(DB_CONFIG);
  await ensureSchema(pool);
  await seedMetadata(pool);
  await migrateLegacyData(pool);
  registerRoutes();
  app.listen(PORT, () => {
    console.log(`MealMap server listening on http://localhost:${PORT}`);
  });
}

function registerRoutes() {
  app.get("/api/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });

  app.get("/api/restaurants", async (_req, res, next) => {
    try {
      const restaurants = await readRestaurants(pool);
      res.json(restaurants);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/restaurants", async (req, res, next) => {
    try {
      const payload = normalizeRestaurantInput(req.body, true);
      const restaurant = await createRestaurant(pool, payload);
      res.status(201).json(restaurant);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/restaurants/:id", async (req, res, next) => {
    try {
      const payload = normalizeRestaurantInput(req.body, false);
      const restaurant = await updateRestaurant(pool, req.params.id, payload);
      res.json(restaurant);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/restaurants/:id", async (req, res, next) => {
    try {
      await deleteRestaurant(pool, req.params.id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(ROOT_DIR));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, "index.html"));
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "server_error", message: error.message || "Server error" });
  });
}

async function ensureSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      id INT PRIMARY KEY AUTO_INCREMENT,
      app_key VARCHAR(100) NOT NULL UNIQUE,
      app_value JSON NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS profile_overrides (
      name VARCHAR(255) PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      menu_category VARCHAR(255) NOT NULL,
      signature_menu VARCHAR(255) NOT NULL,
      verification VARCHAR(100) NULL,
      tags_json JSON NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS custom_restaurants (
      name VARCHAR(255) PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      menu_category VARCHAR(255) NOT NULL,
      signature_menu VARCHAR(255) NOT NULL,
      verification VARCHAR(100) NULL,
      breakfast TINYINT(1) NOT NULL DEFAULT 0,
      lunch TINYINT(1) NOT NULL DEFAULT 0,
      dinner TINYINT(1) NOT NULL DEFAULT 0,
      tags_json JSON NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS deleted_restaurants (
      name VARCHAR(255) PRIMARY KEY,
      deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      category VARCHAR(100) NOT NULL,
      cuisine_group VARCHAR(100) NOT NULL,
      menu_category VARCHAR(255) NOT NULL,
      signature_menu VARCHAR(255) NOT NULL,
      verification VARCHAR(100) NULL,
      tags_json JSON NULL,
      aliases_json JSON NULL,
      breakfast TINYINT(1) NOT NULL DEFAULT 0,
      lunch TINYINT(1) NOT NULL DEFAULT 0,
      dinner TINYINT(1) NOT NULL DEFAULT 0,
      is_custom TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function seedMetadata(db) {
  const metadata = {
    officeLabel: DATABASE.metadata.officeLabel,
    version: DATABASE.metadata.version,
    seededAt: new Date().toISOString(),
    mode: "db-first"
  };

  await db.query(
    `
      INSERT INTO app_metadata (app_key, app_value)
      VALUES ('seed_info', CAST(:value AS JSON))
      ON DUPLICATE KEY UPDATE app_value = CAST(:value AS JSON)
    `,
    { value: JSON.stringify(metadata) }
  );
}

async function migrateLegacyData(db) {
  const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM restaurants");
  if (count > 0) return;

  const baseMap = buildSeedRestaurants();
  const legacyStore = await readLegacyEditStore(db);

  Object.entries(legacyStore.profileOverrides).forEach(([name, profile]) => {
    const existing = baseMap.get(name);
    if (!existing) return;
    existing.category = profile.category || existing.category;
    existing.menuCategory = profile.menuCategory || existing.menuCategory;
    existing.signatureMenu = profile.signatureMenu || existing.signatureMenu;
    existing.verification = profile.verification || existing.verification;
    existing.tags = Array.isArray(profile.tags) ? profile.tags : existing.tags;
    existing.cuisineGroup = toCuisineGroup(existing);
  });

  legacyStore.customRestaurants.forEach((restaurant) => {
    const existing = baseMap.get(restaurant.name);

    if (existing) {
      existing.category = restaurant.category || existing.category;
      existing.menuCategory = restaurant.menuCategory || existing.menuCategory;
      existing.signatureMenu = restaurant.signatureMenu || existing.signatureMenu;
      existing.verification = restaurant.verification || existing.verification;
      existing.tags = Array.isArray(restaurant.tags) ? restaurant.tags : existing.tags;
      existing.breakfast = !!existing.breakfast || !!restaurant.breakfast;
      existing.lunch = !!existing.lunch || !!restaurant.lunch;
      existing.dinner = !!existing.dinner || !!restaurant.dinner;
      existing.cuisineGroup = toCuisineGroup(existing);
      return;
    }

    const custom = {
      id: slugify(restaurant.name),
      name: restaurant.name,
      category: restaurant.category || "기타",
      menuCategory: restaurant.menuCategory || "기타",
      signatureMenu: restaurant.signatureMenu || "현장 메뉴 확인",
      verification: restaurant.verification || "이름 기반",
      tags: Array.isArray(restaurant.tags) ? restaurant.tags : [],
      aliases: [restaurant.name],
      breakfast: !!restaurant.breakfast,
      lunch: !!restaurant.lunch,
      dinner: !!restaurant.dinner,
      isCustom: true
    };
    custom.cuisineGroup = toCuisineGroup(custom);
    baseMap.set(custom.name, custom);
  });

  const deletedSet = new Set(legacyStore.deletedRestaurants);
  const records = Array.from(baseMap.values()).map((restaurant) => ({
    ...restaurant,
    deletedAt: deletedSet.has(restaurant.name) ? new Date() : null
  }));

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    for (const restaurant of records) {
      await connection.query(
        `
          INSERT INTO restaurants
          (id, name, category, cuisine_group, menu_category, signature_menu, verification, tags_json, aliases_json, breakfast, lunch, dinner, is_custom, deleted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?, ?)
        `,
        [
          restaurant.id,
          restaurant.name,
          restaurant.category,
          restaurant.cuisineGroup,
          restaurant.menuCategory,
          restaurant.signatureMenu,
          restaurant.verification || "이름 기반",
          JSON.stringify(restaurant.tags || []),
          JSON.stringify(restaurant.aliases || [restaurant.name]),
          restaurant.breakfast ? 1 : 0,
          restaurant.lunch ? 1 : 0,
          restaurant.dinner ? 1 : 0,
          restaurant.isCustom ? 1 : 0,
          restaurant.deletedAt
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function readRestaurants(db) {
  const [rows] = await db.query(`
    SELECT
      id,
      name,
      category,
      cuisine_group AS cuisineGroup,
      menu_category AS menuCategory,
      signature_menu AS signatureMenu,
      verification,
      tags_json AS tagsJson,
      aliases_json AS aliasesJson,
      breakfast,
      lunch,
      dinner,
      is_custom AS isCustom
    FROM restaurants
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    cuisineGroup: row.cuisineGroup,
    menuCategory: row.menuCategory,
    signatureMenu: row.signatureMenu,
    verification: row.verification || "이름 기반",
    tags: parseJsonArray(row.tagsJson),
    aliases: parseJsonArray(row.aliasesJson),
    breakfast: !!row.breakfast,
    lunch: !!row.lunch,
    dinner: !!row.dinner,
    isCustom: !!row.isCustom
  }));
}

async function createRestaurant(db, payload) {
  const id = slugify(payload.name);
  const restaurant = {
    id,
    name: payload.name,
    category: payload.category,
    cuisineGroup: toCuisineGroup(payload),
    menuCategory: payload.menuCategory,
    signatureMenu: payload.signatureMenu,
    verification: "DB 생성",
    tags: payload.tags,
    aliases: [payload.name],
    breakfast: payload.breakfast,
    lunch: payload.lunch,
    dinner: payload.dinner,
    isCustom: true
  };

  await db.query(
    `
      INSERT INTO restaurants
      (id, name, category, cuisine_group, menu_category, signature_menu, verification, tags_json, aliases_json, breakfast, lunch, dinner, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, 1)
    `,
    [
      restaurant.id,
      restaurant.name,
      restaurant.category,
      restaurant.cuisineGroup,
      restaurant.menuCategory,
      restaurant.signatureMenu,
      restaurant.verification,
      JSON.stringify(restaurant.tags),
      JSON.stringify(restaurant.aliases),
      restaurant.breakfast ? 1 : 0,
      restaurant.lunch ? 1 : 0,
      restaurant.dinner ? 1 : 0
    ]
  );

  return restaurant;
}

async function updateRestaurant(db, id, payload) {
  const [[existing]] = await db.query(
    `
      SELECT id, name, aliases_json AS aliasesJson, is_custom AS isCustom
      FROM restaurants
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
    `,
    [id]
  );

  if (!existing) {
    throw new Error("수정할 식당을 찾을 수 없습니다.");
  }

  const nextName = payload.name || existing.name;
  const aliases = parseJsonArray(existing.aliasesJson);
  if (!aliases.includes(nextName)) aliases.push(nextName);

  const cuisineGroup = toCuisineGroup({
    category: payload.category,
    menuCategory: payload.menuCategory,
    signatureMenu: payload.signatureMenu,
    name: nextName
  });

  await db.query(
    `
      UPDATE restaurants
      SET
        name = ?,
        category = ?,
        cuisine_group = ?,
        menu_category = ?,
        signature_menu = ?,
        tags_json = CAST(? AS JSON),
        aliases_json = CAST(? AS JSON),
        breakfast = ?,
        lunch = ?,
        dinner = ?
      WHERE id = ?
    `,
    [
      nextName,
      payload.category,
      cuisineGroup,
      payload.menuCategory,
      payload.signatureMenu,
      JSON.stringify(payload.tags),
      JSON.stringify(aliases),
      payload.breakfast ? 1 : 0,
      payload.lunch ? 1 : 0,
      payload.dinner ? 1 : 0,
      id
    ]
  );

  return {
    id,
    name: nextName,
    category: payload.category,
    cuisineGroup,
    menuCategory: payload.menuCategory,
    signatureMenu: payload.signatureMenu,
    tags: payload.tags,
    aliases,
    breakfast: payload.breakfast,
    lunch: payload.lunch,
    dinner: payload.dinner,
    isCustom: !!existing.isCustom
  };
}

async function deleteRestaurant(db, id) {
  await db.query("UPDATE restaurants SET deleted_at = NOW() WHERE id = ?", [id]);
}

function buildSeedRestaurants() {
  const map = new Map();
  ["breakfast", "lunch", "dinner"].forEach((mealType) => {
    DATABASE.rawSources[mealType].forEach((sourceName) => {
      const normalized = DATABASE.corrections[sourceName] || sourceName;
      const existing = map.get(normalized);

      if (existing) {
        existing[mealType] = true;
        if (!existing.aliases.includes(sourceName)) existing.aliases.push(sourceName);
        return;
      }

      const profile = inferProfile(normalized);
      const item = {
        id: slugify(normalized),
        name: normalized,
        category: profile.category,
        menuCategory: profile.menuCategory,
        signatureMenu: profile.signatureMenu,
        verification: profile.verification || "이름 기반",
        tags: profile.tags || [],
        aliases: [sourceName],
        breakfast: mealType === "breakfast",
        lunch: mealType === "lunch",
        dinner: mealType === "dinner",
        isCustom: false
      };
      item.cuisineGroup = toCuisineGroup(item);
      map.set(normalized, item);
    });
  });

  return map;
}

function inferProfile(name) {
  if (DATABASE.profiles[name]) {
    const profile = DATABASE.profiles[name];
    return {
      category: profile.category,
      menuCategory: profile.menuCategory,
      signatureMenu: profile.signatureMenu,
      verification: profile.verification || "이름 기반",
      tags: profile.tags || []
    };
  }

  const rules = [
    { test: ["스타벅스", "이디야", "투썸", "빽다방", "셀이렉토커피", "차얌", "카페"], category: "카페", menuCategory: "커피", signatureMenu: "커피 · 음료", tags: ["커피", "음료"], verification: "이름 기반" },
    { test: ["파리바게뜨", "뚜레쥬르", "단팥빵", "빵장수", "베이커리"], category: "베이커리", menuCategory: "빵", signatureMenu: "빵 · 샌드위치", tags: ["빵", "베이커리"], verification: "이름 기반" },
    { test: ["김밥", "토스트", "떡볶이", "샌드위치", "도시락"], category: "분식", menuCategory: "김밥·분식", signatureMenu: "김밥 · 분식", tags: ["분식", "간편식"], verification: "이름 기반" },
    { test: ["버거", "롯데리아", "맘스터치", "써브웨이", "치킨"], category: "패스트푸드", menuCategory: "버거·샌드위치", signatureMenu: "버거 · 샌드위치", tags: ["버거", "패스트푸드"], verification: "이름 기반" },
    { test: ["샐러디", "샐러드", "포케", "슬로우캘리"], category: "건강식", menuCategory: "샐러드·포케", signatureMenu: "샐러드 · 포케", tags: ["샐러드", "포케"], verification: "이름 기반" },
    { test: ["규동", "우동", "카츠", "돈까스", "교자", "모밀", "소바", "나베"], category: "일식", menuCategory: "일식", signatureMenu: "일식 메뉴", tags: ["일식"], verification: "이름 기반" },
    { test: ["짬뽕", "짜장", "반점", "홍콩", "마라", "미엔"], category: "중식", menuCategory: "중식", signatureMenu: "중식 면요리", tags: ["중식"], verification: "이름 기반" },
    { test: ["쌀국수", "분짜", "호치민", "포아이니"], category: "베트남·아시아", menuCategory: "쌀국수", signatureMenu: "쌀국수 · 분짜", tags: ["쌀국수", "베트남"], verification: "이름 기반" },
    { test: ["파스타", "피자", "미태리", "루벨", "래빗", "브로스"], category: "양식", menuCategory: "양식", signatureMenu: "파스타 · 브런치", tags: ["양식"], verification: "이름 기반" },
    { test: ["국밥", "찌개", "칼국수", "국수", "감자탕", "갈비", "보쌈", "보리밥", "시래기", "닭갈비", "순두부"], category: "한식", menuCategory: "한식", signatureMenu: "한식 메뉴", tags: ["한식"], verification: "이름 기반" }
  ];

  for (const rule of rules) {
    if (rule.test.some((keyword) => name.includes(keyword))) {
      return { ...rule, tags: [...rule.tags] };
    }
  }

  return { category: "기타", menuCategory: "기타", signatureMenu: "현장 메뉴 확인", tags: ["기타"], verification: "이름 기반" };
}

function toCuisineGroup(restaurant) {
  const category = restaurant.category;
  if (category === "한식") return "한식";
  if (category === "중식") return "중식";
  if (category === "일식") return "일식";
  if (category === "양식") return "양식";
  if (category === "베트남·아시아") return "동남아";
  if (category === "카페" || category === "베이커리") return "카페";
  if (category === "분식" || category === "패스트푸드" || category === "건강식") return "패스트·간편식";
  return "기타";
}

async function readLegacyEditStore(db) {
  const [overrideRows] = await db.query(`
    SELECT name, category, menu_category AS menuCategory, signature_menu AS signatureMenu, verification, tags_json AS tagsJson
    FROM profile_overrides
  `);

  const [customRows] = await db.query(`
    SELECT
      name,
      category,
      menu_category AS menuCategory,
      signature_menu AS signatureMenu,
      verification,
      breakfast,
      lunch,
      dinner,
      tags_json AS tagsJson
    FROM custom_restaurants
  `);

  const [deletedRows] = await db.query("SELECT name FROM deleted_restaurants");

  const profileOverrides = {};
  overrideRows.forEach((row) => {
    profileOverrides[row.name] = {
      category: row.category,
      menuCategory: row.menuCategory,
      signatureMenu: row.signatureMenu,
      verification: row.verification || "이름 기반",
      tags: parseJsonArray(row.tagsJson)
    };
  });

  return {
    profileOverrides,
    customRestaurants: customRows.map((row) => ({
      name: row.name,
      category: row.category,
      menuCategory: row.menuCategory,
      signatureMenu: row.signatureMenu,
      verification: row.verification || "이름 기반",
      breakfast: !!row.breakfast,
      lunch: !!row.lunch,
      dinner: !!row.dinner,
      tags: parseJsonArray(row.tagsJson)
    })),
    deletedRestaurants: deletedRows.map((row) => row.name)
  };
}

function normalizeRestaurantInput(input, requireName) {
  const safe = input && typeof input === "object" ? input : {};
  if (requireName && !safe.name) {
    throw new Error("상호명이 필요합니다.");
  }

  return {
    name: String(safe.name || "").trim(),
    category: String(safe.category || "기타").trim(),
    menuCategory: String(safe.menuCategory || "기타").trim(),
    signatureMenu: String(safe.signatureMenu || "현장 메뉴 확인").trim(),
    tags: Array.isArray(safe.tags) ? safe.tags.map((item) => String(item).trim()).filter(Boolean) : [],
    breakfast: !!safe.breakfast,
    lunch: !!safe.lunch,
    dinner: !!safe.dinner
  };
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
