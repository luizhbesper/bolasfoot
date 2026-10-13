CREATE TABLE "commands" (
	"game_id" integer NOT NULL,
	"n" integer NOT NULL,
	"etapa" smallint DEFAULT 0 NOT NULL,
	"member_id" integer NOT NULL,
	"list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "commands_game_id_n_etapa_member_id_pk" PRIMARY KEY("game_id","n","etapa","member_id")
);
--> statement-breakpoint
CREATE TABLE "game_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"team_ref" text,
	"tecnico_id" integer,
	"ready" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_members_game_id_user_id_unique" UNIQUE("game_id","user_id"),
	CONSTRAINT "game_members_game_id_team_ref_unique" UNIQUE("game_id","team_ref")
);
--> statement-breakpoint
CREATE TABLE "game_settings" (
	"game_id" integer PRIMARY KEY NOT NULL,
	"planning_timeout_s" integer DEFAULT 180 NOT NULL,
	"halftime_timeout_s" integer DEFAULT 30 NOT NULL,
	"results_pause_s" integer DEFAULT 15 NOT NULL,
	"ms_per_minute" integer DEFAULT 400 NOT NULL,
	"daily_resolve_at" text DEFAULT '23:00' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"auto_ready_on_timeout" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"admin_id" integer NOT NULL,
	"mode" text DEFAULT 'live' NOT NULL,
	"config" jsonb NOT NULL,
	"game_seed" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"round" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" text PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_logs" (
	"game_id" integer NOT NULL,
	"n" integer NOT NULL,
	"etapa" smallint DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "round_logs_game_id_n_etapa_pk" PRIMARY KEY("game_id","n","etapa")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"game_id" integer NOT NULL,
	"n" integer NOT NULL,
	"phase" text DEFAULT 'planejamento' NOT NULL,
	"seed_hash" text NOT NULL,
	"seed" text,
	"started_at" timestamp with time zone,
	CONSTRAINT "rounds_game_id_n_pk" PRIMARY KEY("game_id","n")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"game_id" integer NOT NULL,
	"n" integer NOT NULL,
	"etapa" smallint DEFAULT 0 NOT NULL,
	"data" "bytea" NOT NULL,
	CONSTRAINT "snapshots_game_id_n_etapa_pk" PRIMARY KEY("game_id","n","etapa")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_member_id_game_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."game_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_members" ADD CONSTRAINT "game_members_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_members" ADD CONSTRAINT "game_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_settings" ADD CONSTRAINT "game_settings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_logs" ADD CONSTRAINT "round_logs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;