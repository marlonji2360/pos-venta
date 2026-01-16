// backend/src/routes/gastos-fijos.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// ============================================
// UTILIDAD DE PAGINACIÓN
// ============================================

/**
 * Función helper para construir respuesta paginada
 */
const construirRespuestaPaginada = (datos, nombreCampo, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    [nombreCampo]: datos,  // 'gastos' o 'pagos'
    datos: datos,          // Para compatibilidad con nuevo frontend
    paginacion: {
      paginaActual: parseInt(page),
      porPagina: parseInt(limit),
      totalRegistros: parseInt(total),
      totalPaginas: totalPages,
      tienePaginaAnterior: page > 1,
      tienePaginaSiguiente: page < totalPages
    },
    // Mantener compatibilidad con frontend original
    total: parseInt(total),
    limit: parseInt(limit),
    offset: (page - 1) * limit
  };
};

// ============================================
// CATEGORÍAS DE GASTOS
// ============================================

// GET /api/gastos-fijos/categorias - Listar categorías
router.get('/categorias', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM categorias_gastos
      WHERE activo = true
      ORDER BY nombre
    `);

    res.json({
      categorias: result.rows
    });
  } catch (error) {
    console.error('Error al listar categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// ============================================
// GASTOS FIJOS (Plantillas)
// ============================================

// GET /api/gastos-fijos - Listar todos los gastos fijos (CON PAGINACIÓN)
router.get('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { activo, buscar } = req.query;
    
    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Construir WHERE clause
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (activo !== undefined) {
      conditions.push(`gf.activo = $${paramCount}`);
      params.push(activo === 'true');
      paramCount++;
    }

    if (buscar && buscar.trim()) {
      conditions.push(`(
        gf.nombre ILIKE $${paramCount} OR 
        gf.proveedor ILIKE $${paramCount} OR
        cg.nombre ILIKE $${paramCount}
      )`);
      params.push(`%${buscar.trim()}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM gastos_fijos gf
      LEFT JOIN categorias_gastos cg ON gf.categoria_id = cg.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Obtener datos paginados
    let queryText = `
      SELECT 
        gf.*,
        cg.nombre as categoria_nombre,
        cg.icono,
        cg.color
      FROM gastos_fijos gf
      LEFT JOIN categorias_gastos cg ON gf.categoria_id = cg.id
      ${whereClause}
      ORDER BY gf.nombre
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json(construirRespuestaPaginada(
      result.rows,
      'gastos',
      page,
      limit,
      total
    ));
  } catch (error) {
    console.error('Error al listar gastos:', error);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// POST /api/gastos-fijos - Crear gasto fijo
router.post('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const {
      nombre,
      categoria_id,
      monto,
      frecuencia,
      dia_vencimiento,
      proveedor,
      numero_cuenta,
      notas,
      dias_recordatorio
    } = req.body;

    if (!nombre || !monto || !frecuencia || !dia_vencimiento) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const result = await query(`
      INSERT INTO gastos_fijos (
        nombre,
        categoria_id,
        monto,
        frecuencia,
        dia_vencimiento,
        proveedor,
        numero_cuenta,
        notas,
        dias_recordatorio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      nombre,
      categoria_id || null,
      monto,
      frecuencia,
      dia_vencimiento,
      proveedor || null,
      numero_cuenta || null,
      notas || null,
      dias_recordatorio || 3
    ]);

    // Generar primer pago automáticamente
    await query('SELECT generar_proximos_pagos_gastos()');

    res.status(201).json({
      message: 'Gasto fijo creado exitosamente',
      gasto: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear gasto:', error);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// PUT /api/gastos-fijos/:id - Actualizar gasto fijo
router.put('/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      categoria_id,
      monto,
      frecuencia,
      dia_vencimiento,
      proveedor,
      numero_cuenta,
      notas,
      dias_recordatorio,
      activo
    } = req.body;

    const result = await query(`
      UPDATE gastos_fijos
      SET 
        nombre = COALESCE($1, nombre),
        categoria_id = COALESCE($2, categoria_id),
        monto = COALESCE($3, monto),
        frecuencia = COALESCE($4, frecuencia),
        dia_vencimiento = COALESCE($5, dia_vencimiento),
        proveedor = COALESCE($6, proveedor),
        numero_cuenta = COALESCE($7, numero_cuenta),
        notas = COALESCE($8, notas),
        dias_recordatorio = COALESCE($9, dias_recordatorio),
        activo = COALESCE($10, activo)
      WHERE id = $11
      RETURNING *
    `, [nombre, categoria_id, monto, frecuencia, dia_vencimiento, proveedor, numero_cuenta, notas, dias_recordatorio, activo, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({
      message: 'Gasto actualizado exitosamente',
      gasto: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar gasto:', error);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
});

// DELETE /api/gastos-fijos/:id - Eliminar gasto fijo
router.delete('/:id', verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM gastos_fijos WHERE id = $1', [id]);

    res.json({ message: 'Gasto eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar gasto:', error);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

// ============================================
// PAGOS DE GASTOS
// ============================================

// GET /api/gastos-fijos/pagos - Listar pagos (CON PAGINACIÓN)
router.get('/pagos', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { estado, mes, anio, buscar } = req.query;
    
    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Construir condiciones WHERE
    const conditions = ['gf.activo = true'];
    const params = [];
    let paramCount = 1;

    if (estado) {
      conditions.push(`pg.estado = $${paramCount}`);
      params.push(estado);
      paramCount++;
    }

    if (mes && anio) {
      conditions.push(`EXTRACT(MONTH FROM pg.fecha_vencimiento) = $${paramCount}`);
      params.push(mes);
      paramCount++;
      conditions.push(`EXTRACT(YEAR FROM pg.fecha_vencimiento) = $${paramCount}`);
      params.push(anio);
      paramCount++;
    }

    if (buscar && buscar.trim()) {
      conditions.push(`(
        gf.nombre ILIKE $${paramCount} OR 
        gf.proveedor ILIKE $${paramCount} OR
        cg.nombre ILIKE $${paramCount}
      )`);
      params.push(`%${buscar.trim()}%`);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM pagos_gastos pg
      JOIN gastos_fijos gf ON pg.gasto_fijo_id = gf.id
      JOIN categorias_gastos cg ON gf.categoria_id = cg.id
      LEFT JOIN usuarios u ON pg.usuario_id = u.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Obtener datos paginados
    let queryText = `
      SELECT 
        pg.*,
        gf.nombre as gasto_nombre,
        gf.proveedor,
        gf.dias_recordatorio,
        cg.nombre as categoria_nombre,
        cg.icono,
        cg.color,
        u.nombre as usuario_nombre,
        (pg.fecha_vencimiento - CURRENT_DATE) as dias_restantes,
        CASE 
          WHEN pg.estado = 'pagado' THEN 'pagado'
          WHEN pg.fecha_vencimiento < CURRENT_DATE AND pg.estado = 'pendiente' THEN 'vencido'
          WHEN pg.fecha_vencimiento <= CURRENT_DATE + gf.dias_recordatorio AND pg.estado = 'pendiente' THEN 'por_vencer'
          ELSE 'pendiente'
        END as estado_alerta
      FROM pagos_gastos pg
      JOIN gastos_fijos gf ON pg.gasto_fijo_id = gf.id
      JOIN categorias_gastos cg ON gf.categoria_id = cg.id
      LEFT JOIN usuarios u ON pg.usuario_id = u.id
      ${whereClause}
      ORDER BY pg.fecha_vencimiento ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json(construirRespuestaPaginada(
      result.rows,
      'pagos',
      page,
      limit,
      total
    ));
  } catch (error) {
    console.error('Error al listar pagos:', error);
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// POST /api/gastos-fijos/pagos/:id/pagar - Registrar pago
router.post('/pagos/:id/pagar', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_pago, monto_pagado, metodo_pago, referencia, notas } = req.body;

    const result = await query(`
      UPDATE pagos_gastos
      SET 
        fecha_pago = $1,
        monto_pagado = $2,
        metodo_pago = $3,
        referencia = $4,
        notas = $5,
        estado = 'pagado',
        usuario_id = $6
      WHERE id = $7
      AND estado = 'pendiente'
      RETURNING *
    `, [
      fecha_pago || new Date(),
      monto_pagado,
      metodo_pago,
      referencia || null,
      notas || null,
      req.usuario.id,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado o ya procesado' });
    }

    res.json({
      message: 'Pago registrado exitosamente',
      pago: result.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
});

// POST /api/gastos-fijos/generar-pagos - Generar próximos pagos
router.post('/generar-pagos', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    await query('SELECT generar_proximos_pagos_gastos()');

    res.json({
      message: 'Pagos generados exitosamente'
    });
  } catch (error) {
    console.error('Error al generar pagos:', error);
    res.status(500).json({ error: 'Error al generar pagos' });
  }
});

// GET /api/gastos-fijos/resumen - Resumen de gastos
router.get('/resumen', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { mes, anio } = req.query;
    const mesActual = mes || new Date().getMonth() + 1;
    const anioActual = anio || new Date().getFullYear();

    // Total gastos del mes
    const totalMes = await query(`
      SELECT 
        COUNT(*) as total_pagos,
        COALESCE(SUM(monto_pagado), 0) as total_pagado,
        COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN monto_pagado ELSE 0 END), 0) as total_pendiente
      FROM pagos_gastos
      WHERE EXTRACT(MONTH FROM fecha_vencimiento) = $1
      AND EXTRACT(YEAR FROM fecha_vencimiento) = $2
    `, [mesActual, anioActual]);

    // Gastos por categoría
    const porCategoria = await query(`
      SELECT 
        cg.nombre as categoria,
        cg.color,
        COUNT(pg.id) as num_pagos,
        COALESCE(SUM(pg.monto_pagado), 0) as total
      FROM pagos_gastos pg
      JOIN gastos_fijos gf ON pg.gasto_fijo_id = gf.id
      JOIN categorias_gastos cg ON gf.categoria_id = cg.id
      WHERE EXTRACT(MONTH FROM pg.fecha_vencimiento) = $1
      AND EXTRACT(YEAR FROM pg.fecha_vencimiento) = $2
      AND pg.estado = 'pagado'
      GROUP BY cg.nombre, cg.color
      ORDER BY total DESC
    `, [mesActual, anioActual]);

    // Próximos vencimientos
    const proximosVencimientos = await query(`
      SELECT 
        pg.id,
        pg.fecha_vencimiento,
        pg.monto_pagado as monto,
        gf.nombre as gasto_nombre,
        gf.proveedor,
        cg.color,
        (pg.fecha_vencimiento - CURRENT_DATE) as dias_restantes
      FROM pagos_gastos pg
      JOIN gastos_fijos gf ON pg.gasto_fijo_id = gf.id
      JOIN categorias_gastos cg ON gf.categoria_id = cg.id
      WHERE pg.estado = 'pendiente'
      AND pg.fecha_vencimiento >= CURRENT_DATE
      ORDER BY pg.fecha_vencimiento ASC
      LIMIT 5
    `);

    res.json({
      resumen: totalMes.rows[0],
      porCategoria: porCategoria.rows,
      proximosVencimientos: proximosVencimientos.rows
    });
  } catch (error) {
    console.error('Error al obtener resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

module.exports = router;