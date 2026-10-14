ALTER TABLE "game_members" ADD COLUMN "last_seen" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "auto_paused" boolean DEFAULT false NOT NULL;