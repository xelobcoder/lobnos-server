import { PrimeSmsCategoryMappingsRepo } from '../repositories/PrimeSmsCategoryMappingsRepo';
import { CreateSmsCategoryMappingDto } from '../dtos/CreateSmsCategoryMappingDto';

function mapCategoryMappingDtoToDb(dto: any) {
     return {
          category: dto.category,
          tablename: dto.tableName,
          idcolumn: dto.idColumn,
          phonecolumn: dto.phoneColumn,
          namecolumn: dto.nameColumn,
          additionalfields: dto.additionalFields,
     };
}

export class SmsCategoryMappingsService {
     constructor(private mappingsRepo: PrimeSmsCategoryMappingsRepo) { }

     async createMapping(dto: CreateSmsCategoryMappingDto) {
          return this.mappingsRepo.create(mapCategoryMappingDtoToDb(dto));
     }

     async getMappingById(id: number) {
          return this.mappingsRepo.findById(id);
     }

     async updateMapping(id: number, dto: Partial<CreateSmsCategoryMappingDto>) {
          return this.mappingsRepo.update(id, mapCategoryMappingDtoToDb(dto));
     }

     async deleteMapping(id: number) {
          return this.mappingsRepo.delete(id);
     }

     async getAllMappings() {
          return this.mappingsRepo.findAll();
     }
}
