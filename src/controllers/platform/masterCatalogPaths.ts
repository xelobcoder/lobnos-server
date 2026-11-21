const allowed = [
 /^\/testpanel\/\d+\/validation-rules$/,
 /^\/testpanel\/(?:my-access|unit-catalogue|categories|list(?:\/(?:createcustom|updateprocedureManual|customtestrule))?|management\/list|calculations(?:\/preview)?|reportsettings|qc-requirement)$/,
 /^\/gettestpanel\/edit$/,
 /^\/test\/(?:getProcedureManual|getLiteraturereview|isLiteraturereview\/getLiterature)$/,
 /^\/testsetup\/(?:literature|resultliterature)$/,
 /^\/field-constraints(?:\/(?:field|test)\/\d+|\/\d+)?$/,
 /^\/departments(?:\/\d+)?$/,
 /^\/sampletype$/,
 /^\/sample\/containers(?:\/\d+)?$/,
 /^\/test\/fields\/category(?:\/(?:test|soft-delete|restore)\/\d+|\/\d+)?$/,
 /^\/multi\/(?:definition(?:\/(?:test|conditions)\/\d+|\/\d+)?|condition(?:\/(?:update|delete)\/\d+|\/\d+)?)$/,
 /^\/operations\/control\/tests\/\d+\/critical-policies(?:\/\d+)?$/,
];
export const allowedMasterCatalogPath=(path:string)=>allowed.some(pattern=>pattern.test(path));
