-- Demo catalogue for UI testing. These are illustrative products, not Maxi stock or ERP data.
-- Brands now define the product family. The legacy product_families table and any existing
-- family assignments are intentionally preserved; the application no longer asks users to manage them.

INSERT INTO public.brands (name) VALUES
  ('Coca-Cola'), ('Fanta'), ('Sprite'), ('Red Bull'), ('Schweppes'),
  ('Nescafé'), ('Oreo'), ('Lay''s'), ('Pringles'), ('Heinz')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.product_categories (name) VALUES
  ('Refrigerantes'), ('Bebidas energéticas'), ('Águas e mixers'),
  ('Mercearia'), ('Bolachas'), ('Snacks'), ('Condimentos')
ON CONFLICT (name) DO NOTHING;

WITH demo_products(code, name, description, brand_name, category_name, unit, image_url) AS (
  VALUES
    ('DEMO-001', 'Coca-Cola Zero 500 ml', 'Refrigerante de cola sem açúcar, garrafa 500 ml.', 'Coca-Cola', 'Refrigerantes', 'UN', 'https://bghranite.eu/content/images/thumbs/0009206_koka-kola-ziro-500ml12br_415.jpeg'),
    ('DEMO-002', 'Fanta Laranja 330 ml', 'Refrigerante de laranja, lata 330 ml.', 'Fanta', 'Refrigerantes', 'UN', 'https://megamocambique.com/cdn/shop/files/4109275.jpg?v=1774006588&width=600'),
    ('DEMO-003', 'Sprite Lima-Limão 500 ml', 'Refrigerante lima-limão, garrafa 500 ml.', 'Sprite', 'Refrigerantes', 'UN', 'https://www.hancocks.co.uk/_next/image?q=75&url=https%3A%2F%2Fapi.hancocks.co.uk%2Fmedia%2Fcatalog%2Fproduct%2F4%2F1%2F41005_aa.jpg&w=3840'),
    ('DEMO-004', 'Red Bull Energy Drink 250 ml', 'Bebida energética, lata 250 ml.', 'Red Bull', 'Bebidas energéticas', 'UN', 'https://dtgxwmigmg3gc.cloudfront.net/imagery/assets/derivations/icon/512/512/true/eyJpZCI6ImY0ZWI2ZTczZWUxMzA5OWU5MmYxNzkzNTQxNDE4YmY2Iiwic3RvcmFnZSI6InB1YmxpY19zdG9yZSJ9?signature=3e799900bea6ceff93039ffc74fdd103de826cae2738e546863422d8d739dabf'),
    ('DEMO-005', 'Schweppes Tonic Water 1 L', 'Água tónica, garrafa 1 litro.', 'Schweppes', 'Águas e mixers', 'UN', 'https://bevmo.com/cdn/shop/files/a9199fe4-13be-4d20-bcad-cfdae55459e5_f0786fdd-f941-4b9d-9f1b-e95fcd8aad3f.png?v=1718254616&width=416'),
    ('DEMO-006', 'Nescafé Classic 100 g', 'Café solúvel, frasco 100 g.', 'Nescafé', 'Mercearia', 'UN', 'https://digitalcontent.api.tesco.com/v2/media/ghs/dae5d679-cc65-4c37-b93a-98a970386f46/aaa1e8d1-5182-4f92-b937-2fee711b5dc3_162139033.jpeg?h=960&w=960'),
    ('DEMO-007', 'Oreo Original 154 g', 'Bolachas de chocolate com recheio de baunilha, embalagem 154 g.', 'Oreo', 'Bolachas', 'UN', 'https://digitalcontent.api.tesco.com/v2/media/ghs/98c75019-8b89-48b1-b6eb-b63099b64ab7/d1bd714f-8a1e-4012-8c09-1958219833ac_996875380.jpeg?h=960&w=960'),
    ('DEMO-008', 'Lay''s Classic 226,8 g', 'Batatas fritas clássicas, embalagem 226,8 g.', 'Lay''s', 'Snacks', 'UN', 'https://digitalassets.pepsico.com/asset/0777c802-14d1-4013-88b9-81198bec7dda/Hi-Res/00028400199148_C1C1.jpg'),
    ('DEMO-009', 'Pringles Original 165 g', 'Batatas fritas empilhadas, embalagem Original 165 g.', 'Pringles', 'Snacks', 'UN', 'https://regalplus.com/cdn/shop/files/PringlesORIGINAL.jpg?v=1736525772'),
    ('DEMO-010', 'Heinz Tomato Ketchup 570 g', 'Ketchup de tomate, frasco 570 g.', 'Heinz', 'Condimentos', 'UN', 'https://www.bazaar-online.gr/image/cache/catalog/product-upload/8715700421582_1-1000x1000.jpg')
)
INSERT INTO public.products (code, name, description, brand_id, category_id, unit, image_url, active, sort_order)
SELECT dp.code, dp.name, dp.description, b.id, c.id, dp.unit, dp.image_url, true,
       (substring(dp.code from 6))::integer
FROM demo_products dp
JOIN public.brands b ON b.name = dp.brand_name
JOIN public.product_categories c ON c.name = dp.category_name
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  brand_id = EXCLUDED.brand_id,
  category_id = EXCLUDED.category_id,
  unit = EXCLUDED.unit,
  image_url = EXCLUDED.image_url,
  active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
