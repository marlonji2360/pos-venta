// src/jobs/notificaciones-cuentas-por-pagar.js
// Script para generar notificaciones automáticas de cuentas por vencer

const { query } = require('../config/database');

async function generarNotificacionesCuentasPorPagar() {
  try {
    console.log('🔔 Generando notificaciones de cuentas por pagar...');

    // Buscar cuentas que vencen en los próximos 7 días
    const cuentas7dias = await query(`
      SELECT 
        cpp.id,
        cpp.folio,
        cpp.fecha_vencimiento,
        cpp.saldo_pendiente,
        cpp.dias_credito,
        p.nombre as proveedor_nombre,
        (cpp.fecha_vencimiento - CURRENT_DATE) as dias_restantes
      FROM cuentas_por_pagar cpp
      JOIN proveedores p ON cpp.proveedor_id = p.id
      WHERE cpp.estado IN ('pendiente', 'parcial')
      AND cpp.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM notificaciones n
        WHERE n.tipo = 'cuenta_por_vencer'
        AND n.datos->>'cuenta_id' = cpp.id::text
        AND n.fecha::date = CURRENT_DATE
      )
    `);

    // Buscar cuentas vencidas
    const cuentasVencidas = await query(`
      SELECT 
        cpp.id,
        cpp.folio,
        cpp.fecha_vencimiento,
        cpp.saldo_pendiente,
        p.nombre as proveedor_nombre,
        (CURRENT_DATE - cpp.fecha_vencimiento) as dias_vencidos
      FROM cuentas_por_pagar cpp
      JOIN proveedores p ON cpp.proveedor_id = p.id
      WHERE cpp.estado IN ('pendiente', 'parcial', 'vencido')
      AND cpp.fecha_vencimiento < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM notificaciones n
        WHERE n.tipo = 'cuenta_vencida'
        AND n.datos->>'cuenta_id' = cpp.id::text
        AND n.fecha::date = CURRENT_DATE
      )
    `);

    // Crear notificaciones para cuentas próximas a vencer
    for (const cuenta of cuentas7dias.rows) {
      const prioridad = cuenta.dias_restantes <= 3 ? 'alta' : cuenta.dias_restantes <= 5 ? 'media' : 'baja';
      
      await query(`
        INSERT INTO notificaciones (
          tipo,
          titulo,
          mensaje,
          prioridad,
          datos,
          fecha
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        'cuenta_por_vencer',
        `Cuenta por pagar próxima a vencer`,
        `La cuenta ${cuenta.folio} del proveedor "${cuenta.proveedor_nombre}" vence en ${cuenta.dias_restantes} días. Saldo: Q${parseFloat(cuenta.saldo_pendiente).toFixed(2)}`,
        prioridad,
        JSON.stringify({
          cuenta_id: cuenta.id,
          folio: cuenta.folio,
          proveedor: cuenta.proveedor_nombre,
          fecha_vencimiento: cuenta.fecha_vencimiento,
          dias_restantes: cuenta.dias_restantes,
          saldo: cuenta.saldo_pendiente
        })
      ]);

      console.log(`✅ Notificación creada: ${cuenta.folio} - Vence en ${cuenta.dias_restantes} días`);
    }

    // Crear notificaciones para cuentas vencidas
    for (const cuenta of cuentasVencidas.rows) {
      await query(`
        INSERT INTO notificaciones (
          tipo,
          titulo,
          mensaje,
          prioridad,
          datos,
          fecha
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        'cuenta_vencida',
        `⚠️ Cuenta por pagar VENCIDA`,
        `La cuenta ${cuenta.folio} del proveedor "${cuenta.proveedor_nombre}" está vencida hace ${cuenta.dias_vencidos} días. Saldo: Q${parseFloat(cuenta.saldo_pendiente).toFixed(2)}`,
        'alta',
        JSON.stringify({
          cuenta_id: cuenta.id,
          folio: cuenta.folio,
          proveedor: cuenta.proveedor_nombre,
          fecha_vencimiento: cuenta.fecha_vencimiento,
          dias_vencidos: cuenta.dias_vencidos,
          saldo: cuenta.saldo_pendiente
        })
      ]);

      // Actualizar estado a vencido
      await query(`
        UPDATE cuentas_por_pagar
        SET estado = 'vencido'
        WHERE id = $1
      `, [cuenta.id]);

      console.log(`⚠️  Notificación creada: ${cuenta.folio} - Vencida hace ${cuenta.dias_vencidos} días`);
    }

    console.log(`✅ Proceso completado. Notificaciones por vencer: ${cuentas7dias.rows.length}, Vencidas: ${cuentasVencidas.rows.length}`);

  } catch (error) {
    console.error('❌ Error al generar notificaciones:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generarNotificacionesCuentasPorPagar()
    .then(() => {
      console.log('🎉 Job completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { generarNotificacionesCuentasPorPagar };
