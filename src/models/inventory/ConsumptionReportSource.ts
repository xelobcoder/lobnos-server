import type { Knex } from 'knex';

/** Preserve legacy records and include workflow movements without writing or deducting stock. */
export function consumptionReportSource(db: Knex) {
     const history = db('inv_consumption_history as history').select(
          'history.id', 'history.item_id', 'history.quantity_consumed', 'history.consumed_by',
          'history.consumption_date', 'history.batch_number', 'history.unit_cost', 'history.total_cost',
          'history.consumption_reason', 'history.department', 'history.patientid',
          'history.prescription_id', 'history.notes', 'history.approved_by',
          db.raw('NULL as ascensionid'), db.raw('NULL as reference_id')
     );
     const workflow = db('inv_inventory_transactions as movement')
          .leftJoin('inv_department_requests as custody','custody.id','movement.reference_id')
          .where('movement.transaction_type', 'consumption')
          .where(query=>query.whereIn('movement.reason', ['Phlebotomy actual supply usage', 'Laboratory actual material usage']).orWhereNotNull('custody.id'))
          .whereNotExists(db('inv_consumption_history as recorded').select(db.raw('1')).whereRaw('recorded.id = movement.id'))
          .select('movement.id', 'movement.item_id', db.raw('CAST(movement.previous_stock AS DECIMAL(20,6)) - CAST(movement.new_stock AS DECIMAL(20,6)) as quantity_consumed'),
               'movement.performed_by as consumed_by', 'movement.transaction_date as consumption_date',
               'movement.batch_number', 'movement.unit_cost', 'movement.total_cost', 'movement.reason as consumption_reason',
               db.raw("CASE WHEN custody.department IS NOT NULL THEN custody.department WHEN movement.reason = 'Phlebotomy actual supply usage' THEN 'Phlebotomy' ELSE 'Laboratory' END as department"),
               'movement.patientid', db.raw('NULL as prescription_id'), 'movement.notes', db.raw('NULL as approved_by'),
               'movement.ascensionid', 'movement.reference_id');
     return history.unionAll([workflow]);
}

export function consumptionReportType(record: { consumption_reason?: string | null }): 'manual' | 'test' | 'wastage' | 'phlebotomy' {
     const reason = (record.consumption_reason || '').toLowerCase();
     if (reason.includes('phlebotomy')) return 'phlebotomy';
     if (reason.includes('wastage')) return 'wastage';
     if (reason.includes('test') || reason === 'laboratory actual material usage') return 'test';
     return 'manual';
}
