export async function commissionRecipients(db: any, query: any) {
    const type = String(query.type || '');
    const page = Number(query.page ?? 1), pageSize = Number(query.pageSize ?? 25);
    const search = String(query.search || '').trim();
    if (!['clinician','organization'].includes(type) || !Number.isSafeInteger(page) || page < 1 || page > 100000 ||
        !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || search.length > 100)
        throw Object.assign(new Error('Invalid recipient search or page'), {statusCode:400});
    const table = type === 'clinician' ? 'clinicianbasicinfo' : 'organization';
    const base = db(table);
    if (search) base.where('name', 'like', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
    const count = await base.clone().count({total:'id'}).first();
    const rows = await base.clone().select('id','name').orderBy('name').orderBy('id').limit(pageSize).offset((page-1)*pageSize);
    return {rows:rows.map((row:any)=>({id:Number(row.id),label:row.name})),total:Number(count?.total||0),page,pageSize};
}
