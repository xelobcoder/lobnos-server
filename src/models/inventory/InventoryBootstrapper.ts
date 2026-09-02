import KnexConnection from '../../database/KnexConnections';

const DEFAULT_CATEGORIES = [
     { id: 'CAT-PHARMACY', name: 'Pharmacy', description: 'Medicines and pharmacy retail products.' },
     { id: 'CAT-LAB-REAGENTS', name: 'Laboratory Reagents', description: 'Reagents and test consumables.' },
     { id: 'CAT-LAB-CONSUMABLES', name: 'Laboratory Consumables', description: 'Routine laboratory consumables.' },
     { id: 'CAT-LAB-EQUIPMENT', name: 'Laboratory Equipment', description: 'Laboratory equipment and accessories.' },
     { id: 'CAT-PPE-CLEANING', name: 'PPE and Cleaning', description: 'Protective equipment and cleaning supplies.' },
     { id: 'CAT-OFFICE-SUPPLIES', name: 'Office Supplies', description: 'Office and administrative supplies.' },
     { id: 'CAT-GENERAL-SUPPLIES', name: 'General Supplies', description: 'Other operational supplies.' }
] as const;

export async function bootstrapInventoryDefaults(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);
     const categoryCount = await connection('inv_categories').count('* as count').first();

     if (Number(categoryCount?.count || 0) === 0) {
          const now = new Date();
          await connection('inv_categories').insert(DEFAULT_CATEGORIES.map((category) => ({ ...category, item_count: 0, created_at: now, updated_at: now })));
     } else {
          const pharmacyCategory = await connection('inv_categories').whereRaw('LOWER(name) = ?', ['pharmacy']).first();
          if (!pharmacyCategory) await connection('inv_categories').insert({ id: 'CAT-PHARMACY', name: 'Pharmacy', description: 'Medicines and pharmacy retail products.', item_count: 0, created_at: new Date(), updated_at: new Date() });
     }

     const supplierCount = await connection('inv_suppliers').count('* as count').first();
     if (Number(supplierCount?.count || 0) === 0) {
          const now = new Date();
          await connection('inv_suppliers').insert({ id: 'SUP-SYSTEM-DEFAULT', name: 'System Default Supplier', contact: null, email: null, phone: null, address: null, is_active: true, created_at: now, updated_at: now });
     }
}