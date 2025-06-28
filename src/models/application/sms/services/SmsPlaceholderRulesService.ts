import { PrimeSmsPlaceholderRulesRepo } from '../repositories/PrimeSmsPlaceholderRulesRepo';
import { CreateSmsPlaceholderRuleDto } from '../dtos/CreateSmsPlaceholderRuleDto';

function mapPlaceholderRuleDtoToDb(dto: any) {
     return {
          category: dto.category,
          placeholder: dto.placeholder,
          columnname: dto.columnName,
          tablename: dto.tableName,
          description: dto.description,
     };
}

export class SmsPlaceholderRulesService {
     constructor(private rulesRepo: PrimeSmsPlaceholderRulesRepo) { }

     async createRule(dto: CreateSmsPlaceholderRuleDto) {
          return this.rulesRepo.create(mapPlaceholderRuleDtoToDb(dto));
     }

     async getRuleById(id: number) {
          return this.rulesRepo.findById(id);
     }

     async updateRule(id: number, dto: Partial<CreateSmsPlaceholderRuleDto>) {
          return this.rulesRepo.update(id, mapPlaceholderRuleDtoToDb(dto));
     }

     async deleteRule(id: number) {
          return this.rulesRepo.delete(id);
     }

     async getAllRules() {
          return this.rulesRepo.findAll();
     }
}
