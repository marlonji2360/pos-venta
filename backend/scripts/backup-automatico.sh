#!/bin/bash
# Script de backup automático para POS Abarrotes
# Ubicación: backend/scripts/backup-automatico.sh

# Configuración - AJUSTA ESTOS VALORES
DB_NAME="pos_abarrotes"
DB_USER="marlonjimenez"  # Tu usuario de PostgreSQL
DB_HOST="localhost"
DB_PORT="5432"

# Obtener directorio actual del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="backup_auto_${DATE}.sql"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Función para registrar en log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Iniciando backup automático ==="
log "Directorio de backups: ${BACKUP_DIR}"
log "Archivo: ${BACKUP_FILE}"

# Crear backup (sin contraseña si está configurado .pgpass o trust)
log "Ejecutando pg_dump..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F p -f "${BACKUP_DIR}/${BACKUP_FILE}" 2>&1 | tee -a "$LOG_FILE"

# Verificar que se creó correctamente
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    log "✓ Backup creado exitosamente: ${BACKUP_FILE} (${SIZE})"
else
    log "✗ ERROR: No se pudo crear el backup"
    log "Verifica: 1) Usuario PostgreSQL correcto, 2) Base de datos existe, 3) Permisos"
    exit 1
fi

# Limpiar backups antiguos (mantener últimos 30 días)
log "Limpiando backups antiguos (>30 días)..."
BEFORE_DELETE=$(find "$BACKUP_DIR" -name "backup_auto_*.sql" -type f | wc -l)
find "$BACKUP_DIR" -name "backup_auto_*.sql" -type f -mtime +30 -delete 2>/dev/null
AFTER_DELETE=$(find "$BACKUP_DIR" -name "backup_auto_*.sql" -type f | wc -l)
DELETED_COUNT=$((BEFORE_DELETE - AFTER_DELETE))
log "Backups eliminados: ${DELETED_COUNT}"

# Contar backups totales
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "*.sql" -type f 2>/dev/null | wc -l)
log "Total de backups disponibles: ${TOTAL_BACKUPS}"

# Calcular espacio usado
DISK_USAGE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "Espacio usado por backups: ${DISK_USAGE}"

log "=== Backup completado exitosamente ==="
log ""

exit 0
