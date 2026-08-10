import { pgTable, serial, timestamp, text, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

/**
 * 运行时配置表（KV 存储）
 *
 * 供 ConfigStore 使用，存储子站凭证、模型启停状态等运行时配置。
 * 键采用命名空间约定：station:<stationId>:<category>
 */
export const runtimeConfig = pgTable(
  "runtime_config",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("runtime_config_key_idx").on(table.key),
  ]
);
