CREATE TABLE price_list (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text,
  item_name text NOT NULL,
  unit text,
  price numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE price_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON "public"."price_list"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."price_list"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users only" ON "public"."price_list"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (true);
