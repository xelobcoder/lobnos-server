export type AdministrativeDivisionType =
     | 'region' | 'state' | 'county' | 'province' | 'department' | 'district' | 'municipality' | 'territory' | 'wilaya';

export interface AdministrativeDivision {
     name: string;
     type: AdministrativeDivisionType;
}

export interface CountryPhoneRule {
     callingCode: string;
     trunkPrefix: string | null;
     nationalNumberLength: { min: number; max: number };
     // Illustrative only: operators change and numbers are portable, so validation relies on libphonenumber.
     mobilePrefixExamples: string[];
     internationalExample: string;
}

export interface CountryRecord {
     name: string;
     iso2: string;
     iso3: string;
     capital: string;
     currency: { code: string; symbol: string; name: string };
     languages: string[];
     officialLanguage: string;
     timezone: string;
     phone: CountryPhoneRule;
     divisionLabel: string;
     divisions: AdministrativeDivision[];
}

const div = (type: AdministrativeDivisionType, names: string[]): AdministrativeDivision[] =>
     names.map((name) => ({ name, type }));

const XOF = { code: 'XOF', symbol: 'CFA', name: 'West African CFA franc' };

export const DEFAULT_COUNTRY_ISO = 'GH';

export const WEST_AFRICA_COUNTRIES: CountryRecord[] = [
     {
          name: 'Benin', iso2: 'BJ', iso3: 'BEN', capital: 'Porto-Novo', currency: XOF,
          languages: ['fr'], officialLanguage: 'fr', timezone: 'Africa/Porto-Novo',
          phone: { callingCode: '+229', trunkPrefix: null, nationalNumberLength: { min: 8, max: 10 }, mobilePrefixExamples: ['01', '4', '5', '6', '9'], internationalExample: '+229 01 90 01 12 34' },
          divisionLabel: 'Department',
          divisions: div('department', ['Alibori', 'Atakora', 'Atlantique', 'Borgou', 'Collines', 'Couffo', 'Donga', 'Littoral', 'Mono', 'Ouémé', 'Plateau', 'Zou']),
     },
     {
          name: 'Burkina Faso', iso2: 'BF', iso3: 'BFA', capital: 'Ouagadougou', currency: XOF,
          languages: ['fr'], officialLanguage: 'fr', timezone: 'Africa/Ouagadougou',
          phone: { callingCode: '+226', trunkPrefix: null, nationalNumberLength: { min: 8, max: 8 }, mobilePrefixExamples: ['5', '6', '7'], internationalExample: '+226 70 12 34 56' },
          divisionLabel: 'Region',
          divisions: div('region', ['Boucle du Mouhoun', 'Cascades', 'Centre', 'Centre-Est', 'Centre-Nord', 'Centre-Ouest', 'Centre-Sud', 'Est', 'Hauts-Bassins', 'Nord', 'Plateau-Central', 'Sahel', 'Sud-Ouest']),
     },
     {
          name: 'Cabo Verde', iso2: 'CV', iso3: 'CPV', capital: 'Praia', currency: { code: 'CVE', symbol: 'Esc', name: 'Cape Verdean escudo' },
          languages: ['pt'], officialLanguage: 'pt', timezone: 'Atlantic/Cape_Verde',
          phone: { callingCode: '+238', trunkPrefix: null, nationalNumberLength: { min: 7, max: 7 }, mobilePrefixExamples: ['5', '9'], internationalExample: '+238 991 12 34' },
          divisionLabel: 'Municipality',
          divisions: div('municipality', ['Boa Vista', 'Brava', 'Maio', 'Mosteiros', 'Paul', 'Porto Novo', 'Praia', 'Ribeira Brava', 'Ribeira Grande', 'Ribeira Grande de Santiago', 'Sal', 'Santa Catarina', 'Santa Catarina do Fogo', 'Santa Cruz', 'São Domingos', 'São Filipe', 'São Lourenço dos Órgãos', 'São Miguel', 'São Salvador do Mundo', 'São Vicente', 'Tarrafal', 'Tarrafal de São Nicolau']),
     },
     {
          name: "Côte d'Ivoire", iso2: 'CI', iso3: 'CIV', capital: 'Yamoussoukro', currency: XOF,
          languages: ['fr'], officialLanguage: 'fr', timezone: 'Africa/Abidjan',
          phone: { callingCode: '+225', trunkPrefix: null, nationalNumberLength: { min: 10, max: 10 }, mobilePrefixExamples: ['01', '05', '07'], internationalExample: '+225 01 23 45 67 89' },
          divisionLabel: 'District',
          divisions: div('district', ['Abidjan', 'Bas-Sassandra', 'Comoé', 'Denguélé', 'Gôh-Djiboua', 'Lacs', 'Lagunes', 'Montagnes', 'Sassandra-Marahoué', 'Savanes', 'Vallée du Bandama', 'Woroba', 'Yamoussoukro', 'Zanzan']),
     },
     {
          name: 'The Gambia', iso2: 'GM', iso3: 'GMB', capital: 'Banjul', currency: { code: 'GMD', symbol: 'D', name: 'Gambian dalasi' },
          languages: ['en'], officialLanguage: 'en', timezone: 'Africa/Banjul',
          phone: { callingCode: '+220', trunkPrefix: null, nationalNumberLength: { min: 7, max: 7 }, mobilePrefixExamples: ['2', '3', '6', '7', '9'], internationalExample: '+220 301 2345' },
          divisionLabel: 'Region',
          divisions: [...div('municipality', ['Banjul', 'Kanifing']), ...div('region', ['Central River', 'Lower River', 'North Bank', 'Upper River', 'West Coast'])],
     },
     {
          name: 'Ghana', iso2: 'GH', iso3: 'GHA', capital: 'Accra', currency: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian cedi' },
          languages: ['en'], officialLanguage: 'en', timezone: 'Africa/Accra',
          phone: { callingCode: '+233', trunkPrefix: '0', nationalNumberLength: { min: 9, max: 9 }, mobilePrefixExamples: ['020', '023', '024', '025', '026', '027', '028', '050', '053', '054', '055', '059'], internationalExample: '+233 55 024 0202' },
          divisionLabel: 'Region',
          divisions: div('region', ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North']),
     },
     {
          name: 'Guinea', iso2: 'GN', iso3: 'GIN', capital: 'Conakry', currency: { code: 'GNF', symbol: 'FG', name: 'Guinean franc' },
          languages: ['fr'], officialLanguage: 'fr', timezone: 'Africa/Conakry',
          phone: { callingCode: '+224', trunkPrefix: null, nationalNumberLength: { min: 9, max: 9 }, mobilePrefixExamples: ['55', '60', '62', '63', '64', '65', '66', '67', '68'], internationalExample: '+224 601 12 34 56' },
          divisionLabel: 'Region',
          divisions: div('region', ['Boké', 'Conakry', 'Faranah', 'Kankan', 'Kindia', 'Labé', 'Mamou', 'Nzérékoré']),
     },
     {
          name: 'Guinea-Bissau', iso2: 'GW', iso3: 'GNB', capital: 'Bissau', currency: XOF,
          languages: ['pt'], officialLanguage: 'pt', timezone: 'Africa/Bissau',
          phone: { callingCode: '+245', trunkPrefix: null, nationalNumberLength: { min: 9, max: 9 }, mobilePrefixExamples: ['955', '966', '977'], internationalExample: '+245 955 012 345' },
          divisionLabel: 'Region',
          divisions: [...div('region', ['Bafatá', 'Biombo', 'Bolama', 'Cacheu', 'Gabú', 'Oio', 'Quinara', 'Tombali']), ...div('territory', ['Bissau (Autonomous Sector)'])],
     },
     {
          name: 'Liberia', iso2: 'LR', iso3: 'LBR', capital: 'Monrovia', currency: { code: 'LRD', symbol: 'L$', name: 'Liberian dollar' },
          languages: ['en'], officialLanguage: 'en', timezone: 'Africa/Monrovia',
          phone: { callingCode: '+231', trunkPrefix: '0', nationalNumberLength: { min: 7, max: 9 }, mobilePrefixExamples: ['4', '5', '6', '7'], internationalExample: '+231 77 012 3456' },
          divisionLabel: 'County',
          divisions: div('county', ['Bomi', 'Bong', 'Gbarpolu', 'Grand Bassa', 'Grand Cape Mount', 'Grand Gedeh', 'Grand Kru', 'Lofa', 'Margibi', 'Maryland', 'Montserrado', 'Nimba', 'River Cess', 'River Gee', 'Sinoe']),
     },
     {
          name: 'Mali', iso2: 'ML', iso3: 'MLI', capital: 'Bamako', currency: XOF,
          languages: ['fr'], officialLanguage: 'fr', timezone: 'Africa/Bamako',
          phone: { callingCode: '+223', trunkPrefix: null, nationalNumberLength: { min: 8, max: 8 }, mobilePrefixExamples: ['6', '7'], internationalExample: '+223 65 01 23 45' },
          divisionLabel: 'Region',
          divisions: [...div('region', ['Gao', 'Kayes', 'Kidal', 'Koulikoro', 'Ménaka', 'Mopti', 'Ségou', 'Sikasso', 'Taoudénit', 'Tombouctou']), ...div('district', ['Bamako'])],
     },
     {
          name: 'Mauritania', iso2: 'MR', iso3: 'MRT', capital: 'Nouakchott', currency: { code: 'MRU', symbol: 'UM', name: 'Mauritanian ouguiya' },
          languages: ['ar', 'fr'], officialLanguage: 'ar', timezone: 'Africa/Nouakchott',
          phone: { callingCode: '+222', trunkPrefix: null, nationalNumberLength: { min: 8, max: 8 }, mobilePrefixExamples: ['2', '3', '4'], internationalExample: '+222 22 12 34 56' },
          divisionLabel: 'Wilaya',
          divisions: div('wilaya', ['Adrar', 'Assaba', 'Brakna', 'Dakhlet Nouadhibou', 'Gorgol', 'Guidimaka', 'Hodh Ech Chargui', 'Hodh El Gharbi', 'Inchiri', 'Nouakchott-Nord', 'Nouakchott-Ouest', 'Nouakchott-Sud', 'Tagant', 'Tiris Zemmour', 'Trarza']),
     },
     {
          name: 'Niger', iso2: 'NE', iso3: 'NER', capital: 'Niamey', currency: XOF,
          languages: ['fr'], officialLanguage: 'fr', timezone: 'Africa/Niamey',
          phone: { callingCode: '+227', trunkPrefix: null, nationalNumberLength: { min: 8, max: 8 }, mobilePrefixExamples: ['9'], internationalExample: '+227 93 12 34 56' },
          divisionLabel: 'Region',
          divisions: [...div('region', ['Agadez', 'Diffa', 'Dosso', 'Maradi', 'Tahoua', 'Tillabéri', 'Zinder']), ...div('district', ['Niamey (Capital District)'])],
     },
     {
          name: 'Nigeria', iso2: 'NG', iso3: 'NGA', capital: 'Abuja', currency: { code: 'NGN', symbol: '₦', name: 'Nigerian naira' },
          languages: ['en'], officialLanguage: 'en', timezone: 'Africa/Lagos',
          phone: { callingCode: '+234', trunkPrefix: '0', nationalNumberLength: { min: 10, max: 10 }, mobilePrefixExamples: ['070', '080', '081', '090', '091'], internationalExample: '+234 802 123 4567' },
          divisionLabel: 'State',
          divisions: [
               ...div('state', ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara']),
               ...div('territory', ['Federal Capital Territory (Abuja)']),
          ],
     },
     {
          name: 'Senegal', iso2: 'SN', iso3: 'SEN', capital: 'Dakar', currency: XOF,
          languages: ['fr'], officialLanguage: 'fr', timezone: 'Africa/Dakar',
          phone: { callingCode: '+221', trunkPrefix: null, nationalNumberLength: { min: 9, max: 9 }, mobilePrefixExamples: ['7'], internationalExample: '+221 77 123 45 67' },
          divisionLabel: 'Region',
          divisions: div('region', ['Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou', 'Kolda', 'Louga', 'Matam', 'Saint-Louis', 'Sédhiou', 'Tambacounda', 'Thiès', 'Ziguinchor']),
     },
     {
          name: 'Sierra Leone', iso2: 'SL', iso3: 'SLE', capital: 'Freetown', currency: { code: 'SLE', symbol: 'Le', name: 'Sierra Leonean leone' },
          languages: ['en'], officialLanguage: 'en', timezone: 'Africa/Freetown',
          phone: { callingCode: '+232', trunkPrefix: '0', nationalNumberLength: { min: 8, max: 8 }, mobilePrefixExamples: ['25', '30', '33', '34', '40', '44', '50', '55', '76', '77', '78', '79', '88'], internationalExample: '+232 76 123456' },
          divisionLabel: 'Province',
          divisions: [...div('province', ['Eastern', 'North West', 'Northern', 'Southern']), ...div('territory', ['Western Area'])],
     },
     {
          name: 'Togo', iso2: 'TG', iso3: 'TGO', capital: 'Lomé', currency: XOF,
          languages: ['fr'], officialLanguage: 'fr', timezone: 'Africa/Lome',
          phone: { callingCode: '+228', trunkPrefix: null, nationalNumberLength: { min: 8, max: 8 }, mobilePrefixExamples: ['9', '7'], internationalExample: '+228 90 12 34 56' },
          divisionLabel: 'Region',
          divisions: div('region', ['Centrale', 'Kara', 'Maritime', 'Plateaux', 'Savanes']),
     },
];
