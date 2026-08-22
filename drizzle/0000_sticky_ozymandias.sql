CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"evaluation_id" uuid,
	"payload" jsonb NOT NULL,
	"delivered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"profile_id" uuid,
	"score" integer NOT NULL,
	"score_class" text NOT NULL,
	"asking_ratio" numeric(6, 4),
	"gate_a_passed" boolean,
	"gate_b_passed" boolean,
	"expected_margin" numeric(12, 2),
	"fraud_risk_score" integer,
	"hard_rejected" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"vin" text NOT NULL,
	"title_state" text NOT NULL,
	"brands" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"accident_count" integer,
	"odometer_readings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw" jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_listing_id" text,
	"url" text,
	"raw_text" text,
	"title" text,
	"description" text,
	"price" numeric(10, 2),
	"price_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mileage" integer,
	"location" text,
	"vin" text,
	"vin_confidence" text DEFAULT 'NONE' NOT NULL,
	"vehicle_year" integer,
	"vehicle_make" text,
	"vehicle_model" text,
	"vehicle_trim" text,
	"seller_name" text,
	"seller_type" text DEFAULT 'unknown' NOT NULL,
	"seller_contact" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title_state" text DEFAULT 'UNKNOWN' NOT NULL,
	"parsed_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"red_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedup_key" text NOT NULL,
	"workflow_stage" text DEFAULT 'FOUND' NOT NULL,
	"workflow_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"watched" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"evaluation_id" uuid,
	"outcome" text NOT NULL,
	"notes" text,
	"actual_repairs" numeric(10, 2),
	"actual_finished_value" numeric(10, 2),
	"actual_all_in" numeric(10, 2),
	"actual_margin" numeric(10, 2),
	"sold_price" numeric(10, 2),
	"prediction_error" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"zip" text NOT NULL,
	"radius_miles" integer DEFAULT 100 NOT NULL,
	"make" text,
	"model" text,
	"trim" text,
	"year_min" integer,
	"year_max" integer,
	"mileage_max" integer,
	"price_min" numeric(10, 2),
	"price_max" numeric(10, 2),
	"max_asking_ratio" numeric(5, 4) DEFAULT '0.7000' NOT NULL,
	"require_clean_title" boolean DEFAULT true NOT NULL,
	"allowed_repair_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rejected_repair_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_expected_repairs" numeric(10, 2),
	"min_deal_margin" numeric(10, 2) DEFAULT '2000' NOT NULL,
	"max_fraud_risk_score" integer DEFAULT 40 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"confidence" numeric(4, 3) DEFAULT '0.900' NOT NULL,
	"estimate_low" numeric(10, 2) NOT NULL,
	"estimate_expected" numeric(10, 2) NOT NULL,
	"estimate_high" numeric(10, 2) NOT NULL,
	"major_risk" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'USER_INPUT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"reference_good_value" numeric(10, 2) NOT NULL,
	"comp_median" numeric(10, 2),
	"comp_range_low" numeric(10, 2),
	"comp_range_high" numeric(10, 2),
	"confidence" numeric(4, 3) DEFAULT '0.800' NOT NULL,
	"notes" text,
	"entered_by" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vin_cache" (
	"vin" text PRIMARY KEY NOT NULL,
	"decoded" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_profile_id_search_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."search_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_checks" ADD CONSTRAINT "history_checks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_issues" ADD CONSTRAINT "user_issues_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;