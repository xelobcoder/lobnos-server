export interface SupplierRecord {
  name: string;
  address: string;
  email: string;
  contactperson: string;
  region: string;
  phonenumber: number;
  supplierid?: number;
}

export interface CommodityRecord {
  name: string;
  category: string;
}

export interface ApiResponse {
  message: string;
  statusCode: number;
  status: string;
}

export interface ApplicationSettings {
  emailNotification: number;
}
