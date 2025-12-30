-- Paso 1: Ver la estructura actual de detalle_pedidos
\d detalle_pedidos

-- Paso 2: Eliminar la foreign key existente que apunta a la tabla incorrecta
ALTER TABLE detalle_pedidos 
DROP CONSTRAINT IF EXISTS detalle_pedidos_pedido_id_fkey;

-- Paso 3: Agregar la foreign key correcta apuntando a pedidos_proveedores
ALTER TABLE detalle_pedidos
ADD CONSTRAINT detalle_pedidos_pedido_id_fkey 
FOREIGN KEY (pedido_id) REFERENCES pedidos_proveedores(id) ON DELETE CASCADE;

-- Paso 4: Verificar que la columna subtotal existe, si no, agregarla
ALTER TABLE detalle_pedidos 
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);

-- Paso 5: Si subtotal no tiene valor por defecto, actualizarlo
UPDATE detalle_pedidos 
SET subtotal = cantidad * precio_unitario 
WHERE subtotal IS NULL;

-- Paso 6: Hacer subtotal NOT NULL si no lo es
ALTER TABLE detalle_pedidos 
ALTER COLUMN subtotal SET NOT NULL;

-- Paso 7: Verificar la estructura final
\d detalle_pedidos

-- Paso 8: Verificar las foreign keys
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'detalle_pedidos'
AND tc.constraint_type = 'FOREIGN KEY';
