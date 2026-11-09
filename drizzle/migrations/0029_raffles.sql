CREATE TABLE "raffle_draws" (
	"id" text PRIMARY KEY NOT NULL,
	"raffle_id" text NOT NULL,
	"method" text NOT NULL,
	"one_per_person" boolean DEFAULT true NOT NULL,
	"pool_size" integer NOT NULL,
	"pool_checksum" text NOT NULL,
	"pool_snapshot" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"drawn_at" timestamp NOT NULL,
	"drawn_by" text,
	"published_at" timestamp,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_interest" (
	"id" text PRIMARY KEY NOT NULL,
	"raffle_id" text,
	"email" text NOT NULL,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"raffle_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"quantity" integer NOT NULL,
	"amount" integer NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"payment_method" text NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_fee_pence" integer DEFAULT 0 NOT NULL,
	"sold_by" text,
	"age_confirmed" boolean DEFAULT false NOT NULL,
	"marketing_opt_out" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"paid_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"raffle_id" text NOT NULL,
	"order_id" text NOT NULL,
	"seq" integer NOT NULL,
	"ticket_number" integer NOT NULL,
	"void" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffles" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"tagline" text,
	"description" text DEFAULT '{}' NOT NULL,
	"hero_image_url" text,
	"gallery_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ticket_price_pence" integer NOT NULL,
	"max_tickets" integer,
	"max_per_order" integer DEFAULT 50 NOT NULL,
	"quick_picks" jsonb DEFAULT '[1,5,10,20]'::jsonb NOT NULL,
	"min_age" integer DEFAULT 16 NOT NULL,
	"sales_open_at" timestamp NOT NULL,
	"sales_close_at" timestamp NOT NULL,
	"draw_at" timestamp NOT NULL,
	"live_stream_url" text,
	"cause_title" text,
	"cause_goal_pence" integer,
	"claim_instructions" text,
	"claim_days" integer DEFAULT 14 NOT NULL,
	"small_print" text,
	"published" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp,
	"tickets_reserved" integer DEFAULT 0 NOT NULL,
	"tickets_issued" integer DEFAULT 0 NOT NULL,
	"open_notified_at" timestamp,
	"reminder_sent_at" timestamp,
	"other_expenses_pence" integer DEFAULT 0 NOT NULL,
	"return_submitted_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_drawn_by_users_id_fk" FOREIGN KEY ("drawn_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_interest" ADD CONSTRAINT "raffle_interest_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_orders" ADD CONSTRAINT "raffle_orders_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_orders" ADD CONSTRAINT "raffle_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_tickets" ADD CONSTRAINT "raffle_tickets_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_tickets" ADD CONSTRAINT "raffle_tickets_order_id_raffle_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."raffle_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_draws_raffle_idx" ON "raffle_draws" USING btree ("raffle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_interest_email_idx" ON "raffle_interest" USING btree ("raffle_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_orders_session_idx" ON "raffle_orders" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "raffle_orders_raffle_idx" ON "raffle_orders" USING btree ("raffle_id","status");--> statement-breakpoint
CREATE INDEX "raffle_orders_payment_intent_idx" ON "raffle_orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "raffle_orders_paid_at_idx" ON "raffle_orders" USING btree ("paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_tickets_number_idx" ON "raffle_tickets" USING btree ("raffle_id","ticket_number");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_tickets_order_seq_idx" ON "raffle_tickets" USING btree ("order_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "raffles_slug_idx" ON "raffles" USING btree ("slug");