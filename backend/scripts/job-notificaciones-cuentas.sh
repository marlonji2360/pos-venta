#!/bin/bash
# Script para ejecutar job de notificaciones de cuentas por pagar
# Ubicación: backend/scripts/job-notificaciones-cuentas.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="${SCRIPT_DIR}/.."
LOG_FILE="${PROJECT_DIR}/logs/notificaciones-cuentas.log"

# Crear directorio de logs si no existe
mkdir -p "${PROJECT_DIR}/logs"

echo "========================================" >> "$LOG_FILE"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Iniciando job de notificaciones de cuentas por pagar" >> "$LOG_FILE"

# Ejecutar el job
cd "$PROJECT_DIR"
node src/jobs/notificaciones-cuentas-por-pagar.js >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Job completado exitosamente" >> "$LOG_FILE"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Job falló" >> "$LOG_FILE"
fi

echo "========================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
