type AgeCategory = {
     maxAge: number;
     minAge: number;
     specifier: string;
};

type AgeVariationLimitsConfig = {
     adults?: AgeCategory;
     children?: AgeCategory;
     neonates?: AgeCategory;
};

export type AgeGroup = "neonate" | "child" | "adult";

export type DemographicLimitRule = {
     plan?: string;
     reference_mode?: string | null;
     upperlimit?: string | null;
     lowerlimit?: string | null;
     upperLimitFemale?: string | null;
     lowerLimitFemale?: string | null;
     upperLimitMale?: string | null;
     lowerLimitMale?: string | null;
     upperLimitChildren?: string | null;
     lowerLimitChildren?: string | null;
     upperLimitNeonates?: string | null;
     lowerLimitNeonates?: string | null;
};

function hasContent(value?: string | null): boolean {
     return value !== undefined && value !== null && value.toString().trim() !== "";
}

function parseAgeVariationLimits(ageVariationLimits?: string | null): AgeVariationLimitsConfig | null {
     if (!ageVariationLimits) return null;
     try {
          const parsed = typeof ageVariationLimits === "string" ? JSON.parse(ageVariationLimits) : ageVariationLimits;
          return parsed as AgeVariationLimitsConfig;
     } catch {
          return null;
     }
}

function convertAgeToDays(age: number, specifier: string): number {
     switch ((specifier || "").toLowerCase().trim()) {
          case "day":
          case "days":
               return age;
          case "month":
          case "months":
               return age * 30;
          case "year":
          case "years":
               return age * 365;
          default:
               return NaN;
     }
}

function ageFallsInCategory(ageDays: number, category: AgeCategory): boolean {
     const minDays = convertAgeToDays(category.minAge, category.specifier);
     const maxDays = convertAgeToDays(category.maxAge, category.specifier);
     return Number.isFinite(minDays) && Number.isFinite(maxDays) && ageDays >= minDays && ageDays <= maxDays;
}

export function getAgeGroup(age?: number | string, ageType?: string, ageVariationLimits?: string | null): AgeGroup {
     const parsedAge = Number(age);
     const normalizedType = (ageType || "").toLowerCase().trim();
     const config = parseAgeVariationLimits(ageVariationLimits);

     if (config && Number.isFinite(parsedAge)) {
          const ageDays = convertAgeToDays(parsedAge, normalizedType);
          if (Number.isFinite(ageDays)) {
               if (config.neonates && ageFallsInCategory(ageDays, config.neonates)) return "neonate";
               if (config.children && ageFallsInCategory(ageDays, config.children)) return "child";
               if (config.adults && ageFallsInCategory(ageDays, config.adults)) return "adult";
          }
     }

     if (!Number.isFinite(parsedAge)) return "adult";

     if ((normalizedType === "day" || normalizedType === "days") && parsedAge <= 28) {
          return "neonate";
     }

     if (
          normalizedType === "day" || normalizedType === "days" ||
          normalizedType === "month" || normalizedType === "months" ||
          ((normalizedType === "year" || normalizedType === "years") && parsedAge < 18)
     ) {
          return "child";
     }

     return "adult";
}

export function applyDemographicLimits<T extends DemographicLimitRule>(rule: T, gender: string, ageGroup: AgeGroup): T {
     if (rule.plan !== "limits") return rule;
     if (rule.reference_mode && rule.reference_mode !== 'demographic') return rule;
     if (rule.reference_mode === 'demographic' && ageGroup !== 'adult') {
          const lower = ageGroup === 'neonate' ? rule.lowerLimitNeonates : rule.lowerLimitChildren;
          const upper = ageGroup === 'neonate' ? rule.upperLimitNeonates : rule.upperLimitChildren;
          return {...rule, ...(hasContent(lower) ? {lowerlimit:lower} : {}), ...(hasContent(upper) ? {upperlimit:upper} : {})} as T;
     }
     const normalizedGender = (gender || "").toLowerCase().trim();
     const normalizedRule = { ...rule };

     if (normalizedGender === "female") {
          if (hasContent(rule.upperLimitFemale)) normalizedRule.upperlimit = rule.upperLimitFemale;
          if (hasContent(rule.lowerLimitFemale)) normalizedRule.lowerlimit = rule.lowerLimitFemale;
          return normalizedRule as T;
     }

     if (normalizedGender === "male") {
          if (ageGroup === "neonate") {
               if (hasContent(rule.upperLimitNeonates)) normalizedRule.upperlimit = rule.upperLimitNeonates;
               if (hasContent(rule.lowerLimitNeonates)) normalizedRule.lowerlimit = rule.lowerLimitNeonates;
               return normalizedRule as T;
          }

          if (ageGroup === "child") {
               if (hasContent(rule.upperLimitChildren)) normalizedRule.upperlimit = rule.upperLimitChildren;
               if (hasContent(rule.lowerLimitChildren)) normalizedRule.lowerlimit = rule.lowerLimitChildren;
               return normalizedRule as T;
          }

          if (hasContent(rule.upperLimitMale)) normalizedRule.upperlimit = rule.upperLimitMale;
          if (hasContent(rule.lowerLimitMale)) normalizedRule.lowerlimit = rule.lowerLimitMale;
     }

     return normalizedRule as T;
}